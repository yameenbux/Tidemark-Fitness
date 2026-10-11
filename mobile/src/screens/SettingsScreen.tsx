import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { dateKey, DAY_ABBR, DAY_ORDER, longDate, shortDate } from '../core/dates';
import { normalizeSettings } from '../core/plan';
import { daysSince } from '../core/summary';
import { describeAutoBackup, type AutoBackup } from '../core/autoBackup';
import { showWeight } from '../core/units';
import type { DoseLog, Habit, Settings, Unit } from '../core/types';
import type { Reminder } from '../core/storage';
import { AppearanceToggle, LengthToggle, UnitToggle } from '../components/Fields';
import { DoneWindow } from '../components/KeyboardDone';
import { Tabs } from '../components/ui';
import { askPassword, notify } from '../dialogs';
import { success } from '../feel';
import { FEATURES, WEB_PREVIEW } from '../features';
import { APP_STORE_ID, PRIVACY_URL, SUPPORT_EMAIL } from '../support';
import { writeReviewUrl } from '../core/reviewAsk';
import { PaywallSlot, usePlus } from '../plus';
import { PLUS_PRODUCTS } from '../core/plus';
import { remindersSetUntil } from '../reminders';
import { AppearancePref, C } from '../theme';
import { Group, Row, SwitchRow, TimeInput, Pushed, s } from './settings/kit';
import { PlanPage, EventPage } from './settings/PlanPage';
import { HabitsPage, SessionsPage } from './settings/HabitsPage';
import { MealsPage } from './settings/MealsPage';
import { BackupPage, CreditsPage } from './settings/BackupPage';
import { MedicationPage } from './settings/MedicationPage';


// ---------- screen ----------

export type Page = 'root' | 'plan' | 'event' | 'habits' | 'sessions' | 'meals' | 'credits' | 'medication' | 'backup';

/** Automatic backups, where the phone can do them (iOS build with the native folder module). */
export interface AutoBackupApi { prefs: AutoBackup; choose: () => Promise<{ ok: boolean; error?: string }>; turnOff: () => void; backUpNow: () => Promise<boolean> }

export interface SettingsProps {
  settings: Settings; unit: Unit; setUnit: (u: Unit) => void;
  lock: boolean; lockAvailable: boolean; lockName: string; onLockChange: (on: boolean) => void;
  reminder: Reminder; onReminderChange: (r: Reminder) => void;
  appearance: AppearancePref; onAppearanceChange: (a: AppearancePref) => void; reminderBlocked?: boolean;
  hideWeight?: boolean; onHideWeightChange?: (on: boolean) => void;
  health?: { on: boolean; set: (on: boolean) => Promise<boolean> };   // absent where there's no Apple Health
  onReport?: () => void;
  autoBackup?: AutoBackupApi;   // absent where automatic backups can't run (web, Expo Go, Android)
  lastBackup: string | null; weighIns: number; weights: Record<string, number>;
  doses: DoseLog; onDoses: (d: DoseLog) => void;
  lengthUnit: 'cm' | 'in'; onLengthUnit: (u: 'cm' | 'in') => void;
  onPlanLeftUnsaved: (plan: Settings['plan']) => void;
  initialPage?: Page;   // open straight onto a sub-page (e.g. Habits from an empty Habits tab)
  onSave: (s: Settings) => void; onClose: () => void;
  onExport: () => void; onExportCsv: () => void; onRestore: () => void; onReset: () => void; onEraseAll: () => void;
}

/** Settings as an iOS grouped list: every row shows its current value, and changes apply as you make them. */
export function SettingsScreen(p: SettingsProps) {
  const [page, setPage] = useState<Page>(p.initialPage ?? 'root');
  const plusApi = usePlus();
  const { plus, openPaywall } = plusApi;
  const { settings, unit } = p;
  const commit = (patch: Partial<Settings>) => {
    const next = normalizeSettings({ ...settings, ...patch });
    if (next) { p.onSave(next); success(); }
  };
  const [leaving, setLeaving] = useState(false);
  const back = () => setLeaving(true);                       // Pushed animates out, then the page is removed
  const gone = useCallback(() => { setPage('root'); setLeaving(false); }, []);

  // Sub-pages save when you leave them, however you leave (Back, swiping the sheet away, or the app locking)
  const keep = <T,>(key: keyof Settings) => (v: T) => { if (JSON.stringify(v) !== JSON.stringify(settings[key])) commit({ [key]: v } as Partial<Settings>); };
  function subPage() {
  if (page === 'plan') return <PlanPage settings={settings} unit={unit} weights={p.weights} onSave={plan => { commit({ plan }); back(); }} onBack={back} onLeaveUnsaved={p.onPlanLeftUnsaved} />;
  if (page === 'event') return <EventPage settings={settings} onSave={keep<Settings['event']>('event')} onBack={back} />;
  if (page === 'habits') return <HabitsPage settings={settings} onSave={keep<Habit[]>('habits')} onBack={back} />;
  if (page === 'sessions') return <SessionsPage settings={settings} onSave={keep<Settings['sessions']>('sessions')} onBack={back} />;
  if (page === 'credits') return <CreditsPage onBack={back} />;
  if (page === 'backup' && p.autoBackup) return <BackupPage api={p.autoBackup} onBack={back} />;
  if (page === 'medication') return <MedicationPage settings={settings} doses={p.doses} onDoses={p.onDoses} onSave={keep<Settings['medication']>('medication')} onBack={back} />;
  return <MealsPage settings={settings} onSave={keep<Settings['meals']>('meals')} onBack={back} />;
  }

  const plan = settings.plan;
  const sessionDays = DAY_ORDER.filter(d => settings.sessions[d].title || settings.sessions[d].items.length).length;
  const backupDays = daysSince(p.lastBackup);
  // Reminders are scheduled a few weeks ahead and topped up when Tidemark opens; say how far, so a long break isn't a surprise
  const until = remindersSetUntil(p.reminder, FEATURES.medication ? settings.medication : null, p.doses, p.weights[dateKey(new Date())] != null);
  const reminderEnd = until ? ` Reminders are set up to ${shortDate(until)}; opening Tidemark adds more.` : '';
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const build = Application.nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber;
  const reviewUrl = Platform.OS === 'ios' ? writeReviewUrl(APP_STORE_ID) : null;   // chosen by the person, so allowed any time

  // The root list stays mounted underneath a pushed page (keeps its scroll position, and the page can slide back over it)
  return (
    <DoneWindow>
    <View style={{ flex: 1 }}>
    <PaywallSlot />
    <View style={s.wrap} importantForAccessibility={page === 'root' ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={page !== 'root'}>
      <View style={s.bar}>
        <View style={s.barRight} />
        <Text style={s.barTitle} accessibilityRole="header">Settings</Text>
        <View style={s.barRight}>
          <Pressable onPress={p.onClose} hitSlop={8} style={s.done} accessibilityRole="button" accessibilityLabel="Done">
            <Text style={s.doneTxt}>Done</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Group title="Plan">
          <Row icon="target" label="Goal" value={`${showWeight(plan.goalKg, unit)} · ${longDate(plan.goalDate)}`} onPress={() => setPage('plan')} hint="Edit your plan" />
          <Row icon="calendar" label="Planned breaks" value={plan.breaks?.length ? String(plan.breaks.length) : 'None'} onPress={() => setPage('plan')} />
          <Row icon="flag" label="Event" value={settings.event?.name || 'None'} onPress={() => setPage('event')} last />
        </Group>

        <Group title="Tracking">
          <Row icon="ruler" label="Units" wide right={<UnitToggle unit={unit} onChange={p.setUnit} />} />
          {p.health && <SwitchRow icon="heart" label="Apple Health" value={p.health.on} onChange={async on => {
            if (!(await p.health!.set(on))) notify('Apple Health isn’t available', 'Tidemark couldn’t connect to Apple Health on this iPhone.');
          }} />}
          <Row icon="body" label="Measurements" wide right={<LengthToggle unit={p.lengthUnit} onChange={p.onLengthUnit} />} />
          <Row icon="habits" label="Daily habits" value={String(settings.habits.length)} onPress={() => setPage('habits')} />
          <Row icon="trend" label="Weekly sessions" value={sessionDays ? `${sessionDays} day${sessionDays === 1 ? '' : 's'}` : 'None'} onPress={() => setPage('sessions')} />
          <Row icon="meal" label="Meals" value={settings.meals.items.length ? String(settings.meals.items.length) : 'None'} onPress={() => setPage('meals')} />
{FEATURES.medication &&           <Row icon="pill" label="Medication" value={settings.medication ? `${settings.medication.name}${settings.medication.doseMg ? ` ${settings.medication.doseMg} mg` : ''} · ${settings.medication.every === 'day' ? 'daily' : DAY_ABBR[settings.medication.weekday]}` : 'Off'}
            onPress={() => setPage('medication')} />}
          {plus ? <SwitchRow icon="meal" label="Protein target" value={settings.protein?.on === true} onChange={v => commit({ protein: { on: v, perKg: settings.protein?.perKg ?? 1.4 } })} />
            : <Row icon="meal" label="Protein target" value="Plus" onPress={() => openPaywall('protein')} hint="Part of Tidemark Plus" />}
          {plus && settings.protein?.on && <Row icon="target" label="Grams per kg" wide right={<Tabs value={String(settings.protein.perKg) as '1.2' | '1.4' | '1.6'} label="Protein per kilogram"
            options={[{ id: '1.2', label: '1.2' }, { id: '1.4', label: '1.4' }, { id: '1.6', label: '1.6' }]} onChange={v => commit({ protein: { on: true, perKg: Number(v) as 1.2 | 1.4 | 1.6 } })} />} />}
          {/* Free: a plain row that says it's Plus, not a switch that opens a sales sheet */}
          {plus ? <SwitchRow icon="flame" label="Calorie estimate" value={settings.trackCalories === true} onChange={v => commit({ trackCalories: v })} last />
            : <Row icon="flame" label="Calorie estimate" value="Plus" onPress={() => openPaywall('calories')} hint="Part of Tidemark Plus" last />}
        </Group>
        <Text style={s.groupFootOut}>{p.health ? 'Apple Health: weights from your scale or other apps come in by themselves, and weights you log here go to Health. A weight you type always wins for its day. ' : ''}Calorie estimate: enter how many calories you ate each day (not burned). After two weeks Tidemark compares that with your trend and estimates how many you burn.</Text>

        <Group title="Display" footer="Hide my weight: Tidemark shows which way your trend is going and by how much, never the weight itself. Exports still hold the real numbers.">
          <Row icon="moon" label="Appearance" wide right={<AppearanceToggle value={p.appearance} onChange={p.onAppearanceChange} />} />
          <SwitchRow icon="shield" label="Hide my weight" value={p.hideWeight === true} onChange={v => p.onHideWeightChange?.(v)} last />
        </Group>

        <Group title="Reminder" footer={p.reminderBlocked ? 'Notifications for Tidemark are switched off in iOS Settings, so no reminder will appear until they’re allowed again.'
          : 'A gentle daily notification. It’s scheduled on this phone; nothing is sent anywhere.' + reminderEnd}>
          <SwitchRow icon="bell" label="Daily weigh-in reminder" value={p.reminder.on} onChange={on => p.onReminderChange({ ...p.reminder, on })} last={!p.reminder.on} />
          {p.reminderBlocked && <Row icon="info" label="Allow notifications" value="iOS Settings" onPress={() => Linking.openSettings().catch(() => {})} hint="Opens Tidemark’s page in iOS Settings" />}
          {p.reminder.on && <Row icon="calendar" label="Time" last right={<TimeInput hour={p.reminder.hour} minute={p.reminder.minute}
            onChange={(hour, minute) => p.onReminderChange({ ...p.reminder, hour, minute })} />} />}
        </Group>

        {/* After the settings people came for, not first */}
        <Group title="Tidemark Plus">
          {plus ? <>
            <Row icon="check" label="Plus" value={plusApi.status?.productId === PLUS_PRODUCTS.lifetime ? 'Lifetime' : plusApi.status?.productId === PLUS_PRODUCTS.yearly ? 'Yearly' : plusApi.status?.productId === PLUS_PRODUCTS.monthly ? 'Monthly' : 'Active'}
              last={plusApi.status?.productId === PLUS_PRODUCTS.lifetime || !plusApi.storeAvailable} />
            {plusApi.storeAvailable && plusApi.status?.productId !== PLUS_PRODUCTS.lifetime &&
              <Row icon="calendar" label="Manage subscription" onPress={plusApi.manage} hint="Opens your App Store subscriptions" last />}
          </> : <>
            <Row icon="sparkle" label="Get Plus" value="See plans" onPress={() => openPaywall()} hint="Dose insights, doctor report, 6 habits, measurements, photos, calories"
              last={!plusApi.storeAvailable} />
            {plusApi.storeAvailable && <Row icon="download" label="Restore purchases" onPress={() => { plusApi.restore(); }} hint="If you’ve bought Plus before" last />}
          </>}
        </Group>

        <Group title="Privacy & data" footer="Everything lives on this phone only. Tidemark has no account and no servers. A backup file kept somewhere safe off this phone is the only copy if you lose it.">
          <SwitchRow icon="lock" label={`Lock with ${p.lockName}`} value={p.lock} onChange={p.onLockChange} disabled={!p.lockAvailable} />
          {p.autoBackup && <Row icon="download" label="Automatic backup" value={p.autoBackup.prefs.on ? (describeAutoBackup(p.autoBackup.prefs).warn ? 'Not saving' : p.autoBackup.prefs.folder ?? 'On') : 'Off'}
            onPress={() => setPage('backup')} hint="Saves a backup into a folder you choose, every day something changes" />}
          <Row icon="share" label="Export backup" value={backupDays == null ? 'Never' : backupDays === 0 ? 'Today' : `${backupDays}d ago`} onPress={p.onExport}
            hint="Saves a backup file you can restore later" />
          <Row icon="share" label="Export spreadsheet (CSV)" onPress={p.onExportCsv} />
          {p.onReport && <Row icon="download" label="Report for your doctor (PDF)" value={plus ? undefined : 'Plus'} onPress={() => (plus ? p.onReport!() : openPaywall('report'))} hint="The last 12 weeks: trend, doses, side effects and notes" />}
          <Row icon="download" label="Restore from backup" onPress={p.onRestore} last />
        </Group>
        {!p.lockAvailable && <Text style={s.groupFootOut}>Set up {p.lockName} or a passcode on this phone to use the lock.</Text>}

        <Group>
          <Row icon="trash" label="Clear weigh-ins and habit ticks" destructive onPress={p.onReset} />
          <Row icon="trash" label="Delete all my data" destructive onPress={p.onEraseAll} last hint="Deletes all data and photos from this phone" />
        </Group>

        <Group title="About" footer={`Support: ${SUPPORT_EMAIL}`}>
          <Row icon="shield" label="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL, { controlsColor: C.coralInk }).catch(() => Linking.openURL(PRIVACY_URL).catch(() => {}))} hint="Opens the policy" />
          <Row icon="mail" label="Send feedback or get help" hint={`Opens Mail to ${SUPPORT_EMAIL}`}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Tidemark ${version}`)}`).catch(() => notify('No mail app', `Email ${SUPPORT_EMAIL} from any device.`))} />
          {reviewUrl && <Row icon="heart" label="Rate Tidemark" hint="Opens the App Store to write a review"
            onPress={() => Linking.openURL(reviewUrl).catch(() => {})} />}
          <Row icon="book" label="Acknowledgements" onPress={() => setPage('credits')} />
          {WEB_PREVIEW.offered && <Row icon="lock" label="Unlock owner preview" hint="For the app's owner: enter the preview passphrase"
            onPress={async () => {
              const pass = await askPassword('Owner preview', 'Enter the preview passphrase.');
              if (pass == null) return;
              if (WEB_PREVIEW.unlock(pass)) window.location.reload(); else notify('Not quite', 'That passphrase didn’t match.');
            }} />}
          <Row icon="info" label="Version" value={build ? `${version} (${build})` : version} last />
        </Group>
        <Text style={[s.groupFootOut, { textAlign: 'center', marginTop: 4 }]}>Tidemark · the scale jumps, your trend doesn’t{'\n'}Targets and estimates are guidance, not medical advice.</Text>
      </ScrollView>
    </View>
    {page !== 'root' && <Pushed key={page} onBack={back} leaving={leaving} onGone={gone}>{subPage()}</Pushed>}
    </View>
    </DoneWindow>
  );
}
