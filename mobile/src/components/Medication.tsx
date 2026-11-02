import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, dateKey, daysBetween, longDate, parseKey, shortDate, DAY_FULL } from '../core/dates';
import { dosePeriods, EFFECTS, effectLabel, effectPatterns, isDue, lastDose, missedDose, nextDose, SEVERITY, SITES, siteLabel, suggestSite } from '../core/medication';
import type { TrendPoint } from '../core/trend';
import type { DoseLog, EffectId, EffectLog, Medication, SiteId, Unit } from '../core/types';
import { showChange } from '../core/units';
import { success, tick } from '../feel';
import { DoneInput } from './KeyboardDone';
import { fieldStyles } from './Fields';
import { Sheet } from './Sheet';
import { C, F, themed } from '../theme';
import { Icon } from './Icons';
import { Button, Card } from './ui';

const doseText = (mg: number | null) => (mg != null ? `${mg} mg` : '');

const ago = (k: string, today: Date) => {
  const n = daysBetween(parseKey(k), today);
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : n < 7 ? DAY_FULL[parseKey(k).getDay()] : shortDate(parseKey(k));
};

/**
 * Today: is a dose due, taken, missed, or when is the next one. A dose can be marked on any day (taken late, or the
 * day moved) and undone the same day; older doses are edited in the dose history (Settings → Medication).
 */
export function MedicationToday({ med, doses, onChange, onHistory, plus, onEffects }: {
  med: Medication; doses: DoseLog; onChange: (d: DoseLog) => void; onHistory?: () => void;
  plus?: boolean; onEffects?: () => void;   // Plus: pick the injection site, and note side effects
}) {
  const today = new Date(), key = dateKey(today);
  const taken = doses[key];
  const due = isDue(med, doses, today);
  const next = nextDose(med, doses, addDays(today, taken || !due ? 1 : 0));
  const last = lastDose(doses, addDays(today, -1));
  const missed = !taken && !due ? missedDose(med, doses, today) : null;
  // Plus, injections: where it went. The suggestion is the spot used longest ago; any chip changes it
  const sites = plus && med.injected;
  const [site, setSite] = useState<SiteId>(() => suggestSite(doses));
  const take = (k = key) => { onChange({ ...doses, [k]: { mg: med.doseMg, ...(sites ? { site } : {}) } }); success(); };
  const sitePicker = sites ? (
    <View style={s.sites} accessibilityLabel="Injection site">
      {SITES.map(x => (
        <Pressable key={x.id} onPress={() => { tick(); setSite(x.id); }} style={[s.site, site === x.id && s.siteOn]} hitSlop={2}
          accessibilityRole="radio" accessibilityState={{ selected: site === x.id }} accessibilityLabel={x.label + (x.id === suggestSite(doses) ? ', used longest ago' : '')}>
          <Text style={[s.siteTxt, site === x.id && s.siteTxtOn]}>{x.short}</Text>
        </Pressable>
      ))}
    </View>
  ) : null;
  const undo = () => { const d = { ...doses }; delete d[key]; onChange(d); };
  const nextTxt = `next ${DAY_FULL[next.getDay()]}${med.every === 'week' ? ' ' + shortDate(next) : ''}`;
  if (missed) {
    const day = DAY_FULL[missed.getDay()];
    return (
      <View style={[s.card, s.cardDue, s.column]}>
        <View style={s.rowTop} accessible accessibilityLabel={`${med.name}: ${day}'s dose isn't marked. If you took it, mark the day you took it.`}>
          <View style={s.icon}><Icon name="pill" size={20} color={C.plum2} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{day}’s {med.name} isn’t marked</Text>
            <Text style={s.sub}>If you took it, mark the day you took it. If you missed it, follow your prescriber’s advice.</Text>
          </View>
        </View>
        {sitePicker}
        <View style={s.actions}>
          <Button label={`Took it ${DAY_FULL[missed.getDay()].slice(0, 3)}`} kind="ghost" small onPress={() => take(dateKey(missed))} />
          <Button label="Took it today" kind="primary" small onPress={() => take()} />
          {onHistory && <Button label="Another day" kind="ghost" small onPress={onHistory} />}
        </View>
      </View>
    );
  }
  const title = taken ? `${med.name} taken today` : due ? `${med.name} due today` : `${med.name} · ${nextTxt}`;
  const sub = taken ? [doseText(taken.mg), taken.site ? siteLabel(taken.site).toLowerCase() : '', nextTxt].filter(Boolean).join(' · ')
    : [doseText(med.doseMg), last ? `last dose ${ago(last, today)}` : due ? 'mark it once you’ve taken it' : ''].filter(Boolean).join(' · ');
  return (
    <View style={[s.card, due && s.cardDue, s.column]}>
      <View style={s.rowTop}>
        <View style={s.icon}><Icon name="pill" size={20} color={C.plum2} /></View>
        <View style={{ flex: 1 }} accessible accessibilityLabel={`${title}. ${sub}`}>
          <Text style={s.title}>{title}</Text>
          {!!sub && <Text style={s.sub}>{sub}</Text>}
        </View>
        {taken ? <Button label="Undo" kind="ghost" small onPress={undo} />
          : <Button label={due ? 'Mark taken' : 'Took it today'} kind={due ? 'primary' : 'ghost'} small onPress={() => take()} />}
      </View>
      {due && !taken && sitePicker}
      {plus && onEffects && <Button label="Note how you feel" kind="ghost" small style={{ alignSelf: 'flex-start' }} onPress={onEffects} />}
    </View>
  );
}

/** Trend tab: how the trend moved on each dose, in order. The question people on a GLP-1 ask most. */
/**
 * Each dose and how the trend moved during it, then side-effect patterns. `onUnlock` makes it the free version's preview:
 * the person's own doses are listed but each result is hidden, with one button to Plus. Seeing your own numbers waiting
 * says more than a feature list.
 */
export function MedicationTrend({ med, doses, series, unit, onHistory, effects = {}, onReport, onUnlock }: {
  med: Medication; doses: DoseLog; series: TrendPoint[]; unit: Unit; onHistory?: () => void; effects?: EffectLog; onReport?: () => void; onUnlock?: () => void;
}) {
  const locked = !!onUnlock;
  const runs = dosePeriods(doses, series);
  const patterns = effectPatterns(effects, doses).slice(0, 4);
  return (
    <Card title={`${med.name} and your trend`}>
      {!runs.length
        ? <Text style={s.sub}>Mark doses as taken on Today and this shows how your trend moved at each dose.</Text>
        : runs.slice().reverse().map(r => (
          <View key={r.from} style={s.row} accessible accessibilityLabel={`${doseText(r.mg) || 'Dose'} from ${longDate(r.from)}, ${r.doses} doses${locked ? ', trend change shown with Plus' : r.trendChange != null ? `, trend ${showChange(r.trendChange, unit, 1)}` : ''}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{doseText(r.mg) || 'Dose'} · from {shortDate(parseKey(r.from))}</Text>
              <Text style={s.sub}>{r.doses} dose{r.doses === 1 ? '' : 's'}{r.weeks ? ` over ${r.weeks} week${r.weeks === 1 ? '' : 's'}` : ''}</Text>
            </View>
            {locked
              ? <View style={s.hidden}><Icon name="lock" size={13} color={C.inkSoft} strokeWidth={2.4} /><Text style={s.hiddenTxt}>•••</Text></View>
              : <Text style={s.change}>{r.trendChange != null ? showChange(r.trendChange, unit, 1) : '—'}</Text>}
          </View>
        ))}
      {locked && patterns.length > 0 && <Text style={s.foot}>{patterns.length} side effect{patterns.length === 1 ? '' : 's'} noted. Plus shows which day after a dose each one peaks.</Text>}
      {locked && <View style={s.actions}><Button label="See your trend at each dose" kind="primary" small onPress={onUnlock} /></View>}
      {!locked && patterns.length > 0 && <>
        <Text style={s.sectionK}>Side effects through the week</Text>
        {patterns.map(p => {
          const peak = p.byDay.indexOf(Math.max(...p.byDay));
          const placed = p.byDay.reduce((a, b) => a + b, 0);
          return (
            <View key={p.id} style={s.row} accessible accessibilityLabel={`${effectLabel(p.id)}: noted ${p.total} time${p.total === 1 ? '' : 's'}${placed ? `, most often ${peak === 0 ? 'on dose day' : peak + ' day' + (peak === 1 ? '' : 's') + ' after a dose'}` : ''}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{effectLabel(p.id)}</Text>
                <Text style={s.sub}>{p.total} time{p.total === 1 ? '' : 's'}{placed ? ` · most often ${peak === 0 ? 'on dose day' : `${peak} day${peak === 1 ? '' : 's'} after`}` : ''}</Text>
              </View>
              <View style={s.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {p.byDay.map((n, i) => <View key={i} style={[s.bar, { height: 4 + Math.round(18 * n / Math.max(1, ...p.byDay)) }, n > 0 && s.barOn]} />)}
              </View>
            </View>
          );
        })}
        <Text style={s.foot}>Bars: dose day, then each day after it.</Text>
      </>}
      {!locked && <View style={s.actions}>
        {onHistory && runs.length > 0 && <Button label="Edit dose history" kind="ghost" small onPress={onHistory} />}
        {onReport && <Button label="Report for your doctor" kind="ghost" small onPress={onReport} />}
      </View>}
      <Text style={s.foot}>A record, not advice: talk to your prescriber about any change to your medication.</Text>
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardDue: { borderColor: C.done, borderWidth: 1.5 },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.panelAlt, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  sub: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, marginTop: 2, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  rowTitle: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  change: { fontFamily: F.displaySemi, fontSize: 16, color: C.ink },
  hidden: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: C.panel },
  hiddenTxt: { fontFamily: F.displaySemi, fontSize: 15, color: C.inkSoft, letterSpacing: 1 },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, marginTop: 10, lineHeight: 17 },
  sites: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  site: { minHeight: 44, minWidth: 64, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  siteOn: { backgroundColor: C.fill },
  siteTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink },
  siteTxtOn: { color: C.onFill },
  sectionK: { fontFamily: F.bodyBold, fontSize: 11.5, letterSpacing: 0.8, textTransform: 'uppercase', color: C.inkSoft, marginTop: 16, marginBottom: 2 },
  week: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  bar: { width: 6, borderRadius: 3, backgroundColor: C.chip },
  barOn: { backgroundColor: C.plum2 },
}));

/** Plus: note side effects on a day, with how strong they were. A record to show a prescriber, never advice. */
export function EffectsSheet({ day, effects, onSave, onClose }: { day: string; effects: EffectLog; onSave: (e: EffectLog) => void; onClose: () => void }) {
  const cur = effects[day];
  const [picked, setPicked] = useState<EffectId[]>(cur?.effects ?? []);
  const [severity, setSeverity] = useState<1 | 2 | 3>(cur?.severity ?? 1);
  const [text, setText] = useState(cur?.text ?? '');
  const [closing, setClosing] = useState(false);
  const toggle = (id: EffectId) => { tick(); setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])); };
  const save = () => {
    const next = { ...effects };
    if (picked.length) next[day] = { effects: picked, severity, ...(text.trim() ? { text: text.trim().slice(0, 140) } : {}) };
    else delete next[day];
    onSave(next); setClosing(true);
  };
  return (
    <Sheet title={`How you feel · ${shortDate(parseKey(day))}`} onClose={onClose} closing={closing}
      footer={<Button label={picked.length || cur ? 'Save' : 'Nothing to note'} disabled={!picked.length && !cur} onPress={save} />}>
      <View style={s.sites}>
        {EFFECTS.map(x => (
          <Pressable key={x.id} onPress={() => toggle(x.id)} style={[s.site, picked.includes(x.id) && s.siteOn]}
            accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(x.id) }} accessibilityLabel={x.label}>
            <Text style={[s.siteTxt, picked.includes(x.id) && s.siteTxtOn]}>{x.label}</Text>
          </Pressable>
        ))}
      </View>
      {picked.length > 0 && <>
        <Text style={s.sectionK}>How strong</Text>
        <View style={s.sites}>
          {SEVERITY.map((label, i) => (
            <Pressable key={label} onPress={() => { tick(); setSeverity((i + 1) as 1 | 2 | 3); }} style={[s.site, severity === i + 1 && s.siteOn]}
              accessibilityRole="radio" accessibilityState={{ selected: severity === i + 1 }} accessibilityLabel={label}>
              <Text style={[s.siteTxt, severity === i + 1 && s.siteTxtOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </>}
      <DoneInput style={[fieldStyles.fIn, { marginTop: 14 }]} value={text} onChangeText={setText} placeholder="Add a note (optional)"
        placeholderTextColor={C.inkSoft} maxLength={140} accessibilityLabel="Note about how you feel" />
      <Text style={s.foot}>A record to show your prescriber. Anything severe or that worries you is a question for them, not an app.</Text>
    </Sheet>
  );
}
