import { PlusTeaser } from '../components/PlusTeaser';
import { usableHabits } from '../core/plus';
import { usePlus } from '../plus';
import { CardBoundary } from '../components/States';
import { ProteinCard } from '../components/Protein';
import { EffectsSheet, MedicationToday, MedicationTrend } from '../components/Medication';
import { isDue, missedDose } from '../core/medication';
import { FEATURES } from '../features';
import { cloneElement, isValidElement, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LengthUnit, lengthUnitFor, measureSummary, showLength } from '../core/body';
import { estimateExpenditure, kcalRange } from '../core/calories';
import { describeAutoBackup } from '../core/autoBackup';
import { addDays, DAY_FULL, MON, dateKey, longDate, parseKey, shortDate } from '../core/dates';
import { consistency, milestoneQuarter } from '../core/insights';
import { direction, historyStart, sign } from '../core/plan';
import { milestonePlanKey } from '../core/storage';
import { backupDue, changeTable, daysSince } from '../core/summary';
import { projectedGoalDate, Rate, TrendPoint } from '../core/trend';
import { showChange, showWeight } from '../core/units';
import type { Settings } from '../core/types';
import { BodyCard } from '../components/Body';
import { EntriesList, EventCard } from '../components/Entries';
import { CaloriesCard, MilestoneBanner, PatternsCard } from '../components/Extras';
import { HabitsCard } from '../components/HabitsCard';
import { Hero } from '../components/Hero';
import { ChangeTable, HabitGrids, HabitSummary, Tile, TodayHabits } from '../components/Insights';
import { FirstWeekCard, WeekCard } from '../components/WeekCard';
import { ProgressChart } from '../components/ProgressChart';
import { Notice, SectionLabel, Tab, TabScreen } from '../components/Shell';
import { TrendCard } from '../components/TrendCard';
import { success } from '../feel';
import type { Tracker } from '../store';
import { C, F, themed } from '../theme';

/** What every tab needs: the data, the derived trend, and ways to move around. */
export interface TabProps {
  t: Tracker;
  settings: Settings;
  series: TrendPoint[];
  rate: Rate | null;
  today: string;                           // changes at midnight, so memoised cards refresh
  scrollTop: number;                       // bumps when the active tab is tapped again
  openSettings: (page?: 'habits' | 'medication') => void;
  go: (tab: Tab) => void;
  show: (m: { message: string; action?: string; onAction?: () => void }) => void;
}

/** Signed length change in the person's unit ("−1.0 in", "+2.5 cm"). */
function lengthChange(cm: number, unit: LengthUnit) {
  const sign = Math.abs(cm) < 0.05 ? '' : cm < 0 ? '−' : '+';
  return sign + showLength(Math.abs(cm), unit);
}

export function TodayTab(props: TabProps & { notices: React.ReactNode; onLog: (day?: string) => void }) {
  const { t, settings, series, rate, scrollTop, openSettings, go, notices, onLog } = props;
  const { state, prefs } = t;
  const { plus } = usePlus();
  const unit = state.unit, lu = lengthUnitFor(prefs.length, state.unit);
  const now = new Date();
  const todayKey = dateKey(now);
  const last = series.at(-1);
  const trendNow = last?.trend;
  // Milestones follow the trend, so a single light weigh-in can't trigger one
  const quarter = trendNow != null ? milestoneQuarter(settings.plan, trendNow) : 0;
  const planKey = milestonePlanKey(settings.plan);
  const celebrated = (prefs.milestoneFor ?? planKey) === planKey ? prefs.milestone : 0;
  // Older saves didn't record which plan a milestone belonged to: pin it to the plan in use now, so a later new plan starts fresh
  const legacy = prefs.milestoneFor == null && prefs.milestone > 0;
  useEffect(() => { if (legacy) t.setPrefs({ milestoneFor: planKey }); }, [legacy, planKey, t]);
  const eta = trendNow != null ? projectedGoalDate(trendNow, settings.plan.goalKg, rate) : null;
  const H = usableHabits(settings.habits, plus);   // free: the first few; the rest are kept for Plus
  // A week's change needs weigh-ins in that week: someone who's had a break is told so, not asked for a week's data
  const lapsed = Object.keys(state.weights).some(k => k < dateKey(addDays(now, -7)));
  // Nothing ticked in 30 days (usually day one) shows a dash, not a 0% that reads like a mark
  const ticked30 = H.some(h => consistency(state.habits, h.id, 30, now, historyStart(settings.plan)).done > 0);
  const avg30 = H.length ? Math.round(H.reduce((a, h) => { const c = consistency(state.habits, h.id, 30, now, historyStart(settings.plan)); return a + (c.of ? c.done / c.of : 0); }, 0) / H.length * 100) : 0;
  const waist = measureSummary(state.measurements, 'waist');
  const tdee = settings.trackCalories ? estimateExpenditure(state.intake, series) : null;
  const week = changeTable(series, now, [7])[0].change;
  // New, not back from a break: there's no week to show yet, so show the first week filling in instead
  const firstWeekNow = week == null && !lapsed && Object.keys(state.weights).length > 0;
  const d = sign(direction(settings.plan));
  // On a dose day, or when a dose looks missed, the card goes straight under today's list; otherwise it sits lower.
  // It stays put once taken, so Undo doesn't jump away.
  const med = FEATURES.medication ? settings.medication : null, doseLog = state.doses ?? {};   // dose logging is free
  const [feel, setFeel] = useState(false);
  const doseToday = !!med && (isDue(med, doseLog, now) || !!doseLog[props.today] || !!missedDose(med, doseLog, now));

  return (
    <TabScreen eyebrow={`${DAY_FULL[now.getDay()]} ${now.getDate()} ${MON[now.getMonth()]}`} title="Today" onSettings={() => openSettings()} scrollTop={scrollTop}>
      {notices}
      <CardBoundary name="Your weight"><Hero settings={settings} weights={state.weights} unit={unit} today={props.today} trend={series} /></CardBoundary>
      {/* The day's jobs come before the reading: weigh in, tick habits, then look at the charts */}
      <CardBoundary name="Today’s habits"><TodayHabits settings={settings} habits={state.habits} onChange={t.setHabits} onOpenSession={() => go('habits')}
        weigh={{ done: state.weights[todayKey] != null, onPress: () => onLog(state.weights[todayKey] != null ? todayKey : undefined) }}
        summary={H.length ? <HabitSummary pct={ticked30 ? avg30 : null} onPress={() => go('habits')} /> : undefined} /></CardBoundary>
      {/* A dose due today is the next job after the daily ticks (weekly, so it doesn't push the list down) */}
      {med && doseToday && <CardBoundary name="Medication"><MedicationToday med={med} doses={doseLog} onChange={t.setDoses} onHistory={() => openSettings('medication')} plus={plus} onEffects={() => setFeel(true)} /></CardBoundary>}
      {quarter > celebrated && trendNow != null && (
        <MilestoneBanner quarter={quarter} settings={settings} trendNow={trendNow} unit={unit} onDismiss={() => t.setPrefs({ milestone: quarter, milestoneFor: planKey })} />
      )}
      {/* This week across the full width: the trend through each of the last seven days, each labelled */}
      <CardBoundary name="This week">
        {firstWeekNow ? <FirstWeekCard weights={state.weights} /> : <WeekCard series={series} weights={state.weights} unit={unit} onPress={() => go('trend')}
          value={week != null ? showChange(week, unit, 1) : '—'}
          valueColor={week == null || d === 0 ? C.ink : week * d > 0.05 ? C.mintInk : week * d < -0.05 ? C.coralInk : C.ink}
          sub={week != null ? 'change in your trend, last 7 days' : lapsed ? 'No weigh-in in the last 7 days' : 'Needs a week of weigh-ins'}
          a11y={week != null ? `This week: trend changed ${showChange(week, unit, 1)} in the last 7 days` : 'This week: needs a week of weigh-ins'}
          // The pace is the average over recent weeks (the same figure as Trend's "Average a week"), so say so: it's
          // why it can differ from this week's change above
          foot={eta && rate ? (prefs.hide
            ? `At your average pace you’ll reach your goal around ${longDate(eta)}.`
            : `At your average pace (${showChange(rate.perWeek, unit, 1)} a week) you’ll reach ${showWeight(settings.plan.goalKg, unit)} around ${longDate(eta)}.`) : undefined} />}
      </CardBoundary>
      {/* Plus: calories or the waist beside the week (free has its weigh-in count inside the week card) */}
      {plus && <View style={s.tiles}>
        {settings.trackCalories && plus ? (
          <Tile icon="flame" label="Calories" onPress={() => go('body')}
            value={tdee ? kcalRange(tdee.low, tdee.high) : state.intake[todayKey] != null ? `${state.intake[todayKey].toLocaleString()} kcal` : 'Log food'}
            sub={tdee ? 'kcal you burn a day' : state.intake[todayKey] != null ? 'eaten today' : 'Calories eaten today'}
            a11y={tdee ? `Estimated burn ${tdee.low} to ${tdee.high} kcal a day` : 'Calories'} />
        ) : (
          <Tile icon="ruler" label="Body" onPress={() => go('body')}
            value={waist && waist.first.k !== waist.latest.k ? lengthChange(waist.change, lu) : waist ? showLength(waist.latest.cm, lu) : 'Measure'}
            sub={waist && waist.first.k !== waist.latest.k ? `waist since ${shortDate(parseKey(waist.first.k))} · now ${showLength(waist.latest.cm, lu)}`
              : waist ? 'waist · measure again in a few weeks' : 'Waist and photos show what the scale can’t'}
            a11y={waist ? `Waist ${showLength(waist.latest.cm, lu)}${waist.first.k !== waist.latest.k ? `, ${lengthChange(waist.change, lu)} since ${longDate(waist.first.k)}` : ''}` : 'Body measurements, none yet'} />
        )}
      </View>}
      {/* No habits yet: the invitation stays where the habit figures would be */}
      {!H.length && (
        <View style={s.tiles}>
          <Tile icon="habits" label="Habits" onPress={() => openSettings('habits')}
            value="Add habits" sub="Small daily ticks, no streaks" a11y="Habits, none set up. Opens habit settings." />
        </View>
      )}
      {med && !doseToday && <CardBoundary name="Medication"><MedicationToday med={med} doses={doseLog} onChange={t.setDoses} onHistory={() => openSettings('medication')} plus={plus} onEffects={() => setFeel(true)} /></CardBoundary>}
      {feel && <EffectsSheet day={props.today} effects={state.effects ?? {}} onSave={t.setEffects} onClose={() => setFeel(false)} />}
      {plus && settings.protein?.on && trendNow != null && <CardBoundary name="Protein"><ProteinCard settings={settings} trendKg={trendNow} log={state.protein ?? {}} onChange={t.setProtein} /></CardBoundary>}
      <CardBoundary name="Your event"><EventCard settings={settings} /></CardBoundary>
      {isValidElement<{ part?: string }>(notices) ? cloneElement(notices, { part: 'nudge' }) : null}
    </TabScreen>
  );
}

export function TrendTab({ t, settings, series, today, scrollTop, openSettings, onReplan, onHold, onEdit, onReport }: TabProps & {
  onReplan: (next: Settings['plan']) => void; onHold?: (next: Settings['plan']) => void; onEdit: (k: string) => void; onReport?: () => void;
}) {
  const { state } = t;
  const { plus, openPaywall } = usePlus();
  return (
    <TabScreen eyebrow={`${settings.plan.targets.length - 1}-week plan`} title="Trend" onSettings={() => openSettings()} scrollTop={scrollTop}>
      <CardBoundary name="Your trend"><TrendCard settings={settings} weights={state.weights} unit={state.unit} onReplan={onReplan} onHold={onHold} trend={series} today={today} notes={state.notes} /></CardBoundary>
      {series.length >= 2 && <ChangeTable series={series} unit={state.unit} today={today} d={sign(direction(settings.plan)) as -1 | 0 | 1} />}
      <CardBoundary name="The chart"><ProgressChart settings={settings} weights={state.weights} unit={state.unit} trend={series} today={today} notes={state.notes} /></CardBoundary>
      {FEATURES.medication && settings.medication && (plus
        ? <CardBoundary name="Medication"><MedicationTrend med={settings.medication} doses={t.state.doses ?? {}} series={series} unit={t.state.unit} onHistory={() => openSettings('medication')} effects={t.state.effects} onReport={onReport} /></CardBoundary>
        // Free, once doses are logged: their own doses with each result hidden. Before that, a plain teaser.
        : Object.keys(t.state.doses ?? {}).length > 0
        ? <CardBoundary name="Medication"><MedicationTrend med={settings.medication} doses={t.state.doses ?? {}} series={series} unit={t.state.unit} effects={t.state.effects} onUnlock={() => openPaywall('medication')} /></CardBoundary>
        : <PlusTeaser feature="medication" icon="pill" title={`${settings.medication.name} and your trend`}
            body="See how your trend moved at each dose, rotate injection sites, spot side-effect patterns and make a report for your doctor." />)}
      <SectionLabel>History</SectionLabel>
      <CardBoundary name="Weigh-ins"><EntriesList settings={settings} weights={state.weights} unit={state.unit} onEdit={onEdit} trend={series} notes={state.notes} /></CardBoundary>
    </TabScreen>
  );
}

export function HabitsTab({ t, settings, series, today, scrollTop, openSettings, onLogSession }: TabProps & { onLogSession: (k: string, dow: number) => void }) {
  const addHabits = () => openSettings('habits');
  const { state } = t;
  return (
    <TabScreen eyebrow="Consistency, not streaks" title="Habits" onSettings={() => openSettings()} scrollTop={scrollTop}>
      <CardBoundary name="This week"><HabitsCard settings={settings} habits={state.habits} onChange={t.setHabits} onLogSession={onLogSession} today={today} onAddHabits={addHabits} /></CardBoundary>
      <CardBoundary name="Last 30 days"><HabitGrids settings={settings} habits={state.habits} today={today} /></CardBoundary>
      <CardBoundary name="Patterns"><PatternsCard settings={settings} weights={state.weights} habits={state.habits} unit={state.unit} trend={series} today={today} /></CardBoundary>
    </TabScreen>
  );
}

export function BodyTab({ t, settings, series, scrollTop, openSettings, show }: TabProps) {
  const { state, prefs } = t;
  const { plus } = usePlus();
  if (!plus) {
    // Free: the waist, so the tab is never just a locked door; the rest is Plus
    const kept = Object.values(state.measurements).some(d => Object.keys(d).some(k => k !== 'waist')) || Object.keys(state.photos).length > 0 || Object.keys(state.intake).length > 0;
    return (
      <TabScreen eyebrow="Beyond the scale" title="Body" onSettings={() => openSettings()} scrollTop={scrollTop}>
        <CardBoundary name="Waist"><BodyCard waistOnly settings={settings} weights={state.weights} unit={state.unit} lengthUnit={lengthUnitFor(prefs.length, state.unit)}
          onLengthUnit={length => t.setPrefs({ length })} measurements={state.measurements} photos={state.photos}
          onMeasurements={m => { t.setMeasurements(m); success(); }} onPhotos={t.setPhotos} /></CardBoundary>
        <PlusTeaser feature="body" icon="body" kept={kept} title="Hips, chest, arms, photos and calories"
          body="Private progress photos, more measurements and an estimate of the calories you burn are part of Tidemark Plus." />
      </TabScreen>
    );
  }
  return (
    <TabScreen eyebrow="Beyond the scale" title="Body" onSettings={() => openSettings()} scrollTop={scrollTop}>
      <CardBoundary name="Measurements & photos"><BodyCard settings={settings} weights={state.weights} unit={state.unit} lengthUnit={lengthUnitFor(prefs.length, state.unit)}
        onLengthUnit={length => t.setPrefs({ length })} measurements={state.measurements} photos={state.photos}
        onMeasurements={m => { t.setMeasurements(m); success(); }} onPhotos={t.setPhotos} /></CardBoundary>
      {settings.trackCalories
        ? <CardBoundary name="Calories"><CaloriesCard settings={settings} weights={state.weights} intake={state.intake} onChange={t.setIntake} trend={series} /></CardBoundary>
        : <Notice icon="flame" title="Estimate what you burn (optional)"
            body="Each day, enter roughly how many calories you ate. After two weeks Tidemark compares that with your trend and estimates how many you burn a day. You never enter calories burned."
            action="Turn on" onAction={() => { t.setSettings({ ...settings, trackCalories: true }); show({ message: 'Calorie logging on' }); }} />}
    </TabScreen>
  );
}

/** Notices shown at the top of Today: unreadable data, failing saves, a lock that switched itself off, backups. */
export function TodayNotices({ part = 'urgent', t, lockLost, onLockLostDismiss, backupHidden, onBackupHide, onExport, onRestore, onExportRescued, pendingPlan, onSavePending, onDiscardPending }: {
  part?: 'urgent' | 'nudge';   // urgent notices sit above the weight; the backup nudge waits at the bottom of Today
  t: Tracker; lockLost: boolean; onLockLostDismiss: () => void; backupHidden: boolean; onBackupHide: () => void;
  onExport: () => void; onRestore: () => void; onExportRescued: () => void;
  pendingPlan: Settings['plan'] | null; onSavePending: () => void; onDiscardPending: () => void;
}) {
  const { prefs, state } = t;
  const lastBackupDays = daysSince(prefs.lastBackup);
  // The backup nudge waits while anything more urgent is showing, so Today never opens on a stack of cards
  const urgent = t.recovered || !!pendingPlan || lockLost || t.saveFailed;
  // Automatic backups that are working make the nudge unnecessary; ones that have stopped working say so instead
  const auto = prefs.autoBackup.on ? describeAutoBackup(prefs.autoBackup) : null;
  const showBackup = part === 'nudge' && !urgent && !backupHidden && (auto ? auto.warn : backupDue(prefs.lastBackup, Object.keys(state.weights).length));
  if (part === 'nudge' && auto?.warn) return showBackup ? <Notice tone="warn" icon="download" title="Automatic backup isn’t saving"
    body={auto.text + ' Check the folder in Settings › Automatic backup, or export a backup by hand.'}
    action="Export a backup" onAction={onExport} onDismiss={onBackupHide} /> : null;
  if (part === 'nudge') return showBackup ? <Notice icon="download" title={lastBackupDays == null ? 'Make your first backup' : `Last backup ${lastBackupDays} days ago`}
    body="Your data lives only on this phone. A backup file kept somewhere safe off this phone means a lost phone isn’t lost data."
    action="Back up now" onAction={onExport} onDismiss={onBackupHide} /> : null;
  return (
    <>
      {t.recovered && (
        <Notice tone="warn" icon="shield" title="Some saved data couldn’t be read"
          body="Tidemark kept an untouched copy on this phone. Restore a backup if you have one, or export the copy to keep it safe."
          action="Restore a backup" onAction={onRestore} onDismiss={t.dismissRecovered} />
      )}
      {t.recovered && (
        <Notice icon="download" title="Export the saved copy" body="Shares the unreadable data as a file, exactly as it was found."
          action="Export copy" onAction={onExportRescued} />
      )}
      {pendingPlan && (
        <Notice icon="target" title="Unsaved plan changes"
          body={`You left Settings with a new plan (goal ${showWeight(pendingPlan.goalKg, state.unit)} by ${longDate(pendingPlan.goalDate)}) that wasn’t saved.`}
          action="Save the new plan" onAction={onSavePending} onDismiss={onDiscardPending} />
      )}
      {lockLost && (
        <Notice tone="warn" icon="lock" title="The lock has been turned off"
          body="This iPhone no longer has a passcode or Face ID, so Tidemark couldn’t keep asking for it. Turn the lock back on in Settings once a passcode is set."
          onDismiss={onLockLostDismiss} />
      )}
      {t.saveFailed && (
        <Notice tone="warn" icon="info" title="Changes aren’t being saved" body="This phone is refusing to save right now (often full storage). Free some space, then make any change to retry." />
      )}
      {showBackup && (
        <Notice icon="download" title={lastBackupDays == null ? 'Make your first backup' : `Last backup ${lastBackupDays} days ago`}
          body="Your data lives only on this phone. A backup file kept somewhere safe off this phone means a lost phone isn’t lost data."
          action="Back up now" onAction={onExport} onDismiss={onBackupHide} />
      )}
    </>
  );
}

const s = themed(() => StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  dotsCap: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, marginTop: 5 },
}));
