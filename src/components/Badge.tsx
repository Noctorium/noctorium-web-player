import { useSyncExternalStore } from 'react';
import { MARK_VIEWPORT, SERVICE_MARKS } from '../base/serviceMarks';
import type { Provider } from '../types';
import { cls, providerBadge, providerName } from '../util';

/*
 * The badges' style in force, for every badge on the page at once: put in force by the App from the looks, as the
 * icon set is, so that a badge in each of a thousand rows does not each ask for the settings.
 */
let inForce = 'MARKS';
const listeners = new Set<() => void>();

/** Puts [style] -- Base's ServiceBadgeStyle, MARKS or LETTERS -- in force on every badge. */
export function setServiceBadgeStyle(style: string) {
  if (style === inForce) return;
  inForce = style;
  listeners.forEach((l) => l());
}

function useServiceBadgeStyle(): string {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => inForce, () => inForce);
}

/**
 * The badge that says which service a song comes from: the service's own mark, or its letters as the badges always
 * had them, as the listener chooses ([style] draws one the other way, for Settings' samples). Either way it is the
 * same chip at the same size: under a mark the letters are still there, unseen, and the mark is laid over them, so
 * changing the setting moves nothing round it. A mark says less than the letters to somebody who does not know it,
 * so it carries the service's name for a screen reader, and as a tooltip.
 */
export function Badge({ provider, style: own }: { provider: Provider; style?: string }) {
  const chosen = useServiceBadgeStyle();
  if ((own ?? chosen) === 'LETTERS') {
    return <span className={cls('badge', provider)} title={providerName[provider]}>{providerBadge[provider]}</span>;
  }
  return (
    <span className={cls('badge', 'mark', provider)} title={providerName[provider]} role="img" aria-label={providerName[provider]}>
      <span className="letters" aria-hidden>{providerBadge[provider]}</span>
      <svg viewBox={`0 0 ${MARK_VIEWPORT} ${MARK_VIEWPORT}`} aria-hidden focusable="false"><path d={SERVICE_MARKS[provider]} /></svg>
    </span>
  );
}
