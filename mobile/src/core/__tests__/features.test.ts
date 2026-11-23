import { assessPlan, behindBy, buildTargets, cleanBreaks, habitAmount, HABIT_AMOUNTS, isBreakStep, lossWeeks, planChanged, replanFromHere, SUGGESTED_HABITS, withHabitAmount } from '../plan';
import { consistency, habitInsight, milestoneQuarter, trendAt, weeksOfData } from '../insights';
import { cleanIntake, estimateExpenditure, intakeRange, MIN_INTAKE } from '../calories';
import { cleanSessionLog, exerciseName, lastLift, suggestNext } from '../progression';
import { toCsv } from '../csv';
import { trendSeries } from '../trend';
import { addDays, dateKey, parseKey } from '../dates';
import type { Plan } from '../types';

const series = (rows: [string, number][]) => trendSeries(rows.map(([k, kg]) => ({ k, d: parseKey(k), kg })));

describe('planned breaks', () => {
  const start = '2026-10-05', goal = '2027-01-04';               // 13 weeks
  const xmas = [{ start: '2026-12-21', weeks: 2 }];
  test('break steps are the weeks starting inside the break', () => {
    expect(isBreakStep(start, xmas, 11)).toBe(false);             // week starting 14 Dec: before the break
    expect(isBreakStep(start, xmas, 12)).toBe(true);              // 21 Dec
    expect(isBreakStep(start, xmas, 13)).toBe(true);              // 28 Dec
    expect(isBreakStep(start, xmas, 14)).toBe(false);             // 4 Jan: break over
  });
  test('the line holds flat during a break and still reaches the goal', () => {
    const t = buildTargets(95, 88, start, goal, [{ start: '2026-11-02', weeks: 2 }]);
    expect(t).toHaveLength(14);
    expect(t[0]).toBe(95);
    expect(t[13]).toBe(88);
    expect(t[4]).toBe(t[5]);        // steps 5 and 6 start on 2 Nov and 9 Nov: flat
    expect(t[5]).toBe(t[6]);
    expect(t[3]).toBeGreaterThan(t[4]);
  });
  test('pace is measured over the weeks that are not breaks', () => {
    const plain = assessPlan({ startKg: 95, goalKg: 88, start, goalDate: goal });
    const withBreak = assessPlan({ startKg: 95, goalKg: 88, start, goalDate: goal, breaks: [{ start: '2026-11-02', weeks: 2 }] });
    if (!plain.ok || !withBreak.ok) throw new Error('expected ok');
    expect(lossWeeks(start, goal, [{ start: '2026-11-02', weeks: 2 }])).toBe(11);
    expect(withBreak.perWeek).toBeGreaterThan(plain.perWeek);
    expect(assessPlan({ startKg: 95, goalKg: 88, start, goalDate: goal, breaks: [{ start, weeks: 8 }, { start: '2026-11-30', weeks: 4 }] }).error).toMatch(/breaks leave/);
  });
  test('breaks are validated and sorted; changing them counts as a plan change', () => {
    expect(cleanBreaks([{ start: '2026-12-21', weeks: 2 }, { start: 'x', weeks: 1 }, { start: '2026-11-01', weeks: 9 }, { start: '2026-11-01', weeks: 1 }]))
      .toEqual([{ start: '2026-11-01', weeks: 1 }, { start: '2026-12-21', weeks: 2 }]);
    const p: Plan = { start, startKg: 95, goalKg: 88, goalDate: goal, targets: [], breaks: [] };
    expect(planChanged(p, { startKg: 95, goalKg: 88, start, goalDate: goal, breaks: [] })).toBe(false);
    expect(planChanged(p, { startKg: 95, goalKg: 88, start, goalDate: goal, breaks: xmas })).toBe(true);
  });
});

describe('re-plan from here', () => {
  const plan: Plan = { start: '2026-09-07', startKg: 95, goalKg: 88, goalDate: '2027-01-04', targets: buildTargets(95, 88, '2026-09-07', '2027-01-04'), breaks: [] };
  const today = new Date(2026, 10, 2);   // week 8
  test('keeps past targets, restarts at the trend, and keeps the original pace by moving the goal date', () => {
    const r = replanFromHere(plan, 94.0, today)!;
    expect(r.targets.slice(0, 8)).toEqual(plan.targets.slice(0, 8));
    expect(r.targets[8]).toBe(94);
    expect(r.targets[r.targets.length - 1]).toBe(88);
    const pace = 7 / 17;
    expect(r.targets.length - 1 - 8).toBe(Math.ceil(6 / pace));       // 15 weeks of loss at the old pace
    expect(r.goalDate > plan.goalDate).toBe(true);
  });
  test('after the plan has ended, the new line starts this week and the goal date is in the future', () => {
    const late = new Date(2027, 2, 1);   // 8 weeks after the old goal date (week 25)
    const r = replanFromHere(plan, 92, late)!;
    expect(r.targets.slice(0, 18)).toEqual(plan.targets);
    expect(r.targets.slice(18, 25).every(v => v === 88)).toBe(true);   // the gap is held at the old goal
    expect(r.targets[25]).toBe(92);
    expect(r.targets[r.targets.length - 1]).toBe(88);
    expect(r.goalDate > '2027-03-01').toBe(true);
  });
  test('nothing to re-plan once at goal; behindBy compares the trend to today\'s target', () => {
    expect(replanFromHere(plan, 88, today)).toBeNull();
    expect(behindBy(plan, 94, today)).toBeCloseTo(94 - (95 - 8 * 7 / 17), 1);
  });
});

describe('consistency and insights', () => {
  const today = new Date(2026, 9, 31);
  test('consistency counts ticked days in the window, never before the plan start', () => {
    const log = { '2026-10-31': { w: true as const }, '2026-10-29': { w: true as const }, '2026-10-01': { w: true as const } };
    expect(consistency(log, 'w', 7, today)).toEqual({ done: 2, of: 7 });
    expect(consistency(log, 'w', 30, today)).toEqual({ done: 2, of: 30 });
    expect(consistency(log, 'w', 30, today, '2026-10-28')).toEqual({ done: 2, of: 4 });
  });
  test('insight needs 8 weeks and 3+ weeks on each side; then compares average weekly change', () => {
    const plan: Plan = { start: '2026-07-06', startKg: 95, goalKg: 85, goalDate: '2027-01-04', targets: [] };
    const rows: [string, number][] = [];
    const log: Record<string, Record<string, true>> = {};
    let kg = 95;
    for (let w = 0; w < 12; w++) {
      const active = w % 2 === 0;                                    // active weeks lose 0.8 kg, others 0.2
      for (let d = 0; d < 7; d++) {
        const day = addDays(parseKey(plan.start), w * 7 + d);
        kg -= (active ? 0.8 : 0.2) / 7;
        rows.push([dateKey(day), Math.round(kg * 100) / 100]);
        if (active ? d < 5 : d < 1) log[dateKey(day)] = { gym: true };
      }
    }
    const s = series(rows);
    const at = new Date(2026, 8, 28);                                 // after 12 full weeks
    expect(weeksOfData(plan, s, at)).toBe(12);
    const ins = habitInsight(plan, s, log, 'gym', at)!;
    expect(ins.withWeeks).toBe(6);
    expect(ins.withoutWeeks).toBe(6);
    expect(ins.withRate).toBeLessThan(ins.withoutRate);               // more loss in gym weeks
    expect(habitInsight(plan, s, log, 'gym', new Date(2026, 7, 24))).toBeNull();   // only 7 weeks
    expect(habitInsight(plan, s, {}, 'gym', at)).toBeNull();          // no weeks on the "with" side
  });
  test('trendAt uses the last point on or before a date', () => {
    const s = series([['2026-10-01', 90], ['2026-10-05', 89]]);
    expect(trendAt(s, new Date(2026, 8, 30))).toBeNull();
    expect(trendAt(s, new Date(2026, 9, 3))).toBe(90);
  });
  test('milestones are quarters of the way on trend', () => {
    const p: Plan = { start: '2026-10-05', startKg: 96, goalKg: 88, goalDate: '2027-02-01', targets: [] };
    expect(milestoneQuarter(p, 95)).toBe(0);
    expect(milestoneQuarter(p, 94)).toBe(1);
    expect(milestoneQuarter(p, 92)).toBe(2);
    expect(milestoneQuarter(p, 87)).toBe(4);
    expect(milestoneQuarter(p, 97)).toBe(0);
  });
});

describe('calories', () => {
  test('estimates burn from intake plus trend change, and needs enough logged days', () => {
    const today = new Date(2026, 10, 1);
    const intake: Record<string, number> = {};
    const rows: [string, number][] = [];
    for (let i = 30; i >= 1; i--) {
      const d = addDays(today, -i);
      rows.push([dateKey(d), 90 - (30 - i) * (0.5 / 7)]);             // losing 0.5 kg/week
      if (i <= 21 && i % 4 !== 0) intake[dateKey(d)] = 2000;
    }
    const e = estimateExpenditure(intake, series(rows), today)!;
    expect(e.logged).toBeGreaterThanOrEqual(14);
    expect(e.avgIntake).toBe(2000);
    // 0.5 kg/week is a 390–550 kcal/day gap, depending on how much of the loss is fat (trend lags a little)
    expect(e.low).toBeGreaterThan(2300);
    expect(e.high).toBeLessThan(2650);
    expect(e.high - e.low).toBeGreaterThanOrEqual(100);                // a range, not false precision
    expect(e.low % 50).toBe(0);
    // Eating what you ate keeps the pace you lost at, whatever the tissue mix
    const r = intakeRange(e, 0.5);
    expect(r.floored).toBe(false);
    expect(r.low).toBeGreaterThanOrEqual(1900);
    expect(r.high).toBeLessThanOrEqual(2100);
    expect(estimateExpenditure({}, series(rows), today)).toBeNull();
  });
  test('a break from weighing gives no estimate, not one built from weeks of change squeezed into three', () => {
    // 90 kg, then no weigh-ins for 7 weeks, back at 86 kg; 2000 kcal logged every day of the last three weeks.
    // Dividing that 4 kg by 21 days said 3570 kcal a day and suggested eating 3020 to lose 0.5 kg a week.
    const today = parseKey('2026-10-09');
    const rows: [string, number][] = [];
    for (let i = 90; i >= 56; i--) rows.push([dateKey(addDays(today, -i)), 90]);
    rows.push([dateKey(addDays(today, -6)), 86], [dateKey(addDays(today, -3)), 86], [dateKey(addDays(today, -1)), 86]);
    const intake: Record<string, number> = {};
    for (let i = 1; i <= 21; i++) intake[dateKey(addDays(today, -i))] = 2000;
    expect(estimateExpenditure(intake, series(rows), today)).toBeNull();
  });
  test('the estimate spreads the change over the days it actually took', () => {
    // Weighed every few days, but the first weigh-in in the window is 3 days in: the change is divided by 18 days, not 21
    const today = parseKey('2026-10-09');
    const rows: [string, number][] = [];
    for (let i = 60; i >= 1; i--) if (i > 21 || i <= 18) rows.push([dateKey(addDays(today, -i)), 90 - (60 - i) * (0.5 / 7)]);
    const intake: Record<string, number> = {};
    for (let i = 1; i <= 21; i++) intake[dateKey(addDays(today, -i))] = 2000;
    const e = estimateExpenditure(intake, series(rows), today)!;
    expect(e.low).toBeGreaterThan(2300);
    expect(e.high).toBeLessThan(2700);
  });
  test('never suggests eating below the floor', () => {
    // Eating 1300 and losing slowly, on a plan that wants 1 kg a week: the maths says well under 1,000 kcal
    const est = { low: 1400, high: 1450, avgIntake: 1300, kgPerDay: 0.02, logged: 21, window: 21 };
    const r = intakeRange(est, 1);
    expect(r.floored).toBe(true);
    expect(r.low).toBe(MIN_INTAKE);
    expect(r.high).toBe(MIN_INTAKE);
    // A plan to hold or gain is never floored
    expect(intakeRange({ ...est, avgIntake: 2200, kgPerDay: 0 }, 0).floored).toBe(false);
  });
  test('intake cleaning drops silly numbers', () => {
    expect(cleanIntake({ '2026-10-01': '1850', '2026-10-02': 50, '2026-10-03': 99999, bad: 2000 })).toEqual({ '2026-10-01': 1850 });
  });
});

describe('progression and CSV', () => {
  test('exercise names come from the line before the dash; headings are skipped', () => {
    expect(exerciseName('Goblet squat — 3 × 10–12')).toBe('Goblet squat');
    expect(exerciseName('Lat pulldown - 3 x 10')).toBe('Lat pulldown');
    expect(exerciseName('# core')).toBeNull();
    expect(exerciseName('— core —')).toBeNull();
  });
  test('suggests a small increase after a completed session, otherwise repeat', () => {
    const log = cleanSessionLog({ '2026-10-05': { 'Goblet squat': { kg: 20, done: true } }, '2026-10-12': { 'Goblet squat': { kg: 22.5, done: false } } });
    expect(suggestNext(lastLift(log, 'Goblet squat', '2026-10-12'))).toEqual({ kg: 22.5, reason: 'increase' });
    expect(suggestNext(lastLift(log, 'Goblet squat', '2026-10-19'))).toEqual({ kg: 22.5, reason: 'repeat' });
    expect(suggestNext({ kg: 8, done: true })).toEqual({ kg: 9, reason: 'increase' });
    expect(suggestNext(null)).toBeNull();
  });
  test('imperial lifters get plate-sized pound steps, and pound entries survive a reload exactly', () => {
    const lb = (n: number) => n * 0.45359237;
    const next = suggestNext({ kg: lb(100), done: true }, 'imp')!;
    expect(Math.round(next.kg / 0.45359237 * 2) / 2).toBe(105);
    const small = suggestNext({ kg: lb(30), done: true }, 'imp')!;
    expect(Math.round(small.kg / 0.45359237 * 2) / 2).toBe(32.5);
    for (const v of [35, 67.5, 105, 142.5]) {
      const kept = cleanSessionLog({ '2026-10-01': { Squat: { kg: lb(v), done: true } } })['2026-10-01'].Squat.kg;
      expect(Math.round(kept / 0.45359237 * 2) / 2).toBe(v);
    }
  });
  test('CSV has one row per date with blanks where nothing was logged', () => {
    expect(toCsv({ '2026-10-01': 90.5 }, { '2026-10-02': { waist: 95 } }, { '2026-10-01': 1900 }))
      .toBe('date,weight_kg,waist_cm,hips_cm,chest_cm,arm_cm,kcal,protein_g,tags,note\n2026-10-01,90.5,,,,,1900,,,\n2026-10-02,,95,,,,,,,\n');
  });
  test('CSV carries protein grams, so a log kept with Plus is never stuck in the app', () => {
    expect(toCsv({}, {}, {}, {}, { '2026-10-03': 120 }).split('\n')[1]).toBe('2026-10-03,,,,,,,120,,');
  });
  test('CSV carries tags and a note, quoted, and never as a spreadsheet formula', () => {
    const csv = toCsv({ '2026-10-01': 90.5 }, {}, {}, { '2026-10-01': { tags: ['salty', 'alcohol'], text: '=HYPERLINK("x") "party"' } });
    expect(csv.split('\n')[1]).toBe(`2026-10-01,90.5,,,,,,,salty;alcohol,"'=HYPERLINK(""x"") ""party"""`);
  });
});

describe('breaks after a re-plan', () => {
  test('changing only breaks keeps past weeks (and a re-plan) and still ends at the goal', () => {
    const { withBreaks, onlyBreaksChanged, replanFromHere: rp } = jest.requireActual('../plan');
    const base: Plan = { start: '2026-09-07', startKg: 95, goalKg: 88, goalDate: '2027-01-04', targets: buildTargets(95, 88, '2026-09-07', '2027-01-04'), breaks: [] };
    const today = new Date(2026, 10, 2);
    const re = rp(base, 94, today)!;
    const next = withBreaks(re, [{ start: '2026-12-21', weeks: 2 }], today);
    expect(next.targets.slice(0, 9)).toEqual(re.targets.slice(0, 9));
    expect(next.targets[next.targets.length - 1]).toBe(88);
    expect(next.goalDate).toBe(re.goalDate);
    expect(onlyBreaksChanged(re, { ...re, breaks: [{ start: '2026-12-21', weeks: 2 }] })).toBe(true);
    expect(onlyBreaksChanged(re, { ...re, goalKg: 87, breaks: [{ start: '2026-12-21', weeks: 2 }] })).toBe(false);
  });
});

describe('habit amounts', () => {
  test('every suggested habit with an amount starts on one of its choices, and changing it only renames it', () => {
    for (const h of SUGGESTED_HABITS.filter(x => HABIT_AMOUNTS[x.id])) expect(habitAmount(h)).not.toBeNull();
    const steps = SUGGESTED_HABITS.find(h => h.id === 'steps')!;
    expect(withHabitAmount(steps, '10k')).toEqual({ ...steps, name: 'Steps 10k' });
    expect(withHabitAmount(steps, '999k')).toEqual(steps);                       // not a choice: unchanged
    expect(habitAmount({ ...steps, name: 'Steps after lunch' })).toBeNull();
    expect(habitAmount({ id: 'water', icon: 'water', short: '3 L', name: 'Water 3 L' })).toBe('3 L');   // older default
  });
});
