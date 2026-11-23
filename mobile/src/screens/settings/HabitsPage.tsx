import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DAY_FULL, DAY_ORDER } from '../../core/dates';
import { MAX_HABITS } from '../../core/plan';
import type { Habit, Session, Settings } from '../../core/types';
import { HABIT_ICONS, habitIcon } from '../../core/habitIcons';
import { Field } from '../../components/Fields';
import { Icon } from '../../components/Icons';
import { Button } from '../../components/ui';
import { HabitAmount } from '../../components/HabitAmount';
import { usePlus } from '../../plus';
import { FREE_HABITS } from '../../core/plus';
import { C } from '../../theme';
import { PageHeader, Input, useSaveOnLeave, s } from './kit';

export function HabitsPage({ settings, onSave, onBack }: { settings: Settings; onSave: (h: Habit[]) => void; onBack: () => void }) {
  const { plus, openPaywall } = usePlus();
  const [habits, setHabits] = useState<Habit[]>(settings.habits.map(h => ({ ...h })));
  const setHabit = (i: number, patch: Partial<Habit>) => setHabits(hs => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  useSaveOnLeave(habits.filter(h => h.short.trim() || h.name.trim()), onSave);
  const [picking, setPicking] = useState<string | null>(null);   // habit whose icon grid is open
  return (
    <View style={s.wrap}>
      <PageHeader title="Daily habits" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>Up to {MAX_HABITS}. An icon, a short label (5 letters) and a name; for steps, water, sleep and veg, pick your own amount. Removing a habit hides it; past ticks are kept.</Text>
        <View style={s.form}>
          {habits.map((h, i) => (
            <View key={h.id} style={[s.habitBlock, i === habits.length - 1 && s.habitBlockLast]}>
            <View style={s.habitRow}>
              <Pressable onPress={() => setPicking(p => (p === h.id ? null : h.id))} style={[s.iconBtn, picking === h.id && s.iconBtnOn]}
                accessibilityRole="button" accessibilityState={{ expanded: picking === h.id }}
                accessibilityLabel={`Habit ${i + 1} icon: ${HABIT_ICONS.find(([n]) => n === habitIcon(h.icon, h.name))?.[1]}`} accessibilityHint="Choose a different icon">
                <Icon name={habitIcon(h.icon, h.name)} size={22} color={C.plum2} />
              </Pressable>
              <Input value={h.short} onChangeText={v => setHabit(i, { short: v })} style={{ width: 84, textAlign: 'center' }} maxLength={5} placeholder="Label" accessibilityLabel={`Habit ${i + 1} short label`} />
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setHabits(hs => hs.filter((_, j) => j !== i))} style={s.x} accessibilityRole="button" accessibilityLabel={'Remove ' + (h.name || `habit ${i + 1}`)}>
                <Icon name="close" size={16} color={C.danger} strokeWidth={2.4} />
              </Pressable>
            </View>
            {/* The name gets the full width (and wraps) so a long one is never cut off or broken mid-word */}
            <Input value={h.name} onChangeText={v => setHabit(i, { name: v.replace(/\n/g, ' ') })} style={s.habitName} placeholder="Name, e.g. Walk after dinner"
              accessibilityLabel={`Habit ${i + 1} name`} multiline scrollEnabled={false} blurOnSubmit returnKeyType="done" maxLength={40} />
            <HabitAmount habit={h} onChange={nh => setHabit(i, { name: nh.name })} />
            {!plus && i >= FREE_HABITS && <Text style={s.hint}>Can’t be ticked on the free version. Its history stays on the Habits tab; ticking it again is Plus.</Text>}
            {picking === h.id && (
              <View style={s.iconGrid} accessibilityRole="radiogroup" accessibilityLabel={`Icon for ${h.name || `habit ${i + 1}`}`}>
                {HABIT_ICONS.map(([name, label]) => {
                  const on = habitIcon(h.icon, h.name) === name;
                  return (
                    <Pressable key={name} onPress={() => { setHabit(i, { icon: name }); setPicking(null); }} style={[s.iconCell, on && s.iconCellOn]}
                      accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}>
                      <Icon name={name} size={22} color={on ? C.onFill : C.ink} />
                    </Pressable>
                  );
                })}
              </View>
            )}
            </View>
          ))}
          {habits.length < MAX_HABITS && (plus || habits.length < FREE_HABITS ? (
            <Button icon="plus" label="Add habit" kind="ghost" small style={{ alignSelf: 'flex-start' }}
              onPress={() => setHabits(hs => [...hs, { id: 'h' + Date.now().toString(36), icon: 'check', short: '', name: '' }])} />
          ) : (
            <Button icon="plus" label={`More than ${FREE_HABITS} habits: Plus`} kind="ghost" small style={{ alignSelf: 'flex-start' }} onPress={() => openPaywall('habits')} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function SessionsPage({ settings, onSave, onBack }: { settings: Settings; onSave: (s: Record<number, Session>) => void; onBack: () => void }) {
  const [sessions, setSessions] = useState<Record<number, Session>>(() => JSON.parse(JSON.stringify(settings.sessions)));
  const [itemsText, setItemsText] = useState<Record<number, string>>(() => Object.fromEntries(DAY_ORDER.map(d => [d, settings.sessions[d].items.join('\n')])));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const out: Record<number, Session> = {};
  for (const d of DAY_ORDER) out[d] = { ...sessions[d], items: itemsText[d].split('\n').map(x => x.trim()).filter(Boolean) };
  useSaveOnLeave(out, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Weekly sessions" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>One exercise per line. Start a line with # to make a heading (e.g. # core). Leave a day empty for rest.</Text>
        <View style={s.groupBox}>
          {DAY_ORDER.map((d, idx) => {
            const x = sessions[d];
            const open = openDay === d;
            const lines = itemsText[d].split('\n').filter(l => l.trim()).length;
            return (
              <View key={d} style={idx < 6 && s.rowLine}>
                <Pressable onPress={() => setOpenDay(open ? null : d)} style={s.row} accessibilityRole="button" accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${DAY_FULL[d]}, ${x.title || (lines ? `${lines} exercises` : 'rest')}`}>
                  <Text style={s.rowLabel}>{DAY_FULL[d]}</Text>
                  <Text style={s.rowValue} numberOfLines={1}>{x.title || (lines ? `${lines} exercises` : 'Rest')}</Text>
                  <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><Icon name="chevron" size={18} color={C.inkSoft} /></View>
                </Pressable>
                {open && (
                  <View style={{ gap: 12, paddingHorizontal: 14, paddingBottom: 14 }}>
                    <Field label="Title"><Input value={x.title} onChangeText={v => setSessions(ss => ({ ...ss, [d]: { ...ss[d], title: v } }))} placeholder="e.g. Upper body" accessibilityLabel={`${DAY_FULL[d]} title`} /></Field>
                    <Field label="Exercises"><Input value={itemsText[d]} onChangeText={v => setItemsText(t => ({ ...t, [d]: v }))} multiline accessibilityLabel={`${DAY_FULL[d]} exercises, one per line`}
                      style={{ minHeight: 120, textAlignVertical: 'top', fontSize: 15 }} placeholder={'Lat pulldown — 3 × 10\n# core\nPlank — 3 × 30 sec'} /></Field>
                    <Field label="Note"><Input value={x.note} onChangeText={v => setSessions(ss => ({ ...ss, [d]: { ...ss[d], note: v } }))} placeholder="Optional reminder" accessibilityLabel={`${DAY_FULL[d]} note`} /></Field>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
