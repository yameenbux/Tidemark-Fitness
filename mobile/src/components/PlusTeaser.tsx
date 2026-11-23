import type { PlusFeature } from '../core/plus';
import type { IconName } from './Icons';
import { usePlus } from '../plus';
import { Notice } from './Shell';

/** Stands in for a Plus feature on the free version. Anything already entered stays on show; adding more is Plus. */
export function PlusTeaser({ feature, icon, title, body, kept }: { feature: PlusFeature; icon: IconName; title: string; body: string; kept?: boolean }) {
  const { openPaywall } = usePlus();
  return <Notice icon={icon} title={title} body={kept ? `${body} Everything you’ve already entered stays yours to see; adding more is Plus.` : body}
    action="See Plus" onAction={() => openPaywall(feature)} />;
}
