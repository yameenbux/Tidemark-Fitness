import { addProtein, cleanProtein, cleanProteinGrams, proteinWeek } from '../protein';
import { normalizeSettings, buildTargets } from '../plan';

describe('protein minimum', () => {
  test('the minimum is the number the person typed, in whole grams; nonsense is no number at all', () => {
    expect(cleanProteinGrams('110')).toBe(110);
    expect(cleanProteinGrams(95.6)).toBe(96);
    expect(cleanProteinGrams('')).toBeNull();
    expect(cleanProteinGrams(0)).toBeNull();
    expect(cleanProteinGrams(999)).toBeNull();
  });
  test('adding never goes below zero or above the cap, and an empty day disappears', () => {
    let l = addProtein({}, '2026-10-09', 30);
    l = addProtein(l, '2026-10-09', 20);
    expect(l['2026-10-09']).toBe(50);
    expect(addProtein(l, '2026-10-09', -80)).toEqual({});
    expect(addProtein({}, '2026-10-09', 999)['2026-10-09']).toBe(400);
  });
  test('the last seven finished days: logged and reached', () => {
    const l = { '2026-10-08': 130, '2026-10-07': 90, '2026-10-05': 125, '2026-10-09': 200, '2026-09-30': 200 };
    expect(proteinWeek(l, 120, new Date(2026, 9, 9))).toEqual({ logged: 3, reached: 2 });
  });
  test('cleaning: junk dropped; the setting keeps the person’s own number, and never works one out', () => {
    expect(cleanProtein({ '2026-10-01': 120.4, '2026-10-02': -5, x: 50, '2026-10-03': 9999 })).toEqual({ '2026-10-01': 120 });
    const plan = { start: '2026-09-07', startKg: 92, goalKg: 84, goalDate: '2027-01-04', targets: buildTargets(92, 84, '2026-09-07', '2027-01-04') };
    const norm = (protein: unknown) => normalizeSettings({ plan, event: null, habits: [], sessions: {}, meals: { items: [], target: {} }, protein })!.protein;
    expect(norm({ on: true, grams: 110 })).toEqual({ on: true, grams: 110 });
    expect(norm({ on: true, perKg: 1.4 })).toEqual({ on: true, grams: null });   // an old per-kg setting asks again
  });
});
