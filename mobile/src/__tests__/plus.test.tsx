import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Iap from 'expo-iap';
import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { NO_PLUS, PLUS_PRODUCTS, PlusStatus } from '../core/plus';
import { buildTargets, defaultSettings, DEFAULT_HABITS } from '../core/plan';
import { DEFAULT_PREFS } from '../core/storage';
import { PlusProvider, usePlus } from '../plus';
import { SettingsScreen, SettingsProps } from '../screens/SettingsScreen';

const N = Iap as unknown as Record<string, jest.Mock>;
const product = (id: string, price: string, trial = false) => ({ id, displayPrice: price, price: Number(price.slice(1)), currency: 'GBP', subscriptionGroupIdIOS: 'plus', ...(trial ? {
  introductoryPricePaymentModeIOS: 'free-trial', introductoryPriceNumberOfPeriodsIOS: '1', introductoryPriceSubscriptionPeriodIOS: 'week' } : {}) });
beforeEach(() => {
  jest.clearAllMocks();
  N.fetchProducts.mockImplementation(async ({ type }: { type: string }) => type === 'subs'
    ? [product(PLUS_PRODUCTS.monthly, '£3.99', true), product(PLUS_PRODUCTS.yearly, '£19.99', true)]
    : [product(PLUS_PRODUCTS.lifetime, '£49.99')]);
  N.getAvailablePurchases.mockResolvedValue([]);
  N.isEligibleForIntroOfferIOS.mockResolvedValue(true);
});

/** Holds the status the way the app's preferences do. */
function Harness({ initial = NO_PLUS, children }: { initial?: PlusStatus; children: React.ReactNode }) {
  const [status, setStatus] = useState(initial);
  return <PlusProvider status={status} onStatus={setStatus}>{children}</PlusProvider>;
}
function Probe() {
  const { plus, openPaywall } = usePlus();
  return <><Text>{plus ? 'PLUS ON' : 'PLUS OFF'}</Text><Text onPress={() => openPaywall()}>open</Text></>;
}

describe('buying Plus', () => {
  test('Plus found with Apple on launch (e.g. a reinstall) is unlocked without asking', async () => {
    N.getAvailablePurchases.mockResolvedValue([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'purchased' }]);
    render(<Harness><Probe /></Harness>);
    expect(await screen.findByText('PLUS ON')).toBeTruthy();
  });
  test('the paywall shows Apple’s prices and the trial, and buys the chosen plan', async () => {
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Try free for 7 days')).toBeTruthy();       // yearly is preselected
    expect(screen.getByText(/renews automatically unless you cancel at least 24 hours/)).toBeTruthy();
    expect(screen.getByText('Free for 7 days, then £19.99 a year. Cancel any time.')).toBeTruthy();   // the trial, right by the button
    expect(screen.getByText('Save 58%')).toBeTruthy();                       // £19.99 vs 12 × £3.99 is 58.2%: rounded down
    expect(screen.getByText('£1.67 a month')).toBeTruthy();
    expect(screen.getByLabelText('Terms of use')).toBeTruthy();
    expect(screen.getByLabelText('Privacy policy')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Try free for 7 days')); });
    expect(N.requestPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'subs', request: expect.objectContaining({ apple: { sku: PLUS_PRODUCTS.yearly } }) }));
    fireEvent.press(screen.getByRole('radio', { name: /^Lifetime/ }));
    expect(screen.getByText('£49.99 once. No subscription.')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Buy for £49.99')); });
    expect(N.requestPurchase).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'in-app', request: expect.objectContaining({ apple: { sku: PLUS_PRODUCTS.lifetime } }) }));
  });
  test('no saving badge when the store gives no numeric prices', async () => {
    N.fetchProducts.mockImplementation(async ({ type }: { type: string }) => type === 'subs'
      ? [{ ...product(PLUS_PRODUCTS.monthly, '£3.99', true), price: undefined }, { ...product(PLUS_PRODUCTS.yearly, '£19.99', true), price: undefined }]
      : [product(PLUS_PRODUCTS.lifetime, '£49.99')]);
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Try free for 7 days')).toBeTruthy();
    expect(screen.queryByText(/^Save /)).toBeNull();
    expect(screen.getByText('a year')).toBeTruthy();                         // no monthly figure either, just the period
  });
  test('a completed purchase is finished with Apple and unlocks Plus', async () => {
    render(<Harness><Probe /></Harness>);
    await waitFor(() => expect(N.purchaseUpdatedListener).toHaveBeenCalled());
    const onPurchase = N.purchaseUpdatedListener.mock.calls.at(-1)[0];
    const purchase = { productId: PLUS_PRODUCTS.yearly, purchaseState: 'purchased', expirationDateIOS: Date.now() + 365 * 86400000 };
    N.getAvailablePurchases.mockResolvedValue([purchase]);
    await act(async () => { await onPurchase(purchase); });
    expect(N.finishTransaction).toHaveBeenCalledWith({ purchase, isConsumable: false });
    expect(screen.getByText('PLUS ON')).toBeTruthy();
  });
  test('someone who’s had the free trial is offered the plain price', async () => {
    N.isEligibleForIntroOfferIOS.mockResolvedValue(false);
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Subscribe for £19.99 a year')).toBeTruthy();
    expect(screen.queryByText(/Try free/)).toBeNull();
    expect(N.isEligibleForIntroOfferIOS).toHaveBeenCalledWith('plus');
    expect(N.isEligibleForIntroOfferIOS).toHaveBeenCalledTimes(1);           // asked once for the group, not per plan
  });
  test('no trial is promised when Apple can’t say whether it’s allowed', async () => {
    N.isEligibleForIntroOfferIOS.mockRejectedValue(new Error('offline'));
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Subscribe for £19.99 a year')).toBeTruthy();
  });
  test('the trial length comes from the offer’s own period', async () => {
    const offer = { type: 'introductory', paymentMode: 'free-trial', period: { unit: 'day', value: 3 }, periodCount: 1 };
    N.fetchProducts.mockImplementation(async ({ type }: { type: string }) => type === 'subs'
      ? [{ ...product(PLUS_PRODUCTS.monthly, '£3.99'), subscriptionOffers: [offer] }, { ...product(PLUS_PRODUCTS.yearly, '£19.99'), subscriptionOffers: [offer] }]
      : [product(PLUS_PRODUCTS.lifetime, '£49.99')]);
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Try free for 3 days')).toBeTruthy();
  });
  test('a launch price on yearly says what is paid now and what it renews at', async () => {
    const launch = { type: 'introductory', paymentMode: 'pay-up-front', displayPrice: '£11.99', price: 11.99, period: { unit: 'year', value: 1 }, periodCount: 1 };
    N.fetchProducts.mockImplementation(async ({ type }: { type: string }) => type === 'subs'
      ? [product(PLUS_PRODUCTS.monthly, '£3.99'), { ...product(PLUS_PRODUCTS.yearly, '£19.99'), subscriptionOffers: [launch] }]
      : [product(PLUS_PRODUCTS.lifetime, '£49.99')]);
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('£11.99 for the first year, then £19.99 a year. Cancel any time.')).toBeTruthy();
    expect(screen.getByText('Subscribe for £11.99')).toBeTruthy();
    expect(screen.getByText(/^After the introductory price, £19\.99 a year is charged/)).toBeTruthy();
    expect(screen.getByText('Save 58%')).toBeTruthy();                       // the saving is on the regular prices
  });
  test('someone who has had an introductory offer is shown the plain price, not the launch price', async () => {
    N.isEligibleForIntroOfferIOS.mockResolvedValue(false);
    const launch = { type: 'introductory', paymentMode: 'pay-up-front', displayPrice: '£11.99', price: 11.99, period: { unit: 'year', value: 1 }, periodCount: 1 };
    N.fetchProducts.mockImplementation(async ({ type }: { type: string }) => type === 'subs'
      ? [product(PLUS_PRODUCTS.monthly, '£3.99'), { ...product(PLUS_PRODUCTS.yearly, '£19.99'), subscriptionOffers: [launch] }]
      : [product(PLUS_PRODUCTS.lifetime, '£49.99')]);
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    expect(await screen.findByText('Subscribe for £19.99 a year')).toBeTruthy();
    expect(screen.queryByText(/£11\.99/)).toBeNull();
  });
  test('Ask to Buy says the purchase is waiting for approval, not that it failed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness><Probe /></Harness>);
    await waitFor(() => expect(N.purchaseErrorListener).toHaveBeenCalled());
    const onError = N.purchaseErrorListener.mock.calls.at(-1)[0];
    act(() => { onError({ code: 'deferred-payment', message: 'Deferred' }); });
    expect(alert).toHaveBeenLastCalledWith('Waiting for approval', 'Plus will unlock once the purchase is approved.');
    N.getUserFriendlyErrorMessage.mockReturnValueOnce('Payment declined');
    act(() => { onError({ code: 'purchase-error', message: 'Declined' }); });
    expect(alert).toHaveBeenLastCalledWith('Purchase didn’t complete', 'Payment declined');
    alert.mockClear();
    N.isUserCancelledError.mockReturnValueOnce(true);
    act(() => { onError({ code: 'user-cancelled', message: 'Cancelled' }); });
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
  test('restore says plainly when there’s nothing to restore', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness><Probe /></Harness>);
    fireEvent.press(screen.getByText('open'));
    await act(async () => { fireEvent.press(await screen.findByLabelText('Restore purchases')); });
    expect(N.restorePurchases).toHaveBeenCalled();
    expect(alert.mock.calls.at(-1)?.[0]).toBe('No Plus purchase found');
  });
});

describe('the free version', () => {
  const settings = { ...defaultSettings({ start: '2026-01-05', startKg: 90, goalKg: 80, goalDate: '2026-06-01', targets: buildTargets(90, 80, '2026-01-05', '2026-06-01') }, DEFAULT_HABITS) };
  const props = (over: Partial<SettingsProps> = {}): SettingsProps => ({
    settings, unit: 'kg', setUnit: jest.fn(), lock: false, lockAvailable: true, lockName: 'Face ID', onLockChange: jest.fn(),
    reminder: DEFAULT_PREFS.reminder, onReminderChange: jest.fn(), appearance: 'system', onAppearanceChange: jest.fn(), lastBackup: null, weighIns: 3,
    weights: {}, onPlanLeftUnsaved: jest.fn(), doses: {}, onDoses: jest.fn(), lengthUnit: 'cm', onLengthUnit: jest.fn(), onSave: jest.fn(), onClose: jest.fn(),
    onExport: jest.fn(), onExportCsv: jest.fn(), onRestore: jest.fn(), onReset: jest.fn(), onEraseAll: jest.fn(), ...over,
  });
  test('Plus features in Settings open the paywall instead', async () => {
    const onReport = jest.fn();
    render(<Harness><SettingsScreen {...props()} onReport={onReport} /></Harness>);
    fireEvent.press(screen.getByLabelText(/^Report for your doctor/));
    expect(await screen.findAllByText(/The report for your doctor is part of Plus/)).toHaveLength(1);   // one paywall, shown in the Settings window
    expect(onReport).not.toHaveBeenCalled();
  });
  test('logging a medication is free: its page opens without the paywall', async () => {
    render(<Harness><SettingsScreen {...props()} /></Harness>);
    fireEvent.press(screen.getByLabelText(/^Medication/));
    expect(await screen.findByLabelText('Medication name')).toBeTruthy();
    expect(screen.queryByText(/is part of Plus/)).toBeNull();
  });
  test('a 4th habit needs Plus; with Plus all 6 are available', () => {
    const { unmount } = render(<Harness><SettingsScreen {...props()} initialPage="habits" /></Harness>);
    expect(screen.getByText('More than 3 habits: Plus')).toBeTruthy();
    unmount();
    render(<Harness initial={{ active: true, productId: PLUS_PRODUCTS.lifetime, expires: null, checkedAt: 1 }}><SettingsScreen {...props()} initialPage="habits" /></Harness>);
    expect(screen.getByText('Add habit')).toBeTruthy();
  });
});

describe('without the store module (Expo Go)', () => {
  test('loading it fails quietly and every store call does nothing', async () => {
    jest.resetModules();                                                     // drop the cached store mock
    jest.doMock('expo-iap', () => { throw new Error('Cannot find native module \'ExpoIap\''); });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const P: typeof import('../purchases') = require('../purchases');
    expect(P.storeAvailable).toBe(false);
    expect(await P.connect()).toBe(false);
    expect(await P.loadOffers()).toEqual([]);
    expect(await P.checkPlus()).toBeNull();
    expect(await P.restore()).toBeNull();
    await expect(P.manageSubscription()).resolves.toBeUndefined();
    await expect(P.buy('yearly')).rejects.toThrow(/isn’t available/);
    const off = P.onStoreUpdates(jest.fn(), jest.fn());
    expect(() => off()).not.toThrow();
    jest.dontMock('expo-iap');
  });
});
