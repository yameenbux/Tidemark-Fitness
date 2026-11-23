export type Unit = 'kg' | 'imp' | 'lb';   // kilograms, stones & pounds (UK), or pounds only (US)

/** A planned maintenance break: the target line holds flat for `weeks` weeks from `start`. */
export interface PlanBreak { start: string; weeks: number }

export interface Plan {
  start: string;      // YYYY-MM-DD
  startKg: number;
  goalKg: number;
  goalDate: string;   // YYYY-MM-DD
  targets: number[];  // one target per week, week 1 = start date
  breaks?: PlanBreak[];
  holdKg?: number;    // holding plans: how far either side of the goal still counts as holding (default 1 kg)
  since?: string;     // when tracking began, if before `start`: a holding plan (or a new plan) starts today, but the
                      // trend, history and habit grids carry on from here instead of starting again from nothing
}

export interface TrackerEvent { name: string; date: string; detail: string }
export interface Habit { id: string; icon: string; short: string; name: string }
export interface Session { title: string; items: string[]; note: string }
export interface Macros { kcal: number | null; p: number | null; c: number | null; f: number | null }
export interface Meal extends Macros { when: string; text: string }

export interface Settings {
  plan: Plan;
  event: TrackerEvent | null;
  habits: Habit[];
  sessions: Record<number, Session>;   // keyed by JS day of week, 0 = Sunday
  meals: { items: Meal[]; target: Macros };
  trackCalories?: boolean;   // optional one-number-a-day calorie logging
  medication?: Medication | null;   // optional GLP-1 (or other) medication companion
  protein?: { on: boolean; grams: number | null };   // Plus: a daily protein minimum the person sets (never calculated)
}

/** A medication taken on a schedule, e.g. a weekly GLP-1 injection. Tidemark only records it; it never advises on dosing. */
export interface Medication {
  name: string; doseMg: number | null; every: 'week' | 'day'; weekday: number; remind?: boolean; injected?: boolean;   // weekday: 0 = Sunday
  appointment?: string | null;   // the next appointment or reorder the person set (date key), for a report beforehand
  stoppedOn?: string | null;     // the day they stopped taking it: dose cards and reminders stop, the history stays
}
export type SiteId = 'belly-l' | 'belly-r' | 'thigh-l' | 'thigh-r' | 'arm-l' | 'arm-r';
export type DoseLog = Record<string, { mg: number | null; site?: SiteId }>;   // date -> dose taken that day (and where, for injections)
export type EffectId = 'nausea' | 'constipation' | 'diarrhoea' | 'heartburn' | 'tired' | 'headache' | 'noAppetite' | 'site';
export type EffectLog = Record<string, { effects: EffectId[]; severity: 1 | 2 | 3; text?: string }>;   // date -> how it felt

export type Weights = Record<string, number>;                     // date -> kg
export type HabitLog = Record<string, Record<string, true>>;       // date -> habit id -> ticked

export type MeasureKey = 'waist' | 'hips' | 'chest' | 'arm';
export type Measurements = Record<string, Partial<Record<MeasureKey, number>>>;   // date -> part -> cm
export type Pose = 'front' | 'side' | 'back';
export type PhotoLog = Record<string, Partial<Record<Pose, string>>>;             // date -> pose -> file name in app storage

export interface TrackerState {
  settings: Settings | null;
  weights: Weights;                                             // one number a day, derived from `entries`
  entries?: import('./entries').WeighIn[];                     // timestamped weigh-ins: the source of truth
  doses?: DoseLog;                                              // medication doses marked as taken
  effects?: EffectLog;
  protein?: import('./protein').ProteinLog;                     // grams of protein eaten a day (Plus)                                         // side effects noted on a day (medication, Plus)
  notes?: import('./notes').DayNotes;                          // tags and a line of text on a day (why the scale jumped)
  habits: HabitLog;
  unit: Unit;
  measurements: Measurements;
  photos: PhotoLog;
  intake: Record<string, number>;                               // date -> kcal eaten
  lifts: Record<string, Record<string, { kg: number; done: boolean }>>;   // date -> exercise -> weight used
}
