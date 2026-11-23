// When the free version mentions Tidemark Plus, beyond the offer after setup and the feature it's tapped on. Plain
// logic only, so it's testable. The idea is to ask at moments that matter for the person's own progress, and never
// at a bad one: at most one card, at most once a week, never in the first days, never after a weight gain or a side
// effect, and never twice for the same occasion. Every card describes; none of them advises (see COMPLIANCE.md).
import { addDays, dateKey, daysBetween, parseKey, startOfDay } from './dates';
import { dosePeriods } from './medication';
import { direction } from './plan';
import type { TrendPoint } from './trend';
import type { DoseLog, EffectLog, PhotoLog, Settings, Weights } from './types';

export type NudgeKind = 'appointment' | 'newDose' | 'stopped' | 'flat' | 'report' | 'photos';
export interface PlusNudge { kind: NudgeKind; key: string; mg?: number | null; date?: string }

/** What was last shown, so a card stays put for its day and the next one waits. */
export interface NudgeMemory { at: string | null; kind: NudgeKind | null; key: string | null; dismissed: boolean }
export const NO_NUDGE: NudgeMemory = { at: null, kind: null, key: null, dismissed: false };
const KINDS: NudgeKind[] = ['appointment', 'newDose', 'stopped', 'flat', 'report', 'photos'];
export const APPOINTMENT_DAYS = 3;   // how far ahead of an appointment the report is offered

export const NUDGE_GAP_DAYS = 7;     // between cards
export const SETTLE_DAYS = 3;        // after setup: Plus was just offered
export const FLAT_DAYS = 21;         // a stretch this long…
export const FLAT_KG = 0.3;          // …with the trend moving less than this, either way…
export const FLAT_WEIGH_INS = 10;    // …and enough weigh-ins in it to be sure
export const GAIN_KG = 0.2;          // a weigh-in this much above the one before: not the moment

export function cleanNudgeMemory(v: unknown): NudgeMemory {
  if (!v || typeof v !== 'object') return NO_NUDGE;
  const o = v as Record<string, unknown>;
  const at = typeof o.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.at) ? o.at : null;
  const kind = KINDS.includes(o.kind as NudgeKind) ? o.kind as NudgeKind : null;
  return { at, kind, key: typeof o.key === 'string' && o.key.length < 40 ? o.key : null, dismissed: o.dismissed === true };
}

export interface NudgeInput {
  settings: Settings; weights: Weights; series: TrendPoint[]; doses: DoseLog; effects: EffectLog; photos: PhotoLog;
  sampleReportUsed: boolean; memory: NudgeMemory; today?: Date;
}

/** Not now: the latest weigh-in, in the last two days, went up; or a side effect was noted today or yesterday. */
function badMoment({ weights, effects }: NudgeInput, today: Date): boolean {
  const keys = Object.keys(weights).sort();
  const last = keys[keys.length - 1], prev = keys[keys.length - 2];
  if (last && prev && daysBetween(parseKey(last), today) <= 1 && weights[last] > weights[prev] + GAIN_KG) return true;
  return [0, 1].some(n => effects[dateKey(addDays(today, -n))] != null);
}

/** The trend over the last FLAT_DAYS, if there are enough weigh-ins to judge it; null otherwise. */
function recentChange(series: TrendPoint[], weights: Weights, today: Date): number | null {
  const from = addDays(today, -FLAT_DAYS);
  const inWindow = Object.keys(weights).filter(k => parseKey(k) >= from && parseKey(k) <= today).length;
  const pts = series.filter(p => p.d >= from && p.d <= today);
  if (inWindow < FLAT_WEIGH_INS || pts.length < 2 || daysBetween(pts[0].d, pts[pts.length - 1].d) < FLAT_DAYS - 4) return null;
  return pts[pts.length - 1].trend - pts[0].trend;
}

/** The candidates in order of how much the moment matters; the caller shows the first. */
function candidates(i: NudgeInput, today: Date): PlusNudge[] {
  const out: PlusNudge[] = [], med = i.settings.medication, m = i.memory;
  const recent = (kind: NudgeKind, days: number) => m.kind === kind && m.at != null && daysBetween(parseKey(m.at), today) < days;
  if (med && med.stoppedOn && daysBetween(parseKey(med.stoppedOn), today) <= 14 && m.key !== `stop:${med.stoppedOn}`)
    out.push({ kind: 'stopped', key: `stop:${med.stoppedOn}`, date: med.stoppedOn });
  if (med && !med.stoppedOn) {
    // A new strength in the last two weeks: the question is how the trend moves on it
    const runs = dosePeriods(i.doses, i.series);
    const last = runs[runs.length - 1], prev = runs[runs.length - 2];
    if (last && prev && last.mg !== prev.mg && daysBetween(parseKey(last.from), today) <= 14 && m.key !== `dose:${last.from}`)
      out.push({ kind: 'newDose', key: `dose:${last.from}`, mg: last.mg });
  }
  if (direction(i.settings.plan) !== 'maintain' && !recent('flat', 28)) {
    const change = recentChange(i.series, i.weights, today);
    if (change != null && Math.abs(change) < FLAT_KG) out.push({ kind: 'flat', key: `flat:${dateKey(today)}` });
  }
  if (med && Object.keys(i.doses).length >= 4 && !i.sampleReportUsed && m.kind !== 'report') out.push({ kind: 'report', key: 'report' });
  if (Object.keys(i.weights).length >= 14 && Object.keys(i.photos).length === 0 && m.kind !== 'photos') out.push({ kind: 'photos', key: 'photos' });
  return out;
}

/**
 * An appointment or reorder the person set is coming up: the dated need for a report, so it doesn't wait its turn.
 * Exported for Plus users too, for whom the same card is a reminder rather than an offer.
 */
export function appointmentSoon(i: Pick<NudgeInput, 'settings' | 'memory'>, today: Date): PlusNudge | null {
  const at = i.settings.medication?.appointment;
  // Shown each day until it's closed or the day has passed
  if (!at || i.settings.medication?.stoppedOn || (i.memory.key === `appt:${at}` && i.memory.dismissed)) return null;
  const days = daysBetween(today, parseKey(at));
  return days >= 0 && days <= APPOINTMENT_DAYS ? { kind: 'appointment', key: `appt:${at}`, date: at } : null;
}

/** The one Plus card to show on Today, or none. Call only for someone without Plus. */
export function pickPlusNudge(i: NudgeInput): PlusNudge | null {
  const today = startOfDay(i.today ?? new Date()), m = i.memory;
  if (badMoment(i, today)) return null;
  // Today's card stays today's card, unless it was closed or its moment has passed
  if (m.at === dateKey(today)) {
    if (m.dismissed || !m.kind) return null;
    const fresh = { ...i, memory: { ...m, kind: null, key: null } };
    return [appointmentSoon(fresh, today), ...candidates(fresh, today)].find(c => c?.kind === m.kind) ?? null;
  }
  const appt = appointmentSoon(i, today);
  if (appt) return appt;
  if (m.at && daysBetween(parseKey(m.at), today) < NUDGE_GAP_DAYS) return null;
  if (daysBetween(parseKey(i.settings.plan.start), today) < SETTLE_DAYS) return null;
  return candidates(i, today)[0] ?? null;
}
