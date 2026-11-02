import { addDays, dateKey, startOfDay } from '../dates';
import { buildTargets, historyStart, holdingPlan, normalizeSettings, weightSeries } from '../plan';
import { trendSeries, weeklyRate } from '../trend';
import type { Weights } from '../types';

const today = startOfDay(new Date(2026, 9, 10));
const start = dateKey(addDays(today, -139)), goalDate = dateKey(addDays(today, 30));
const plan = { start, startKg: 95, goalKg: 85, goalDate, targets: buildTargets(95, 85, start, goalDate), breaks: [] };
const weights: Weights = {};
for (let i = 0; i < 140; i++) weights[dateKey(addDays(today, i - 139))] = 95 - i * 0.07;

describe('reaching the goal and switching to holding', () => {
  test('keeps every weigh-in: the trend carries on instead of starting again from one reading', () => {
    const before = trendSeries(weightSeries(plan, weights));
    const hold = holdingPlan(plan, today);
    expect(hold.start).toBe(dateKey(today));              // the holding range starts today…
    expect(hold.since).toBe(start);                        // …but the history still starts where it did
    const after = trendSeries(weightSeries(hold, weights));
    expect(after).toHaveLength(140);
    expect(after.at(-1)!.trend).toBeCloseTo(before.at(-1)!.trend, 6);
    expect(weeklyRate(after, today)).not.toBeNull();       // the test's own today, not the real date
  });
  test('a second new plan keeps the same history start, and it survives a save and a backup', () => {
    const again = holdingPlan(holdingPlan(plan, addDays(today, -10)), today);
    expect(historyStart(again)).toBe(start);
    const restored = normalizeSettings({ plan: again, event: null, habits: [], sessions: {}, meals: { items: [], target: {} } })!;
    expect(restored.plan.since).toBe(start);
    // A "since" that isn't before the start means nothing and is dropped
    expect(normalizeSettings({ plan: { ...again, since: dateKey(addDays(today, 5)) }, event: null, habits: [], sessions: {}, meals: { items: [], target: {} } })!.plan.since).toBeUndefined();
  });
});
