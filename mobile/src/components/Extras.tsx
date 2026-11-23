import { usePlus } from '../plus';
import { usableHabits } from '../core/plus';
import { EmptyState } from './States';
import { habitIcon } from '../core/habitIcons';
import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { estimateExpenditure, intakeRange, kcalRange, CAL_MIN_DAYS, CAL_WINDOW, MIN_INTAKE } from '../core/calories';
import { addDays, dateKey, DAY_ABBR, longDate, parseKey, startOfDay } from '../core/dates';
import { habitInsight, INSIGHT_MIN_WEEKS, MILESTONE_TEXT, weeksOfData } from '../core/insights';
import { lossWeeks, weightSeries } from '../core/plan';
import { exerciseName, lastLift, suggestNext } from '../core/progression';
import { trendSeries, TrendPoint } from '../core/trend';
import { KG_PER_LB, num, showChange, showAmount, weightsHidden } from '../core/units';
import type { HabitLog, Session, Settings, TrackerState, Unit, Weights } from '../core/types';
import { C, F, themed, useScheme } from '../theme';
import { fieldStyles } from './Fields';
import { Icon } from './Icons';
import { DoneInput } from './KeyboardDone';
import { Sheet } from './Sheet';
import { Button, Card } from './ui';

const change = (kg: number, unit: Unit) => showChange(kg, unit, 1);   // one decimal for every kg change, app-wide

/** Calm note when the trend passes another quarter of the way to goal. Shown once per milestone. */
export function MilestoneBanner({ quarter, settings, trendNow, unit, onDismiss, onPhoto }: {
  quarter: number; settings: Settings; trendNow: number; unit: Unit; onDismiss: () => void; onPhoto?: () => void;   // onPhoto: without Plus
}) {
  const lost = settings.plan.startKg - trendNow;   // the real figure, not the rounded quarter
  return (
    <View style={s.mile} accessibilityRole="alert">
      <View style={s.mileIcon}><Icon name={quarter === 4 ? 'flag' : 'trend'} size={20} color={C.mintInk} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.mileTitle}>{MILESTONE_TEXT[quarter]}</Text>
        <Text style={s.mileTxt}>
          {quarter === 4
            ? 'Your trend has reached your goal. From here, holding it is the win: the Trend tab can switch you to a holding range.'
            : weightsHidden()
              ? `Your trend is more than ${['', 'a quarter', 'half', 'three quarters'][quarter]} of the way from where you started. That's real change, not a good day on the scale.`
              : `Your trend has moved ${showAmount(Math.abs(lost), unit)} ${lost >= 0 ? 'down' : 'up'} from where you started. That's real change, not a good day on the scale.`}
        </Text>
        {onPhoto && <Pressable onPress={onPhoto} accessibilityRole="button" style={s.milePlus}><Text style={s.milePlusTxt}>Mark it with a progress photo · Plus</Text></Pressable>}
      </View>
      <Pressable onPress={onDismiss} hitSlop={13} accessibilityRole="button" accessibilityLabel="Dismiss milestone"><Icon name="close" size={18} color={C.inkSoft} /></Pressable>
    </View>
  );
}

/** Habit ↔ trend comparisons, only once there is enough data, worded as observations. */
// Memoised: the habit/trend comparison walks every week for every habit
export const PatternsCard = memo(function PatternsCard({ settings, weights, habits, unit, trend }: { settings: Settings; weights: Weights; habits: HabitLog; unit: Unit; trend?: TrendPoint[]; today?: string }) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  const { plus } = usePlus();
  const habitsShown = (x: Settings) => usableHabits(x.habits, plus);   // free: the first few; the rest are kept
  const series = trend ?? trendSeries(weightSeries(settings.plan, weights));
  const have = weeksOfData(settings.plan, series);
  if (!habitsShown(settings).length) return null;
  if (have < INSIGHT_MIN_WEEKS) {
    return (
      <Card title="Patterns">
        <Text style={s.muted}>After {INSIGHT_MIN_WEEKS} weeks of weigh-ins, this compares your trend in weeks you kept a habit with weeks you didn’t. You have {have} so far. Before then it would just be guessing.</Text>
      </Card>
    );
  }
  const found = habitsShown(settings).map(h => ({ h, ins: habitInsight(settings.plan, series, habits, h.id) })).filter(x => x.ins);
  return (
    <Card title="Patterns">
      {found.length === 0 && <EmptyState compact icon="mind" title="No clear pattern yet" body="Each habit needs at least 3 weeks done 5+ days and 3 weeks not." />}
      {found.map(({ h, ins }) => (
        <View key={h.id} style={s.pat}>
          <View style={s.patHead}><Icon name={habitIcon(h.icon, h.name)} size={16} color={C.plum2} /><Text style={s.patTitle}>{h.name}</Text></View>
          <Text style={s.patTxt}>
            Weeks with {ins!.threshold}+ days: <Text style={s.b}>{change(ins!.withRate, unit)}/week</Text> ({ins!.withWeeks} weeks).{'\n'}
            Other weeks: <Text style={s.b}>{change(ins!.withoutRate, unit)}/week</Text> ({ins!.withoutWeeks} weeks).
          </Text>
        </View>
      ))}
      {found.length > 0 && <Text style={s.foot}>This shows what happened alongside each habit, not proof that the habit caused it. Busy or ill weeks affect both.</Text>}
    </Card>
  );
});

/** Optional calorie logging: one number a day, and an estimate of real daily burn. */
export function CaloriesCard({ settings, weights, intake, onChange, trend }: {
  settings: Settings; weights: Weights; intake: TrackerState['intake']; onChange: (k: string, kcal: number | null) => void; trend?: TrendPoint[];
}) {
  // Worked out on every render, so "Today" is still today after midnight
  const today = dateKey(new Date()), yesterday = dateKey(addDays(new Date(), -1));
  const [which, setWhich] = useState<'today' | 'yesterday'>('today');
  const day = which === 'today' ? today : yesterday;
  const saved = intake[day];
  const [txt, setTxt] = useState(saved != null ? String(saved) : '');
  const [focused, setFocused] = useState(false);
  // Follow outside changes (day switch, restore, midnight) without fighting the user mid-edit
  const source = day + '|' + saved;
  const [seen, setSeen] = useState(source);
  if (!focused && source !== seen) { setSeen(source); setTxt(saved != null ? String(saved) : ''); }
  const v = num(txt);
  const invalid = txt.trim() !== '' && !(v >= 300 && v <= 10000);
  const commit = () => {
    setFocused(false);
    if (txt.trim() === '') onChange(day, null);
    else if (!invalid) onChange(day, v);
  };
  const series = trend ?? trendSeries(weightSeries(settings.plan, weights));
  const est = estimateExpenditure(intake, series);
  const last7 = Array.from({ length: 7 }, (_, i) => intake[dateKey(addDays(startOfDay(), -i - 1))]).filter((v): v is number => v != null);
  const avg7 = last7.length ? Math.round(last7.reduce((a, b) => a + b, 0) / last7.length) : null;
  let logged = 0;
  for (let i = 1; i <= CAL_WINDOW; i++) if (intake[dateKey(addDays(startOfDay(), -i))] != null) logged++;
  const needsWeighIns = !est && logged >= CAL_MIN_DAYS;   // enough food logged, but no recent weigh-ins at an edge
  const plan = settings.plan;
  const pace = (plan.startKg - plan.goalKg) / Math.max(1, lossWeeks(plan.start, plan.goalDate, plan.breaks));
  const eat = est ? intakeRange(est, pace) : null;

  return (
    <Card title="Calories eaten">
      <Text style={s.ask}>How much did you eat and drink {which === 'today' ? 'today' : 'yesterday'}?</Text>
      <View style={s.calRow}>
        <View style={s.dayTabs} accessibilityRole="tablist" accessibilityLabel="Day">
          {(['today', 'yesterday'] as const).map(w => (
            <Pressable key={w} onPress={() => { if (w !== which && !invalid) { commit(); setWhich(w); } }} hitSlop={4} style={[s.dayTab, which === w && s.dayTabOn]} accessibilityRole="tab" accessibilityState={{ selected: which === w }}>
              <Text style={[s.dayTabTxt, which === w && { color: C.onFill }]}>{w === 'today' ? 'Today' : 'Yesterday'}</Text>
            </Pressable>
          ))}
        </View>
        <DoneInput key={day} value={txt} onChangeText={setTxt} onFocus={() => setFocused(true)} onBlur={commit} keyboardType="number-pad" placeholder="kcal"
          returnKeyType="done" maxFontSizeMultiplier={1.4}
          placeholderTextColor={C.placeholder} style={[fieldStyles.fIn, s.calIn]} accessibilityLabel={`Calories eaten, ${which}`} />
      </View>
      {invalid && <Text style={s.err}>Enter a day’s total between 300 and 10,000 kcal. It isn’t saved until it’s in that range.</Text>}
      <Text style={s.muted}>Enter what you ate, not what you burned, and don’t take exercise off: Tidemark works out your burn for you. One rough total for the day is enough.</Text>
      <View style={s.calStats}>
        <View style={s.calStat}><Text style={s.k}>Eaten, 7-day average</Text><Text style={s.v}>{avg7 != null ? `${avg7.toLocaleString()} kcal` : '—'}</Text></View>
        <View style={s.calStat}><Text style={s.k}>You burn (worked out)</Text><Text style={s.v}>{est ? `${kcalRange(est.low, est.high)} kcal` : needsWeighIns ? 'Needs weigh-ins' : `${logged}/${CAL_MIN_DAYS} days`}</Text></View>
      </View>
      <Text style={s.line}>
        {est
          ? <>From what you ate and how your trend moved over {est.window} days, you burn somewhere around <Text style={s.b}>{kcalRange(est.low, est.high)} kcal a day</Text>.
            {/* With "hide my weight" on, no eating target: that setting is for people who'd rather not live by numbers */}
            {weightsHidden() || !eat ? null
              : eat.floored ? <> Your plan’s pace would mean eating less than {MIN_INTAKE.toLocaleString()} kcal a day, so Tidemark won’t suggest a number. A slower pace is safer: talk to your GP or a dietitian.</>
              : <> To keep your plan’s pace, eat around <Text style={s.b}>{kcalRange(eat.low, eat.high)} kcal</Text>.</>}</>
          : needsWeighIns ? <>There aren’t weigh-ins near both ends of the last {CAL_WINDOW} days, so Tidemark can’t see how your trend really moved. Weigh in for the next couple of weeks and the estimate comes back.</>
          : <>Log what you eat on {CAL_MIN_DAYS} of the last {CAL_WINDOW} days. Tidemark then compares it with how your trend moved and estimates how much you burn a day, from your own data rather than a formula.</>}
      </Text>
      {est && <Text style={s.foot}>How it’s worked out: your average eaten, plus your trend’s change in kg × 5,500–7,700 kcal, spread over the days. A range, because some of what you lose is water and muscle, not just fat. Only as accurate as the logging: forgotten snacks make it low. An estimate, not medical advice: talk to a GP or dietitian before big changes.</Text>}
    </Card>
  );
}

/** Log the weight used for each exercise in a session, with last time's weight and a suggestion. */
export function LiftSheet({ dateK, session, lifts, unit, onSave, onClose }: {
  dateK: string; session: Session; lifts: TrackerState['lifts']; unit: Unit;
  onSave: (lifts: TrackerState['lifts']) => void; onClose: () => void;
}) {
  // Stored in kg (so progression maths is unchanged); shown and typed in pounds for st/lb users
  const L = unit === 'kg' ? 'kg' : 'lb';
  const toU = (kg: number) => (unit === 'kg' ? String(kg) : String(Math.round(kg / KG_PER_LB * 2) / 2));
  const fromU = (t: string): number | null => {
    const v = num(t);
    if (!(v >= 0)) return null;
    const kg = unit === 'kg' ? v : Math.round(v * KG_PER_LB * 100) / 100;
    return kg <= 500 ? kg : null;
  };
  const names = Array.from(new Set(session.items.map(exerciseName).filter((n): n is string => !!n)));
  const today = lifts[dateK] || {};
  const [rows, setRows] = useState(() => Object.fromEntries(names.map(n => {
    const sug = suggestNext(lastLift(lifts, n, dateK), unit);
    return [n, { txt: today[n] ? toU(today[n].kg) : sug ? toU(sug.kg) : '', done: today[n]?.done ?? false }];
  })) as Record<string, { txt: string; done: boolean }>);
  const save = () => {
    const day: Record<string, { kg: number; done: boolean }> = {};
    for (const n of names) { const kg = fromU(rows[n].txt); if (kg != null) day[n] = { kg, done: rows[n].done }; }
    const next = { ...lifts };
    if (Object.keys(day).length) next[dateK] = day; else delete next[dateK];
    onSave(next);
  };
  const d = parseKey(dateK);
  const bad = names.filter(n => rows[n].txt.trim() !== '' && fromU(rows[n].txt) == null);
  const [saving, setSaving] = useState(false);   // animate away, then save
  return (
    <Sheet title={session.title || 'Session'} onClose={() => (saving ? save() : onClose())} closing={saving}
      footer={names.length > 0 ? <Button label="Save session" disabled={bad.length > 0 || saving} onPress={() => setSaving(true)} /> : undefined}>
      <Text style={s.muted}>{DAY_ABBR[d.getDay()]} {longDate(dateK)} · weights in {L}. Tick when you hit every rep.</Text>
      {names.length === 0 && <Text style={[s.muted, { marginTop: 12 }]}>Add exercises to this day in Settings → Weekly sessions.</Text>}
      {names.map(n => {
        const last = lastLift(lifts, n, dateK);
        const sug = suggestNext(last, unit);
        return (
          <View key={n} style={s.lift}>
            <View style={{ flex: 1 }}>
              <Text style={s.liftName}>{n}</Text>
              <Text style={s.liftHint}>
                {last ? `Last: ${toU(last.kg)} ${L}${last.done ? ', all reps' : ''}` : 'First time'}
                {sug ? (sug.reason === 'increase' ? ` · try ${toU(sug.kg)} ${L}` : ' · repeat until every rep is done') : ''}
              </Text>
            </View>
            <DoneInput value={rows[n].txt} onChangeText={v => setRows(r => ({ ...r, [n]: { ...r[n], txt: v } }))} keyboardType="decimal-pad"
              placeholder={L} placeholderTextColor={C.placeholder} style={[fieldStyles.fIn, s.liftIn, bad.includes(n) && { borderColor: C.danger }]}
              maxFontSizeMultiplier={1.4} accessibilityLabel={`${n} weight in ${unit === 'kg' ? 'kilograms' : 'pounds'}`} />
            <Pressable onPress={() => setRows(r => ({ ...r, [n]: { ...r[n], done: !r[n].done } }))} style={[s.liftDone, rows[n].done && s.liftDoneOn]}
              accessibilityRole="checkbox" accessibilityState={{ checked: rows[n].done }} accessibilityLabel={`${n}: all reps done`}>
              <Icon name="check" size={18} color={rows[n].done ? C.onAccent : C.inkSoft} strokeWidth={2.6} />
            </Pressable>
          </View>
        );
      })}
      {bad.length > 0 && <Text style={s.err}>Check {bad.join(', ')}: enter a weight between 0 and {unit === 'kg' ? '500 kg' : '1,100 lb'}, or leave it empty.</Text>}
    </Sheet>
  );
}

const s = themed(() => StyleSheet.create({
  mile: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: C.mintBg, borderWidth: 1, borderColor: C.mintLine, borderRadius: 16, padding: 14, marginBottom: 16 },
  mileIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.danger, marginTop: 8, lineHeight: 19, paddingHorizontal: 4 },
  mileTitle: { fontFamily: F.display, fontSize: 16, color: C.ink },
  mileTxt: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 19, marginTop: 3 },
  milePlus: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  milePlusTxt: { fontFamily: F.bodySemi, fontSize: 14, color: C.coralInk },
  muted: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, lineHeight: 18, paddingHorizontal: 4 },
  ask: { fontFamily: F.bodySemi, fontSize: 14.5, color: C.ink, paddingHorizontal: 4, marginBottom: 8 },
  pat: { paddingHorizontal: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line },
  patHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  patTitle: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
  patTxt: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 19 },
  b: { fontFamily: F.bodyBold, color: C.ink },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 16, paddingHorizontal: 4, marginTop: 8 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 8 },
  dayTabs: { flexDirection: 'row', backgroundColor: C.chip, borderRadius: 999, padding: 3 },
  dayTab: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999 },
  dayTabOn: { backgroundColor: C.fill },
  dayTabTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  calIn: { flex: 1, minWidth: 0, fontFamily: F.displaySemi, textAlign: 'right' },
  calStats: { flexDirection: 'row', gap: 10, paddingHorizontal: 4, marginTop: 10 },
  calStat: { flex: 1, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11 },
  k: { fontFamily: F.bodySemi, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 4 },
  v: { fontFamily: F.display, fontSize: 17, color: C.ink },
  line: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 19, paddingHorizontal: 4, marginTop: 10 },
  lift: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  liftName: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  liftHint: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2 },
  liftIn: { width: 72, textAlign: 'right', fontFamily: F.displaySemi },
  liftDone: { width: 44, height: 44, borderRadius: 9, borderWidth: 1.5, borderColor: C.control, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  liftDoneOn: { backgroundColor: C.mintInk, borderColor: C.mintInk },
}));
