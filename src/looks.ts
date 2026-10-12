import { useSyncExternalStore } from 'react';
import { live, send, usePart } from './live';
import { DEFAULT_QUEUE_COLUMNS, normalisedColumns } from './base/looks';

/*
 * The look's choices that came with the desktop-music-player look, wherever each is kept.
 *
 * The player bar and the now playing layout -- and whether the Centred bar has a Stop button -- are this page's
 * own and kept in this browser, as the desktop keeps its own bar and layout: a phone and a laptop opening the same
 * Noctorium can each have theirs. The visualiser, the queue's columns, the status bar, the icon set and the service
 * badges' style are Noctorium's, shared with its other players, and sent with the settings; from a Noctorium too old
 * to send them, they are kept here too, so the choice still holds in this browser.
 */

export interface Looks {
  /** Base's PlayerBarStyle: CENTERED, this page's own bar, or TOOLBAR. */
  playerBar: string;
  /** Base's NowPlayingLayout: SIDE_BY_SIDE, this page's own screen, or PLAYLIST. */
  nowPlaying: string;
  /** Stop among the Centred bar's buttons, which it is not unless asked for, as on the desktop. */
  stopButton: boolean;
  visualiser: string;
  queueColumns: string[];
  statusBar: boolean;
  iconSet: string;
  /** Base's ServiceBadgeStyle: MARKS, each service's own, or LETTERS, as the badges were. */
  serviceBadgeStyle: string;
}

const KEY = 'noctorium:looks';
const DEFAULTS: Looks = {
  playerBar: 'CENTERED', nowPlaying: 'SIDE_BY_SIDE', stopButton: false, visualiser: 'BARS', queueColumns: DEFAULT_QUEUE_COLUMNS,
  statusBar: true, iconSet: 'STANDARD', serviceBadgeStyle: 'MARKS',
};

function read(): Looks {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Looks>;
    return { ...DEFAULTS, ...kept, queueColumns: normalisedColumns(kept.queueColumns ?? DEFAULTS.queueColumns) };
  } catch {
    return DEFAULTS;
  }
}

let local = read();
const listeners = new Set<() => void>();

/** Noctorium's own name for each of the shared choices, and the command that changes it there. */
const kept: Partial<Record<keyof Looks, (value: any) => [string, Record<string, unknown>]>> = {
  visualiser: (name: string) => ['visualiser', { name }],
  queueColumns: (columns: string[]) => ['queueColumns', { columns }],
  statusBar: (on: boolean) => ['statusBar', { on }],
  iconSet: (name: string) => ['iconSet', { name }],
  serviceBadgeStyle: (name: string) => ['serviceBadgeStyle', { name }],
};

/** Every choice, as it stands: Noctorium's where it sends it, this browser's otherwise. */
export function useLooks(): Looks {
  const settings = usePart('settings');
  const mine = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => local);
  return {
    ...mine,
    visualiser: settings?.visualiser ?? mine.visualiser,
    queueColumns: settings?.queueColumns ? normalisedColumns(settings.queueColumns) : mine.queueColumns,
    statusBar: settings?.statusBar ?? mine.statusBar,
    iconSet: settings?.iconSet ?? mine.iconSet,
    serviceBadgeStyle: settings?.serviceBadgeStyle ?? mine.serviceBadgeStyle,
  };
}

/** Changes a choice where it is kept. */
export function setLook<K extends keyof Looks>(name: K, value: Looks[K]) {
  const settings = live.state.settings as Record<string, unknown> | undefined;
  const command = kept[name];
  if (command && settings && settings[name] !== undefined) {
    const [type, fields] = command(value);
    send(type, fields);
    return;
  }
  local = { ...local, [name]: value };
  try {
    localStorage.setItem(KEY, JSON.stringify(local));
  } catch {
    // Not kept, then; it holds until the page is closed.
  }
  listeners.forEach((l) => l());
}
