// A daily protein minimum (Plus): a number the person sets, for example one their GP, dietitian or prescriber gave
// them, and Tidemark tracks the day against it. Tidemark deliberately doesn't work the number out from body weight:
// a target calculated for someone, on a weight-loss medication especially, edges towards clinical advice (UK MHRA
// medical-device rules; see COMPLIANCE.md). It's a floor to reach, not a limit.
import { addDays, dateKey, startOfDay, validKey } from './dates';
import { numOrNull } from './units';

export type ProteinLog = Record<string, number>;   // date -> grams eaten
export const MAX_PROTEIN_G = 400;

export function cleanProtein(v: unknown): ProteinLog {
  const out: ProteinLog = {};
  if (!v || typeof v !== 'object') return out;
  for (const k of Object.keys(v).slice(0, 20000)) {
    const g = numOrNull((v as Record<string, unknown>)[k]);
    if (validKey(k) && g != null && g > 0 && g <= MAX_PROTEIN_G) out[k] = Math.round(g);
  }
  return out;
}

/** The daily minimum the person set, in whole grams; null if it's missing or not a sensible number. */
export function cleanProteinGrams(v: unknown): number | null {
  const g = numOrNull(v);
  return g != null && g >= 1 && g <= MAX_PROTEIN_G ? Math.round(g) : null;
}

/** Settings from storage. An old setting saved as grams per kg isn't converted: the person sets their own number. */
export function cleanProteinSetting(v: unknown): { on: boolean; grams: number | null } | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  return { on: o.on === true, grams: cleanProteinGrams(o.grams) };
}

/** Adds grams to a day (negative to take some off), never below zero or above the cap. */
export function addProtein(log: ProteinLog, day: string, grams: number): ProteinLog {
  const next = { ...log };
  const g = Math.max(0, Math.min(MAX_PROTEIN_G, (log[day] ?? 0) + grams));
  if (g > 0) next[day] = Math.round(g); else delete next[day];
  return next;
}

/** Of the last 7 finished days, how many were logged and how many reached the target. */
export function proteinWeek(log: ProteinLog, target: number, today: Date = new Date()): { logged: number; reached: number } {
  let logged = 0, reached = 0;
  for (let i = 1; i <= 7; i++) {
    const g = log[dateKey(addDays(startOfDay(today), -i))];
    if (g != null) { logged++; if (g >= target) reached++; }
  }
  return { logged, reached };
}
