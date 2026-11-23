import { habitIcon } from './habitIcons';
import { cleanMedication } from './medication';
import { cleanProteinSetting } from './protein';
import { addDays, dateKey, daysBetween, parseKey, startOfDay, validKey, WEEK_MS } from './dates';
import { numOrNull, plausible, round2 } from './units';
import type { Habit, HabitLog, Macros, Plan, PlanBreak, Session, Settings, Weights } from './types';

export const MAX_HABITS = 6;
export const DEFAULT_HABITS: Habit[] = [
  { id: 'water', icon: 'water', short: '3 L', name: 'Water 3 L' },
  { id: 'steps', icon: 'steps', short: '8K', name: 'Steps 8k' },
  { id: 'workout', icon: 'dumbbell', short: 'WORK', name: 'Workout' },
];

export function emptySessions(): Record<number, Session> {
  const s: Record<number, Session> = {};
  for (let d = 0; d < 7; d++) s[d] = { title: '', items: [], note: '' };
  return s;
}
const emptyMacros = (): Macros => ({ kcal: null, p: null, c: null, f: null });

/** Habits offered during setup. None are picked for you: only what someone chooses shows up. */
export const SUGGESTED_HABITS: Habit[] = [
  { id: 'water', icon: 'water', short: 'WATER', name: 'Water 2–3 L' },
  { id: 'steps', icon: 'steps', short: 'STEPS', name: 'Steps 8k' },
  { id: 'workout', icon: 'dumbbell', short: 'TRAIN', name: 'Workout' },
  { id: 'protein', icon: 'meal', short: 'PROT', name: 'Protein at each meal' },
  { id: 'sleep', icon: 'moon', short: 'SLEEP', name: 'Sleep 7 h' },
  { id: 'veg', icon: 'leaf', short: 'VEG', name: '5 portions of veg' },
  { id: 'noalcohol', icon: 'noAlcohol', short: 'DRY', name: 'No alcohol' },
  { id: 'stretch', icon: 'stretch', short: 'MOVE', name: 'Stretch or mobility' },
];

/**
 * Suggested habits with an amount (steps, water, sleep, veg): the amount is a choice, not a fixed number. The habit's
 * name carries it ("Steps 10k"), so a name typed by hand still works and nothing else in the data changes.
 */
export const HABIT_AMOUNTS: Record<string, { question: string; options: string[]; name: (v: string) => string }> = {
  steps: { question: 'Steps a day', options: ['5k', '6k', '7k', '8k', '10k', '12k', '15k'], name: v => `Steps ${v}` },
  water: { question: 'Water a day', options: ['1.5 L', '2 L', '2–3 L', '3 L'], name: v => `Water ${v}` },
  sleep: { question: 'Hours of sleep', options: ['6 h', '7 h', '8 h', '9 h'], name: v => `Sleep ${v}` },
  veg: { question: 'Portions of veg', options: ['3', '5', '7'], name: v => `${v} portions of veg` },
};

/** The amount a habit's name currently says, if it's one of the choices (null for a name typed by hand). */
export function habitAmount(h: Habit): string | null {
  const spec = HABIT_AMOUNTS[h.id];
  return spec?.options.find(o => spec.name(o) === h.name) ?? null;
}

/** The habit set to a different amount. */
export function withHabitAmount(h: Habit, amount: string): Habit {
  const spec = HABIT_AMOUNTS[h.id];
  return spec && spec.options.includes(amount) ? { ...h, name: spec.name(amount) } : h;
}

export function defaultSettings(plan: Plan, habits: Habit[] = []): Settings {
  return { plan, event: null, habits: habits.slice(0, MAX_HABITS).map(h => ({ ...h })), sessions: emptySessions(),
           meals: { items: [], target: emptyMacros() } };
}

function weeksBetween(start: string, goal: string): number {
  return Math.round(daysBetween(parseKey(start), parseKey(goal)) / 7);
}

export const MAX_BREAK_WEEKS = 8;

/** True if the week ending at index i (the step from week i-1 to week i) falls inside a planned break. */
export function isBreakStep(start: string, breaks: PlanBreak[], i: number): boolean {
  if (i < 1) return false;
  const stepStart = addDays(parseKey(start), (i - 1) * 7).getTime();
  return breaks.some(b => {
    const from = parseKey(b.start).getTime();
    return stepStart >= from && stepStart < addDays(parseKey(b.start), b.weeks * 7).getTime();
  });
}
/** Weeks in which weight is meant to come down (total weeks minus break weeks). */
export function lossWeeks(start: string, goalDate: string, breaks: PlanBreak[] = []): number {
  const weeks = weeksBetween(start, goalDate);
  let n = 0;
  for (let i = 1; i <= weeks; i++) if (!isBreakStep(start, breaks, i)) n++;
  return n;
}

/**
 * Target line, one point per week, rounded to 0.1 kg: a straight line from start to goal,
 * held flat during planned breaks. With `from`, weeks before `from.index` are kept as given
 * and the line restarts from `from.kg` (used when re-planning part-way through).
 */
export function buildTargets(startKg: number, goalKg: number, start: string, goalDate: string,
                             breaks: PlanBreak[] = [], from?: { index: number; kg: number; prefix: number[] }): number[] {
  const weeks = Math.max(1, weeksBetween(start, goalDate));
  const i0 = from ? Math.min(from.index, weeks) : 0;
  const t: number[] = from ? from.prefix.slice(0, i0) : [];
  let v = from ? from.kg : startKg;
  t.push(Math.round(v * 10) / 10);
  let steps = 0;
  for (let i = i0 + 1; i <= weeks; i++) if (!isBreakStep(start, breaks, i)) steps++;
  const per = steps > 0 ? (v - goalKg) / steps : 0;
  for (let i = i0 + 1; i <= weeks; i++) {
    if (!isBreakStep(start, breaks, i)) v -= per;
    t.push(Math.round(v * 10) / 10);
  }
  return t;
}

// ---- goal direction ----
// A plan can lose, gain or hold weight. Everything that says "ahead", "behind", "good" or "to go" asks this.
export type Direction = 'lose' | 'gain' | 'maintain';
/** Goals within half a kilo of the start are maintenance. */
export function direction(p: { startKg: number; goalKg: number }): Direction {
  const d = p.goalKg - p.startKg;
  return Math.abs(d) < 0.5 ? 'maintain' : d > 0 ? 'gain' : 'lose';
}
/** +1 when the plan goes up, −1 when it goes down, 0 when it holds. */
export const sign = (dir: Direction) => (dir === 'gain' ? 1 : dir === 'lose' ? -1 : 0);
/** Weekly gain above this share of body weight is mostly fat, so it gets the same "slow down" note as fast loss. */
export const GAIN_WARN_PCT = 0.5;

export interface PlanDraft { startKg: number | null; goalKg: number | null; start: string; goalDate: string; breaks?: PlanBreak[] }
export type PlanAssessment =
  | { ok: false; error: string }
  | { ok: true; error?: undefined; weeks: number; perWeek: number; pct: number; warn: boolean };

/** Validates a proposed plan and describes its pace. Warns above ~1% of body weight a week. */
export function assessPlan(p: PlanDraft): PlanAssessment {
  if (!plausible(p.startKg)) return { ok: false, error: 'Enter your current weight.' };
  if (!plausible(p.goalKg)) return { ok: false, error: 'Enter a goal weight.' };
  if (!validKey(p.start) || !validKey(p.goalDate)) return { ok: false, error: 'Pick a start date and a goal date.' };
  const weeks = weeksBetween(p.start, p.goalDate);
  if (weeks < 2) return { ok: false, error: 'The goal date needs to be at least 2 weeks after the start.' };
  if (weeks > 156) return { ok: false, error: 'Keep the plan under 3 years — you can always start a new one after.' };
  const dir = direction({ startKg: p.startKg, goalKg: p.goalKg });
  if (dir === 'maintain') return { ok: true, weeks, perWeek: 0, pct: 0, warn: false };
  const moving = lossWeeks(p.start, p.goalDate, p.breaks);
  if (moving < 2) return { ok: false, error: 'The breaks leave less than 2 weeks to make progress. Move the goal date later.' };
  const perWeek = Math.abs(p.startKg - p.goalKg) / moving;   // pace in the weeks that aren't breaks
  const pct = perWeek / p.startKg * 100;
  return { ok: true, weeks, perWeek, pct, warn: pct > (dir === 'gain' ? GAIN_WARN_PCT : 1) };
}

export const MAX_PLAN_WEEKS = 520;   // the editor allows 156; re-plans can extend that, but never past ten years
/** A string from untrusted data, trimmed to a sane length (a 200,000-character habit name would freeze layout). */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);   // never usable as object keys for ticks
const str = (v: unknown, max: number): string => (v == null ? '' : String(v)).slice(0, max);
/** Smallest and largest without spreading (`Math.min(...a)` overflows the stack on very long arrays). */
export function extent(a: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return [lo, hi];
}

/** Fill in anything missing or malformed, so bad storage or a hand-edited backup can't break rendering. */
export function normalizeSettings(s: any): Settings | null {
  if (!s || typeof s !== 'object' || !s.plan) return null;
  const p = s.plan;
  const startKg = numOrNull(p.startKg), goalKg = numOrNull(p.goalKg);
  if (!validKey(p.start) || !validKey(p.goalDate) || !plausible(startKg) || !plausible(goalKg)) return null;
  // The same bounds the plan editor enforces (with room for re-plans), so a hand-made backup can't create a plan the
  // app can't draw. Targets must be exactly one per week; anything else is rebuilt from the plan.
  const weeks = weeksBetween(p.start, p.goalDate);
  if (weeks < 1 || weeks > MAX_PLAN_WEEKS) return null;
  let targets: number[] = Array.isArray(p.targets) ? p.targets : [];
  const breaks = cleanBreaks(p.breaks);
  if (targets.length !== weeks + 1 || !targets.every(plausible)) targets = buildTargets(startKg, goalKg, p.start, p.goalDate, breaks);
  const plan: Plan = { start: p.start, startKg, goalKg, goalDate: p.goalDate, targets: [...targets], breaks };
  if (validKey(p.since) && p.since < p.start) plan.since = p.since;
  const hold = numOrNull(p.holdKg);
  if (hold != null && hold >= MIN_HOLD_KG && hold <= MAX_HOLD_KG) plan.holdKg = Math.round(hold * 10) / 10;

  const ev = s.event && s.event.name && validKey(s.event.date)
    ? { name: str(s.event.name, 60), date: s.event.date, detail: str(s.event.detail, 120) } : null;

  const seen: Record<string, boolean> = {};
  const habits: Habit[] = (Array.isArray(s.habits) ? s.habits : DEFAULT_HABITS)
    .filter((h: any) => { const id = h && h.id ? str(h.id, 40) : '';
      return id && !RESERVED.has(id) && !Object.prototype.hasOwnProperty.call(seen, id) && (seen[id] = true); })
    .slice(0, MAX_HABITS)
    .map((h: any) => ({ id: str(h.id, 40), icon: habitIcon(h.icon, str(h.name, 40)), short: str(h.short, 5),
                        name: str(h.name || h.short, 40) || 'Habit' }));

  const sessions = emptySessions();
  for (let d = 0; d < 7; d++) {
    const x = s.sessions && s.sessions[d];
    if (x) sessions[d] = { title: str(x.title, 60), items: Array.isArray(x.items) ? x.items.slice(0, 40).map((i: unknown) => str(i, 120)) : [], note: str(x.note, 500) };
  }

  const m = s.meals || {};
  const mt = m.target || {};
  const meals = {
    items: (Array.isArray(m.items) ? m.items : []).filter((x: any) => x && (x.text || x.when)).slice(0, 20).map((x: any) => ({
      when: str(x.when, 40), text: str(x.text, 200),
      kcal: numOrNull(x.kcal), p: numOrNull(x.p), c: numOrNull(x.c), f: numOrNull(x.f) })),
    target: { kcal: numOrNull(mt.kcal), p: numOrNull(mt.p), c: numOrNull(mt.c), f: numOrNull(mt.f) },
  };
  const protein = cleanProteinSetting(s.protein);
  return { plan, event: ev, habits, sessions, meals, trackCalories: s.trackCalories === true, medication: cleanMedication(s.medication), ...(protein ? { protein } : {}) };
}

export function cleanWeights(obj: unknown): Weights {
  const out: Weights = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = numOrNull((obj as any)[k]);
      if (validKey(k) && plausible(v)) out[k] = round2(v);
    }
  }
  return out;
}

export function cleanHabits(obj: unknown): HabitLog {
  const out: HabitLog = {};
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const h = (obj as any)[k];
      if (!validKey(k) || !h || typeof h !== 'object') continue;
      const day: Record<string, true> = {};
      for (const id of Object.keys(h)) if (h[id] === true) day[id] = true;
      if (Object.keys(day).length) out[k] = day;
    }
  }
  return out;
}

/** Old weekly weigh-ins were keyed by week number; place them on that week's date. Existing date entries win. */
export function mergeLegacyActuals(actuals: unknown, into: Weights, start: string): Weights {
  if (!actuals || typeof actuals !== 'object') return into;
  for (const wk of Object.keys(actuals)) {
    const v = numOrNull((actuals as any)[wk]);
    const i = parseInt(wk, 10) - 1;
    if (!plausible(v) || !(i >= 0)) continue;
    const k = dateKey(addDays(parseKey(start), i * 7));
    if (into[k] == null) into[k] = round2(v);
  }
  return into;
}

// ---- reading the plan ----
export function weekDate(plan: Plan, i: number): Date { return addDays(parseKey(plan.start), i * 7); }
/** Fractional weeks since the plan started, for placing a date on the chart. */
export function weekFraction(plan: Plan, d: Date): number { return daysBetween(parseKey(plan.start), d) / 7; }

/** Target for any day, interpolated between weekly points and held flat outside the plan. */
export function targetAt(plan: Plan, d: Date): number {
  const f = Math.max(0, Math.min(plan.targets.length - 1, weekFraction(plan, d)));
  const i = Math.floor(f), j = Math.min(plan.targets.length - 1, i + 1);
  return plan.targets[i] + (plan.targets[j] - plan.targets[i]) * (f - i);
}

export interface WeightPoint { k: string; d: Date; kg: number }
/** Logged weights from the plan's start onwards, oldest first. */
/** Where the history begins: the plan's start, or earlier when an older plan's weigh-ins carry on into this one. */
export const historyStart = (plan: Pick<Plan, 'start' | 'since'>): string => (plan.since && plan.since < plan.start ? plan.since : plan.start);

export function weightSeries(plan: Plan, weights: Weights): WeightPoint[] {
  const start = parseKey(historyStart(plan)).getTime();
  return Object.keys(weights)
    .map(k => ({ k, d: parseKey(k), kg: weights[k] }))
    .filter(p => p.d.getTime() >= start)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
}
export function latestWeight(plan: Plan, weights: Weights): (WeightPoint & { weekIdx: number }) | null {
  const arr = weightSeries(plan, weights);
  if (!arr.length) return null;
  const p = arr[arr.length - 1];
  const weekIdx = Math.max(0, Math.min(plan.targets.length - 1, Math.floor(weekFraction(plan, p.d))));
  return { ...p, weekIdx };
}

/** Week of Mon..Sun containing `now`. */
export function weekDays(now: Date = new Date()): Date[] {
  const mon = startOfDay(now);
  const dow = mon.getDay();
  const first = addDays(mon, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}


export function toggleHabit(log: HabitLog, key: string, id: string): HabitLog {
  const next = { ...log, [key]: { ...(log[key] || {}) } };
  if (next[key][id]) delete next[key][id]; else next[key][id] = true;
  if (!Object.keys(next[key]).length) delete next[key];
  return next;
}

/** Totals of meals that have calories filled in. */
export function mealTotals(items: Macros[]): Macros & { count: number } {
  const counted = items.filter(x => x.kcal != null);
  const zero: Macros & { count: number } = { count: 0, kcal: 0, p: 0, c: 0, f: 0 };
  return counted.reduce<Macros & { count: number }>((a, x) => ({ count: a.count + 1, kcal: (a.kcal ?? 0) + (x.kcal ?? 0),
    p: (a.p ?? 0) + (x.p ?? 0), c: (a.c ?? 0) + (x.c ?? 0), f: (a.f ?? 0) + (x.f ?? 0) }), zero);
}

/** True if a settings edit moved the plan enough to rebuild the target line (0.05 kg absorbs unit round-trips). */
export function planChanged(old: Plan, p: PlanDraft): boolean {
  const near = (a: number | null, b: number) => a != null && Math.abs(a - b) < 0.05;
  return p.start !== old.start || p.goalDate !== old.goalDate || !near(p.startKg, old.startKg) || !near(p.goalKg, old.goalKg)
    || JSON.stringify(cleanBreaks(p.breaks)) !== JSON.stringify(cleanBreaks(old.breaks));
}

export function cleanBreaks(v: unknown): PlanBreak[] {
  if (!Array.isArray(v)) return [];
  return v.filter(b => b && validKey(b.start) && Number.isInteger(b.weeks) && b.weeks >= 1 && b.weeks <= MAX_BREAK_WEEKS)
          .slice(0, 24).map(b => ({ start: b.start as string, weeks: b.weeks as number }))
          .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * New line from where you are now, at the plan's original weekly pace: past weeks keep their targets,
 * the line restarts at today's trend, and the goal date moves to when that pace gets there.
 * Returns null if already at (or below) goal.
 */
export function replanFromHere(plan: Plan, trendNow: number, today: Date = new Date()): Plan | null {
  const d = sign(direction(plan));
  if (d === 0 || (plan.goalKg - trendNow) * d <= 0) return null;    // maintaining, or already at the goal
  const breaks = plan.breaks ?? [];
  const lw = Math.max(1, lossWeeks(plan.start, plan.goalDate, breaks));
  const pace = Math.abs(plan.startKg - plan.goalKg) / lw;
  // This week, even if the old plan has already ended: the line restarts today, never in the past
  const i0 = Math.max(0, Math.floor(weekFraction(plan, today)));
  const last = plan.targets[plan.targets.length - 1];
  const prefix = plan.targets.concat(Array(Math.max(0, i0 - plan.targets.length + 1)).fill(last));   // weeks after the old end held at its goal
  const needed = Math.max(2, Math.ceil(Math.abs(plan.goalKg - trendNow) / pace - 1e-9));
  let total = i0, counted = 0;
  while (counted < needed && total < i0 + 156) { total++; if (!isBreakStep(plan.start, breaks, total)) counted++; }
  const goalDate = dateKey(weekDate(plan, total));
  const targets = buildTargets(plan.startKg, plan.goalKg, plan.start, goalDate, breaks, { index: i0, kg: trendNow, prefix });
  return { ...plan, goalDate, targets };
}

/**
 * Apply new breaks without rewriting history: weeks up to the current one keep their targets
 * (including any re-plan or hand-shaped holds), and only the future is rebuilt around the breaks.
 */
export function withBreaks(plan: Plan, breaks: PlanBreak[], today: Date = new Date()): Plan {
  const clean = cleanBreaks(breaks);
  const i0 = Math.max(0, Math.min(plan.targets.length - 1, Math.floor(weekFraction(plan, today))));
  const targets = buildTargets(plan.startKg, plan.goalKg, plan.start, plan.goalDate, clean, { index: i0, kg: plan.targets[i0], prefix: plan.targets });
  return { ...plan, breaks: clean, targets };
}

/** True if a draft differs from the saved plan only in its breaks. */
export function onlyBreaksChanged(old: Plan, p: PlanDraft): boolean {
  return planChanged(old, p) && !planChanged({ ...old, breaks: [] }, { ...p, breaks: [] });
}

/**
 * How far the trend is behind the target line today, in kg (negative = ahead).
 * Losing: above the line is behind. Gaining: below it is behind. Maintaining: any distance from the line.
 */
export function behindBy(plan: Plan, trendNow: number, today: Date = new Date()): number {
  const off = trendNow - targetAt(plan, today);
  const d = sign(direction(plan));
  return d === 0 ? Math.abs(off) : -d * off;
}

/** Within this much of the line counts as "on the line" (kg); a maintenance plan allows a kilo either way by default. */
// Within half a kilo of the line counts as on it: the trend is smooth, but not so smooth that 0.3 kg can't flip back
export const ON_LINE_KG = 0.5, HOLD_KG = 1, MIN_HOLD_KG = 0.5, MAX_HOLD_KG = 3;
/** How far either side of the goal a holding plan allows. */
export const holdBand = (plan: Plan) => plan.holdKg ?? HOLD_KG;
/**
 * The one answer to "how am I doing against the line?", used by every screen so they can never disagree.
 * `off` is how far behind (positive) or ahead (negative) the trend is today, in kg.
 */
export function lineStatus(plan: Plan, trendNow: number, today: Date = new Date()): { off: number; onLine: boolean; ahead: boolean } {
  const off = behindBy(plan, trendNow, today);
  const tol = direction(plan) === 'maintain' ? holdBand(plan) : ON_LINE_KG;
  return { off, onLine: off <= tol, ahead: direction(plan) !== 'maintain' && off < -tol };
}

/** Chart y-range: fits targets and weights, snapped to a tidy step. */
export function chartRange(values: number[]): { min: number; max: number; step: number } {
  const [lo, hi] = extent(values);
  const span = hi - lo;
  const step = span <= 3 ? 0.5 : span <= 7 ? 1 : span <= 16 ? 2 : span <= 40 ? 5 : 10;
  const pad = step < 1 ? step : 1;   // short ranges (the 4-week view) get finer lines instead of looking flat
  return { min: Math.floor((lo - pad) / step) * step, max: Math.ceil((hi + pad) / step) * step, step };
}

export { WEEK_MS };

// ---- setup pace ----
// Weekly loss as a share of starting weight. ~0.5–0.75% is the range most people can hold for months.
export const PACES = [
  { id: 'gentle', label: 'Gentle', pct: 0.25 },
  { id: 'steady', label: 'Steady', pct: 0.5, recommended: true },
  { id: 'brisk', label: 'Brisk', pct: 0.75 },
  { id: 'fast', label: 'Fast', pct: 1.0 },
] as const;
export type PaceId = (typeof PACES)[number]['id'];
/** Weekly gain as a share of body weight: slow gains keep it mostly muscle rather than fat. */
export const GAIN_PACES = [
  { id: 'lean', label: 'Lean', pct: 0.25, recommended: true },
  { id: 'steady', label: 'Steady', pct: 0.5 },
] as const;

/** Goal date for a pace: whole weeks needed at that rate, at least 2, at most 156. */
export function goalDateForPace(startKg: number, goalKg: number, start: string, pct: number): string {
  const perWeek = startKg * pct / 100;
  const weeks = Math.min(156, Math.max(2, Math.ceil(Math.abs(startKg - goalKg) / perWeek - 1e-9)));
  return dateKey(addDays(parseKey(start), weeks * 7));
}

// ---- chart window ----
export type ChartRange = '4w' | '12w' | 'plan';
/** First and last calendar day shown for a range. Short ranges end today (or the latest entry), clamped to the plan. */
export function chartWindow(plan: Plan, range: ChartRange, latest: Date | null, today: Date = new Date()): [Date, Date] {
  const start = parseKey(plan.start);
  const planEnd = addDays(start, (plan.targets.length - 1) * 7);
  if (range === 'plan') return [start, planEnd];
  const anchor = latest && latest > today ? latest : today;
  let end = startOfDay(anchor);
  if (end < start) end = addDays(start, range === '4w' ? 28 : 84);
  const from = addDays(end, range === '4w' ? -28 : -84);
  return [from < start ? start : from, end];
}

// ---- after the goal: holding ----
/** Weeks a holding plan runs for before it asks again (it can be extended any time in Settings). */
export const HOLD_WEEKS = 26;
/** The range a holding plan starts with: 1.5 kg either side, about the size of normal day-to-day water swings. */
export const DEFAULT_HOLD_KG = 1.5;

/** A losing or gaining plan whose trend has reached the goal. Holding plans never "reach" anything. */
export function reachedGoal(plan: Plan, trendNow: number): boolean {
  const d = sign(direction(plan));
  return d !== 0 && (plan.goalKg - trendNow) * d <= 0;
}

/**
 * The plan after the goal: hold the goal weight, within a range, from today. Further loss isn't the aim any more,
 * so nothing praises it; drifting outside the range either way gets the same calm note.
 */
export function holdingPlan(plan: Plan, today: Date = new Date(), holdKg = DEFAULT_HOLD_KG): Plan {
  const start = dateKey(startOfDay(today));
  const goalDate = dateKey(addDays(startOfDay(today), HOLD_WEEKS * 7));
  return { start, startKg: plan.goalKg, goalKg: plan.goalKg, goalDate, targets: buildTargets(plan.goalKg, plan.goalKg, start, goalDate), breaks: [],
           holdKg: Math.min(MAX_HOLD_KG, Math.max(MIN_HOLD_KG, holdKg)), since: historyStart(plan) };
}
