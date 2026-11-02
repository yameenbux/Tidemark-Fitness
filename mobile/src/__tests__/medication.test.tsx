import { fireEvent, render, screen } from '@testing-library/react-native';
import { MedicationToday, MedicationTrend } from '../components/Medication';
import { dateKey, parseKey } from '../core/dates';
import type { Medication } from '../core/types';

const today = new Date();
const med: Medication = { name: 'Wegovy', doseMg: 2.4, every: 'day', weekday: 1 };

describe('medication cards', () => {
  test('a due dose can be marked as taken, then undone', () => {
    const onChange = jest.fn();
    const { rerender } = render(<MedicationToday med={med} doses={{}} onChange={onChange} />);
    expect(screen.getByText('Wegovy due today')).toBeTruthy();
    fireEvent.press(screen.getByText('Mark taken'));
    const taken = onChange.mock.calls[0][0];
    expect(taken).toEqual({ [dateKey(today)]: { mg: 2.4 } });
    rerender(<MedicationToday med={med} doses={taken} onChange={onChange} />);
    expect(screen.getByText('Wegovy taken today')).toBeTruthy();
    fireEvent.press(screen.getByText('Undo'));
    expect(onChange.mock.calls[1][0]).toEqual({});
  });
  test('not a dose day: shows when the next one is, and a late dose can still be logged today', () => {
    const other = (today.getDay() + 3) % 7, onChange = jest.fn();
    const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 4);   // last scheduled day, taken
    render(<MedicationToday med={{ ...med, every: 'week', weekday: other }} doses={{ [dateKey(lastWeek)]: { mg: 2.4 } }} onChange={onChange} />);
    expect(screen.getByText(/Wegovy · next /)).toBeTruthy();
    expect(screen.queryByText('Mark taken')).toBeNull();
    fireEvent.press(screen.getByText('Took it today'));
    expect(onChange.mock.calls[0][0]).toEqual({ [dateKey(lastWeek)]: { mg: 2.4 }, [dateKey(today)]: { mg: 2.4 } });
  });
  test('a weekly dose day with nothing logged is called out, and can be marked on the day it was taken', () => {
    const missed = new Date(today); missed.setDate(missed.getDate() - 2);
    const onChange = jest.fn(), onHistory = jest.fn();
    render(<MedicationToday med={{ ...med, every: 'week', weekday: missed.getDay() }} doses={{}} onChange={onChange} onHistory={onHistory} />);
    expect(screen.getByText(/isn’t marked/)).toBeTruthy();
    fireEvent.press(screen.getByText(/^Took it [A-Z][a-z]{2}$/));
    expect(onChange.mock.calls[0][0]).toEqual({ [dateKey(missed)]: { mg: 2.4 } });
    fireEvent.press(screen.getByText('Another day'));
    expect(onHistory).toHaveBeenCalled();
  });
  test('says when the last dose was', () => {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    render(<MedicationToday med={med} doses={{ [dateKey(y)]: { mg: 2.4 } }} onChange={jest.fn()} />);
    expect(screen.getByText(/last dose yesterday/)).toBeTruthy();
  });
  test('trend card: an explanation before any doses, then one row per strength, and never advice', () => {
    const { rerender } = render(<MedicationTrend med={med} doses={{}} series={[]} unit="kg" />);
    expect(screen.getByText(/Mark doses as taken on Today/)).toBeTruthy();
    const pt = (k: string, kg: number) => ({ k, d: parseKey(k), kg, trend: kg });
    rerender(<MedicationTrend med={med} doses={{ '2026-09-01': { mg: 1 }, '2026-09-15': { mg: 1.7 } }}
      series={[pt('2026-09-01', 100), pt('2026-09-15', 99)]} unit="kg" />);
    expect(screen.getByText(/1 mg · from 1 Sep/)).toBeTruthy();
    expect(screen.getByText(/1.7 mg · from 15 Sep/)).toBeTruthy();
    expect(screen.getByText(/A record, not advice/)).toBeTruthy();
  });
  test('free preview: the person’s own doses are listed, every result is hidden, and one button opens Plus', () => {
    const pt = (k: string, kg: number) => ({ k, d: parseKey(k), kg, trend: kg });
    const onUnlock = jest.fn();
    render(<MedicationTrend med={med} doses={{ '2026-09-01': { mg: 1 }, '2026-09-15': { mg: 1.7 } }}
      series={[pt('2026-09-01', 100), pt('2026-09-15', 99)]} unit="kg" onUnlock={onUnlock} effects={{ '2026-09-02': { effects: ['nausea'], severity: 1 } }} />);
    expect(screen.getByText(/1 mg · from 1 Sep/)).toBeTruthy();                 // their real doses
    expect(screen.queryByText(/kg/)).toBeNull();                                // but no result, anywhere
    expect(screen.getAllByText('•••')).toHaveLength(2);
    expect(screen.getByLabelText(/1 mg from .*trend change shown with Plus/)).toBeTruthy();
    expect(screen.queryByText('Nausea')).toBeNull();                            // side-effect patterns are Plus too
    expect(screen.getByText(/^1 side effect noted\./)).toBeTruthy();
    expect(screen.queryByText('Report for your doctor')).toBeNull();
    fireEvent.press(screen.getByText('See your trend at each dose'));
    expect(onUnlock).toHaveBeenCalled();
  });
});
