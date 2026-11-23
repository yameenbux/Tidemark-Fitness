import { addDays, dateKey } from '../dates';
import { buildTargets, defaultSettings, weightSeries } from '../plan';
import { NO_NUDGE, NUDGE_GAP_DAYS, cleanNudgeMemory, pickPlusNudge, type NudgeInput } from '../plusNudge';
import { trendSeries } from '../trend';
import type { DoseLog, Weights } from '../types';

const today = new Date(2026, 10, 23);
const k = (n: number) => dateKey(addDays(today, n));
const start = k(-60);
const plan = { start, startKg: 100, goalKg: 85, goalDate: k(120), targets: buildTargets(100, 85, start, k(120)) };
const med = { name: 'Weekly injection', doseMg: 5, every: 'week' as const, weekday: today.getDay(), injected: true };

/** Weigh-ins every day for 60 days: falling, then (if `flat`) level for the last 35, long enough for the trend to settle. */
function weighIns(flat: boolean): Weights {
  const w: Weights = {};
  for (let i = -60; i <= 0; i++) w[k(i)] = flat && i > -35 ? 100 - 25 * 0.08 : 100 - (i + 60) * 0.08;
  return w;
}
function input(over: Partial<NudgeInput> & { flat?: boolean; onMed?: boolean } = {}): NudgeInput {
  const weights = over.weights ?? weighIns(over.flat ?? false);
  const settings = { ...defaultSettings(plan, []), medication: over.onMed === false ? null : med };
  const series = trendSeries(weightSeries(settings.plan, weights));
  return { settings, weights, series, doses: {}, effects: {}, photos: {}, sampleReportUsed: false, memory: NO_NUDGE, today, ...over };
}
const steps = (from: number, to: number, mg: number, d: DoseLog = {}) => { for (let i = from; i <= to; i += 7) d[k(i)] = { mg }; return d; };

describe('Plus cards on Today: the moment', () => {
  test('a new dose strength in the last two weeks comes first', () => {
    const doses = steps(-56, -14, 5, steps(-7, 0, 7.5));
    expect(pickPlusNudge(input({ doses }))).toEqual({ kind: 'newDose', key: `dose:${k(-7)}`, mg: 7.5 });
  });
  test('the same new dose is never brought up twice', () => {
    const doses = steps(-56, -14, 5, steps(-7, 0, 7.5));
    const memory = { at: k(-10), kind: 'newDose' as const, key: `dose:${k(-7)}`, dismissed: true };
    expect(pickPlusNudge(input({ doses, memory }))?.kind).not.toBe('newDose');
  });
  test('three flat weeks on a losing plan, with enough weigh-ins', () => {
    expect(pickPlusNudge(input({ flat: true, onMed: false }))?.kind).toBe('flat');
    expect(pickPlusNudge(input({ flat: false, onMed: false }))?.kind).not.toBe('flat');
  });
  test('the free report is offered once someone on a medication has a few doses, and not after it’s been used', () => {
    const doses = steps(-28, 0, 5);
    expect(pickPlusNudge(input({ doses }))?.kind).toBe('report');
    expect(pickPlusNudge(input({ doses, sampleReportUsed: true }))?.kind).toBe('photos');
  });
  test('photos, for anyone with two weeks of weigh-ins and no photo yet', () => {
    expect(pickPlusNudge(input({ onMed: false }))?.kind).toBe('photos');
    expect(pickPlusNudge(input({ onMed: false, photos: { [k(-3)]: { front: 'a.jpg' } } }))).toBeNull();
  });
});

describe('Plus cards on Today: never at a bad moment, never too often', () => {
  test('not after a weigh-in that went up', () => {
    const weights = weighIns(false); weights[k(0)] = weights[k(-1)] + 0.6;
    expect(pickPlusNudge(input({ onMed: false, weights }))).toBeNull();
  });
  test('not the day of or after a side effect is noted', () => {
    expect(pickPlusNudge(input({ effects: { [k(-1)]: { effects: ['nausea'], severity: 1 } } }))).toBeNull();
    expect(pickPlusNudge(input({ effects: { [k(-2)]: { effects: ['nausea'], severity: 1 } } }))).not.toBeNull();
  });
  test('not in the first days after setup, when Plus was just offered', () => {
    const fresh = { ...plan, start: k(-1) };
    const i = input({ onMed: false });
    expect(pickPlusNudge({ ...i, settings: { ...i.settings, plan: fresh } })).toBeNull();
  });
  test('at most one a week; today’s card stays for the day unless it was closed', () => {
    const shown = { at: k(0), kind: 'photos' as const, key: 'photos', dismissed: false };
    expect(pickPlusNudge(input({ onMed: false, memory: shown }))?.kind).toBe('photos');
    expect(pickPlusNudge(input({ onMed: false, memory: { ...shown, dismissed: true } }))).toBeNull();
    const lastWeek = { at: k(-(NUDGE_GAP_DAYS - 1)), kind: 'report' as const, key: 'report', dismissed: true };
    expect(pickPlusNudge(input({ onMed: false, memory: lastWeek }))).toBeNull();
    expect(pickPlusNudge(input({ onMed: false, memory: { ...lastWeek, at: k(-NUDGE_GAP_DAYS) } }))?.kind).toBe('photos');
  });
  test('saved memory is cleaned', () => {
    expect(cleanNudgeMemory({ at: 'x', kind: 'spam', key: 5, dismissed: 'yes' })).toEqual(NO_NUDGE);
    expect(cleanNudgeMemory({ at: '2026-11-20', kind: 'flat', key: 'flat:2026-11-20', dismissed: true }).kind).toBe('flat');
  });
});
