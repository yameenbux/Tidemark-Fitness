import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { introText, PAYWALL_LEAD, perksFor, perMonth, PLUS_PERKS, PlusAudience, PlusFeature, PlusPlan, restText, yearlySaving } from '../core/plus';
import { buy, loadOffers, PlanOffer, storeAvailable } from '../purchases';
import { notify } from '../dialogs';
import { PRIVACY_URL, TERMS_URL } from '../support';
import { C, F, themed } from '../theme';
import { Icon } from './Icons';
import { TidemarkIcon } from './Logo';
import { Tap } from './Motion';
import { Sheet } from './Sheet';
import { ShinyButton } from './ShinyButton';

const PLAN_TEXT: Record<PlusPlan, { name: string; per: string }> = {
  yearly: { name: 'Yearly', per: 'a year' },
  monthly: { name: 'Monthly', per: 'a month' },
  lifetime: { name: 'Lifetime', per: 'once' },
};
const ORDER: PlusPlan[] = ['yearly', 'monthly', 'lifetime'];

const open = (url: string) => WebBrowser.openBrowserAsync(url, { controlsColor: C.coralInk }).catch(() => Linking.openURL(url).catch(() => {}));

/** The line under a plan card's price: yearly as a monthly figure when the store gives a number, else the period. */
function cardNote(o: PlanOffer): string {
  if (o.intro) return `${o.intro.price} to start`;
  if (o.plan === 'yearly') { const m = perMonth(o.amount, o.currency); return m ? `${m} a month` : 'a year'; }
  return o.plan === 'monthly' ? 'a month' : 'pay once';
}

/** What the chosen plan costs, in one plain sentence, shown right above the button. */
function summary(o: PlanOffer): string {
  if (o.plan === 'lifetime') return `${o.price} once. No subscription.`;
  const per = PLAN_TEXT[o.plan].per;
  if (o.intro) return `${introText(o.intro, o.price, per)} Cancel any time.`;
  return o.trialDays ? `Free for ${o.trialDays} days, then ${o.price} ${per}. Cancel any time.` : `${o.price} ${per}. Cancel any time.`;
}

/**
 * Tidemark Plus: what it adds, the three plans with Apple's own prices, and the terms Apple requires on any
 * subscription screen (price and period, auto-renewal, how to cancel, terms of use and privacy links, restore).
 * Laid out so the prices and the trial terms are on the first screen, not below a list of features.
 */
export function Paywall({ reason, audience = 'general', welcome, onClose, onRestore }: {
  reason: PlusFeature | null; audience?: PlusAudience; welcome?: boolean; onClose: () => void; onRestore: () => Promise<void>;
}) {
  const [offers, setOffers] = useState<PlanOffer[] | null>(storeAvailable ? null : []);
  const [plan, setPlan] = useState<PlusPlan>('yearly');
  const [busy, setBusy] = useState(false);
  const { fontScale } = useWindowDimensions();
  useEffect(() => { if (storeAvailable) loadOffers().then(setOffers).catch(() => setOffers([])); }, []);
  const chosen = offers?.find(o => o.plan === plan);
  const lead = reason ? PLUS_PERKS.find(p => p.feature === reason) : null;
  const perks = perksFor(audience, reason), top = perks.slice(0, PAYWALL_LEAD), rest = perks.slice(PAYWALL_LEAD);
  const saving = yearlySaving(offers?.find(o => o.plan === 'monthly')?.amount, offers?.find(o => o.plan === 'yearly')?.amount);
  const stacked = fontScale > 1.3;              // three cards side by side don't fit large text

  const purchase = async () => {
    if (!chosen) return;
    setBusy(true);
    try { await buy(plan); }                                    // the outcome arrives through the store listener
    catch (e) { notify('Purchase didn’t start', e instanceof Error ? e.message : 'Try again in a moment.'); }
    finally { setBusy(false); }
  };
  const cta = !chosen ? 'Continue'
    : chosen.trialDays ? `Try free for ${chosen.trialDays} days`
    : chosen.intro ? `Subscribe for ${chosen.intro.price}${chosen.intro.mode === 'pay-as-you-go' && chosen.intro.count > 1 ? ` a ${chosen.intro.unit}` : ''}`
    : plan === 'lifetime' ? `Buy for ${chosen.price}` : `Subscribe for ${chosen.price} ${PLAN_TEXT[plan].per}`;

  const links = (
    <View style={s.links}>
      {storeAvailable && <>
        <Tap onPress={() => { setBusy(true); onRestore().finally(() => setBusy(false)); }} disabled={busy} accessibilityRole="button" accessibilityLabel="Restore purchases">
          <Text style={s.restore}>Restore</Text>
        </Tap>
        <Text style={s.dot}>·</Text>
      </>}
      <Tap onPress={() => open(TERMS_URL)} accessibilityRole="link" accessibilityLabel="Terms of use"><Text style={s.link}>Terms</Text></Tap>
      <Text style={s.dot}>·</Text>
      <Tap onPress={() => open(PRIVACY_URL)} accessibilityRole="link" accessibilityLabel="Privacy policy"><Text style={s.link}>Privacy</Text></Tap>
    </View>
  );

  return (
    <Sheet title="" onClose={onClose} footer={<>
      {storeAvailable && <ShinyButton label={cta} disabled={!chosen || busy} onPress={purchase} />}
      {links}
    </>}>
      <View style={s.hero}>
        <TidemarkIcon size={64} />
        <Text style={s.title} accessibilityRole="header">Tidemark Plus</Text>
        <Text style={s.lead}>{welcome ? 'Your plan is ready, and everything in it stays free. ' : `${lead ? `${lead.title} is part of Plus. ` : ''}Everything free stays free. `}Plus adds the extras, with no account and nothing leaving your phone.</Text>
      </View>

      <View style={s.list}>
        {top.map(p => (
          <View key={p.feature} style={[s.line, p.feature === reason && s.lineOn]}>
            <View style={s.tick}><Icon name="check" size={14} color={C.plum2} strokeWidth={2.6} /></View>
            <Text style={s.lineTxt}>{p.line}</Text>
          </View>
        ))}
        {rest.length > 0 && <Text style={s.rest}>Also in Plus: {restText(rest)}.</Text>}
      </View>

      {!storeAvailable ? (
        <Text style={s.notice}>Plus is available in the Tidemark iPhone app. This web version includes everything that’s free.</Text>
      ) : offers == null ? (
        <View style={s.loading}><ActivityIndicator color={C.inkSoft} /><Text style={s.small}>Getting prices from the App Store…</Text></View>
      ) : offers.length === 0 ? (
        <Text style={s.notice}>The App Store couldn’t be reached, so prices can’t be shown. Check your connection and try again.</Text>
      ) : (<>
        <View style={[s.cards, stacked && s.cardsStacked]} accessibilityRole="radiogroup" accessibilityLabel="Plus plans">
          {ORDER.map(p => {
            const o = offers.find(x => x.plan === p);
            if (!o) return null;
            const on = p === plan, t = PLAN_TEXT[p], badge = p === 'yearly' && saving ? `Save ${saving}%` : null;
            return (
              <Tap key={p} onPress={() => setPlan(p)} style={[s.card, stacked && s.cardStacked, on && s.cardOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}
                accessibilityLabel={`${t.name}, ${o.price} ${t.per}${o.trialDays ? `, ${o.trialDays}-day free trial` : ''}${o.intro ? `, ${introText(o.intro, o.price, t.per)}` : ''}${badge ? `, ${badge.toLowerCase()}` : ''}`}>
                {badge && <View style={s.badge}><Text style={s.badgeTxt}>{badge}</Text></View>}
                <Text style={s.cardName}>{t.name}</Text>
                <Text style={s.cardPrice} numberOfLines={1} adjustsFontSizeToFit>{o.price}</Text>
                <Text style={s.small}>{cardNote(o)}</Text>
              </Tap>
            );
          })}
        </View>
        {chosen && <Text style={s.summary}>{summary(chosen)}</Text>}
        <Text style={s.terms}>
          {plan === 'lifetime'
            ? 'A single payment, charged to your Apple ID. No renewal. '
            : `${chosen?.trialDays ? 'After the free trial, ' : chosen?.intro ? 'After the introductory price, ' : ''}${chosen?.price ?? 'The price'} ${PLAN_TEXT[plan].per} is charged to your Apple ID. It renews automatically unless you cancel at least 24 hours before the end of the current period. Cancel any time in Settings → your name → Subscriptions. `}
          Plus works on any iPhone signed in to the same Apple ID.
        </Text>
      </>)}
    </Sheet>
  );
}

const s = themed(() => StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, paddingTop: 4 },
  title: { fontFamily: F.display, fontSize: 28, color: C.ink },
  lead: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  list: { marginTop: 22, gap: 6, paddingHorizontal: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12 },
  lineOn: { backgroundColor: C.panel },
  tick: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.panelAlt, alignItems: 'center', justifyContent: 'center' },
  lineTxt: { flex: 1, fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  rest: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, lineHeight: 19, marginTop: 6, paddingHorizontal: 8 },
  cards: { flexDirection: 'row', gap: 8, marginTop: 30 },
  cardsStacked: { flexDirection: 'column', gap: 16 },
  card: { flex: 1, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 14, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg, gap: 2 },
  cardStacked: { flex: 0 },
  cardOn: { borderColor: C.coralInk, borderWidth: 2, backgroundColor: C.card },
  badge: { position: 'absolute', top: -11, left: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: C.coralInk },
  badgeTxt: { fontFamily: F.bodySemi, fontSize: 11, color: C.onAccent },
  cardName: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  cardPrice: { fontFamily: F.display, fontSize: 22, color: C.ink },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft },
  summary: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 26 },
  notice: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, marginTop: 22, lineHeight: 20, textAlign: 'center' },
  terms: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 16, textAlign: 'center' },
  links: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  restore: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, paddingVertical: 10 },
  link: { fontFamily: F.bodySemi, fontSize: 14, color: C.coralInk, paddingVertical: 10 },
  dot: { fontFamily: F.body, fontSize: 13, color: C.inkSoft },
}));
