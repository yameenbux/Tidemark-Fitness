// Medication companion (e.g. a weekly GLP-1 injection): when the next dose is due, marking doses as taken, and how the
// trend moved on each dose level. Tidemark records what you tell it; it never suggests doses or changes.
import { addDays, dateKey, daysBetween, parseKey, startOfDay, validKey } from './dates';
import type { TrendPoint } from './trend';
import type { DoseLog, EffectId, EffectLog, Medication, SiteId } from './types';
import { numOrNull } from './units';

export const MAX_DOSE_MG = 1000;

export function cleanMedication(v: unknown): Medication | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  const name = typeof m.name === 'string' ? m.name.trim().slice(0, 40) : '';
  if (!name) return null;
  const mg = numOrNull(m.doseMg);
  const weekday = Number.isInteger(m.weekday) && (m.weekday as number) >= 0 && (m.weekday as number) <= 6 ? (m.weekday as number) : 1;
  const every = m.every === 'day' ? 'day' : 'week';
  // Weekly medicines are injections unless said otherwise (the GLP-1s); daily ones are tablets unless said otherwise
  const injected = typeof m.injected === 'boolean' ? m.injected : every === 'week';
  const day = (x: unknown) => (validKey(x) ? x : null);
  return { name, doseMg: mg != null && mg > 0 && mg <= MAX_DOSE_MG ? Math.round(mg * 1000) / 1000 : null, every, weekday, remind: m.remind === true, injected,
    appointment: day(m.appointment), stoppedOn: day(m.stoppedOn) };
}

export function cleanDoses(v: unknown): DoseLog {
  const out: DoseLog = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(v).slice(0, 5000)) {
    if (!validKey(k)) continue;
    const e = (v as Record<string, { mg?: unknown; site?: unknown }>)[k];
    const mg = numOrNull(e?.mg);
    const site = SITES.some(x => x.id === e?.site) ? (e!.site as SiteId) : undefined;
    out[k] = { mg: mg != null && mg > 0 && mg <= MAX_DOSE_MG ? mg : null, ...(site ? { site } : {}) };
  }
  return out;
}

/** Is a dose scheduled on this day? */
export function isDoseDay(med: Medication, d: Date): boolean {
  return med.every === 'day' || d.getDay() === med.weekday;
}

// A weekly dose day counts as covered when a dose was logged in the 3 days before it (taken late, or the dose day was
// moved), so Tidemark never prompts a second weekly dose within a few days of the last one. Not dosing advice: the
// card always says when the last dose was, and the person follows their prescriber.
export const COVER_DAYS = 3;

/** The most recent logged dose on or before `day`, or null. */
export function lastDose(doses: DoseLog, day: Date = new Date()): string | null {
  const k = dateKey(day);
  let best: string | null = null;
  for (const d of Object.keys(doses)) if (d <= k && (!best || d > best)) best = d;
  return best;
}

/** Is a dose still to take on this day: scheduled, not marked, and (weekly) not covered by a recent dose. */
export function isDue(med: Medication, doses: DoseLog, d: Date): boolean {
  if (!isDoseDay(med, d) || doses[dateKey(d)]) return false;
  if (med.every === 'day') return true;
  for (let i = 1; i <= COVER_DAYS; i++) if (doses[dateKey(addDays(d, -i))]) return false;
  return true;
}

/** The next dose still to take, from today on (today if it's due). */
export function nextDose(med: Medication, doses: DoseLog, today: Date = new Date()): Date {
  // A weekly dose can be covered for up to COVER_DAYS, so its next one can be up to 7 + COVER_DAYS days away
  for (let i = 0; i <= 7 + COVER_DAYS + 1; i++) {
    const d = addDays(startOfDay(today), i);
    if (isDue(med, doses, d)) return d;
  }
  return addDays(startOfDay(today), 7);
}

/**
 * A weekly dose day in the last 6 days with no dose logged around it (from COVER_DAYS before it up to today): it was
 * missed, or taken and not marked. Daily medicines don't get this (a missed daily dose is just the next day).
 */
export function missedDose(med: Medication, doses: DoseLog, today: Date = new Date()): Date | null {
  if (med.every !== 'week') return null;
  for (let i = 1; i <= 6; i++) {
    const d = addDays(startOfDay(today), -i);
    if (!isDoseDay(med, d)) continue;
    for (let j = -COVER_DAYS; j <= i; j++) if (doses[dateKey(addDays(d, j))]) return null;
    return d;
  }
  return null;
}

/** Days to show in the dose history: every scheduled day and every logged day, newest first, over `weeks`. */
export function doseHistoryDays(med: Medication, doses: DoseLog, today: Date = new Date(), weeks = 8): string[] {
  const out: string[] = [];
  const span = med.every === 'week' ? weeks * 7 : 14;
  for (let i = 0; i < span; i++) {
    const d = addDays(startOfDay(today), -i), k = dateKey(d);
    // After the day they stopped, only doses actually logged: an unmarked day then isn't a missed dose
    if ((isDoseDay(med, d) && !(med.stoppedOn && k > med.stoppedOn)) || doses[k]) out.push(k);
  }
  return out;
}

/** Days scheduled for a reminder over the next `days` (doses already marked today are skipped). */
export function doseReminderDays(med: Medication | null | undefined, doses: DoseLog, today: Date = new Date(), days = 8): Date[] {
  if (!med || med.stoppedOn) return [];   // stopped: no more dose reminders
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(startOfDay(today), i);
    if (isDue(med, doses, d)) out.push(d);
  }
  return out;
}

export interface DosePeriod { mg: number | null; from: string; to: string; doses: number; trendChange: number | null; weeks: number }

/**
 * Groups taken doses into runs at the same strength (in order), with how the trend moved during each run.
 * This is the question people on a GLP-1 ask most: what happened at each dose?
 */
export function dosePeriods(doses: DoseLog, series: TrendPoint[]): DosePeriod[] {
  const days = Object.keys(doses).sort();
  const runs: DosePeriod[] = [];
  for (const k of days) {
    const mg = doses[k].mg, last = runs[runs.length - 1];
    if (last && last.mg === mg) { last.to = k; last.doses++; }
    else runs.push({ mg, from: k, to: k, doses: 1, trendChange: null, weeks: 0 });
  }
  const trendOn = (k: string) => {
    let v: number | null = null;
    for (const p of series) { if (p.k <= k) v = p.trend; else break; }
    return v;
  };
  runs.forEach((r, i) => {
    const end = i + 1 < runs.length ? runs[i + 1].from : dateKey(new Date());
    const a = trendOn(r.from), b = trendOn(end);
    r.trendChange = a != null && b != null && b !== a ? b - a : null;
    r.weeks = Math.max(0, Math.round(daysBetween(parseKey(r.from), parseKey(end)) / 7));
  });
  return runs;
}

// ---- injection sites (Plus) ----
// Rotating sites gives each spot time to recover. Tidemark only remembers where the last ones went; it suggests the
// spot used longest ago, and the person can always pick another.
export const SITES: { id: SiteId; label: string; short: string }[] = [
  { id: 'belly-l', label: 'Belly, left', short: 'Belly L' }, { id: 'belly-r', label: 'Belly, right', short: 'Belly R' },
  { id: 'thigh-l', label: 'Thigh, left', short: 'Thigh L' }, { id: 'thigh-r', label: 'Thigh, right', short: 'Thigh R' },
  { id: 'arm-l', label: 'Upper arm, left', short: 'Arm L' }, { id: 'arm-r', label: 'Upper arm, right', short: 'Arm R' },
];
export const siteLabel = (id: SiteId) => SITES.find(x => x.id === id)!.label;

/** The site used longest ago (never-used sites first, in the list's order). */
export function suggestSite(doses: DoseLog): SiteId {
  const last: Partial<Record<SiteId, string>> = {};
  for (const k of Object.keys(doses)) { const s = doses[k].site; if (s && (!last[s] || k > last[s]!)) last[s] = k; }
  return SITES.map(x => x.id).reduce((best, id) => (!last[id] ? (last[best] ? id : best) : last[best] && last[id]! < last[best]! ? id : best));
}

// ---- side effects (Plus) ----
export const EFFECTS: { id: EffectId; label: string }[] = [
  { id: 'nausea', label: 'Nausea' }, { id: 'constipation', label: 'Constipation' }, { id: 'diarrhoea', label: 'Diarrhoea' },
  { id: 'heartburn', label: 'Heartburn' }, { id: 'tired', label: 'Tiredness' }, { id: 'headache', label: 'Headache' },
  { id: 'noAppetite', label: 'No appetite' }, { id: 'site', label: 'Sore injection site' },
];
export const effectLabel = (id: EffectId) => EFFECTS.find(x => x.id === id)!.label;
export const SEVERITY = ['Mild', 'Moderate', 'Severe'] as const;

export function cleanEffects(v: unknown): EffectLog {
  const out: EffectLog = {};
  if (!v || typeof v !== 'object') return out;
  const ids = new Set<string>(EFFECTS.map(x => x.id));
  for (const k of Object.keys(v).slice(0, 5000)) {
    if (!validKey(k)) continue;
    const e = (v as Record<string, { effects?: unknown; severity?: unknown; text?: unknown }>)[k];
    const effects = Array.isArray(e?.effects) ? [...new Set(e!.effects.filter((x): x is EffectId => typeof x === 'string' && ids.has(x)))] : [];
    if (!effects.length) continue;
    const severity = e!.severity === 2 || e!.severity === 3 ? e!.severity : 1;
    const text = typeof e!.text === 'string' ? e!.text.replace(/\s+/g, ' ').trim().slice(0, 140) : '';
    out[k] = { effects, severity, ...(text ? { text } : {}) };
  }
  return out;
}

/** Days since the most recent dose on or before `day` (0 = dose day), or null with no dose before it. */
export function daysAfterDose(doses: DoseLog, day: string): number | null {
  const d = lastDose(doses, parseKey(day));
  return d ? daysBetween(parseKey(d), parseKey(day)) : null;
}

export interface EffectPattern { id: EffectId; total: number; byDay: number[] }   // byDay[0..6]: days after a dose
/**
 * Side effects against the dose cycle: for each effect, how often it was noted 0, 1, 2… 6 days after a dose.
 * "Nausea is mostly the day after" is a pattern worth taking to a prescriber; Tidemark says nothing about what to do.
 */
export function effectPatterns(effects: EffectLog, doses: DoseLog): EffectPattern[] {
  const by: Partial<Record<EffectId, EffectPattern>> = {};
  for (const k of Object.keys(effects)) {
    const n = daysAfterDose(doses, k);
    for (const id of effects[k].effects) {
      const p = by[id] ?? (by[id] = { id, total: 0, byDay: [0, 0, 0, 0, 0, 0, 0] });
      p.total++;
      if (n != null && n < 7) p.byDay[n]++;
    }
  }
  return Object.values(by).sort((a, b) => b.total - a.total) as EffectPattern[];
}
