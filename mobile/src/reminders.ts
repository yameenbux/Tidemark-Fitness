import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, dateKey, startOfDay } from './core/dates';
import { doseReminderDays } from './core/medication';
import type { Reminder } from './core/storage';
import type { DoseLog, Medication } from './core/types';

// Daily weigh-in reminder, scheduled on the device (local notifications only: nothing is sent to a server).
// Instead of one repeating notification, the next few weeks are scheduled one day at a time, so a day you've
// already logged gets no reminder. It's rescheduled whenever the app opens or a weigh-in is saved.

const PREFIX = 'weigh-in-';
const DOSE_PREFIX = 'dose-';
// iOS allows 64 pending local notifications in all: 52 days of weigh-ins on their own, or 28 days of weigh-ins and
// up to 28 dose reminders (four weeks of a daily dose, 28 of a weekly one) with dose reminders on. Some spare either way.
const DAYS_AHEAD = 52;
const SHARED = 28;
export const DOSE_HOUR = 9;

/** How many weigh-in and dose reminders to schedule, sharing iOS's limit. */
export function reminderBudget(doseReminders: boolean): { weighIns: number; doses: number } {
  return doseReminders ? { weighIns: SHARED, doses: SHARED } : { weighIns: DAYS_AHEAD, doses: 0 };
}
// What was last asked for, so turning dose reminders on or off can resize the weigh-in reminders to fit
let doseRemindersOn = false;
let lastWeighIn: { r: Reminder; loggedToday: boolean } | null = null;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/** Asks for permission if needed. False when the person has said no (they can change it in iOS Settings). */
export async function allowReminders(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } })).granted;
  } catch { return false; }
}

/** The days (from today) that should get a reminder: skips today if it's logged or the time has passed. */
export function reminderDays(r: Reminder, loggedToday: boolean, now: Date = new Date(), days = DAYS_AHEAD): Date[] {
  if (!r.on) return [];
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const at = addDays(startOfDay(now), i);
    at.setHours(r.hour, r.minute, 0, 0);
    if (i === 0 && (loggedToday || at <= now)) continue;
    out.push(at);
  }
  return out;
}

/** True when reminders are on in Tidemark but notifications are switched off for it in iOS Settings. */
export async function remindersBlocked(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try { return !(await Notifications.getPermissionsAsync()).granted; } catch { return false; }
}

// Calls run one after another, so quick changes (spinning the time picker) can't leave duplicate reminders
let queue: Promise<void> = Promise.resolve();

interface Planned { at: Date; title: string; body: string; action: string }

/**
 * Makes the scheduled notifications under `prefix` exactly what `plan` returns (nothing is touched if they already
 * match). The plan is made when its turn comes, so it sees the latest budget (set by calls made in the meantime).
 */
function sync(prefix: string, plan: () => Planned[]): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  queue = queue.then(async () => {
    try {
      const want = plan();
      const ours = (await Notifications.getAllScheduledNotificationsAsync()).filter(n => n.identifier.startsWith(prefix));
      // Nothing to do if exactly these reminders are already scheduled (the usual case on every launch). Compared by the
      // exact moment, not the clock time: after flying to another time zone "7:30" is a different moment
      const key = (at: Date) => prefix + dateKey(at) + '@' + at.toISOString();
      const have = new Set(ours.map(n => n.identifier + '@' + (n.content.data?.at ?? '')));
      if (ours.length === want.length && want.every(w => have.has(key(w.at)))) return;
      await Promise.all(ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
      for (const w of want) {
        await Notifications.scheduleNotificationAsync({
          identifier: prefix + dateKey(w.at),
          content: { title: w.title, body: w.body, data: { action: w.action, at: w.at.toISOString() } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: w.at },
        });
      }
    } catch { /* scheduling can fail on simulators; the setting simply has no effect */ }
  });
  return queue;
}

/** Replaces Tidemark's scheduled weigh-in reminders with the ones this setting calls for. */
export function applyReminder(r: Reminder, loggedToday = false): Promise<void> {
  lastWeighIn = { r, loggedToday };
  return sync(PREFIX, () => reminderDays(r, loggedToday, new Date(), reminderBudget(doseRemindersOn).weighIns).map(at => ({
    at, title: 'Weigh-in', body: 'Step on the scale before breakfast. One number, ten seconds.', action: 'log' })));
}

/** The dose reminders this medication calls for: 9am on each dose day, skipping today once it's marked or past 9am. */
export function doseReminderTimes(med: Medication | null | undefined, doses: DoseLog, now: Date = new Date(), max = reminderBudget(true).doses): Date[] {
  if (!med?.remind) return [];
  return doseReminderDays(med, doses, now, 7 * max).slice(0, max + 1).map(d => { const at = new Date(d); at.setHours(DOSE_HOUR, 0, 0, 0); return at; })
    .filter(at => at > now).slice(0, max);
}

/** Replaces the scheduled dose reminders. The text never names the medication (it shows on the lock screen). */
export function applyDoseReminders(med: Medication | null | undefined, doses: DoseLog): Promise<void> {
  const on = !!med?.remind, changed = on !== doseRemindersOn;
  doseRemindersOn = on;
  // Weigh-ins shrink before dose reminders are added, and grow back only once they're gone, so the total never overflows
  const resize = () => { if (changed && lastWeighIn) applyReminder(lastWeighIn.r, lastWeighIn.loggedToday); return queue; };
  if (on) resize();
  const done = sync(DOSE_PREFIX, () => doseReminderTimes(med, doses).map(at => ({
    at, title: 'Dose day', body: 'Today is a dose day. Mark it in Tidemark once it’s done.', action: 'dose' })));
  return on ? done : resize();
}

/**
 * The last moment reminders are scheduled up to (the earlier of weigh-ins and doses, as both have to fit iOS's limit),
 * or null if none are. Opening Tidemark extends them.
 */
export function remindersSetUntil(r: Reminder, med: Medication | null | undefined, doses: DoseLog, loggedToday = false, now: Date = new Date()): Date | null {
  const b = reminderBudget(!!med?.remind);
  const ends = [reminderDays(r, loggedToday, now, b.weighIns).at(-1), doseReminderTimes(med, doses, now, b.doses).at(-1)]
    .filter((d): d is Date => d != null);
  return ends.length ? new Date(Math.min(...ends.map(d => d.getTime()))) : null;
}

/**
 * Calls `onLog` when the person taps a weigh-in reminder, `onDose` for a dose reminder (including the tap that launched
 * the app). Returns an unsubscribe.
 */
export function onReminderTap(onLog: () => void, onDose: () => void = () => {}): () => void {
  if (Platform.OS === 'web') return () => {};
  const route = (r: Notifications.NotificationResponse | null) => {
    const id = r?.notification.request.identifier ?? '';
    if (id.startsWith(PREFIX)) { onLog(); return true; }
    if (id.startsWith(DOSE_PREFIX)) { onDose(); return true; }
    return false;
  };
  // The tap that launched the app is remembered by iOS; clear it once handled so a later launch doesn't act on it again
  Notifications.getLastNotificationResponseAsync().then(r => {
    if (!route(r)) return;
    try { Notifications.clearLastNotificationResponse(); } catch { /* older native module: harmless */ }
  }).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(r => { route(r); });
  return () => sub.remove();
}

export const timeLabel = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;

const TRIAL_ID = 'plus-trial-ending';
export const TRIAL_NOTICE_DAYS = 2;
/**
 * A free trial of Plus has started: one reminder two days before it becomes paid, as the paywall's timeline says.
 * Only if the person allows notifications (asked here if they haven't been). Says nothing about their health.
 */
export async function scheduleTrialReminder(endsAt: number, now: number = Date.now()): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const at = new Date(endsAt - TRIAL_NOTICE_DAYS * 86400000);
  at.setHours(10, 0, 0, 0);
  if (at.getTime() <= now || !(await allowReminders())) return false;
  try {
    await Notifications.cancelScheduledNotificationAsync(TRIAL_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_ID,
      content: { title: 'Your Plus trial ends in 2 days', body: 'After that, Plus is charged to your Apple ID. To cancel, open iPhone Settings › your name › Subscriptions.', data: { action: 'plus' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    return true;
  } catch { return false; }
}
