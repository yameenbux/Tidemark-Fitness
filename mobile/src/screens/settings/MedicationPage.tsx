import { useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { addDays, dateKey, DAY_ABBR, DAY_FULL, longDate, parseKey, shortDate } from '../../core/dates';
import { doseHistoryDays, isDoseDay } from '../../core/medication';
import { num } from '../../core/units';
import type { DoseLog, Medication, Settings } from '../../core/types';
import { DateInput, Field } from '../../components/Fields';
import { Icon } from '../../components/Icons';
import { Button, Tabs } from '../../components/ui';
import { Tap } from '../../components/Motion';
import { choose, notify } from '../../dialogs';
import { tap } from '../../feel';
import { allowReminders, DOSE_HOUR, timeLabel } from '../../reminders';
import { C } from '../../theme';
import { PageHeader, Input, useSaveOnLeave, s } from './kit';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** Optional medication companion (e.g. a weekly GLP-1 injection). Records only: Tidemark never suggests doses. */
export function MedicationPage({ settings, doses, onDoses, onSave, onBack }: {
  settings: Settings; doses: DoseLog; onDoses: (d: DoseLog) => void; onSave: (m: Settings['medication']) => void; onBack: () => void;
}) {
  const cur = settings.medication;
  const [name, setName] = useState(cur?.name ?? '');
  const [dose, setDose] = useState(cur?.doseMg != null ? String(cur.doseMg) : '');
  const [every, setEvery] = useState<'week' | 'day'>(cur?.every ?? 'week');
  const [weekday, setWeekday] = useState(cur?.weekday ?? new Date().getDay());
  const [remind, setRemind] = useState(cur?.remind ?? false);
  const [injected, setInjected] = useState(cur?.injected ?? (cur?.every ?? 'week') === 'week');
  const [appointment, setAppointment] = useState<string | null>(cur?.appointment ?? null);
  const [stoppedOn, setStoppedOn] = useState<string | null>(cur?.stoppedOn ?? null);
  const todayK = dateKey(new Date());
  const mg = num(dose);
  const result: Settings['medication'] = name.trim() ? { name: name.trim(), doseMg: mg > 0 && mg <= 1000 ? mg : null, every, weekday, remind: remind && !stoppedOn, injected, appointment, stoppedOn } : null;
  const toggleRemind = async (on: boolean) => {
    if (on && !(await allowReminders())) { notify('Notifications are off', 'Turn on notifications for Tidemark in iOS Settings to get dose reminders.'); return; }
    setRemind(on);
  };
  const skip = useSaveOnLeave(result, onSave);
  return (
    <View style={s.wrap}>
      <PageHeader title="Medication" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={s.lead}>For a weight-loss medication such as a weekly GLP-1 injection. Today shows when the next dose is due and lets you mark it
          as taken; the Trend tab shows how your trend moved at each dose. Tidemark only keeps a record: follow your prescriber for anything about dosing.</Text>
        <View style={s.form}>
          <Field label="Name"><Input value={name} onChangeText={setName} placeholder="e.g. semaglutide" accessibilityLabel="Medication name" maxLength={40} /></Field>
          <View style={{ marginTop: 14 }}><Field label="Current dose (mg, optional)">
            <Input value={dose} onChangeText={setDose} keyboardType="decimal-pad" placeholder="e.g. 2.4" accessibilityLabel="Current dose in milligrams" />
          </Field></View>
          <View style={{ marginTop: 14 }}><Field label="How often">
            <Tabs value={every} onChange={setEvery} label="How often" options={[{ id: 'week', label: 'Once a week' }, { id: 'day', label: 'Every day' }]} />
          </Field></View>
          {every === 'week' && <View style={{ marginTop: 14 }}><Field label="Dose day">
            <View style={s.dayRow} accessibilityRole="radiogroup" accessibilityLabel="Dose day">
              {WEEK_ORDER.map(d => (
                <Tap key={d} onPress={() => setWeekday(d)} style={[s.dayChip, weekday === d && s.dayChipOn]}
                  accessibilityRole="radio" accessibilityState={{ checked: weekday === d }} accessibilityLabel={DAY_FULL[d]}>
                  <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.4} style={[s.dayChipTxt, weekday === d && { color: C.onFill }]}>{DAY_ABBR[d]}</Text>
                </Tap>
              ))}
            </View>
          </Field></View>}
        </View>
        <View style={[s.form, s.remindRow]}>
          <View style={{ flex: 1 }}>
            <Text style={s.remindTitle}>It’s an injection</Text>
            <Text style={s.hint}>With Plus, Today offers the site used longest ago, so each spot gets a rest.</Text>
          </View>
          <Switch value={injected} onValueChange={setInjected} trackColor={{ false: C.control, true: C.mintInk }} accessibilityLabel="It’s an injection" />
        </View>
        <View style={[s.form, s.remindRow]}>
          <View style={{ flex: 1 }}>
            <Text style={s.remindTitle}>Remind me on dose days</Text>
            <Text style={s.hint}>At {timeLabel(DOSE_HOUR, 0)}. The reminder doesn’t name the medication.</Text>
          </View>
          <Switch value={remind} onValueChange={toggleRemind} trackColor={{ false: C.control, true: C.mintInk }} accessibilityLabel="Remind me on dose days" />
        </View>
        <Text style={s.hint}>If you change dose, update it here; earlier doses keep the strength they were logged at.</Text>
        <View style={[s.form, { marginTop: 16 }]}>
          <Field label="Next appointment or reorder (optional)">
            {appointment
              ? <View style={{ gap: 8 }}>
                  <DateInput value={appointment} onChange={setAppointment} label="Next appointment or reorder" min={todayK} />
                  <Button label="Remove the date" kind="ghost" small style={{ alignSelf: 'flex-start' }} onPress={() => setAppointment(null)} />
                </View>
              : <Button icon="calendar" label="Add a date" kind="ghost" small style={{ alignSelf: 'flex-start' }} onPress={() => setAppointment(dateKey(addDays(new Date(), 7)))} />}
          </Field>
          <Text style={s.hint}>A few days before, Tidemark offers a report of your trend, doses and side effects to take along.</Text>
        </View>
        {cur && (stoppedOn
          ? <View style={[s.form, { marginTop: 16 }]}>
              <Text style={s.remindTitle}>Stopped on {longDate(stoppedOn)}</Text>
              <Text style={s.hint}>Dose cards and reminders are off. Your dose history stays, and the Trend tab follows your trend since.</Text>
              <Button label="I’ve started again" kind="ghost" small style={{ alignSelf: 'flex-start', marginTop: 8 }} onPress={() => setStoppedOn(null)} />
            </View>
          : <Button label="I’ve stopped taking it" kind="ghost" small style={{ alignSelf: 'flex-start', marginTop: 16 }} onPress={async () => {
              const pick = await choose('Stopped taking it?', 'Tidemark turns off dose cards and reminders and keeps your dose history. Talk to your prescriber about anything to do with stopping.',
                [{ id: 'stop', label: 'Yes, I’ve stopped' }]);
              if (pick === 'stop') { setStoppedOn(todayK); setRemind(false); }
            }} />)}
        {cur && <DoseHistory med={cur} doses={doses} onDoses={onDoses} />}
        {cur && <Button label="Stop tracking medication" kind="danger" small style={{ alignSelf: 'flex-start', marginTop: 16 }} onPress={async () => {
          const n = Object.keys(doses).length;
          if (n) {
            const pick = await choose('Stop tracking medication?', `You have ${n} dose${n === 1 ? '' : 's'} recorded. Keep them (they stay in your backups) or delete them from this phone.`,
              [{ id: 'keep', label: 'Keep dose history' }, { id: 'delete', label: 'Delete dose history' }]);
            if (!pick) return;
            if (pick === 'delete') onDoses({});
          }
          skip(); onSave(null); onBack();
        }} />}
      </ScrollView>
    </View>
  );
}

/** Recent dose days with a tick each, so a dose marked by mistake can be cleared and a forgotten one added. */
function DoseHistory({ med, doses, onDoses }: { med: Medication; doses: DoseLog; onDoses: (d: DoseLog) => void }) {
  const days = doseHistoryDays(med, doses);
  const toggle = (k: string) => {
    const d = { ...doses };
    if (d[k]) delete d[k]; else d[k] = { mg: med.doseMg };
    onDoses(d); tap();
  };
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={s.groupTitle} accessibilityRole="header">Dose history</Text>
      <View style={s.form}>
        {days.map((k, i) => {
          const d = parseKey(k), on = !!doses[k];
          const label = `${DAY_ABBR[d.getDay()]} ${shortDate(d)}`;
          return (
            <Tap key={k} onPress={() => toggle(k)} style={[s.doseRow, i > 0 && s.doseRowLine]} accessibilityRole="checkbox"
              accessibilityState={{ checked: on }} accessibilityLabel={`${label}, ${on ? 'taken' : 'not marked'}`}>
              <View style={{ flex: 1 }}>
                <Text style={s.remindTitle}>{label}</Text>
                <Text style={s.hint}>{on ? ['Taken', doses[k].mg != null ? `${doses[k].mg} mg` : ''].filter(Boolean).join(' · ') : isDoseDay(med, d) ? 'Not marked' : 'Extra dose'}</Text>
              </View>
              <View style={[s.doseTick, on && s.doseTickOn]}>{on && <Icon name="check" size={16} color={C.onDone} strokeWidth={2.6} />}</View>
            </Tap>
          );
        })}
      </View>
      <Text style={s.hint}>Tap a day to mark or clear it. A dose added here uses your current strength.</Text>
    </View>
  );
}
