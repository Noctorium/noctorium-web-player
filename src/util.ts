import type { Provider, Track, Likes } from './types';

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
  return false;
}

export const providerName: Record<Provider, string> = {
  YOUTUBE_MUSIC: 'YouTube Music',
  YOUTUBE_VIDEO: 'YouTube',
  SOUNDCLOUD: 'SoundCloud',
  SPOTIFY: 'Spotify',
  LOCAL: 'This computer',
};

export const providerBadge: Record<Provider, string> = {
  YOUTUBE_MUSIC: 'YT',
  YOUTUBE_VIDEO: 'YT',
  SOUNDCLOUD: 'SC',
  SPOTIFY: 'SP',
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
