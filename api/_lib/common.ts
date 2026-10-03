import type { Album, Artist, Playlist, Provider, Section, Track } from '../../src/types.js';

/*
 * What the hosted player's API shares between the two services: the shapes it answers in, which are the page's
 * own, and the few helpers both readers need.
 */

export type { Album, Artist, Playlist, Provider, Section, Track };

/** A service that answered, but not with something usable; the message is shown to the listener as it is. */
export class Upstream extends Error {}

/** Where the listener is and what they read, so YouTube Music answers in their language and their charts. */
export interface Locale { hl: string; gl: string }

export const BROWSER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export function track(provider: Provider, id: string, title: string, artists: Artist[], fields: Partial<Track> & { sourceUrl: string }): Track {
  return {
    key: `${provider}:${id}`,
    provider,
    id,
    title,
    artists,
    artistLine: artists.map((a) => a.name).join(', '),
    ...fields,
  };
}

export function artist(provider: Provider, name: string, id?: string): Artist {
  return { id: id ?? `${provider}:${name}`, name, provider };
}

/** `3:04` or `1:02:03` as milliseconds; undefined when the text is not a length. */
export function durationMs(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return undefined;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) return undefined;
  return numbers.reduce((total, n) => total * 60 + n, 0) * 1000;
}

export function unique<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Takes from each list in turn, so a search for both services is not one service then the other. */
export function interleave<T>(...lists: T[][]): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (i < list.length) out.push(list[i]);
  return out;
}
