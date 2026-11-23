import * as Notifications from 'expo-notifications';
import { applyDoseReminders, applyReminder, reminderBudget, remindersSetUntil, scheduleTrialReminder } from '../reminders';
import type { Medication } from '../core/types';

// What iOS has scheduled, kept in memory so each sync sees the last one's result
type Req = { identifier: string; content: { data: { at: string } }; trigger: { date: Date } };
let pending: Req[] = [];
const N = Notifications as unknown as Record<string, jest.Mock>;
const count = (prefix: string) => pending.filter(n => n.identifier.startsWith(prefix)).length;

beforeEach(() => {
  pending = [];
  N.getAllScheduledNotificationsAsync.mockImplementation(async () => pending.slice());
  N.cancelScheduledNotificationAsync.mockImplementation(async (id: string) => { pending = pending.filter(n => n.identifier !== id); });
  N.scheduleNotificationAsync.mockImplementation(async (r: Req) => { pending.push(r); });
  N.scheduleNotificationAsync.mockClear();
});
afterAll(() => { N.getAllScheduledNotificationsAsync.mockReset().mockResolvedValue([]); });

const r = { on: true, hour: 7, minute: 30 };
const daily: Medication = { name: 'Test', doseMg: 1, every: 'day', weekday: 4, remind: true };

describe('reminders after travel', () => {
  test('a new time zone reschedules, so 7:30 stays 7:30 where you are', async () => {
    await applyReminder(r, false);
    expect(new Date(pending[0].content.data.at).getTime()).toBe(pending[0].trigger.date.getTime());   // the exact moment
    N.scheduleNotificationAsync.mockClear();
    await applyReminder(r, false);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();     // same zone: nothing to do
    // As a phone in London would have left them after flying to New York: same days and clock time, five hours earlier
    pending = pending.map(n => {
      const at = new Date(new Date(n.content.data.at).getTime() - 5 * 3600e3);
      return { ...n, content: { data: { at: at.toISOString() } }, trigger: { date: at } };
    });
    await applyReminder(r, false);
    expect(N.scheduleNotificationAsync).toHaveBeenCalled();
    expect(pending[0].trigger.date.getHours()).toBe(7);
    expect(pending[0].trigger.date.getMinutes()).toBe(30);
  });
});

describe('sharing iOS’s 64-notification limit', () => {
  test('dose reminders on: four weeks of each; off again: weigh-ins get their two months back', async () => {
    await applyReminder(r, false);
    expect(count('weigh-in-')).toBeGreaterThanOrEqual(51);
    await applyDoseReminders(daily, {});
    expect(count('dose-')).toBeGreaterThanOrEqual(27);
    expect(count('weigh-in-')).toBeLessThanOrEqual(reminderBudget(true).weighIns);
    expect(pending.length).toBeLessThanOrEqual(60);
    await applyDoseReminders({ ...daily, remind: false }, {});
    expect(count('dose-')).toBe(0);
    expect(count('weigh-in-')).toBeGreaterThanOrEqual(51);
  });
  test('the budget never goes over 60', () => {
    for (const on of [true, false]) { const b = reminderBudget(on); expect(b.weighIns + b.doses).toBeLessThanOrEqual(60); }
  });
  test('says how far ahead reminders are set, the earlier of the two', () => {
    const now = new Date(2026, 9, 8, 6, 0);
    expect(remindersSetUntil(r, null, {}, false, now)!.getDate()).toBe(28);                // 52 days: 28 Nov
    expect(remindersSetUntil(r, daily, {}, false, now)!.getMonth()).toBe(10);              // 28 days: early Nov
    expect(remindersSetUntil(r, daily, {}, false, now)!.getDate()).toBe(4);
    expect(remindersSetUntil({ ...r, on: false }, { ...daily, remind: false }, {}, false, now)).toBeNull();
  });
});

describe('the free-trial reminder', () => {
  test('one reminder, at 10am two days before the trial is paid, saying nothing about health', async () => {
    const now = new Date(2026, 10, 23, 12).getTime(), ends = new Date(2026, 10, 30, 12).getTime();
    expect(await scheduleTrialReminder(ends, now)).toBe(true);
    const t = pending.find(n => n.identifier === 'plus-trial-ending')!;
    expect(t.trigger.date).toEqual(new Date(2026, 10, 28, 10));
    expect(JSON.stringify(t.content)).not.toMatch(/kg|lb|dose|weight/i);
    await scheduleTrialReminder(ends, now);                               // a second purchase event doesn't double it
    expect(pending.filter(n => n.identifier === 'plus-trial-ending')).toHaveLength(1);
  });
  test('none when that moment has already passed', async () => {
    const now = new Date(2026, 10, 29, 12).getTime(), ends = new Date(2026, 10, 30, 12).getTime();
    expect(await scheduleTrialReminder(ends, now)).toBe(false);
    expect(pending).toHaveLength(0);
  });
});
