import { perksFor, restText, PAYWALL_LEAD, cleanPlus, introText, NO_PLUS, OFFLINE_GRACE_MS, PLUS_PRODUCTS, perMonth, plusActive, plusFrom, usableHabits, yearlySaving } from '../plus';

const now = Date.UTC(2026, 9, 8);
const day = 86400000;

describe('Tidemark Plus', () => {
  test('a lifetime purchase unlocks Plus for good', () => {
    const s = plusFrom([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'purchased' }], now);
    expect(s).toEqual({ active: true, productId: PLUS_PRODUCTS.lifetime, expires: null, checkedAt: now });
    expect(plusActive(s, now + 3650 * day)).toBe(true);
  });
  test('a subscription unlocks Plus until it ends; the latest-ending one wins', () => {
    const s = plusFrom([
      { productId: PLUS_PRODUCTS.monthly, expirationDateIOS: now + 5 * day },
      { productId: PLUS_PRODUCTS.yearly, expirationDateIOS: now + 300 * day },
    ], now);
    expect(s.active).toBe(true);
    expect(s.productId).toBe(PLUS_PRODUCTS.yearly);
    expect(s.expires).toBe(now + 300 * day);
  });
  test('expired, refunded, pending or unrelated purchases don’t count', () => {
    expect(plusFrom([{ productId: PLUS_PRODUCTS.monthly, expirationDateIOS: now - day }], now).active).toBe(false);
    expect(plusFrom([{ productId: PLUS_PRODUCTS.lifetime, revocationDateIOS: now - day }], now).active).toBe(false);
    expect(plusFrom([{ productId: PLUS_PRODUCTS.lifetime, purchaseState: 'pending' }], now).active).toBe(false);
    expect(plusFrom([{ productId: 'com.someone.else.pro' }], now).active).toBe(false);
    expect(plusFrom([], now)).toEqual({ ...NO_PLUS, checkedAt: now });
  });
  test('offline, a lapsed subscription keeps working for a few days, then stops', () => {
    const s = { active: true, productId: PLUS_PRODUCTS.monthly, expires: now, checkedAt: now - 30 * day };
    expect(plusActive(s, now + OFFLINE_GRACE_MS - 1)).toBe(true);
    expect(plusActive(s, now + OFFLINE_GRACE_MS + 1)).toBe(false);
    expect(plusActive(null, now)).toBe(false);
  });
  test('a renewal Apple couldn’t charge keeps Plus through the billing grace period', () => {
    const grace = (g: number, more = {}) => plusFrom([{ productId: PLUS_PRODUCTS.monthly, expirationDateIOS: now - day, renewalInfoIOS: { gracePeriodExpirationDate: g }, ...more }], now);
    expect(grace(now + 5 * day)).toEqual({ active: true, productId: PLUS_PRODUCTS.monthly, expires: now + 5 * day, checkedAt: now });
    expect(grace(now - 1).active).toBe(false);                                   // grace period over
    expect(grace(now + 5 * day, { revocationDateIOS: now - day }).active).toBe(false);   // refunded
  });
  test('setting the clock back can’t keep a subscription going; lifetime is unaffected', () => {
    const s = { active: true, productId: PLUS_PRODUCTS.monthly, expires: now + 20 * day, checkedAt: now };
    expect(plusActive(s, now - day / 2)).toBe(true);                            // a little clock drift is fine
    expect(plusActive(s, now - 2 * day)).toBe(false);
    expect(plusActive({ ...s, checkedAt: null }, now - 2 * day)).toBe(true);
    expect(plusActive({ ...s, productId: PLUS_PRODUCTS.lifetime, expires: null }, now - 400 * day)).toBe(true);
  });
  test('saved status is cleaned: an unknown product can’t switch Plus on', () => {
    expect(cleanPlus({ active: true, productId: 'anything', expires: null })).toEqual({ ...NO_PLUS, productId: null });
    expect(cleanPlus({ active: true, productId: PLUS_PRODUCTS.yearly, expires: 'soon', checkedAt: 5 }))
      .toEqual({ active: true, productId: PLUS_PRODUCTS.yearly, expires: null, checkedAt: 5 });
    expect(cleanPlus('junk')).toEqual(NO_PLUS);
  });
  test('free shows the first 3 habits; the rest are kept, and all show with Plus', () => {
    const h = [1, 2, 3, 4, 5];
    expect(usableHabits(h, false)).toEqual([1, 2, 3]);
    expect(usableHabits(h, true)).toEqual(h);
  });
});

describe('paywall prices', () => {
  test('the yearly saving is rounded down so it never overstates', () => {
    expect(yearlySaving(1.99, 11.99)).toBe(49);                  // 49.8%
    expect(yearlySaving(2, 12)).toBe(50);                        // exactly half stays 50, not 49
    expect(yearlySaving(1.99, 23.88)).toBeNull();                // no saving, no badge
    expect(yearlySaving(null, 11.99)).toBeNull();
    expect(yearlySaving(1.99, 0)).toBeNull();
  });
  test('the prices Tidemark sells at: £3.99 a month against £19.99 a year is a 58% saving', () => {
    expect(yearlySaving(3.99, 19.99)).toBe(58);                  // 58.2%: rounded down
    expect(yearlySaving(2.99, 19.99)).toBe(44);                  // the old monthly price: 44.3%, rounded down
    expect(perMonth(19.99, 'GBP')).toMatch(/£1\.67/);
  });
  test('an introductory price says exactly what is paid, for how long, and what comes after', () => {
    expect(introText({ price: '£11.99', mode: 'pay-up-front', unit: 'year', value: 1, count: 1 }, '£19.99', 'a year'))
      .toBe('£11.99 for the first year, then £19.99 a year.');
    expect(introText({ price: '£9.99', mode: 'pay-up-front', unit: 'month', value: 6, count: 1 }, '£19.99', 'a year'))
      .toBe('£9.99 for the first 6 months, then £19.99 a year.');
    expect(introText({ price: '£0.99', mode: 'pay-as-you-go', unit: 'month', value: 1, count: 3 }, '£2.99', 'a month'))
      .toBe('£0.99 a month for the first 3 months, then £2.99 a month.');
    expect(introText({ price: '£0.99', mode: 'pay-as-you-go', unit: 'month', value: 1, count: 1 }, '£2.99', 'a month'))
      .toBe('£0.99 for the first month, then £2.99 a month.');
  });
  test('a yearly price as a monthly figure, in the store’s currency', () => {
    expect(perMonth(11.99, 'GBP')).toMatch(/£1\.00/);
    expect(perMonth(11.99, null)).toBeNull();
    expect(perMonth(11.99, 'not a currency')).toBeNull();
  });
});

describe('the paywall speaks to the person looking', () => {
  test('someone on a medication sees the dose insights and the doctor report first', () => {
    expect(perksFor('medication').slice(0, 2).map(p => p.feature)).toEqual(['medication', 'report']);
  });
  test('everyone else sees change beyond the scale first, and medication last', () => {
    const order = perksFor('general').map(p => p.feature);
    expect(order[0]).toBe('body');
    expect(order.at(-1)).toBe('medication');
  });
  test('the feature that was tapped always leads, and nothing in Plus is dropped or repeated', () => {
    for (const audience of ['medication', 'general'] as const) {
      const order = perksFor(audience, 'protein').map(p => p.feature);
      expect(order[0]).toBe('protein');
      expect(new Set(order).size).toBe(order.length);
      expect(order).toHaveLength(7);
    }
  });
  test('the rest read as one plain phrase', () => {
    const rest = perksFor('medication').slice(PAYWALL_LEAD);
    expect(restText(rest)).toBe('the protein target, the calorie estimate, more habits and password-protected backup');
    expect(restText(rest.slice(0, 1))).toBe('the protein target');
  });
});
