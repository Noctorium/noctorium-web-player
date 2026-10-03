import { artist, BROWSER_AGENT, track, unique, Upstream } from './common.js';
import type { Artist, Playlist, Section, Track } from './common.js';

/*
 * SoundCloud, through the API its own website uses.
 *
 * That API wants the public client id the website carries in its scripts, found the way Base's
 * SoundCloudClientId.kt finds it: read the home page, then its bundles from the last, until one names it.
 * It rotates now and then, so a refusal asks for it again once before giving up.
 *
 * The audio is not fetched here either. What comes back for a track is the signed address of its stream on
 * SoundCloud's own servers, which answer any page, and the listener's browser plays it from there.
 */

const API = 'https://api-v2.soundcloud.com';
let clientId: string | undefined;

async function findClientId(): Promise<string> {
  const get = (url: string) =>
    fetch(url, { headers: { 'User-Agent': BROWSER_AGENT }, signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.text() : ''));
  const page = await get('https://soundcloud.com/');
  const scripts = [...page.matchAll(/src="(https:\/\/[^"]+\.js[^"]*)"/g)].map((m) => m[1]).reverse();
  for (const script of scripts) {
    const body = await get(script).catch(() => '');
    const found = /client_id[=:]"?([A-Za-z0-9]{28,40})/.exec(body)?.[1];
    if (found) return found;
  }
  throw new Upstream('SoundCloud did not say how to ask it anything');
}

async function api(path: string, parameters: Record<string, string | number | undefined> = {}): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    clientId ??= await findClientId();
    const url = new URL(path.startsWith('http') ? path : `${API}${path}`);
    for (const [k, v] of Object.entries(parameters)) if (v !== undefined) url.searchParams.set(k, String(v));
    url.searchParams.set('client_id', clientId);
    const response = await fetch(url, { headers: { 'User-Agent': BROWSER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if ((response.status === 401 || response.status === 403) && attempt === 0) {
      clientId = undefined;
      continue;
    }
    if (response.status === 404) throw new Upstream('SoundCloud has nothing there, or it is private');
    if (!response.ok) throw new Upstream(`SoundCloud answered ${response.status}`);
    return response.json();
  }
  throw new Upstream('SoundCloud refused');
}

type Json = any;

function artwork(url: string | undefined | null): string | undefined {
  return url ? url.replace('-large.', '-t500x500.') : undefined;
}

/** A track, or nothing for one that would only play thirty seconds without SoundCloud Go+, or not at all. */
export function trackFrom(json: Json): Track | undefined {
  if (!json || json.kind !== 'track' || !json.title || !json.permalink_url) return undefined;
  if (json.policy === 'SNIP' || json.policy === 'BLOCK' || json.streamable === false) return undefined;
  const who = json.user?.username ?? 'SoundCloud';
  const id = String(json.id);
  const artists: Artist[] = [artist('SOUNDCLOUD', who, json.user?.permalink_url)];
  return track('SOUNDCLOUD', id, json.title, artists, {
    durationMs: json.full_duration ?? json.duration,
    artworkUrl: artwork(json.artwork_url ?? json.user?.avatar_url),
    sourceUrl: json.permalink_url,
  });
}

function playlistFrom(json: Json): Playlist | undefined {
  if (!json?.title) return undefined;
  if (json.kind === 'system-playlist') {
    return {
      key: `sc:sys:${json.urn}`, id: json.urn, title: json.title, provider: 'SOUNDCLOUD', ownerName: json.made_for?.username ?? 'SoundCloud',
      artworkUrl: artwork(json.artwork_url ?? json.calculated_artwork_url ?? json.tracks?.[0]?.artwork_url), trackCount: json.tracks?.length,
      editable: false, sourceUrl: json.permalink_url,
    };
  }
  if (json.kind !== 'playlist') return undefined;
  return {
    key: `sc:pl:${json.id}`, id: String(json.id), title: json.title, provider: 'SOUNDCLOUD', ownerName: json.user?.username,
    artworkUrl: artwork(json.artwork_url ?? json.tracks?.find((t: Json) => t.artwork_url)?.artwork_url), trackCount: json.track_count,
    isPublic: json.sharing ? json.sharing === 'public' : undefined, editable: false, sourceUrl: json.permalink_url,
  };
}

/** The set's tracks, the ones SoundCloud sent as bare ids asked for in the batches its site uses. */
async function fill(set: Json): Promise<Track[]> {
  const rows: Json[] = (set.tracks ?? []).slice(0, 1000);
  const missing = rows.filter((r) => !r.title).map((r) => String(r.id));
  const filled = new Map<string, Json>();
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += 50) batches.push(missing.slice(i, i + 50));
  await Promise.all(batches.map(async (ids) => {
    const found: Json[] = await api('/tracks', {
      ids: ids.join(','),
      playlistId: set.kind === 'playlist' ? set.id : undefined,
      playlistSecretToken: set.secret_token ?? undefined,
    }).catch(() => []);
    for (const t of found) filled.set(String(t.id), t);
  }));
  return rows.map((r) => trackFrom(r.title ? r : filled.get(String(r.id)))).filter((t): t is Track => !!t);
}

export interface Found { tracks: Track[]; playlists: Playlist[]; artists: Artist[] }

export async function search(query: string): Promise<Found> {
  const [tracks, sets, users] = await Promise.all([
    api('/search/tracks', { q: query, limit: 30 }),
    api('/search/playlists', { q: query, limit: 10 }).catch(() => ({ collection: [] })),
    api('/search/users', { q: query, limit: 6 }).catch(() => ({ collection: [] })),
  ]);
  return {
    tracks: unique((tracks.collection ?? []).map(trackFrom).filter((t: Track | undefined): t is Track => !!t), (t) => t.id),
    playlists: (sets.collection ?? []).map(playlistFrom).filter((p: Playlist | undefined): p is Playlist => !!p),
    artists: (users.collection ?? []).filter((u: Json) => u.username).map((u: Json) => artist('SOUNDCLOUD', u.username, u.permalink_url)),
  };
}

/** A set by the key the page knows it by: `pl:<id>`, `sys:<urn>` or `url:<address>`. */
export async function playlist(key: string): Promise<Playlist> {
  const [kind, ...rest] = key.split(':');
  const value = rest.join(':');
  const set = kind === 'sys' ? await api(`/system-playlists/${encodeURIComponent(value)}`)
    : kind === 'url' ? await api('/resolve', { url: value })
      : await api(`/playlists/${encodeURIComponent(value)}`);
  const found = playlistFrom(set);
  if (!found) throw new Upstream('That is not a SoundCloud playlist');
  const tracks = await fill(set);
  return { ...found, trackCount: found.trackCount ?? tracks.length, artworkUrl: found.artworkUrl ?? tracks[0]?.artworkUrl, tracks };
}

/** What SoundCloud's own discover page shows a visitor: its curated sets and the charts by genre. */
export async function home(): Promise<Section[]> {
  const reply = await api('/mixed-selections', { limit: 10 });
  return (reply.collection ?? []).map((selection: Json, i: number) => {
    const playlists = (selection.items?.collection ?? []).map(playlistFrom).filter((p: Playlist | undefined): p is Playlist => !!p);
    return { id: `sc:${i}:${selection.title}`, title: selection.title, subtitle: 'SoundCloud', provider: 'SOUNDCLOUD', tracks: [], playlists } as Section;
  }).filter((s: Section) => s.playlists.length);
}

/** Tracks like this one, as SoundCloud's own "related" list has them. */
export async function radio(id: string): Promise<Track[]> {
  const reply = await api(`/tracks/${encodeURIComponent(id)}/related`, { limit: 30 });
  return (reply.collection ?? []).map(trackFrom).filter((t: Track | undefined): t is Track => !!t);
}

export interface Stream { url: string; hls: boolean }

/**
 * Where the browser can read a track's audio from: MP3 over plain HTTP where SoundCloud offers it, as the
 * simplest thing an audio element opens, then the streaming kinds, which hls.js reads. Opus is left out,
 * since SoundCloud sends it in Ogg, which no browser plays through Media Source.
 */
export async function stream(id: string): Promise<Stream> {
  const json = await api(`/tracks/${encodeURIComponent(id)}`);
  if (json.policy === 'SNIP') throw new Upstream('SoundCloud plays only thirty seconds of this without Go+');
  if (json.policy === 'BLOCK') throw new Upstream('SoundCloud does not play this where the server is');
  // A plain MP3's address stops working about ten minutes after it is handed out, which a browser still
  // reading a long mix would notice; a stream's addresses last a couple of hours. So a long track streams.
  const long = (json.full_duration ?? json.duration ?? 0) > 8 * 60_000;
  const rank = (t: Json) => {
    const protocol = t.format?.protocol;
    const mime = String(t.format?.mime_type ?? '');
    if (t.snipped) return 9;
    if (protocol === 'progressive' && mime.startsWith('audio/mpeg')) return long ? 3 : 0;
    if (protocol === 'hls' && mime.startsWith('audio/mpeg')) return 1;
    if (protocol === 'hls' && mime.includes('mp4a')) return 2;
    return 9;
  };
  const choices = (json.media?.transcodings ?? []).filter((t: Json) => rank(t) < 9).sort((a: Json, b: Json) => rank(a) - rank(b));
  for (const choice of choices) {
    const reply = await api(choice.url, { track_authorization: json.track_authorization }).catch(() => undefined);
    if (reply?.url) return { url: reply.url, hls: choice.format.protocol === 'hls' };
  }
  throw new Upstream('SoundCloud offered no stream a browser can play');
}

/** A SoundCloud address pasted into the search box: a track to play, or a set to open. */
export async function resolve(address: string): Promise<{ track?: Track; playlist?: Playlist }> {
  let url = address;
  // Short links from the app's share sheet point at the real address.
  if (/^https?:\/\/on\.soundcloud\.com\//.test(url)) {
    const followed = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': BROWSER_AGENT }, signal: AbortSignal.timeout(8000) });
    url = followed.url;
  }
  const json = await api('/resolve', { url });
  if (json.kind === 'track') {
    const found = trackFrom(json);
    if (!found) throw new Upstream('SoundCloud plays only a preview of this one');
    return { track: found };
  }
  const set = playlistFrom(json);
  if (set) return { playlist: set };
  throw new Upstream('That SoundCloud link is not a track or a playlist');
}
