import { send } from './live';
import { go } from './router';
import { closeNowPlaying } from './ui';
import type { Artist, Provider, Track } from './types';

/*
 * Artists' pages: pressing an artist's name opens their songs on the service the song came from -- YouTube Music's
 * artist for a YouTube Music song, the SoundCloud profile for a SoundCloud one -- as a playlist opens. The page is kept
 * under one key on both sides, [artistKey]: Noctorium's own core opens it on a computer (`noctorium web`), and the
 * hosted player's engine builds it from the service's search, or the SoundCloud profile's tracks.
 */

/** The key an artist's page is opened under, as a playlist is. */
export function artistKey(provider: Provider, name: string): string {
  return `${provider}:artist-named:${name.trim()}`;
}

/** Whether there is an artist's page to open for [track]: not a station, not a file, not a song with no artist. */
export function opensArtist(track: Track | undefined): boolean {
  const provider: string = track?.provider ?? '';
  return !!track && provider !== 'RADIO' && provider !== 'LOCAL' && !!(track.artists[0]?.name ?? track.artistLine).trim();
}

/** Opens [artist]'s page -- [from] is their song it was opened from, which says whose SoundCloud profile it is. */
export function openArtist(artist: Pick<Artist, 'provider' | 'name'> & { id?: string }, from?: Track) {
  const name = artist.name.trim();
  if (!name) return;
  closeNowPlaying();
  send('openArtist', { provider: artist.provider, name, id: artist.id ?? '', sourceUrl: from?.sourceUrl ?? '' });
  go(`/playlist/${encodeURIComponent(artistKey(artist.provider, name))}`);
}

/** Their page on the service itself, for "On …": the SoundCloud profile where it is known, else the service's search. */
export function artistPageUrl(provider: Provider, name: string, sourceUrl?: string): string | undefined {
  const q = encodeURIComponent(name);
  switch (provider) {
    case 'SOUNDCLOUD': return sourceUrl?.replace(/\/tracks$/, '') ?? `https://soundcloud.com/search/people?q=${q}`;
    case 'YOUTUBE_MUSIC': return `https://music.youtube.com/search?q=${q}`;
    case 'YOUTUBE_VIDEO': return `https://www.youtube.com/results?search_query=${q}`;
    default: return sourceUrl;
  }
}

/** The artist of [track], opened: what pressing the name under a song does. */
export function openArtistOf(track: Track) {
  const first = track.artists[0];
  openArtist(first ?? { provider: track.provider, name: track.artistLine }, track);
}
