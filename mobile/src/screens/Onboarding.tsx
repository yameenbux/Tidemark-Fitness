import { habitIcon } from '../core/habitIcons';
import { Tap } from '../components/Motion';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, dateKey, longDate, parseKey } from '../core/dates';
import { assessPlan, buildTargets, defaultSettings, direction, GAIN_PACES, goalDateForPace, HABIT_AMOUNTS, MAX_HABITS, PACES, SUGGESTED_HABITS } from '../core/plan';
import { HabitAmount } from '../components/HabitAmount';
import { ShinyButton } from '../components/ShinyButton';
import { usePlus } from '../plus';
import { FREE_HABITS } from '../core/plus';
import { fmt, lbPart, num, parseWeightInput, plausible, rangeText, showAmount, showRangeError, showWeight, stPart, toLbNum } from '../core/units';
import type { Habit, Medication, Settings, Unit } from '../core/types';
import { DateInput, Field, UnitToggle } from '../components/Fields';
import { Input } from './settings/kit';
import { FEATURES } from '../features';
import { DoneInput, DoneWindow } from '../components/KeyboardDone';
import { ProgressChart } from '../components/ProgressChart';
import { Icon, IconName } from '../components/Icons';
import { TidemarkIcon } from '../components/Logo';
import { Button } from '../components/ui';
import { C, F, themed } from '../theme';

type Step = 'welcome' | 'current' | 'goal' | 'pace' | 'habits' | 'meds' | 'plan' | 'lock';
type MedAnswer = 'week' | 'day' | 'no';
const MED_CHOICES: { id: MedAnswer; label: string }[] = [
  { id: 'week', label: 'Yes, a weekly injection' },
  { id: 'day', label: 'Yes, a daily tablet' },
  { id: 'no', label: 'No' },
];

/** Maintenance plans: how long to hold for. */
const HOLD = [
  { id: 'hold8', label: '8 weeks', weeks: 8 },
  { id: 'hold12', label: '12 weeks', weeks: 12, recommended: true },
  { id: 'hold26', label: '6 months', weeks: 26 },
];

/** Large single-number entry, like the setup screens in Yazio/BitePal. */
function BigWeight({ unit, kg, onChange }: { unit: Unit; kg: number | null; onChange: (kg: number | null) => void }) {
  const init = (): [string, string] => kg == null ? ['', ''] : unit === 'kg' ? [fmt(kg), ''] : unit === 'lb' ? [fmt(toLbNum(kg)), ''] : [String(stPart(kg)), fmt(lbPart(kg))];
  const [t, setT] = useState<[string, string]>(init);
  const [seenUnit, setSeenUnit] = useState(unit);
  if (unit !== seenUnit) { setSeenUnit(unit); setT(init()); }   // re-express the same weight when the unit flips
  const set = (i: 0 | 1, v: string) => {
    const n: [string, string] = i ? [t[0], v] : [v, t[1]];
    setT(n);
    const parsed = parseWeightInput(unit, n[0], n[1]);
    onChange(parsed == null || isNaN(parsed) ? null : parsed);
  };
  const box = (i: 0 | 1, w: number, label: string, suffix: string) => (
    <View style={s.bigBox}>
      <DoneInput value={t[i]} onChangeText={v => set(i, v)} style={[s.bigIn, { minWidth: w }]} maxFontSizeMultiplier={1.2} keyboardType={i === 0 && unit === 'imp' ? 'number-pad' : 'decimal-pad'}
        placeholder="0" placeholderTextColor={C.placeholder} autoFocus={i === 0} accessibilityLabel={label} />
      <Text style={s.bigUnit}>{suffix}</Text>
    </View>
  );
  return unit === 'kg' || unit === 'lb'
    ? <View style={s.bigRow}>{box(0, 150, unit === 'kg' ? 'Weight in kilograms' : 'Weight in pounds', unit)}</View>
    : <View style={s.bigRow}>{box(0, 70, 'Stone', 'st')}{box(1, 100, 'Pounds', 'lb')}</View>;
}

export function Onboarding({ unit, setUnit, lockAvailable, lockName, onDone, onRestore, notice }: {
  unit: Unit; setUnit: (u: Unit) => void; lockAvailable: boolean; lockName: string;
  onDone: (settings: Settings, lock: boolean) => void; onRestore: () => void; notice?: string;
}) {
  const [why, setWhy] = useState(false);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [startKg, setStartKg] = useState<number | null>(null);
  const [goalKg, setGoalKg] = useState<number | null>(null);
  const [pace, setPace] = useState<string>('');   // empty = the recommended option for the goal's direction
  const [start, setStart] = useState(dateKey(new Date()));   // today: a plan that began last Monday starts you "behind"
  const { plus } = usePlus();
  const [picked, setPicked] = useState<string[]>([]);        // habits chosen during setup (none by default)
  const [amounts, setAmounts] = useState<Record<string, Habit>>({});   // a chosen habit with its amount changed (e.g. Steps 10k)
  const [editStart, setEditStart] = useState(false);
  const [meds, setMeds] = useState<MedAnswer | null>(null);   // the medication question: unanswered until tapped
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');

  // Losing, gaining or holding: each gets its own choices on the "how fast" step
  const dir = plausible(startKg) && plausible(goalKg) ? direction({ startKg, goalKg }) : 'lose';
  const options: { id: string; label: string; pct?: number; weeks?: number; recommended?: boolean }[] =
    dir === 'gain' ? [...GAIN_PACES] : dir === 'maintain' ? HOLD : [...PACES];
  const chosen = options.find(o => o.id === pace) ?? options.find(o => o.recommended) ?? options[0];
  const pct = chosen.pct ?? 0;
  const dateFor = (o: typeof chosen) => !startKg || !goalKg ? null
    : o.weeks ? dateKey(addDays(parseKey(start), o.weeks * 7)) : goalDateForPace(startKg, goalKg, start, o.pct!);
  const goalDate = dateFor(chosen) ?? dateKey(addDays(parseKey(start), 112));
  const draft = { startKg, goalKg, start, goalDate };
  const verdict = assessPlan(draft);
  // Someone on a weight-loss medication gets the dose log set up now, with the day they set up as their dose day
  const mg = num(medDose);
  const medication: Medication | null = meds === 'week' || meds === 'day'
    ? { name: medName.trim() || (meds === 'week' ? 'Weekly injection' : 'Daily tablet'), doseMg: mg > 0 && mg <= 1000 ? mg : null,
        every: meds, weekday: parseKey(start).getDay(), remind: false, injected: meds === 'week' }
    : null;
  const settings: Settings | null = verdict.ok
    ? { ...defaultSettings({ startKg: startKg!, goalKg: goalKg!, start, goalDate, targets: buildTargets(startKg!, goalKg!, start, goalDate) },
                           SUGGESTED_HABITS.filter(h => picked.includes(h.id)).map(h => amounts[h.id] ?? h)),
        ...(medication ? { medication } : {}) }
    : null;

  const order: Step[] = ['welcome', 'current', 'goal', 'pace', 'habits', ...(FEATURES.medication ? ['meds' as Step] : []), 'plan', ...(lockAvailable ? ['lock' as Step] : [])];
  const idx = order.indexOf(step);
  const back = () => setStep(order[Math.max(0, idx - 1)]);
  const next = () => setStep(order[idx + 1]);
  const finish = (lock: boolean) => settings && onDone(settings, lock);

  const goalNote = step === 'goal' && plausible(goalKg) && plausible(startKg)
    ? dir === 'gain' ? 'A gain plan: the line rises slowly, so most of it is muscle rather than fat.'
      : dir === 'maintain' ? 'A maintenance plan: the line holds steady and Tidemark shows how close you stay to it.'
      : null
    : null;
  const rate = (p: number) => {
    const kgw = (startKg ?? 0) * p / 100;
    return unit === 'kg' ? fmt(kgw, 2) + ' kg' : toLbNum(kgw).toFixed(1) + ' lb';
  };

  return (
    <DoneWindow>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.wrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 16 }]}>
      {step !== 'welcome' && (
        <View style={s.top}>
          <Pressable onPress={back} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back"><Icon name="back" size={26} color={C.ink} strokeWidth={2.4} /></Pressable>
          <View style={s.progress} accessibilityRole="progressbar" accessibilityLabel="Setup progress"
            accessibilityValue={{ min: 1, max: order.length, now: idx + 1, text: `Step ${idx + 1} of ${order.length}` }}>
            <View style={[s.progressFill, { width: `${(idx / (order.length - 1)) * 100}%` }]} />
          </View>
        </View>
      )}
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {step === 'welcome' && (
          <View style={{ paddingTop: 40 }}>
            <TidemarkIcon size={64} />
            <Text style={[s.eyebrow, { marginTop: 22 }]}>Tidemark</Text>
            <Text style={s.h1} accessibilityRole="header">A weight tracker that stays yours.</Text>
            {notice && (
              <View style={s.notice} accessibilityRole="alert"><Icon name="shield" size={20} color={C.warnInk} /><Text style={s.noticeTxt}>{notice}</Text></View>
            )}
            {([
              ['lock', 'No account, no sign-up. Your data never leaves this phone.'],
              ['trend', 'A trend that smooths out daily water swings, so you see what’s really happening.'],
              ['target', 'A steady target line at a pace you can keep. A guide, not a verdict.'],
            ] as [IconName, string][]).map(([i, t]) => (
              <View key={i} style={s.promise}>
                <View style={s.promiseIcon}><Icon name={i} size={20} color={C.plum2} /></View>
                <Text style={s.promiseTxt}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {step === 'current' && (
          <>
            <Text style={s.h2} accessibilityRole="header">What do you weigh now?</Text>
            <Text style={s.sub}>A rough number is fine. You can change it later.</Text>
            <BigWeight unit={unit} kg={startKg} onChange={setStartKg} />
            {showRangeError(startKg, unit) && <Text style={s.err} accessibilityLiveRegion="polite">{rangeText(unit)}</Text>}
            <View style={{ alignItems: 'center' }}><UnitToggle unit={unit} onChange={setUnit} /></View>
          </>
        )}

        {step === 'goal' && (
          <>
            <Text style={s.h2} accessibilityRole="header">What’s your goal weight?</Text>
            <Text style={s.sub}>Starting from {startKg ? showWeight(startKg, unit) : '—'}.</Text>
            <BigWeight unit={unit} kg={goalKg} onChange={setGoalKg} />
            {showRangeError(goalKg, unit) && <Text style={s.err} accessibilityLiveRegion="polite">{rangeText(unit)}</Text>}
            {goalNote && <Text style={s.note}>{goalNote}</Text>}
          </>
        )}

        {step === 'pace' && (
          <>
            <Text style={s.h2} accessibilityRole="header">{dir === 'maintain' ? 'For how long?' : 'How fast?'}</Text>
            <Text style={s.sub}>{dir === 'maintain' ? 'Pick a stretch to hold for. You can always extend it.'
              : dir === 'gain' ? 'Slow gains are mostly muscle; fast gains are mostly fat.'
              : 'Slower plans are easier to stick to — and sticking to it is what matters.'}</Text>
            {options.map(p => {
              const on = p.id === chosen.id;
              const d = dateFor(p);
              return (
                <Pressable key={p.id} onPress={() => setPace(p.id)} style={[s.pace, on && s.paceOn]}
                  accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[s.paceName, on && { color: C.plum2 }]}>{p.label}</Text>
                      {p.recommended && <View style={s.rec}><Text style={s.recTxt}>Recommended</Text></View>}
                    </View>
                    <Text style={s.paceMeta}>{p.weeks ? `until ${d ? longDate(d) : '—'}` : `~${rate(p.pct!)} a week${d ? ' · goal by ' + longDate(d) : ''}`}</Text>
                  </View>
                  <View style={[s.radio, on && s.radioOn]} />
                </Pressable>
              );
            })}
            {chosen.id === 'fast' && <Text style={s.warn}>1% of body weight a week is the upper end. Most people can’t hold it for long, and it costs more muscle. Fine for a short push.</Text>}
            <View style={s.startRow}>
              <Text style={s.sub}>Starting {longDate(start)}</Text>
              <Pressable onPress={() => setEditStart(e => !e)} style={s.linkBtn} accessibilityRole="button" accessibilityLabel={editStart ? 'Done changing start date' : 'Change start date'}>
                <Text style={s.link}>{editStart ? 'Done' : 'Change'}</Text>
              </Pressable>
            </View>
            {editStart && <DateInput value={start} onChange={setStart} label="Start date" />}
          </>
        )}

        {step === 'habits' && (
          <>
            <Text style={s.h2} accessibilityRole="header">Anything to tick off each day?</Text>
            <Text style={s.sub}>Optional. Up to {plus ? MAX_HABITS : `${FREE_HABITS} (${MAX_HABITS} with Plus)`} small habits, shown as how consistent you are, never as streaks. You can change them any time in Settings.</Text>
            <View style={s.habitGrid} accessibilityRole="none">
              {SUGGESTED_HABITS.map(h => {
                const on = picked.includes(h.id), full = !on && picked.length >= (plus ? MAX_HABITS : FREE_HABITS);
                return (
                  <Tap key={h.id} disabled={full} onPress={() => setPicked(p => on ? p.filter(x => x !== h.id) : [...p, h.id])}
                    style={[s.habitChip, on && s.habitChipOn, full && { opacity: 0.4 }]}
                    accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: full }} accessibilityLabel={h.name}>
                    <Icon name={habitIcon(h.icon, h.name)} size={20} color={on ? C.onFill : C.plum2} />
                    <Text style={[s.habitChipTxt, on && { color: C.onFill }]} numberOfLines={1}>{(amounts[h.id] ?? h).name}</Text>
                  </Tap>
                );
              })}
            </View>
            {SUGGESTED_HABITS.filter(h => picked.includes(h.id) && HABIT_AMOUNTS[h.id]).map(h => (
              <HabitAmount key={h.id} habit={amounts[h.id] ?? h} onChange={nh => setAmounts(a => ({ ...a, [h.id]: nh }))} />
            ))}
          </>
        )}

        {step === 'meds' && (
          <>
            <Text style={s.h2} accessibilityRole="header">Are you taking a weight-loss medication?</Text>
            <Text style={s.sub}>Optional. Tidemark can log your doses and show what your trend does at each one. It only keeps a record; it never advises on dosing.</Text>
            {MED_CHOICES.map(o => {
              const on = meds === o.id;
              return (
                <Pressable key={o.id} onPress={() => setMeds(o.id)} style={[s.pace, on && s.paceOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                  <Text style={[s.paceName, { flex: 1 }, on && { color: C.plum2 }]}>{o.label}</Text>
                  <View style={[s.radio, on && s.radioOn]} />
                </Pressable>
              );
            })}
            {(meds === 'week' || meds === 'day') && (
              <View style={{ marginTop: 18, gap: 4 }}>
                <Field label="Name (optional)"><Input value={medName} onChangeText={setMedName} placeholder="e.g. semaglutide" accessibilityLabel="Medication name" maxLength={40} /></Field>
                <Field label="Current dose in mg (optional)"><Input value={medDose} onChangeText={setMedDose} keyboardType="decimal-pad" placeholder="e.g. 2.5" accessibilityLabel="Current dose in milligrams" /></Field>
                <Text style={s.note}>Doses, reminders and the day can be changed any time in Settings.</Text>
              </View>
            )}
          </>
        )}

        {step === 'plan' && settings && (
          <>
            <Text style={s.eyebrow}>Your plan is ready</Text>
            <Text style={s.h2} accessibilityRole="header">{dir === 'maintain' ? 'Hold ' : 'Reach '}<Text style={{ color: C.coralInk }}>{showWeight(settings.plan.goalKg, unit)}</Text> {dir === 'maintain' ? 'until' : 'by'} {longDate(settings.plan.goalDate)}</Text>
            <View style={{ marginTop: 16 }}>
              <ProgressChart settings={settings} weights={{ [start]: settings.plan.startKg }} unit={unit} fixedRange />
            </View>
            {[
              dir === 'maintain' ? `${settings.plan.targets.length - 1} weeks holding steady` : `${settings.plan.targets.length - 1} weeks at about ${rate(pct)} a week`,
              'Weigh in most mornings: more weigh-ins, clearer trend',
              'Habits, sessions and meals can be added later in Settings',
            ].map(t => (
              <View key={t} style={s.bulletRow}><Icon name="check" size={18} color={C.mintInk} strokeWidth={2.6} /><Text style={s.bullet}>{t}</Text></View>
            ))}
            <Pressable onPress={() => setWhy(w => !w)} style={s.why} accessibilityRole="button" accessibilityState={{ expanded: why }}>
              <Icon name="info" size={18} color={C.plum2} />
              <Text style={s.whyTxt}>How is this worked out?</Text>
            </Pressable>
            {why && (
              <View style={s.whyBox}>
                <Text style={s.whyBody}>
                  {dir === 'maintain'
                    ? <>The dashed line stays at {showWeight(settings.plan.goalKg, unit)} until {longDate(settings.plan.goalDate)}. Tidemark shows how far your trend drifts from it; within {unit === 'kg' ? 'about a kilo' : 'about 2 lb'} either way is normal day-to-day life.</>
                    : <>Your pace is a share of body weight per week: {chosen.label} is {pct}%, so from {showWeight(settings.plan.startKg, unit)} that’s about {rate(pct)} a week.
                      {'\n\n'}Dividing the {showAmount(Math.abs(settings.plan.startKg - settings.plan.goalKg), unit)} you want to {dir === 'gain' ? 'gain' : 'lose'} by that pace gives {settings.plan.targets.length - 1} weeks, so the goal date is {longDate(settings.plan.goalDate)}.</>}
                  {'\n\n'}Your own weigh-ins are smoothed into a trend, so a salty dinner or a hard workout won’t knock you off the line.
                </Text>
              </View>
            )}
          </>
        )}

        {step === 'lock' && (
          <View style={{ paddingTop: 40 }}>
            <View style={s.lockBadge}><Icon name="lock" size={34} color={C.plum2} strokeWidth={2.2} /></View>
            <Text style={s.h2} accessibilityRole="header">Lock Tidemark with {lockName}?</Text>
            <Text style={s.sub}>Your weight and habits are personal. With the lock on, Tidemark asks for {lockName} each time it opens. You can change this in Settings.</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        {step === 'welcome' && <>
          <ShinyButton label="Set up my plan" onPress={next} />
          <Pressable onPress={onRestore} style={s.secondary} accessibilityRole="button"><Text style={s.secondaryTxt}>Restore from a backup</Text></Pressable>
        </>}
        {step === 'current' && <Button label="Next" kind="primary" disabled={!plausible(startKg)} onPress={next} />}
        {step === 'goal' && <Button label="Next" kind="primary" disabled={!plausible(goalKg)} onPress={next} />}
        {step === 'pace' && <>
          {verdict.error && <Text style={s.err}>{verdict.error}</Text>}
          <Button label="See my plan" kind="primary" disabled={!!verdict.error} onPress={next} />
        </>}
        {step === 'habits' && <Button label={picked.length ? `Next · ${picked.length} chosen` : 'Skip for now'} kind={picked.length ? 'primary' : 'ghost'} onPress={next} />}
        {step === 'meds' && <Button label={meds ? 'Next' : 'Skip'} kind={meds ? 'primary' : 'ghost'} onPress={next} />}
        {step === 'plan' && (lockAvailable
          ? <Button label="Continue" onPress={next} />
          : <Button label="Start tracking" onPress={() => finish(false)} />)}
        {step === 'lock' && <>
          <Button label={`Yes, use ${lockName}`} onPress={() => finish(true)} />
          <Pressable onPress={() => finish(false)} style={s.secondary} accessibilityRole="button"><Text style={s.secondaryTxt}>Not now</Text></Pressable>
        </>}
      </View>
    </KeyboardAvoidingView>
    </DoneWindow>
  );
}

const s = themed(() => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 44 },
  backBtn: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.chip, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: C.done, borderRadius: 3 },
  body: { paddingTop: 24, paddingBottom: 24 },
  eyebrow: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: C.coralInk },
  h1: { fontFamily: F.display, fontSize: 34, lineHeight: 40, color: C.ink, marginTop: 8, marginBottom: 26, letterSpacing: -0.5 },
  h2: { fontFamily: F.display, fontSize: 28, lineHeight: 34, color: C.ink, letterSpacing: -0.5, marginTop: 6 },
  sub: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, marginTop: 8, lineHeight: 21 },
  promise: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, marginBottom: 10 },
  promiseIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  promiseTxt: { flex: 1, fontFamily: F.bodyMed, fontSize: 15, color: C.ink, lineHeight: 21 },
  bigRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 40, marginBottom: 24 },
  bigBox: { flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: 2, borderBottomColor: C.control, paddingBottom: 6 },
  bigIn: { fontFamily: F.display, fontSize: 56, color: C.ink, textAlign: 'center', padding: 0, borderWidth: 0 },
  bigUnit: { fontFamily: F.bodySemi, fontSize: 18, color: C.inkSoft, marginLeft: 4 },
  note: { fontFamily: F.body, fontSize: 14.5, color: C.plum2, textAlign: 'center', lineHeight: 20, marginTop: 4, paddingHorizontal: 12 },
  err: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.danger, textAlign: 'center', marginBottom: 10, lineHeight: 19 },
  warn: { fontFamily: F.body, fontSize: 13, color: C.warnInk, backgroundColor: C.warnBg, borderWidth: 1, borderColor: C.warnLine, borderRadius: 12, padding: 12, lineHeight: 19, marginTop: 4 },
  habitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  habitChip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line },
  habitChipOn: { backgroundColor: C.fill, borderColor: C.fill },
  habitChipTxt: { fontFamily: F.bodySemi, fontSize: 14.5, color: C.ink, maxWidth: 220 },
  pace: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, borderRadius: 16, padding: 16, marginTop: 10 },
  paceOn: { borderColor: C.plum2, backgroundColor: C.paceOn },
  paceName: { fontFamily: F.displaySemi, fontSize: 17, color: C.ink },
  paceMeta: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 3 },
  rec: { backgroundColor: C.mintBg, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  recTxt: { fontFamily: F.bodyBold, fontSize: 11.5, color: C.mintInk },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.control },
  radioOn: { borderColor: C.plum2, borderWidth: 7 },
  startRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14 },
  link: { fontFamily: F.bodyBold, fontSize: 15, color: C.coralInk },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  bullet: { flex: 1, fontFamily: F.bodyMed, fontSize: 15, color: C.ink },
  why: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.panel },
  whyTxt: { fontFamily: F.bodySemi, fontSize: 14, color: C.plum2 },
  whyBox: { marginTop: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14 },
  whyBody: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 20 },
  lockBadge: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: C.warnBg, borderWidth: 1, borderColor: C.warnLine, borderRadius: 14, padding: 14, marginBottom: 14 },
  noticeTxt: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.warnInk, lineHeight: 20 },
  linkBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  footer: { paddingTop: 8 },
  secondary: { paddingVertical: 14, alignItems: 'center' },
  secondaryTxt: { fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink },
}));
