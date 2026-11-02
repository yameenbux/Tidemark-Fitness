import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { lengthUnitFor } from './core/body';
import { FEATURES } from './features';
import { PlusProvider } from './plus';
import { plusActive, type PlusStatus } from './core/plus';
import { addDays, dateKey, longDate, parseKey, startOfDay } from './core/dates';
import { historyStart, weightSeries } from './core/plan';
import { trendSeries, weeklyRate } from './core/trend';
import { setWeightsHidden, showAmount, showWeight } from './core/units';
import type { Settings } from './core/types';
import { CoverContext, CoverOverlay } from './components/Cover';
import { LogSheet } from './components/Entries';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DoneWindow } from './components/KeyboardDone';
import { TodaySkeleton } from './components/States';
import { LiftSheet } from './components/Extras';
import { ActivePane, Tab, TabBar, Toast } from './components/Shell';
import { confirm, notify } from './dialogs';
import { success } from './feel';
import { allowReminders, applyDoseReminders, applyReminder, onReminderTap, remindersBlocked } from './reminders';
import { LoadFailedScreen, LockScreen } from './screens/LockScreen';
import { Onboarding } from './screens/Onboarding';
import { SettingsScreen } from './screens/SettingsScreen';
import { BodyTab, HabitsTab, TabProps, TodayNotices, TodayTab, TrendTab } from './screens/Tabs';
import { Reminder, useTracker } from './store';
import { useAppearance } from './appearance';
import { clearCache } from './io';
import { C, themed, useScheme } from './theme';
import { useDataActions } from './useDataActions';
import { useLock } from './useLock';
import { useHealth } from './useHealth';
import { useWeighIn } from './useWeighIn';
import { useAutoBackup } from './useAutoBackup';
import { shareReport } from './report';
import { widgetProps } from './core/widgetData';
import { syncWidgets } from './widgets/sync';

SplashScreen.preventAutoHideAsync().catch(() => {});   // keep the splash up until saved data has loaded
setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 6000);   // safety net: never stay on the splash forever

interface ToastMsg { id: number; message: string; action?: string; onAction?: () => void }

/** Re-renders when the app comes back to the foreground and at midnight, so "today" is never yesterday. */
function useToday(): string {
  const [day, setDay] = useState(() => dateKey(new Date()));
  useEffect(() => {
    const refresh = () => setDay(dateKey(new Date()));
    const sub = AppState.addEventListener('change', st => { if (st === 'active') refresh(); });
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { timer = setTimeout(() => { refresh(); arm(); }, addDays(startOfDay(), 1).getTime() - Date.now() + 1000); };
    arm();
    return () => { sub.remove(); clearTimeout(timer); };
  }, []);
  return day;
}

function Main() {
  const t = useTracker();
  const { setPrefs } = t;
  const onPlusStatus = useCallback((plus: PlusStatus) => setPrefs({ plus }), [setPrefs]);
  const { state, prefs } = t;
  const plusOn = FEATURES.webPlus || plusActive(prefs.plus);   // Tidemark Plus, as Apple last confirmed it (or the web preview)
  setWeightsHidden(prefs.hide);            // read by showWeight() during this render, like the colour palette
  const today = useToday();
  useAppearance(prefs.appearance);
  const [tab, setTab] = useState<Tab>('today');
  const [scrollTop, setScrollTop] = useState<Record<Tab, number>>({ today: 0, trend: 0, habits: 0, body: 0 });   // per tab
  const [pendingPlan, setPendingPlan] = useState<Settings['plan'] | null>(null);   // plan edits left unsaved
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPage, setSettingsPage] = useState<'root' | 'habits' | 'medication'>('root');
  const [lift, setLift] = useState<{ k: string; dow: number } | null>(null);
  const [log, setLog] = useState<{ key: string | null; n: number } | null>(null);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [backupHidden, setBackupHidden] = useState(false);
  const [justSetUp, setJustSetUp] = useState(false);   // setup has just finished in this session
  const lock = useLock(t.ready, prefs, t.setPrefs);
  const insets = useSafeAreaInsets();
  const health = useHealth(t);
  const autoBackup = useAutoBackup(t);

  const show = useCallback((m: Omit<ToastMsg, 'id'>) => setToast({ ...m, id: Date.now() }), []);
  const weighIn = useWeighIn(t, health, show);
  const hideToast = useCallback(() => setToast(null), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const data = useDataActions(t, show, closeSettings, plusOn);

  // Hide the splash two frames after loading, so the saved appearance (e.g. Dark) is already painted underneath
  useEffect(() => {
    if (!t.ready) return;
    let f2 = 0;
    const f1 = requestAnimationFrame(() => { f2 = requestAnimationFrame(() => { SplashScreen.hideAsync().catch(() => {}); }); });
    return () => { cancelAnimationFrame(f1); cancelAnimationFrame(f2); };
  }, [t.ready]);
  // Leftovers in the cache (an export interrupted by a crash, picker copies) are cleared on every launch
  useEffect(() => { if (t.ready) clearCache(); }, [t.ready]);
  // Reminders: skip today once it's logged, and keep the window rolling (re-run each day and on changes)
  const loggedToday = state.weights[today] != null;
  useEffect(() => { if (t.ready) applyReminder(prefs.reminder, loggedToday); }, [t.ready, prefs.reminder, loggedToday, today]);
  const med = FEATURES.medication ? state.settings?.medication : null, doses = state.doses;   // dose reminders are free
  useEffect(() => { if (t.ready) applyDoseReminders(med, doses ?? {}); }, [t.ready, med, doses, today]);
  // Tapping a reminder opens the log sheet. It waits for Face ID when the lock is on, then opens straight after unlock.
  const [pendingLog, setPendingLog] = useState<number | null>(null);
  // A dose reminder opens Today, where the dose card is (the lock, if on, still asks first)
  useEffect(() => onReminderTap(() => setPendingLog(Date.now()), () => { setShowSettings(false); setTab('today'); }), []);

  // Reminders switched on here but notifications switched off in iOS Settings: say so in Settings
  const [notifBlocked, setNotifBlocked] = useState(false);
  useEffect(() => {
    if (!prefs.reminder.on) return;
    const check = () => { remindersBlocked().then(setNotifBlocked); };
    check();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') check(); });
    return () => sub.remove();
  }, [prefs.reminder.on]);

  const setReminder = async (r: Reminder) => {
    if (r.on && !(await allowReminders())) {
      notify('Notifications are off for Tidemark', 'To get a weigh-in reminder, allow notifications for Tidemark in the iPhone Settings app.');
      return;
    }
    t.setPrefs({ reminder: r });
  };
  const finishSetup = async (s: Settings, wantLock: boolean) => {
    // Ask for Face ID now, as Settings does, so the lock is only switched on once we know it works
    if (wantLock && !(await lock.setLock(true, lock.lockName))) {
      notify(`${lock.lockName} wasn't turned on`, `You can switch the lock on any time in Settings.`);
    }
    t.setSettings(s);
    setJustSetUp(true);   // the app opens with Plus offered once (see PlusProvider)
    // The starting weight counts as today's weigh-in (never back-dated to the plan's Monday)
    if (parseKey(s.plan.start) <= startOfDay()) t.setWeight(dateKey(new Date()), s.plan.startKg);
    setTab('today');
  };

  // The trend is worked out once per change and shared by every tab
  const settings = state.settings;
  const series = useMemo(() => (settings ? trendSeries(weightSeries(settings.plan, state.weights)) : []), [settings, state.weights]);
  const rate = useMemo(() => (today ? weeklyRate(series) : null), [series, today]);   // the 28-day window moves with the date
  // The Home Screen and Lock Screen widgets get a fresh snapshot whenever what they show changes (and at midnight, for
  // "this week"). With the app lock on they get nothing but the fact that it's locked.
  useEffect(() => {
    if (t.ready) syncWidgets(widgetProps(settings ?? null, state.weights, series, state.unit, prefs.lock));
  }, [t.ready, settings, state.weights, series, state.unit, prefs.lock, prefs.hide, today]);

  // Any open sheets close when the app locks (and don't reopen on unlock); a tapped reminder's log sheet opens after it.
  // Reacting to the lock (owned by useLock) after the commit; the sheets aren't rendered while locked anyway.
  useEffect(() => {
    if (!lock.locked) return;
    setShowSettings(false); setLog(null); setLift(null);   // eslint-disable-line react-hooks/set-state-in-effect
  }, [lock.locked]);
  useEffect(() => {
    if (lock.locked || !settings || pendingLog == null) return;
    setPendingLog(null); setShowSettings(false); setTab('today'); setLog({ key: null, n: pendingLog });   // eslint-disable-line react-hooks/set-state-in-effect
  }, [lock.locked, settings, pendingLog]);

  if (!t.ready) return <TodaySkeleton />;
  if (t.loadFailed) return <LoadFailedScreen onRetry={t.retryLoad} />;

  // The lock comes before everything else that shows data, onboarding included (a recovered setup shows weigh-in counts).
  // While locked, render nothing but the lock: no data underneath for VoiceOver. Plus still listens to the store, so a
  // purchase that completes while locked (e.g. approved in a banking app) is finished and unlocks.
  if (lock.locked) {
    return (
      <PlusProvider key="app" status={prefs.plus} onStatus={onPlusStatus} locked>
        <LockScreen lockName={lock.lockName} onUnlock={lock.tryUnlock} />
      </PlusProvider>
    );
  }

  if (!settings) {
    const kept = Object.keys(state.weights).length;
    return (
      <PlusProvider key="setup" status={prefs.plus} onStatus={onPlusStatus}>
      <CoverContext.Provider value={lock.covered}>
      <Onboarding unit={state.unit} setUnit={t.setUnit} lockAvailable={lock.lockAvailable} lockName={lock.lockName}
        onDone={finishSetup} onRestore={data.restore}
        notice={t.recovered ? `Your saved plan couldn’t be read, so Tidemark kept a copy on this phone${kept ? ` and kept your ${kept} weigh-in${kept === 1 ? '' : 's'}` : ''}. Set your plan up again, or restore a backup.` : undefined} />
      <CoverOverlay />
      </CoverContext.Provider>
      </PlusProvider>
    );
  }


  const replan = async (next: Settings['plan']) => {
    const ok = await confirm('Start a new line from here?', `Your goal date moves to ${longDate(next.goalDate)}. Past weeks and every weigh-in stay as they are.`, 'Re-plan', false);
    if (ok) { t.setSettings({ ...settings, plan: next }); success(); show({ message: 'New line from today' }); }
  };
  // Plus: a PDF for a doctor or nurse, made on the phone and shared where the person chooses
  const report = async () => {
    try { await shareReport({ settings, series, unit: state.unit, doses: state.doses, effects: state.effects, measurements: state.measurements, notes: state.notes }); }
    catch (e) { notify('Couldn’t make the report', e instanceof Error ? e.message : 'Please try again.'); }
  };
  const hold = async (next: Settings['plan']) => {
    const ok = await confirm(prefs.hide ? 'Hold at your goal?' : `Hold at ${showWeight(next.goalKg, state.unit)}?`, `For the next 26 weeks Tidemark keeps you within ${showAmount(next.holdKg ?? 1.5, state.unit)} either side. Every weigh-in stays as it is, and you can set a new goal any time in Settings.`, 'Hold', false);
    if (ok) { t.setSettings({ ...settings, plan: next }); success(); show({ message: 'Now holding your goal' }); }
  };
  const props: TabProps = { t, settings, series, rate, today, scrollTop: 0, openSettings: page => { setSettingsPage(page ?? 'root'); setShowSettings(true); }, go: setTab, show };
  const top = (id: Tab) => scrollTop[id];

  // All four tabs stay mounted (only the active one is shown), so scroll position and open panels survive switching
  const pane = (id: Tab, el: React.ReactNode) => (
    <View key={id + (prefs.hide ? '-hidden' : '')} style={[s.fill, tab !== id && s.hidden]} pointerEvents={tab === id ? 'auto' : 'none'}
      accessibilityElementsHidden={tab !== id} importantForAccessibility={tab === id ? 'auto' : 'no-hide-descendants'}>
      <ActivePane.Provider value={tab === id}>{el}</ActivePane.Provider>
    </View>
  );

  return (
    <PlusProvider key="app" status={prefs.plus} onStatus={onPlusStatus} audience={settings.medication ? 'medication' : 'general'} welcome={justSetUp}>
      <CoverContext.Provider value={lock.covered}>
      <DoneWindow>
      <View style={s.fill}>
        {pane('today', <TodayTab {...props} scrollTop={top('today')} onLog={day => setLog({ key: day ?? null, n: Date.now() })} notices={
          <TodayNotices t={t} lockLost={lock.lockLost} onLockLostDismiss={lock.dismissLockLost} backupHidden={backupHidden}
            onBackupHide={() => setBackupHidden(true)} onExport={data.exportData} onRestore={data.restore} onExportRescued={data.exportRescued}
            pendingPlan={pendingPlan} onSavePending={() => { if (pendingPlan) { t.setSettings({ ...settings, plan: pendingPlan }); success(); show({ message: 'Plan saved' }); } setPendingPlan(null); }}
            onDiscardPending={() => setPendingPlan(null)} />} />)}
        {pane('trend', <TrendTab {...props} scrollTop={top('trend')} onReplan={replan} onHold={hold} onReport={report} onEdit={k => setLog({ key: k, n: Date.now() })} />)}
        {pane('habits', <HabitsTab {...props} scrollTop={top('habits')} onLogSession={(k, dow) => setLift({ k, dow })} />)}
        {pane('body', <BodyTab {...props} scrollTop={top('body')} />)}

        {toast && <Toast key={toast.id} message={toast.message} action={toast.action} onAction={toast.onAction} onHide={hideToast} />}
        <TabBar tab={tab} onTab={setTab} onReselect={() => setScrollTop(st => ({ ...st, [tab]: st[tab] + 1 }))} onLog={() => setLog({ key: null, n: Date.now() })} />

        {lift && (
          <LiftSheet dateK={lift.k} session={settings.sessions[lift.dow]} lifts={state.lifts} unit={state.unit} onClose={() => setLift(null)}
            onSave={l => { t.setLifts(l); success(); setLift(null); show({ message: 'Session saved' }); }} />
        )}
        {log && (
          <LogSheet key={log.n} initialKey={log.key} weights={state.weights} notes={state.notes} unit={state.unit} minKey={historyStart(settings.plan)} onClose={() => setLog(null)}
            onSave={(k, kg, note) => { weighIn.save(log.key, k, kg, note); setLog(null); }}
            onDelete={k => { weighIn.remove(k); setLog(null); }} />
        )}

        <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSettings}>
          {/* On iPhone a page sheet starts below the status bar. The web build (added to the Home Screen) shows it full
              screen under a see-through status bar, so it needs the notch's height on top or the header sits on the clock */}
          <View style={[s.fill, Platform.OS === 'web' && { paddingTop: insets.top }]}>
            <SettingsScreen initialPage={settingsPage} settings={settings} unit={state.unit} setUnit={t.setUnit}
              lock={prefs.lock} lockAvailable={lock.lockAvailable} lockName={lock.lockName} onLockChange={on => lock.setLock(on, lock.lockName)}
              reminder={prefs.reminder} onReminderChange={setReminder} lastBackup={prefs.lastBackup}
              appearance={prefs.appearance} onAppearanceChange={a => t.setPrefs({ appearance: a })}
              hideWeight={prefs.hide} onHideWeightChange={hide => t.setPrefs({ hide })}
              health={health.available ? { on: health.on, set: health.setHealth } : undefined} onReport={report} autoBackup={autoBackup.available ? autoBackup : undefined} reminderBlocked={prefs.reminder.on && notifBlocked}
              weighIns={Object.keys(state.weights).length} weights={state.weights} onPlanLeftUnsaved={setPendingPlan}
              doses={state.doses ?? {}} onDoses={t.setDoses}
              lengthUnit={lengthUnitFor(prefs.length, state.unit)} onLengthUnit={length => t.setPrefs({ length })}
              onSave={t.setSettings} onClose={closeSettings}
              onExport={data.exportData} onExportCsv={data.exportCsv} onRestore={data.restore} onReset={data.reset}
              onEraseAll={async () => { await data.eraseAll(); setTab('today'); }} />
            <CoverOverlay />
          </View>
        </Modal>

        <CoverOverlay />
      </View>
      </DoneWindow>
    </CoverContext.Provider>
      </PlusProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold,
    HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold,
  });
  useEffect(() => { if (fontError) SplashScreen.hideAsync().catch(() => {}); }, [fontError]);
  const scheme = useScheme();                    // the whole tree repaints when the appearance changes
  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ErrorBoundary>
        {/* If the fonts fail to load, carry on with the system font rather than a blank screen */}
        {fontsLoaded || fontError ? <Main /> : <View style={s.fill} />}
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const s = themed(() => StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  // Native: keep hidden tabs laid out (scroll positions survive). Web preview: take them out of the page entirely.
  hidden: Platform.OS === 'web' ? { display: 'none' } : { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0 },
}));
