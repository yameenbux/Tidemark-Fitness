import { useEffect } from 'react';
import { dateKey, DAY_FULL, daysBetween, parseKey, startOfDay } from '../core/dates';
import { appointmentSoon, pickPlusNudge, type PlusNudge } from '../core/plusNudge';
import type { TrendPoint } from '../core/trend';
import { usePlus } from '../plus';
import type { Tracker } from '../store';
import { Notice } from './Shell';

/** What each card says. They describe the person's own record and what Plus shows; none of them advises. */
function words(n: PlusNudge, onMedication: boolean, freeReport: boolean, plus = false): { title: string; body: string; action: string } {
  switch (n.kind) {
    case 'appointment': {
      const days = n.date ? daysBetween(startOfDay(new Date()), parseKey(n.date)) : 0;
      return { title: days === 0 ? 'Appointment today' : days === 1 ? 'Appointment tomorrow' : `Appointment on ${n.date ? DAY_FULL[parseKey(n.date).getDay()] : 'its way'}`,
        body: `Take a PDF of your trend, doses and side effects along.${plus ? '' : freeReport ? ' Your first report is free.' : ' Reports are part of Plus.'}`,
        action: plus ? 'Make my report' : freeReport ? 'Make my free report' : 'See Plus' };
    }
    case 'stopped': return { title: 'Following your trend after treatment',
      body: 'Plus shows how your trend has moved since you stopped, next to your dose history: a record to look at with your prescriber, not advice.', action: 'See Plus' };
    case 'newDose': return { title: n.mg ? `New dose: ${n.mg} mg` : 'A new dose',
      body: 'Plus shows how your trend moves at each dose, next to the one before, with any side effects you note.', action: 'See Plus' };
    case 'flat': return onMedication
      ? { title: 'Your trend has held steady for three weeks', body: 'Plus lines your trend up with each dose and the side effects you’ve noted, and makes a report you can take to your prescriber.', action: 'See Plus' }
      : { title: 'Your trend has held steady for three weeks', body: 'When the scale holds still, measurements and photos often keep changing. Plus adds hips, chest and arms, and private progress photos.', action: 'See Plus' };
    case 'report': return { title: 'Seeing your prescriber?',
      body: 'Make a PDF of your trend, doses and side effects to take along. Your first report is free.', action: 'Make my free report' };
    case 'photos': return { title: 'Picture where you are now',
      body: 'A progress photo today gives you something to compare in a few months, when the change is easier to see than to weigh. Photos stay on this phone. Part of Plus.', action: 'See Plus' };
  }
}

/**
 * The one Plus card on Today for someone without Plus (core/plusNudge.ts decides whether there is one). Shown in the
 * bottom slot, so it never pushes the weigh-in down, and only when the backup reminder isn't using that slot.
 */
export function PlusNudgeCard({ t, series, onReport }: { t: Tracker; series: TrendPoint[]; onReport?: () => void }) {
  const { plus, storeAvailable, openPaywall } = usePlus();
  const { state, prefs } = t;
  const settings = state.settings;
  const todayD = startOfDay(new Date());
  const nudge = !settings ? null
    : plus ? (prefs.plusNudge.at === dateKey(todayD) && prefs.plusNudge.dismissed ? null : appointmentSoon({ settings, memory: prefs.plusNudge }, todayD))
    : !storeAvailable ? null : pickPlusNudge({ settings, weights: state.weights, series, doses: state.doses ?? {},
    effects: state.effects ?? {}, photos: state.photos, sampleReportUsed: prefs.sampleReport, memory: prefs.plusNudge });
  const today = dateKey(new Date());
  // Remember today's card, so it stays for the day and the next one waits a week
  useEffect(() => {
    if (nudge && prefs.plusNudge.at !== today) t.setPrefs({ plusNudge: { at: today, kind: nudge.kind, key: nudge.key, dismissed: false } });
  }, [nudge, prefs.plusNudge.at, today, t]);
  if (!nudge || !settings) return null;
  const freeReport = !prefs.sampleReport;
  const w = words(nudge, !!settings.medication, freeReport, plus);
  const act = (nudge.kind === 'report' || (nudge.kind === 'appointment' && (freeReport || plus))) && onReport ? onReport
    : nudge.kind === 'appointment' ? () => openPaywall('report')
    : () => openPaywall(nudge.kind === 'photos' || (nudge.kind === 'flat' && !settings.medication) ? 'body' : 'medication');
  return <Notice icon={nudge.kind === 'appointment' ? 'calendar' : nudge.kind === 'report' ? 'download' : nudge.kind === 'photos' ? 'body' : 'sparkle'} title={w.title} body={w.body}
    action={w.action} onAction={act} onDismiss={() => t.setPrefs({ plusNudge: { ...prefs.plusNudge, at: today, dismissed: true } })} />;
}
