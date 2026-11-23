import { fireEvent, render, screen } from '@testing-library/react-native';
import { ProteinCard } from '../components/Protein';
import { buildTargets, defaultSettings } from '../core/plan';
import { dateKey } from '../core/dates';

const plan = { start: '2026-09-07', startKg: 104, goalKg: 84, goalDate: '2027-03-01', targets: buildTargets(104, 84, '2026-09-07', '2027-03-01') };
const settings = defaultSettings(plan, []);

describe('protein card', () => {
  test('with no minimum set, it asks for the person’s own number and suggests none', () => {
    const onSetTarget = jest.fn();
    render(<ProteinCard settings={{ ...settings, protein: { on: true, grams: null } }} log={{}} onChange={jest.fn()} onSetTarget={onSetTarget} />);
    expect(screen.queryByText(/ g$/)).toBeNull();                 // no number of grams anywhere
    expect(screen.queryByText(/per kg/)).toBeNull();
    fireEvent.press(screen.getByText('Set my daily minimum'));
    expect(onSetTarget).toHaveBeenCalled();
  });
  test('with a minimum set, today counts against exactly that number', () => {
    const onChange = jest.fn();
    render(<ProteinCard settings={{ ...settings, protein: { on: true, grams: 110 } }} log={{ [dateKey(new Date())]: 40 }} onChange={onChange} onSetTarget={jest.fn()} />);
    expect(screen.getByText('40 / 110 g')).toBeTruthy();
    fireEvent.press(screen.getByText('+30 g'));
    expect(onChange.mock.calls[0][0][dateKey(new Date())]).toBe(70);
  });
});
