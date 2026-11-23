import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Alert } from 'react-native';
import { BodyCard } from '../components/Body';
import { CaloriesCard, LiftSheet, MilestoneBanner } from '../components/Extras';
import { Hero } from '../components/Hero';
import { addDays, dateKey } from '../core/dates';
import { buildTargets, defaultSettings, DEFAULT_HABITS } from '../core/plan';
import { DEFAULT_PREFS } from '../core/storage';
import { setWeightsHidden } from '../core/units';
import type { Medication } from '../core/types';
import { SettingsScreen, SettingsProps } from '../screens/SettingsScreen';
import { NO_PLUS } from '../core/plus';
import { PlusProvider } from '../plus';

const settings = defaultSettings({ start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: buildTargets(90, 80, '2026-01-05', '2026-06-01') }, DEFAULT_HABITS);
const today = new Date();
const med: Medication = { name: 'Wegovy', doseMg: 2.4, every: 'week', weekday: today.getDay() };
const props = (over: Partial<SettingsProps> = {}): SettingsProps => ({
  settings: { ...settings, medication: med }, unit: 'kg', setUnit: jest.fn(), lock: false, lockAvailable: true, lockName: 'Face ID', onLockChange: jest.fn(),
  reminder: DEFAULT_PREFS.reminder, onReminderChange: jest.fn(), appearance: 'system', onAppearanceChange: jest.fn(), lastBackup: null, weighIns: 3,
  weights: {}, onPlanLeftUnsaved: jest.fn(), doses: {}, onDoses: jest.fn(), lengthUnit: 'cm', onLengthUnit: jest.fn(), onSave: jest.fn(), onClose: jest.fn(), onExport: jest.fn(),
  onExportCsv: jest.fn(), onRestore: jest.fn(), onReset: jest.fn(), onEraseAll: jest.fn(), ...over,
});
afterEach(() => jest.restoreAllMocks());

describe('medication settings', () => {
  test('dose history: tick a day to add a forgotten dose, tick again to clear one marked by mistake', () => {
    const lastWeek = dateKey(addDays(today, -7));
    const p = props({ doses: { [lastWeek]: { mg: 2.4 } } });
    render(<SettingsScreen {...p} initialPage="medication" />);
    expect(screen.getByText('Dose history')).toBeTruthy();
    fireEvent.press(screen.getByRole('checkbox', { name: /, taken$/ }));
    expect(p.onDoses).toHaveBeenLastCalledWith({});
    fireEvent.press(screen.getAllByRole('checkbox', { name: /not marked$/ })[0]);
    expect(p.onDoses).toHaveBeenLastCalledWith({ [lastWeek]: { mg: 2.4 }, [dateKey(today)]: { mg: 2.4 } });
  });
  test('stopping asks about the dose history, and can delete it', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Delete dose history')?.onPress?.());
    const p = props({ doses: { [dateKey(today)]: { mg: 2.4 } } });
    render(<SettingsScreen {...p} initialPage="medication" />);
    await act(async () => { fireEvent.press(screen.getByText('Stop tracking medication')); });
    expect(p.onDoses).toHaveBeenCalledWith({});
    expect((p.onSave as jest.Mock).mock.calls.at(-1)[0].medication).toBeNull();
  });
  test('stopping can keep the history, and cancelling changes nothing', async () => {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Cancel')?.onPress?.());
    const p = props({ doses: { [dateKey(today)]: { mg: 2.4 } } });
    render(<SettingsScreen {...p} initialPage="medication" />);
    await act(async () => { fireEvent.press(screen.getByText('Stop tracking medication')); });
    expect(p.onSave).not.toHaveBeenCalled();
    spy.mockImplementation((_t, _m, buttons) => buttons?.find(b => b.text === 'Keep dose history')?.onPress?.());
    await act(async () => { fireEvent.press(screen.getByText('Stop tracking medication')); });
    expect(p.onDoses).not.toHaveBeenCalled();
    expect((p.onSave as jest.Mock).mock.calls.at(-1)[0].medication).toBeNull();
  });
});

describe('body and extras', () => {
  test('measurements: shows the latest, and adding one saves it for today', async () => {
    const onMeasurements = jest.fn();
    render(<BodyCard settings={settings} weights={{}} unit="kg" lengthUnit="cm" onLengthUnit={jest.fn()} measurements={{ '2026-01-05': { waist: 96 } }} photos={{}} onMeasurements={onMeasurements} onPhotos={jest.fn()} />);
    expect(screen.getByLabelText(/^Waist 96/)).toBeTruthy();
    fireEvent.press(screen.getByText('Measure'));
    fireEvent.changeText(screen.getByLabelText('Waist'), '94.5');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(onMeasurements).toHaveBeenCalled());
    expect(onMeasurements.mock.calls[0][0][dateKey(today)]).toEqual({ waist: 94.5 });
  });
  test('measurements in inches with a kg weight: switching converts what is typed, and it is stored in cm', async () => {
    const onMeasurements = jest.fn(), onLengthUnit = jest.fn();
    function Holder() {   // keeps the chosen unit, as the app's preferences do
      const [lu, setLu] = useState<'cm' | 'in'>('cm');
      return <BodyCard settings={settings} weights={{}} unit="kg" lengthUnit={lu} onLengthUnit={u => { onLengthUnit(u); setLu(u); }}
        measurements={{}} photos={{}} onMeasurements={onMeasurements} onPhotos={jest.fn()} />;
    }
    render(<Holder />);
    fireEvent.press(screen.getByText('Measure'));
    fireEvent.changeText(screen.getByLabelText('Waist'), '91.4');
    fireEvent.press(screen.getByText('inches'));
    expect(onLengthUnit).toHaveBeenCalledWith('in');
    expect(screen.getByLabelText('Waist').props.value).toBe('36.0');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(onMeasurements).toHaveBeenCalled());
    expect(onMeasurements.mock.calls[0][0][dateKey(today)].waist).toBeCloseTo(91.4, 0);
  });
  test('a milestone can be dismissed', () => {
    const onDismiss = jest.fn();
    render(<MilestoneBanner quarter={1} settings={settings} trendNow={87.4} unit="kg" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByLabelText('Dismiss milestone'));
    expect(onDismiss).toHaveBeenCalled();
  });
  test('calories: today\'s intake is saved when you leave the field', () => {
    const onChange = jest.fn();
    render(<CaloriesCard settings={{ ...settings, trackCalories: true }} weights={{}} intake={{}} onChange={onChange} />);
    const input = screen.getByLabelText(/^Calories eaten/);
    fireEvent.changeText(input, '2100');
    fireEvent(input, 'blur');   // saved when you leave the field
    expect(onChange).toHaveBeenCalledWith(dateKey(today), 2100);
  });
  describe('calorie advice', () => {
    // 30 days of weigh-ins changing by `perDay`, and `kcal` eaten on each of the last 21 days
    const data = (perDay: number, kcal: number) => {
      const trend = Array.from({ length: 30 }, (_, i) => { const d = addDays(today, i - 30); d.setHours(0, 0, 0, 0); const kg = 90 - i * perDay; return { d, k: dateKey(d), kg, trend: kg }; });
      const intake: Record<string, number> = {};
      for (let i = 1; i <= 21; i++) intake[dateKey(addDays(today, -i))] = kcal;
      return { trend, intake };
    };
    const card = (perDay: number, kcal: number) => { const d = data(perDay, kcal);
      return <CaloriesCard settings={{ ...settings, trackCalories: true }} weights={{}} intake={d.intake} trend={d.trend} onChange={jest.fn()} />; };
    test('gives the burn and what to eat as ranges, not one exact number', () => {
      render(card(0.5 / 7, 2000));
      expect(screen.getByText(/you burn somewhere around/)).toBeTruthy();
      expect(screen.getByText(/To keep your plan’s pace, eat around/)).toBeTruthy();
      expect(screen.getAllByText(/\d,\d{3}–\d,\d{3} kcal/).length).toBeGreaterThan(0);
    });
    test('never suggests eating under the floor: it says to slow down and ask a professional', () => {
      render(card(0, 1250));      // not losing on 1,250 kcal, plan wants about half a kilo a week
      expect(screen.getByText(/won’t suggest a number/)).toBeTruthy();
      expect(screen.queryByText(/eat around/)).toBeNull();
    });
    test('with "hide my weight" on there is no eating target at all', () => {
      setWeightsHidden(true);
      try {
        render(card(0.5 / 7, 2000));
        expect(screen.getByText(/you burn somewhere around/)).toBeTruthy();
        expect(screen.queryByText(/eat around/)).toBeNull();
      } finally { setWeightsHidden(false); }
    });
  });
  test('a session\'s weights are recorded per exercise', async () => {
    const onSave = jest.fn();
    const session = { title: 'Full body', items: ['Squat — 3 × 8'], note: '' };
    render(<LiftSheet dateK={dateKey(today)} session={session} lifts={{}} unit="kg" onSave={onSave} onClose={jest.fn()} />);
    fireEvent.changeText(screen.getByLabelText(/weight in kilograms/), '60');
    fireEvent.press(screen.getByText('Save session'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
  });
});

describe('the hero', () => {
  const plan = { ...settings.plan, start: dateKey(addDays(today, -30)), goalDate: dateKey(addDays(today, 120)) };
  const s2 = { ...settings, plan: { ...plan, targets: buildTargets(90, 80, plan.start, plan.goalDate) } };
  const series = (n: number) => Array.from({ length: n }, (_, i) => ({ d: addDays(today, i - n + 1), k: dateKey(addDays(today, i - n + 1)), kg: 90, trend: 90 }));
  test('“trend weight” explains itself in a sentence when tapped', () => {
    render(<Hero settings={s2} weights={{}} unit="kg" trend={series(5)} />);
    expect(screen.queryByText(/smoothed average/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'What is trend weight?' }));
    expect(screen.getByText(/smoothed average of your weigh-ins/)).toBeTruthy();
  });
  test('day one: says what comes next, not a verdict', () => {
    render(<Hero settings={s2} weights={{ [dateKey(today)]: 90 }} unit="kg" trend={series(1)} />);
    expect(screen.getByText(/First weigh-in logged/)).toBeTruthy();
    expect(screen.queryByText('Plan')).toBeNull();
    expect(screen.queryByText('On track')).toBeNull();
  });
  test('with a few weigh-ins it uses the shared words, and kg users get no pounds line', () => {
    render(<Hero settings={s2} weights={{}} unit="kg" trend={series(5)} />);
    expect(screen.getByText('Plan')).toBeTruthy();
    expect(screen.getByLabelText(/^Plan: (On track|Ahead|Behind)/)).toBeTruthy();
    expect(screen.getByText(/^(On track|Ahead|Behind)$/)).toBeTruthy();
    expect(screen.queryByText(/ lb$/)).toBeNull();
    expect(screen.getByText(/goal by/)).toBeTruthy();
  });
  // A trend 1 kg above today's target but losing 1 kg a week reaches the goal well before its date
  const losing = (n: number, from: number) => Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - n + 1); return { d, k: dateKey(d), kg: from - i / 7, trend: from - i / 7 };
  });
  test('behind the line but on pace to finish early says “Catching up”, never “Behind” beside an early date', () => {
    const tr = losing(28, 92.9);                                  // about 89 kg today against a target near 88
    render(<Hero settings={s2} weights={{}} unit="kg" trend={tr} />);
    expect(screen.getByText('Catching up')).toBeTruthy();
    expect(screen.queryByText('Behind')).toBeNull();
    expect(screen.getByText(/kg behind$/)).toBeTruthy();
  });
  test('with “hide my weight” on, progress is a share of the way: no kilos lost or left', () => {
    setWeightsHidden(true);
    try {
      render(<Hero settings={s2} weights={{}} unit="kg" trend={losing(28, 89)} />);
      expect(screen.getByText('Progress')).toBeTruthy();
      expect(screen.getByText(/^\d+%$/)).toBeTruthy();
      expect(screen.queryByText('To goal')).toBeNull();
      expect(screen.queryByText('Lost')).toBeNull();
      expect(screen.queryByText(/behind$/)).toBeNull();
    } finally { setWeightsHidden(false); }
  });
});

describe('free waist', () => {
  test('logging the waist keeps hips and chest measured with Plus', async () => {
    const day = dateKey(today);
    const onMeasurements = jest.fn();
    render(<BodyCard free settings={settings} weights={{}} unit="kg" lengthUnit="cm" onLengthUnit={jest.fn()} photos={{}} onPhotos={jest.fn()}
      measurements={{ [day]: { hips: 100, chest: 98 } }} onMeasurements={onMeasurements} />);
    expect(screen.queryByText('Photos')).toBeNull();                              // photos stay Plus
    fireEvent.press(screen.getByText('Measure'));
    expect(screen.queryByLabelText('Hips')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Waist'), '88');
    fireEvent.press(screen.getByText('Save'));
    await waitFor(() => expect(onMeasurements).toHaveBeenCalled());
    expect(onMeasurements.mock.calls[0][0][day]).toEqual({ waist: 88, hips: 100, chest: 98 });
  });
  test('without Plus, everything measured or photographed with Plus stays on show; only adding more is Plus', () => {
    const onPlus = jest.fn();
    render(<BodyCard free onPlus={onPlus} settings={settings} weights={{}} unit="kg" lengthUnit="cm" onLengthUnit={jest.fn()}
      photos={{ [dateKey(today)]: { front: 'a.jpg' } }} onPhotos={jest.fn()} measurements={{ [dateKey(today)]: { hips: 100, chest: 98 } }} onMeasurements={jest.fn()} />);
    expect(screen.getByLabelText('Hips 100.0 cm')).toBeTruthy();              // measured with Plus, still shown
    expect(screen.getByLabelText(/^First photo, /)).toBeTruthy();               // the photo too
    fireEvent.press(screen.getByText('Photos · Plus'));                         // adding another is Plus
    expect(onPlus).toHaveBeenCalled();
  });
});

describe('free Settings', () => {
  test('the calorie estimate is a plain Plus row, not a switch that sells', () => {
    render(<PlusProvider status={NO_PLUS} onStatus={jest.fn()}><SettingsScreen {...props()} /></PlusProvider>);
    expect(screen.getByRole('button', { name: 'Calorie estimate, Plus' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Calorie estimate' })).toBeNull();
  });
});

describe('habit amounts', () => {
  test('steps, water, sleep and veg take your own amount; a hand-typed name is left alone', () => {
    const p = props({ settings: { ...settings, habits: [
      { id: 'steps', icon: 'steps', short: 'STEPS', name: 'Steps 8k' },
      { id: 'water', icon: 'water', short: 'WATER', name: 'Two big bottles' },
    ] } });
    const view = render(<SettingsScreen {...p} initialPage="habits" />);
    expect(screen.queryByText('Water a day')).toBeNull();          // custom name: no chooser to overwrite it
    fireEvent.press(screen.getByLabelText('Steps a day: 10k'));
    view.unmount();                                                 // saved however you leave the page
    expect((p.onSave as jest.Mock).mock.calls.at(-1)[0].habits.map((h: { name: string }) => h.name)).toEqual(['Steps 10k', 'Two big bottles']);
  });
});
