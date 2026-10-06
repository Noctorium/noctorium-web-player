import type { Playlist, Provider, Track, Likes } from './types';
import { HOSTED } from './mode';

export function formatTime(ms?: number): string {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '–:––';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function totalTime(tracks: Track[]): string {
  const ms = tracks.reduce((sum, t) => sum + (t.durationMs ?? 0), 0);
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** The key core keeps a like under, from the track's own id. */
export function likeKey(track: Track): string {
  switch (track.provider) {
    case 'YOUTUBE_MUSIC':
    case 'YOUTUBE_VIDEO': return `yt:${track.id}`;
    case 'SOUNDCLOUD': return `sc:${track.id}`;
    case 'SPOTIFY': return `spotify:${track.id}`;
    case 'BANDCAMP': return `bc:${track.id}`;
    case 'VK': return `vk:${track.id}`;
    default: return `local:${track.id}`;
  }
}

export function isLiked(likes: Likes | undefined, track: Track) {
  return !!likes?.keys.includes(likeKey(track));
}

export function canLike(likes: Likes | undefined, track: Track) {
  if (!likes) return false;
  if (track.provider === 'SOUNDCLOUD') return likes.soundCloudReady;
  if (track.provider === 'YOUTUBE_MUSIC' || track.provider === 'YOUTUBE_VIDEO') return likes.youTubeReady;
  if (track.provider === 'SPOTIFY') return !!likes.spotifyReady;
  if (track.provider === 'VK') return !!likes.vkReady;
  return false;
}

/**
 * The address of a track's own page, to open or pass on. For Bandcamp's and VK's songs Noctorium writes what it
 * needs to play them after a `#` on the page's address, which means nothing to anybody else, so it is left off.
 */
export function pageUrl(track: Track): string {
  return track.sourceUrl.replace(/#(bandcamp-track|vk-access)=.*$/, '');
}

/**
 * Whether a service's songs may be downloaded or saved. Not Bandcamp's, which are streamed to be heard on the
 * way to being bought, and not VK's, which VK licenses for playing and not for keeping.
 */
export function keepsFiles(provider: Provider): boolean {
  return provider !== 'BANDCAMP' && provider !== 'VK';
}

export function canKeep(track: Track): boolean {
  return keepsFiles(track.provider);
}

/** An artist, which Bandcamp and Spotify open as a playlist of what they put out. */
export function isArtist(playlist: Playlist): boolean {
  return (playlist.provider === 'BANDCAMP' && playlist.id.startsWith('band:')) ||
    (playlist.provider === 'SPOTIFY' && playlist.id.startsWith('artist:'));
}

/** What a playlist is, for the line above its name: Bandcamp and Spotify open albums and artists as playlists. */
export function playlistKind(playlist: Playlist): 'Artist' | 'Album' | 'Single' | 'Playlist' {
  if (isArtist(playlist)) return 'Artist';
  if (playlist.provider === 'BANDCAMP' && playlist.id.startsWith('album:')) return 'Album';
  if (playlist.provider === 'BANDCAMP' && playlist.id.startsWith('track:')) return 'Single';
  if (playlist.provider === 'SPOTIFY' && playlist.id.startsWith('album:')) return 'Album';
  return playlist.id.startsWith('OLAK') || playlist.id.startsWith('MPRE') ? 'Album' : 'Playlist';
}

/** A speed as people say it: 1×, 1.25×, 0.75×. */
export function speedName(speed: number): string {
  return `${Number(speed.toFixed(2))}×`;
}

export const providerName: Record<Provider, string> = {
  YOUTUBE_MUSIC: 'YouTube Music',
  YOUTUBE_VIDEO: 'YouTube',
  SOUNDCLOUD: 'SoundCloud',
  SPOTIFY: 'Spotify',
  BANDCAMP: 'Bandcamp',
  VK: 'VK Music',
  LOCAL: HOSTED ? 'This browser' : 'This computer',
};

export const providerBadge: Record<Provider, string> = {
  YOUTUBE_MUSIC: 'YT',
  YOUTUBE_VIDEO: 'YT',
  SOUNDCLOUD: 'SC',
  SPOTIFY: 'SP',
  BANDCAMP: 'BC',
  VK: 'VK',
  LOCAL: 'PC',
};

/** A larger cover than the one a list was given, where the service's address says how to ask for one. */
export function bigArtwork(url?: string, size = 544): string | undefined {
  if (!url) return url;
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
    return url.replace(/=w\d+-h\d+[^&]*$/, `=w${size}-h${size}-l90-rj`).replace(/=s\d+[^&]*$/, `=s${size}`);
  }
  if (url.includes('sndcdn.com')) return url.replace(/-(large|t\d+x\d+|small|badge|tiny|mini|crop)\./, '-t500x500.');
  if (url.includes('i.ytimg.com')) return url.replace(/\/(default|mqdefault|hqdefault|sddefault)\.jpg/, '/hqdefault.jpg');
  return url;
}

export function cls(...names: (string | false | undefined | null)[]) {
  return names.filter(Boolean).join(' ');
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
