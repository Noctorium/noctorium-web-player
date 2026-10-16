/*
 * Bangs: a word starting with "!" that sends one search to one service -- `!ytm daft punk`, or `daft punk !sc`.
 * Base's SearchBangs, word for word, for the hosted player, whose search runs here rather than in Noctorium: the
 * page that `noctorium web` serves sends the text as typed and Noctorium reads the bang itself.
 *
 * At the start or at the end of what was typed, in any case. Only a bang this knows counts: anything else that
 * starts with "!" is left in the words and searched for like the rest of them, since a song can be called "!!!"
 * and a band can be called "!Action Pact!". A bang at the start is taken over one at the end.
 */

import type { Search } from '../types';

export type SearchMode = Search['mode'];

/** A bang that chose where a search goes: the word as it was typed, "!sc", and the search it means. */
export interface SearchBang { typed: string; mode: SearchMode }

/** What a search box's text asks for: the words to look for, and the bang that said where, if one did. */
export interface BangQuery { query: string; bang?: SearchBang }

/** Every bang, without its "!", and the search it chooses, in Base's order. */
export const ALL: ReadonlyMap<string, SearchMode> = new Map<string, SearchMode>([
  ['ytm', 'YOUTUBE_MUSIC'],
  ['yt', 'YOUTUBE_MUSIC'],
  ['youtube', 'YOUTUBE_MUSIC'],
  ['ytv', 'YOUTUBE_VIDEO'],
  ['sc', 'SOUNDCLOUD'],
  ['soundcloud', 'SOUNDCLOUD'],
  ['sp', 'SPOTIFY'],
  ['spotify', 'SPOTIFY'],
  ['bc', 'BANDCAMP'],
  ['bandcamp', 'BANDCAMP'],
  ['vk', 'VK'],
  ['dz', 'DEEZER'],
  ['deezer', 'DEEZER'],
  ['td', 'TIDAL'],
  ['tidal', 'TIDAL'],
  ['am', 'APPLE_MUSIC'],
  ['applemusic', 'APPLE_MUSIC'],
  ['all', 'HYBRID'],
]);

/** [text] read for a bang. Without one, the query is the text exactly as it was. */
export function parse(text: string): BangQuery {
  const trimmed = text.trim();
  const first = before(before(trimmed, ' '), '\t');
  const atStart = bangIn(first);
  if (atStart) return { query: trimmed.slice(first.length).trim(), bang: atStart };
  const last = afterLast(afterLast(trimmed, ' '), '\t');
  const atEnd = bangIn(last);
  if (atEnd) return { query: trimmed.slice(0, trimmed.length - last.length).trim(), bang: atEnd };
  return { query: text };
}

/** The bang a search box can suggest for [mode]: the shortest that means it, "!sc" for SoundCloud. */
export function bangFor(mode: SearchMode): string {
  let shortest: string | undefined;
  for (const [name, chosen] of ALL) if (chosen === mode && (shortest == null || name.length < shortest.length)) shortest = name;
  return '!' + (shortest ?? '');
}

function bangIn(word: string): SearchBang | undefined {
  if (word.length < 2 || !word.startsWith('!')) return undefined;
  const mode = ALL.get(word.slice(1).toLowerCase());
  return mode ? { typed: word, mode } : undefined;
}

/** Kotlin's substringBefore: the whole of [text] when [separator] is not in it. */
function before(text: string, separator: string): string {
  const at = text.indexOf(separator);
  return at < 0 ? text : text.slice(0, at);
}

/** Kotlin's substringAfterLast: the whole of [text] when [separator] is not in it. */
function afterLast(text: string, separator: string): string {
  const at = text.lastIndexOf(separator);
  return at < 0 ? text : text.slice(at + 1);
}
