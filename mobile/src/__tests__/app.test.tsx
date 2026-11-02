import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';
import { dateKey } from '../core/dates';
import { buildTargets, defaultSettings, SUGGESTED_HABITS } from '../core/plan';
import { PLUS_PRODUCTS } from '../core/plus';

// Whole-app flows: real screens, real store, mocked native modules only.
jest.mock('../lock', () => ({
  canLock: jest.fn(async () => false), lockAvailability: jest.fn(async () => 'none'),
  biometricName: jest.fn(async () => 'Face ID'), unlock: jest.fn(async () => true),
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: jest.fn() }));

const day = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return dateKey(d); };

beforeEach(async () => { await AsyncStorage.clear(); });
// Let the short fade/press animations finish after unmounting, so none run on after the test environment closes
afterEach(async () => { cleanup(); await act(async () => { await new Promise(r => setTimeout(r, 700)); }); });

test('first run: set up a plan, choose habits, and land on Today with the trend first', async () => {
  render(<App />);
  fireEvent.press(await screen.findByText('Set up my plan'));
  fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '92');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '84');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.press(await screen.findByText('See my plan'));
  expect(await screen.findByText('Anything to tick off each day?')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Water 2–3 L'));
  fireEvent.press(screen.getByLabelText('Steps 8k'));
  fireEvent.press(screen.getByLabelText('Steps a day: 12k'));        // pick your own amount
  fireEvent.press(screen.getByText('Next · 2 chosen'));
  expect(await screen.findByText('Are you taking a weight-loss medication?')).toBeTruthy();
  fireEvent.press(screen.getByText('Skip'));
  fireEvent.press(await screen.findByText('Start tracking'));
  expect(await screen.findByText(/^Your plan is ready/)).toBeTruthy();        // Plus, offered once, right after setup
  expect(screen.getByText('Progress photos, and hips, chest and arms as well as waist')).toBeTruthy();
  expect(screen.queryByText(/^If you take a weight-loss medication/)).toBeNull();   // named in "Also in Plus", not led with
  expect(await screen.findByText('Trend weight')).toBeTruthy();
  expect(screen.getByText(/Weighed in today/)).toBeTruthy();
  await waitFor(async () => {
    const s = JSON.parse((await AsyncStorage.getItem('tracker_state_v1'))!);
    expect(s.settings.plan.start).toBe(day(0));                       // starts today, not last Monday
    expect(s.settings.habits.map((h: { name: string }) => h.name)).toEqual(['Water 2–3 L', 'Steps 12k']);
    expect(s.entries).toHaveLength(1);
  });
});

test('first run on a weekly injection: the dose log is set up, and Plus is offered once, leading with the dose insights', async () => {
  render(<App />);
  fireEvent.press(await screen.findByText('Set up my plan'));
  fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '104');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.changeText(screen.getByLabelText('Weight in kilograms'), '90');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.press(await screen.findByText('See my plan'));
  fireEvent.press(await screen.findByText('Skip for now'));
  fireEvent.press(await screen.findByText('Yes, a weekly injection'));
  fireEvent.changeText(screen.getByLabelText('Medication name'), 'semaglutide');
  fireEvent.changeText(screen.getByLabelText('Current dose in milligrams'), '2.5');
  fireEvent.press(screen.getByText('Next'));
  fireEvent.press(await screen.findByText('Start tracking'));
  expect(await screen.findByText(/^Your plan is ready, and everything in it stays free\./)).toBeTruthy();
  const lines = screen.getAllByText(/^(If you take|A PDF report|Progress photos|Up to 6|Log what you eat|A daily protein|Password-protected)/).map(n => n.props.children);
  expect(lines[0]).toMatch(/^If you take a weight-loss medication/);           // what they came for, first
  expect(lines[1]).toBe('A PDF report for your doctor or nurse');
  expect(lines).toHaveLength(3);                                               // three, not seven
  expect(screen.getByText(/^Also in Plus: /)).toBeTruthy();                    // the rest are still named
  await waitFor(async () => {
    const s = JSON.parse((await AsyncStorage.getItem('tracker_state_v1'))!);
    expect(s.settings.medication).toMatchObject({ name: 'semaglutide', doseMg: 2.5, every: 'week', injected: true });
  });
});

test('daily use: log a weigh-in from Today, see the trend change, and move between tabs', async () => {
  const start = day(-21);
  const settings = defaultSettings({ start, startKg: 92, goalKg: 84, goalDate: day(91), targets: buildTargets(92, 84, start, day(91)) }, SUGGESTED_HABITS.slice(0, 2));
  const weights: Record<string, number> = {};
  for (let i = -21; i <= -1; i++) weights[day(i)] = Math.round((92 + i * 0.07 + (i % 2 ? 0.2 : -0.2)) * 10) / 10 + 1.47;
  await AsyncStorage.setItem('tracker_state_v1', JSON.stringify({ v: 2, settings, weights, habits: {}, unit: 'kg' }));
  render(<App />);
  expect(await screen.findByText('Trend weight')).toBeTruthy();
  expect(screen.queryByText(/^Your plan is ready/)).toBeNull();               // only straight after setup, never on an ordinary open
  expect(screen.getByText('This week')).toBeTruthy();
  expect(screen.queryByText('Pace')).toBeNull();                       // folded into This week, not a second copy
  expect(screen.getByRole('button', { name: 'Weigh in' })).toBeTruthy();   // not weighed yet today
  fireEvent.press(screen.getByLabelText('Log weight'));
  fireEvent.press(await screen.findByLabelText('Increase by 0.1 kilograms'));
  fireEvent.press(screen.getByText(/^Save/));
  expect(await screen.findByText(/^Saved\. Your trend: [0-9.]+ kg, (down|up) [0-9.]+ kg this week\.$/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Weighed in today' })).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Trend' }));
  expect(await screen.findByText('Your trend')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Habits' }));
  expect(await screen.findAllByText('This week')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Body' }));
  expect(await screen.findByText('Hips, chest, arms, photos and calories')).toBeTruthy();   // free version: the waist is free, the rest is Plus
  expect(screen.getByText('Waist')).toBeTruthy();
});

const seeded = async (prefs: object = {}) => {
  const start = day(-14);
  const settings = defaultSettings({ start, startKg: 92, goalKg: 84, goalDate: day(91), targets: buildTargets(92, 84, start, day(91)) });
  await AsyncStorage.setItem('tracker_state_v1', JSON.stringify({ v: 3, settings, weights: { [day(-14)]: 92, [day(-7)]: 91.4, [day(-1)]: 91 }, habits: {}, unit: 'kg' }));
  await AsyncStorage.setItem('tracker_prefs_v1', JSON.stringify({ lock: false, ...prefs }));
};

test('with the lock on, nothing shows until Face ID passes', async () => {
  const L = jest.requireMock('../lock');
  L.lockAvailability.mockResolvedValue('available'); L.canLock.mockResolvedValue(true);
  L.unlock.mockResolvedValueOnce(false);                                   // first attempt (on launch) fails
  await seeded({ lock: true });
  render(<App />);
  fireEvent.press(await screen.findByText('Unlock with Face ID'));       // second attempt passes
  expect(await screen.findByText('Trend weight')).toBeTruthy();
  L.lockAvailability.mockResolvedValue('none'); L.canLock.mockResolvedValue(false);
});

test('a tapped weigh-in reminder waits for Face ID, then opens the log sheet', async () => {
  const L = jest.requireMock('../lock');
  const N = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
  L.lockAvailability.mockResolvedValue('available'); L.canLock.mockResolvedValue(true);
  L.unlock.mockResolvedValueOnce(false);
  N.getLastNotificationResponseAsync.mockResolvedValueOnce({ notification: { request: { identifier: 'weigh-in-' + day(0) } } });
  await seeded({ lock: true });
  render(<App />);
  fireEvent.press(await screen.findByText('Unlock with Face ID'));
  expect(await screen.findByLabelText('Increase by 0.1 kilograms')).toBeTruthy();
  L.lockAvailability.mockResolvedValue('none'); L.canLock.mockResolvedValue(false);
});

test('a purchase that completes while locked is still finished with Apple and unlocks Plus', async () => {
  const L = jest.requireMock('../lock');
  const N = jest.requireMock('expo-iap') as Record<string, jest.Mock>;
  L.lockAvailability.mockResolvedValue('available'); L.canLock.mockResolvedValue(true);
  L.unlock.mockResolvedValueOnce(false);                                   // stays locked
  N.purchaseUpdatedListener.mockClear();
  await seeded({ lock: true });
  render(<App />);
  expect(await screen.findByText('Unlock with Face ID')).toBeTruthy();
  await waitFor(() => expect(N.purchaseUpdatedListener).toHaveBeenCalled());
  const purchase = { productId: PLUS_PRODUCTS.lifetime, purchaseState: 'purchased' };
  N.getAvailablePurchases.mockResolvedValueOnce([purchase]);
  await act(async () => { await N.purchaseUpdatedListener.mock.calls.at(-1)[0](purchase); });
  expect(N.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: false });
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('tracker_prefs_v1'))!).plus.active).toBe(true));
  expect(screen.getByText('Unlock with Face ID')).toBeTruthy();           // still locked
  L.lockAvailability.mockResolvedValue('none'); L.canLock.mockResolvedValue(false);
});

test('Delete all my data asks twice, then wipes everything and returns to setup', async () => {
  const { Alert } = jest.requireActual('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => {
    const buttons = args[2] as { text: string; onPress?: () => void }[] | undefined;
    buttons?.find(b => b.text !== 'Cancel')?.onPress?.();                 // tap the destructive choice
  });
  await seeded();
  render(<App />);
  fireEvent.press(await screen.findByLabelText('Settings'));
  fireEvent.press(await screen.findByLabelText(/^Delete all my data/));
  expect(await screen.findByText('Set up my plan')).toBeTruthy();
  expect(alert).toHaveBeenCalledTimes(2);
  await waitFor(async () => expect(await AsyncStorage.getItem('tracker_state_v1')).toBeNull());
  alert.mockRestore();
});

test('erasing everything keeps Plus: it belongs to the Apple ID, not the data', async () => {
  const { Alert } = jest.requireActual('react-native');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => {
    (args[2] as { text: string; onPress?: () => void }[] | undefined)?.find(b => b.text !== 'Cancel')?.onPress?.();
  });
  const N = jest.requireMock('expo-iap') as Record<string, jest.Mock>;
  // Apple keeps answering with the purchase: setup re-checks it after the erase
  N.getAvailablePurchases.mockResolvedValue([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'purchased' }]);
  await seeded();
  render(<App />);
  await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('tracker_prefs_v1'))!).plus.active).toBe(true));
  fireEvent.press(await screen.findByLabelText('Settings'));
  fireEvent.press(await screen.findByLabelText(/^Delete all my data/));
  expect(await screen.findByText('Set up my plan')).toBeTruthy();
  await waitFor(async () => expect(await AsyncStorage.getItem('tracker_state_v1')).toBeNull());
  const prefs = JSON.parse((await AsyncStorage.getItem('tracker_prefs_v1'))!);
  expect(prefs.plus).toMatchObject({ active: true, productId: PLUS_PRODUCTS.lifetime });
  N.getAvailablePurchases.mockResolvedValue([]);
  alert.mockRestore();
});
