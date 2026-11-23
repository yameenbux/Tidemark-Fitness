import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { introText, PAYWALL_LEAD, perksFor, perMonth, PLUS_PERKS, PlusAudience, PlusFeature, PlusPlan, restText, yearlySaving } from '../core/plus';
import { buy, loadOffers, PlanOffer, storeAvailable } from '../purchases';
import { notify } from '../dialogs';
import { PRIVACY_URL, TERMS_URL } from '../support';
import { C, F, themed } from '../theme';
import { Icon, type IconName } from './Icons';
import { TidemarkIcon } from './Logo';
import { Tap } from './Motion';
import { Sheet } from './Sheet';
import { ShinyButton } from './ShinyButton';
import { TRIAL_NOTICE_DAYS } from '../reminders';

const PLAN_TEXT: Record<PlusPlan, { name: string; per: string }> = {
  yearly: { name: 'Yearly', per: 'a year' },
  monthly: { name: 'Monthly', per: 'a month' },
  lifetime: { name: 'Lifetime', per: 'once' },
};
const SUBS: PlusPlan[] = ['yearly', 'monthly'];   // the two subscriptions, side by side; lifetime sits below, smaller
const ICON: Record<PlusFeature, IconName> = { medication: 'pill', report: 'download', body: 'body', calories: 'flame', protein: 'meal', habits: 'habits', protectedBackups: 'lock' };

/** The headline speaks to what this person came for; the facts underneath are the same for everyone. */
function headline(audience: PlusAudience, reason: PlusFeature | null, welcome?: boolean): string {
  if (welcome) return 'Your plan is ready. Want the full picture?';
  if (reason === 'report') return 'Take a clear record to your appointment';
  if (reason === 'medication' || (!reason && audience === 'medication')) return 'See what each dose is doing';
  if (reason === 'body' || reason === 'calories' || !reason) return 'See the change beyond the scale';
  return 'Do more with Tidemark';
}

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
 * Tidemark Plus: a headline for what this person came for, the three perks that matter most to them, two subscription
 * plans with yearly chosen, lifetime as a smaller choice below, how the trial works, and the terms Apple requires on
 * any subscription screen (the billed price most prominent, auto-renewal, how to cancel, terms and privacy links,
 * restore). Laid out so the prices and the trial terms are on the first screen, not below a list of features.
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
  const stacked = fontScale > 1.3;              // two cards side by side don't fit very large text
  const life = offers?.find(o => o.plan === 'lifetime');

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
        <View style={s.brand}><TidemarkIcon size={28} /><Text style={s.brandTxt}>Tidemark Plus</Text></View>
        <Text style={s.title} accessibilityRole="header">{headline(audience, reason, welcome)}</Text>
        <Text style={s.lead}>{welcome ? 'Everything in your plan stays free. ' : `${lead ? `${lead.title} is part of Plus. ` : ''}Everything free stays free. `}Plus adds the extras.</Text>
      </View>

      <View style={s.list}>
        {top.map(p => (
          <View key={p.feature} style={[s.line, p.feature === reason && s.lineOn]}>
            <View style={s.tick}><Icon name={ICON[p.feature]} size={17} color={C.plum2} /></View>
            <Text style={s.lineTxt}>{p.line}</Text>
          </View>
        ))}
        {rest.length > 0 && <Text style={s.rest}>Also in Plus: {restText(rest)}.</Text>}
        <View style={s.trust}><Icon name="shield" size={14} color={C.mintInk} /><Text style={s.trustTxt}>No account · nothing leaves your phone · what you enter stays yours, with or without Plus</Text></View>
      </View>

      {!storeAvailable ? (
        <Text style={s.notice}>Plus is available in the Tidemark iPhone app. This web version includes everything that’s free.</Text>
      ) : offers == null ? (
        <View style={s.loading}><ActivityIndicator color={C.inkSoft} /><Text style={s.small}>Getting prices from the App Store…</Text></View>
      ) : offers.length === 0 ? (
        <Text style={s.notice}>The App Store couldn’t be reached, so prices can’t be shown. Check your connection and try again.</Text>
      ) : (<>
        <View style={[s.cards, stacked && s.cardsStacked]} accessibilityRole="radiogroup" accessibilityLabel="Plus plans">
          {SUBS.map(p => {
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
        {life && (
          // Lifetime: a real choice, but not a third equal card, so the subscriptions read as the main offer
          <Tap onPress={() => setPlan('lifetime')} style={[s.life, plan === 'lifetime' && s.lifeOn]} accessibilityRole="radio"
            accessibilityState={{ checked: plan === 'lifetime' }} accessibilityLabel={`Lifetime, ${life.price} once, no subscription`}>
            <View style={[s.radio, plan === 'lifetime' && s.radioOn]} />
            <Text style={s.lifeTxt}>Or pay once: <Text style={s.lifePrice}>{life.price}</Text> lifetime, no subscription</Text>
          </Tap>
        )}
        {chosen?.trialDays && chosen.trialDays > TRIAL_NOTICE_DAYS && plan !== 'lifetime' ? (
          // How the trial works, step by step: knowing when they'd be charged makes people more willing to start one
          <View style={s.timeline} accessibilityRole="list" accessibilityLabel="How the free trial works">
            {[
              ['Today', 'Every Plus feature unlocks. Nothing to pay.'],
              [`Day ${chosen.trialDays - TRIAL_NOTICE_DAYS}`, 'A reminder that your trial ends in 2 days, if you allow notifications.'],
              [`Day ${chosen.trialDays}`, `${chosen.price} ${PLAN_TEXT[plan].per} starts, unless you cancel before.`],
            ].map(([when, what], i) => (
              <View key={when} style={s.step} accessible accessibilityLabel={`${when}: ${what}`}>
                <View style={[s.stepDot, i === 0 && s.stepDotOn]} />
                <Text style={s.stepWhen}>{when}</Text>
                <Text style={s.stepWhat}>{what}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
  hero: { alignItems: 'center', gap: 8, paddingTop: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTxt: { fontFamily: F.bodySemi, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: C.coralInk },
  title: { fontFamily: F.display, fontSize: 26, lineHeight: 31, color: C.ink, textAlign: 'center', paddingHorizontal: 8 },
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10, paddingHorizontal: 8 },
  trustTxt: { flex: 1, fontFamily: F.body, fontSize: 12.5, color: C.inkSoft, lineHeight: 17 },
  life: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  lifeOn: { borderColor: C.coralInk, backgroundColor: C.card },
  lifeTxt: { flex: 1, fontFamily: F.body, fontSize: 13.5, color: C.inkSoft },
  lifePrice: { fontFamily: F.bodySemi, color: C.ink },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.control },
  radioOn: { borderColor: C.coralInk, borderWidth: 6 },
  lead: { fontFamily: F.body, fontSize: 15, color: C.inkSoft, lineHeight: 21, textAlign: 'center', paddingHorizontal: 8 },
  list: { marginTop: 22, gap: 6, paddingHorizontal: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 12 },
  lineOn: { backgroundColor: C.panel },
  tick: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  lineTxt: { flex: 1, fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  rest: { fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, lineHeight: 19, marginTop: 6, paddingHorizontal: 8 },
  cards: { flexDirection: 'row', gap: 10, marginTop: 26 },
  cardsStacked: { flexDirection: 'column', gap: 16 },
  card: { flex: 1, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 14, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.bg, gap: 2 },
  cardStacked: { flex: 0 },
  cardOn: { borderColor: C.coralInk, borderWidth: 2, backgroundColor: C.card },
  badge: { position: 'absolute', top: -11, left: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: C.coralInk },
  badgeTxt: { fontFamily: F.bodySemi, fontSize: 11, color: C.onAccent },
  cardName: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  cardPrice: { fontFamily: F.display, fontSize: 24, color: C.ink },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.inkSoft },
  timeline: { marginTop: 18, gap: 8, paddingHorizontal: 6 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, borderWidth: 2, borderColor: C.coralInk },
  stepDotOn: { backgroundColor: C.coralInk },
  stepWhen: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.ink, width: 52 },
  stepWhat: { flex: 1, fontFamily: F.body, fontSize: 13.5, color: C.inkSoft, lineHeight: 18 },
  summary: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 26 },
  notice: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, marginTop: 22, lineHeight: 20, textAlign: 'center' },
  terms: { fontFamily: F.body, fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 16, textAlign: 'center' },
  links: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  restore: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink, paddingVertical: 10 },
  link: { fontFamily: F.bodySemi, fontSize: 14, color: C.coralInk, paddingVertical: 10 },
  dot: { fontFamily: F.body, fontSize: 13, color: C.inkSoft },
}));
