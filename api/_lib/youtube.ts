import { artist, BROWSER_AGENT, durationMs, track, unique, Upstream } from './common.js';
import type { Album, Artist, Locale, Playlist, Provider, Section, Track } from './common.js';

/*
 * YouTube Music, read the way its own page reads it: the InnerTube API, signed out.
 *
 * The rows are the shapes Noctorium's core already reads for a signed-in account (Base's YouTubeMusic.kt), so
 * the reading here is a port of that: positional columns, " • " between fields, the length found by its
 * shape. Signed out is enough for everything here -- search, a playlist, an album, the home page and a radio
 * -- and nothing here touches an account, because the hosted player has none to touch.
 *
 * No audio comes through here. YouTube's own embedded player plays it in the listener's browser.
 */

const ORIGIN = 'https://music.youtube.com';

/** The version its page announced when this was written; asked for again if YouTube stops accepting it. */
let clientVersion = '1.20260928.13.00';

const FILTER = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  videos: 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D',
};

const TYPE_WORDS = new Set(['Song', 'Video', 'Single', 'EP', 'Album', 'Playlist', 'Artist', 'Episode', 'Podcast', 'Profile', 'Station']);
const COUNT = /\b(views?|plays?|likes?|subscribers?|monthly audience|songs?|tracks?|episodes?)\b/i;
const YEAR = /^\d{4}$/;

async function refreshVersion(): Promise<boolean> {
  try {
    const page = await fetch(`${ORIGIN}/`, {
      headers: { 'User-Agent': BROWSER_AGENT, Cookie: 'SOCS=CAI' },
      signal: AbortSignal.timeout(8000),
    }).then((r) => r.text());
    const found = /"INNERTUBE_CLIENT_VERSION":"([^"]+)"/.exec(page)?.[1];
    if (!found || found === clientVersion) return false;
    clientVersion = found;
    return true;
  } catch {
    return false;
  }
}

async function call(endpoint: string, body: Record<string, unknown>, locale: Locale): Promise<any> {
  const send = () =>
    fetch(`${ORIGIN}/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_AGENT,
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        Cookie: 'SOCS=CAI',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB_REMIX', clientVersion, hl: locale.hl, gl: locale.gl } },
        ...body,
      }),
      signal: AbortSignal.timeout(12000),
    });
  let response = await send();
  if ((response.status === 400 || response.status === 404) && (await refreshVersion())) response = await send();
  if (!response.ok) throw new Upstream(`YouTube Music answered ${response.status}`);
  return response.json();
}

// ---------------------------------------------------------------- reading

type Json = any;

function runs(node: Json): string | undefined {
  const parts: Json[] | undefined = node?.runs;
  if (parts) return parts.map((r) => r.text ?? '').join('').trim() || undefined;
  return typeof node?.simpleText === 'string' ? node.simpleText.trim() || undefined : undefined;
}

function collect(node: Json, name: string, into: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((n) => collect(n, name, into));
  else if (node && typeof node === 'object') {
    if (node[name]) into.push(node[name]);
    for (const key in node) if (key !== name) collect(node[key], name, into);
  }
  return into;
}

function find(node: Json, name: string): Json | undefined {
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = find(n, name);
      if (hit !== undefined) return hit;
    }
  } else if (node && typeof node === 'object') {
    if (node[name] !== undefined) return node[name];
    for (const key in node) {
      const hit = find(node[key], name);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

function lastThumbnail(node: Json): string | undefined {
  const list: Json[] | undefined =
    node?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? node?.thumbnails ?? node?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails;
  return list?.[list.length - 1]?.url;
}

function pageType(endpoint: Json): string | undefined {
  return endpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
}

/** A column's runs split into fields at " • ", each field a list of the runs in it. */
function fields(column: Json): Json[][] {
  const out: Json[][] = [];
  let current: Json[] = [];
  for (const run of column?.text?.runs ?? []) {
    const text = String(run.text ?? '').trim();
    if (text === '•') {
      out.push(current);
      current = [];
    } else if (text && text !== ',' && text !== '&' && text !== '/') current.push(run);
  }
  out.push(current);
  return out.filter((f) => f.length);
}

const fieldText = (field: Json[]) => field.map((r) => String(r.text).trim()).join(', ');

function columnsOf(row: Json): Json[] {
  return (row.flexColumns ?? []).map((c: Json) => c.musicResponsiveListItemFlexColumnRenderer).filter(Boolean);
}

function songProvider(row: Json, fallback: Provider): Provider {
  const type = find(row, 'musicVideoType');
  if (type === 'MUSIC_VIDEO_TYPE_ATV') return 'YOUTUBE_MUSIC';
  if (type === 'MUSIC_VIDEO_TYPE_OMV' || type === 'MUSIC_VIDEO_TYPE_UGC') return fallback === 'YOUTUBE_MUSIC' ? 'YOUTUBE_MUSIC' : 'YOUTUBE_VIDEO';
  return fallback;
}

function sourceUrl(provider: Provider, id: string) {
  return provider === 'YOUTUBE_VIDEO' ? `https://www.youtube.com/watch?v=${id}` : `${ORIGIN}/watch?v=${id}`;
}

/** One row of a song list, from search, a playlist or an album. */
function songFromRow(row: Json, provider: Provider): Track | undefined {
  if (row.musicItemRendererDisplayPolicy === 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT') return undefined;
  const columns = columnsOf(row);
  const title = runs(columns[0]?.text);
  const videoId: string | undefined =
    row.playlistItemData?.videoId ?? columns[0]?.text?.runs?.find((r: Json) => r.navigationEndpoint?.watchEndpoint)?.navigationEndpoint.watchEndpoint.videoId;
  if (!title || !videoId) return undefined;

  let parts = fields(columns[1]);
  // Search's mixed list says what each row is first: "Song • Daft Punk • 1.2B plays".
  if (parts[0]?.length === 1 && TYPE_WORDS.has(String(parts[0][0].text).trim())) parts = parts.slice(1);
  let length: number | undefined;
  const last = parts[parts.length - 1];
  if (last?.length === 1 && durationMs(last[0].text) != null) {
    length = durationMs(last[0].text);
    parts = parts.slice(0, -1);
  }
  length ??= durationMs(runs(row.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text));
  parts = parts.filter((f) => !(f.length === 1 && (COUNT.test(f[0].text) || YEAR.test(String(f[0].text).trim()))));

  const albumRun = (columns[1]?.text?.runs ?? []).concat(columns[2]?.text?.runs ?? []).find((r: Json) => pageType(r.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ALBUM');
  const artistField = parts.find((f) => !f.some((r) => pageType(r.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ALBUM')) ?? [];
  const names = artistField.map((r) => String(r.text).trim()).filter(Boolean);
  const kind = songProvider(row, provider);
  const artists: Artist[] = names.map((name, i) =>
    artist(kind, name, artistField[i]?.navigationEndpoint?.browseEndpoint?.browseId),
  );
  let albumTitle: string | undefined = albumRun ? String(albumRun.text).trim() : undefined;
  // A playlist's rows put the album in a third column of its own.
  if (!albumTitle && columns.length >= 3) {
    const third = runs(columns[2]?.text);
    if (third && !COUNT.test(third)) albumTitle = third;
  }
  const artwork = lastThumbnail(row.thumbnail);
  const albumId = albumRun?.navigationEndpoint?.browseEndpoint?.browseId;
  return track(kind, videoId, title, artists, {
    album: albumTitle ? { id: albumId ?? `YOUTUBE_MUSIC:album:${albumTitle}`, title: albumTitle, artists, provider: 'YOUTUBE_MUSIC', artworkUrl: artwork } : undefined,
    durationMs: length,
    artworkUrl: artwork,
    sourceUrl: sourceUrl(kind, videoId),
  });
}

function songs(node: Json, provider: Provider): Track[] {
  return unique(
    collect(node, 'musicResponsiveListItemRenderer').map((row) => songFromRow(row, provider)).filter((t): t is Track => !!t),
    (t) => t.id,
  );
}

function playlistKey(playlistId: string) {
  return `yt:${playlistId.replace(/^VL/, '')}`;
}

/** The playlist id a card or row would play, wherever in it the play button keeps it. */
function playId(node: Json): string | undefined {
  const id = find(node, 'playlistId');
  return typeof id === 'string' && id ? id : undefined;
}

/** An album, playlist or artist row from search's mixed list. */
function browseRow(row: Json): { album?: Album; playlist?: Playlist; artist?: Artist } {
  const endpoint = row.navigationEndpoint;
  const type = pageType(endpoint);
  const browseId: string | undefined = endpoint?.browseEndpoint?.browseId;
  if (!type || !browseId) return {};
  const columns = columnsOf(row);
  const title = runs(columns[0]?.text);
  if (!title) return {};
  let parts = fields(columns[1]);
  if (parts[0]?.length === 1 && TYPE_WORDS.has(String(parts[0][0].text).trim())) parts = parts.slice(1);
  const byline = parts.filter((f) => !(f.length === 1 && (COUNT.test(f[0].text) || YEAR.test(String(f[0].text).trim()))))[0];
  const artwork = lastThumbnail(row.thumbnail);
  // Profiles -- people who upload, rather than artists -- are left out, as YouTube Music's own Artists tab does.
  if (type === 'MUSIC_PAGE_TYPE_ARTIST') {
    return { artist: { id: browseId, name: title, provider: 'YOUTUBE_MUSIC' } };
  }
  if (type === 'MUSIC_PAGE_TYPE_ALBUM') {
    const id = playId(row.overlay) ?? playId(row);
    if (!id) return {};
    const artists = (byline ?? []).map((r) => artist('YOUTUBE_MUSIC', String(r.text).trim(), r.navigationEndpoint?.browseEndpoint?.browseId));
    return { album: { id: playlistKey(id), title, artists, provider: 'YOUTUBE_MUSIC', artworkUrl: artwork } };
  }
  if (type === 'MUSIC_PAGE_TYPE_PLAYLIST') {
    const id = browseId.replace(/^VL/, '');
    return {
      playlist: {
        key: playlistKey(id), id, title, provider: 'YOUTUBE_MUSIC', ownerName: byline ? fieldText(byline) : undefined,
        artworkUrl: artwork, editable: false, sourceUrl: `${ORIGIN}/playlist?list=${id}`,
      },
    };
  }
  return {};
}

/** One card from a home row or a grid: a playlist or album to open, or a single song or video to play. */
function card(item: Json): { playlist?: Playlist; track?: Track } {
  const title = runs(item.title);
  if (!title) return {};
  const artwork = lastThumbnail(item.thumbnailRenderer);
  const subtitle = runs(item.subtitle);
  const watch = item.navigationEndpoint?.watchEndpoint;
  if (watch?.videoId) {
    const provider: Provider = watch.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType === 'MUSIC_VIDEO_TYPE_ATV' ? 'YOUTUBE_MUSIC' : 'YOUTUBE_VIDEO';
    const names = (item.subtitle?.runs ?? [])
      .filter((r: Json) => r.navigationEndpoint?.browseEndpoint)
      .map((r: Json) => artist(provider, String(r.text).trim(), r.navigationEndpoint.browseEndpoint.browseId));
    return { track: track(provider, watch.videoId, title, names.length ? names : subtitle ? [artist(provider, subtitle.split(' • ')[0])] : [], { artworkUrl: artwork, sourceUrl: sourceUrl(provider, watch.videoId) }) };
  }
  const type = pageType(item.navigationEndpoint);
  if (type && type !== 'MUSIC_PAGE_TYPE_PLAYLIST' && type !== 'MUSIC_PAGE_TYPE_ALBUM') return {};
  const id = playId(item.thumbnailOverlay) ?? playId(item.menu) ?? item.navigationEndpoint?.browseEndpoint?.browseId?.replace(/^VL/, '');
  if (!id || id.startsWith('MPRE')) return {};
  return {
    playlist: {
      key: playlistKey(id), id, title, provider: 'YOUTUBE_MUSIC', ownerName: subtitle, artworkUrl: artwork,
      editable: false, sourceUrl: `${ORIGIN}/playlist?list=${id}`,
    },
  };
}

function shelfTitle(shelf: Json): string | undefined {
  return runs(shelf.header?.musicCarouselShelfBasicHeaderRenderer?.title)
    ?? runs(shelf.title)
    ?? runs(shelf.header?.gridHeaderRenderer?.title)
    ?? runs(shelf.header?.musicImmersiveCarouselShelfBasicHeaderRenderer?.title);
}

function shelves(node: Json, prefix: string): Section[] {
  const out: Section[] = [];
  const read = (shelf: Json, items: Json[]) => {
    const title = shelfTitle(shelf);
    if (!title) return;
    const cards = items.map((i) => (i.musicTwoRowItemRenderer ? card(i.musicTwoRowItemRenderer) : {}));
    const rows = items.map((i) => i.musicResponsiveListItemRenderer).filter(Boolean).map((r: Json) => songFromRow(r, 'YOUTUBE_MUSIC'));
    const tracks = unique([...cards.map((c) => c.track), ...rows].filter((t): t is Track => !!t), (t) => t.id);
    const playlists = unique(cards.map((c) => c.playlist).filter((p): p is Playlist => !!p), (p) => p.key);
    if (tracks.length || playlists.length) {
      out.push({ id: `${prefix}:${out.length}:${title}`, title, provider: 'YOUTUBE_MUSIC', tracks, playlists });
    }
  };
  collect(node, 'musicCarouselShelfRenderer').forEach((s) => read(s, s.contents ?? []));
  collect(node, 'gridRenderer').forEach((s) => read(s, s.items ?? []));
  return out;
}

function continuation(node: Json): string | undefined {
  const token = find(node, 'continuationCommand')?.token ?? find(node, 'nextContinuationData')?.continuation;
  return typeof token === 'string' && token ? token : undefined;
}

// ---------------------------------------------------------------- asking

export interface Found { tracks: Track[]; playlists: Playlist[]; albums: Album[]; artists: Artist[] }

export async function search(query: string, videos: boolean, locale: Locale): Promise<Found> {
  if (videos) {
    const reply = await call('search', { query, params: FILTER.videos }, locale);
    return { tracks: songs(reply, 'YOUTUBE_VIDEO'), playlists: [], albums: [], artists: [] };
  }
  const [songReply, mixed] = await Promise.all([
    call('search', { query, params: FILTER.songs }, locale),
    call('search', { query }, locale).catch(() => undefined),
  ]);
  const found: Found = { tracks: songs(songReply, 'YOUTUBE_MUSIC'), playlists: [], albums: [], artists: [] };
  if (mixed) {
    const top = find(mixed, 'musicCardShelfRenderer');
    const topType = pageType(top?.title?.runs?.[0]?.navigationEndpoint);
    if (top && topType === 'MUSIC_PAGE_TYPE_ARTIST') {
      found.artists.push({ id: top.title.runs[0].navigationEndpoint.browseEndpoint.browseId, name: runs(top.title)!, provider: 'YOUTUBE_MUSIC' });
    }
    for (const row of collect(mixed, 'musicResponsiveListItemRenderer')) {
      const { album, playlist, artist: who } = browseRow(row);
      if (album) found.albums.push(album);
      if (playlist) found.playlists.push(playlist);
      if (who) found.artists.push(who);
    }
    found.albums = unique(found.albums, (a) => `${a.title}|${a.artists[0]?.name ?? ''}`);
    found.playlists = unique(found.playlists, (p) => p.key);
    found.artists = unique(found.artists, (a) => a.id);
  }
  return found;
}

/** A playlist or an album, whole, with a page of continuation at a time up to [limit] tracks. */
export async function playlist(id: string, locale: Locale, limit = 1000): Promise<Playlist> {
  const browseId = id.startsWith('MPRE') || id.startsWith('VL') ? id : `VL${id}`;
  const first = await call('browse', { browseId }, locale);
  if (first.error || first.alerts?.some((a: Json) => a.alertRenderer?.type === 'ERROR')) {
    throw new Upstream('YouTube Music has no such playlist, or it is private');
  }
  const header = find(first, 'musicResponsiveHeaderRenderer') ?? find(first, 'musicDetailHeaderRenderer') ?? find(first, 'musicImmersiveHeaderRenderer') ?? {};
  const tracks = songs(first, 'YOUTUBE_MUSIC');
  // Signed out, an album's playlist comes with no header at all; its songs still say which album they are.
  const albums = new Set(tracks.map((t) => t.album?.title));
  const album = albums.size === 1 ? tracks[0]?.album : undefined;
  const title = runs(header.title) ?? album?.title ?? 'Playlist';
  const owner = runs(header.straplineTextOne)
    ?? header.facepile?.avatarStackViewModel?.text?.content
    ?? runs(header.subtitle)?.split(' • ').find((p) => !TYPE_WORDS.has(p) && !YEAR.test(p))
    ?? (album ? tracks[0]?.artistLine : undefined);
  const artwork = lastThumbnail(header.thumbnail);
  const declared = /([\d,.]+)\s+(songs?|tracks?|videos?|episodes?)/i.exec(runs(header.secondSubtitle) ?? runs(header.subtitle) ?? '')?.[1];

  let token = continuation(first);
  for (let page = 0; token && tracks.length < limit && page < 12; page++) {
    const next = await call('browse', { continuation: token }, locale).catch(() => undefined);
    if (!next) break;
    const more = songs(next, 'YOUTUBE_MUSIC').filter((t) => !tracks.some((x) => x.id === t.id));
    if (!more.length) break;
    tracks.push(...more);
    const following = continuation(next);
    token = following && following !== token ? following : undefined;
  }
  const realId = id.replace(/^VL/, '');
  return {
    key: playlistKey(realId),
    id: realId,
    title,
    provider: 'YOUTUBE_MUSIC',
    ownerName: owner,
    artworkUrl: artwork ?? tracks[0]?.artworkUrl,
    trackCount: declared ? Number(declared.replace(/[,.]/g, '')) || tracks.length : tracks.length,
    editable: false,
    sourceUrl: `${ORIGIN}/playlist?list=${realId}`,
    tracks: tracks.slice(0, limit),
  };
}

/** YouTube Music's home page as a signed-out visitor sees it, with its new releases after it. */
export async function home(locale: Locale): Promise<Section[]> {
  const first = await call('browse', { browseId: 'FEmusic_home' }, locale);
  const sections = shelves(first, 'home');
  let token = continuation(first);
  for (let page = 0; token && page < 2; page++) {
    const next = await call('browse', { continuation: token }, locale).catch(() => undefined);
    if (!next) break;
    sections.push(...shelves(next, `home${page}`));
    token = continuation(next);
  }
  const releases = await call('browse', { browseId: 'FEmusic_new_releases' }, locale).catch(() => undefined);
  if (releases) sections.push(...shelves(releases, 'new').filter((s) => s.playlists.length || s.tracks.length));
  return unique(sections, (s) => s.title);
}

function panelTrack(item: Json): Track | undefined {
  const id = item.videoId;
  const title = runs(item.title);
  if (!id || !title) return undefined;
  const byline = fields({ text: item.longBylineText });
  const provider: Provider = find(item, 'musicVideoType') === 'MUSIC_VIDEO_TYPE_ATV' ? 'YOUTUBE_MUSIC' : 'YOUTUBE_VIDEO';
  const names = (byline[0] ?? []).map((r) => artist(provider, String(r.text).trim(), r.navigationEndpoint?.browseEndpoint?.browseId));
  const albumRun = byline.flat().find((r) => pageType(r.navigationEndpoint) === 'MUSIC_PAGE_TYPE_ALBUM');
  const artwork = lastThumbnail(item.thumbnail);
  return track(provider, id, title, names, {
    album: albumRun ? { id: albumRun.navigationEndpoint.browseEndpoint.browseId, title: String(albumRun.text), artists: names, provider: 'YOUTUBE_MUSIC', artworkUrl: artwork } : undefined,
    durationMs: durationMs(runs(item.lengthText)),
    artworkUrl: artwork,
    sourceUrl: sourceUrl(provider, id),
  });
}

/** The radio YouTube Music would play after [videoId]: fifty songs like it, the song itself first. */
export async function radio(videoId: string, locale: Locale): Promise<Track[]> {
  const reply = await call('next', { videoId, playlistId: `RDAMVM${videoId}`, isAudioOnly: true }, locale);
  return unique(collect(reply, 'playlistPanelVideoRenderer').map(panelTrack).filter((t): t is Track => !!t), (t) => t.id);
}

/** One video or song by its id, as the player's own queue describes it. */
export async function single(videoId: string, locale: Locale): Promise<Track | undefined> {
  const reply = await call('next', { videoId, isAudioOnly: true }, locale);
  const items = collect(reply, 'playlistPanelVideoRenderer').map(panelTrack).filter((t): t is Track => !!t);
  return items.find((t) => t.id === videoId) ?? items[0];
}

/** The playlist an album page plays, for a link to `browse/MPRE…`. */
export async function albumPlaylist(browseId: string, locale: Locale): Promise<string | undefined> {
  const reply = await call('browse', { browseId }, locale);
  return playId(reply);
}
