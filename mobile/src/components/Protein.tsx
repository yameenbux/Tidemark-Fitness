import { StyleSheet, Text, View } from 'react-native';
import { dateKey } from '../core/dates';
import { addProtein, proteinWeek, type ProteinLog } from '../core/protein';
import type { Settings } from '../core/types';
import { tick } from '../feel';
import { C, F, themed } from '../theme';
import { Button, Card } from './ui';

/**
 * Plus: today's protein against the daily minimum the person set, added in quick steps (a chicken breast is about
 * 30 g). Until they've set one, the card asks for it rather than suggesting a number.
 */
export function ProteinCard({ settings, log, onChange, onSetTarget }: { settings: Settings; log: ProteinLog; onChange: (l: ProteinLog) => void; onSetTarget: () => void }) {
  const day = dateKey(new Date());
  const target = settings.protein?.grams ?? null;
  if (target == null) return (
    <Card title="Protein">
      <Text style={s.foot}>Set the daily minimum you’re aiming for, for example one your GP, dietitian or prescriber suggested, and Tidemark tracks each day against it.</Text>
      <View style={s.row}><Button label="Set my daily minimum" kind="ghost" small onPress={onSetTarget} /></View>
    </Card>
  );
  const g = log[day] ?? 0;
  const pct = Math.min(100, Math.round(g / Math.max(1, target) * 100));
  const week = proteinWeek(log, target);
  const add = (n: number) => { tick(); onChange(addProtein(log, day, n)); };
  return (
    <Card title="Protein" right={<Text style={s.count} accessibilityLabel={`${g} of ${target} grams today`}>{g} / {target} g</Text>}>
      <View style={s.track} accessible accessibilityRole="progressbar" accessibilityLabel="Protein today"
        accessibilityValue={{ min: 0, max: 100, now: pct, text: `${g} of ${target} grams` }}>
        <View style={[s.fill, { width: `${pct}%` }, g >= target && s.done]} />
      </View>
      <View style={s.row}>
        {[10, 20, 30].map(n => <Button key={n} label={`+${n} g`} kind="ghost" small onPress={() => add(n)} />)}
        <Button label="−10 g" kind="ghost" small disabled={g === 0} onPress={() => add(-10)} />
      </View>
      <Text style={s.foot}>
        {g >= target ? 'Today’s minimum reached. ' : ''}
        {week.logged ? `Last 7 days: reached on ${week.reached} of ${week.logged} logged day${week.logged === 1 ? '' : 's'}. ` : ''}
        A minimum you set, not a limit. Change it in Settings.
      </Text>
    </Card>
  );
}

const s = themed(() => StyleSheet.create({
  count: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: C.chip, overflow: 'hidden', marginHorizontal: 4, marginTop: 4 },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.coral },
  done: { backgroundColor: C.mintInk },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  foot: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 17, marginTop: 10, paddingHorizontal: 4 },
}));
