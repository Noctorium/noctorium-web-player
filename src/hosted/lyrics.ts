import type { LyricLine, Lyrics, LyricsSource, Track } from '../types';

/*
 * Lyrics for the hosted player, asked for straight from this browser: the sources among Base's eight that
 * answer any page and need no key of Noctorium's -- LRCLIB, Karalyr and lyrics.ovh -- and Genius, which only
 * ever links to its page. The asking and the reading are ports of Base's LyricsProviders.kt and LyricsParser.kt.
 */

interface Query { title: string; artist: string; album?: string; seconds?: number }

function queryFor(track: Track): Query {
  const first = track.artists[0]?.name;
  const artist = first && !first.startsWith('YouTube') ? first : track.artistLine;
  const escaped = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const title = track.title
    .replace(/\s*[|\-–—]\s*(official\s+)?(music\s+)?(video|audio|lyrics?|visuali[sz]er).*$/i, '')
    .replace(/\s*[[(](official\s+)?(music\s+)?(video|audio|lyrics?|visuali[sz]er)[\])].*$/i, '')
    .trim()
    .replace(new RegExp(`^${escaped}\\s*[-–—:]\\s*`, 'i'), '')
    .trim();
  return { title, artist, album: track.album?.title, seconds: track.durationMs ? Math.round(track.durationMs / 1000) : undefined };
}

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?]/g;
const WORD_STAMP = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g;

/** LRC to lines, timed when any line carries a time; otherwise the plain text, line by line. */
export function fromLrc(synced?: string | null, plain?: string | null): { lines: LyricLine[]; synced: boolean } {
  const timed: LyricLine[] = [];
  for (const raw of (synced ?? '').split(/\r?\n/)) {
    const stamps = [...raw.matchAll(STAMP)];
    const text = raw.replace(STAMP, '').replace(WORD_STAMP, '').trim();
    if (!text) continue;
    for (const m of stamps) {
      const fraction = m[3] ?? '';
      const ms = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction.slice(0, 3).padEnd(3, '0') || 0);
      timed.push({ text, startMs: (Number(m[1]) * 60 + Number(m[2])) * 1000 + ms });
    }
  }
  if (timed.length) return { lines: timed.sort((a, b) => a.startMs! - b.startMs!), synced: true };
  return { lines: (plain ?? '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim()).map((text) => ({ text })), synced: false };
}

/** A handful of words is a placeholder somebody uploaded, not the lyrics. */
function substantial(lines: LyricLine[]) {
  return lines.length >= 3 && lines.reduce((n, l) => n + l.text.length, 0) >= 40;
}

type Outcome = Pick<LyricsSource, 'status' | 'synced' | 'lines' | 'sourceUrl' | 'attribution' | 'message' | 'detail'>;

const notFound = (detail = 'No match'): Outcome => ({ status: 'not_found', synced: false, lines: [], detail });

function found(lines: LyricLine[], synced: boolean, sourceUrl: string, attribution: string, short = false): Outcome {
  if (!lines.length) return notFound();
  if (!short && !substantial(lines)) return notFound('Result was too short to trust');
  return { status: 'found', synced, lines, sourceUrl, attribution };
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  return { status: response.status, body: response.ok ? await response.json() : undefined };
}

const params = (p: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));

const normal = (s?: string) => (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function lrclib(q: Query): Promise<Outcome> {
  const read = (root: any): Outcome => {
    if (root.instrumental) return found([{ text: '♪ Instrumental track ♪' }], false, 'https://lrclib.net', 'LRCLIB', true);
    const { lines, synced } = fromLrc(root.syncedLyrics, root.plainLyrics);
    return found(lines, synced, root.id ? `https://lrclib.net/api/get/${root.id}` : 'https://lrclib.net', 'Lyrics from LRCLIB');
  };
  const exact = await getJson(`https://lrclib.net/api/get?${params({ track_name: q.title, artist_name: q.artist, album_name: q.album, duration: q.seconds })}`);
  const first = exact.status === 200 ? read(exact.body) : notFound('No exact match');
  if (first.status === 'found') return first;
  // The exact match can be a stub when complete synced versions exist; the search is ranked for those.
  const search = await getJson(`https://lrclib.net/api/search?${params({ track_name: q.title, artist_name: q.artist })}`);
  if (search.status !== 200 || !Array.isArray(search.body)) return first;
  let best: Outcome | undefined;
  let score = -1;
  for (const root of search.body) {
    const outcome = read(root);
    if (outcome.status !== 'found') continue;
    const title = normal(root.trackName), wanted = normal(q.title);
    const who = normal(root.artistName), artist = normal(q.artist);
    const s = (title === wanted ? 120 : title.includes(wanted) || wanted.includes(title) ? 70 : 0)
      + (who === artist ? 90 : who.includes(artist) || artist.includes(who) ? 55 : 0)
      + (q.seconds && root.duration ? 35 - Math.min(35, Math.abs(Math.round(root.duration) - q.seconds)) : 0)
      + Math.min(35, outcome.lines.length) + (outcome.synced ? 30 : 10);
    if (s > score) { score = s; best = outcome; }
  }
  return best ? { ...best, detail: 'Matched from LRCLIB search' } : first;
}

async function karalyr(q: Query): Promise<Outcome> {
  const reply = await getJson(`https://www.karalyr.com/api/get?${params({ track_name: q.title, artist_name: q.artist, album_name: q.album, duration: q.seconds })}`);
  if (reply.status === 404) return notFound('No karaoke match');
  if (reply.status !== 200) throw new Error(`Karalyr answered ${reply.status}`);
  const { lines, synced } = fromLrc(reply.body.syncedLyrics, reply.body.plainLyrics);
  return found(lines, synced, 'https://karalyr.com', 'Word-synced lyrics from Karalyr');
}

async function ovh(q: Query): Promise<Outcome> {
  const reply = await getJson(`https://api.lyrics.ovh/v1/${encodeURIComponent(q.artist)}/${encodeURIComponent(q.title)}`);
  if (reply.status === 404) return notFound();
  if (reply.status !== 200) throw new Error(`lyrics.ovh answered ${reply.status}`);
  const { lines, synced } = fromLrc(null, reply.body.lyrics);
  return found(lines, synced, 'https://lyrics.ovh', 'Lyrics from lyrics.ovh');
}

async function genius(q: Query): Promise<Outcome> {
  return {
    status: 'link_only', synced: false, lines: [],
    sourceUrl: `https://genius.com/search?q=${encodeURIComponent(`${q.artist} ${q.title}`)}`,
    attribution: 'Genius',
    message: 'Genius does not give out its lyrics; open its page for them.',
  };
}

const PROVIDERS: [string, string, (q: Query) => Promise<Outcome>][] = [
  ['LRCLIB', 'LRCLIB', lrclib],
  ['KARALYR', 'Karalyr', karalyr],
  ['LYRICS_OVH', 'lyrics.ovh', ovh],
  ['GENIUS', 'Genius', genius],
];

export const lyricSources = PROVIDERS.map(([id, name]) => [id, name] as const);

/** The source to show: the listener's pick when it has them, else synced before plain, in the order above. */
export function choose(sources: LyricsSource[], preferred?: string): string | undefined {
  const has = (s: LyricsSource) => s.status === 'found';
  return sources.find((s) => s.provider === preferred && has(s))?.provider
    ?? sources.find((s) => has(s) && s.synced)?.provider
    ?? sources.find(has)?.provider
    ?? sources.find((s) => s.status === 'link_only')?.provider;
}

/** Asks every source at once, telling [update] as each answers. */
export async function findLyrics(track: Track, preferred: string | undefined, update: (lyrics: Lyrics) => void): Promise<void> {
  const q = queryFor(track);
  const sources: LyricsSource[] = PROVIDERS.map(([provider, name]) => ({ provider, name, status: 'searching', synced: false, lines: [] }));
  const publish = (loading: boolean) => update({ trackKey: track.key, loading, sources: sources.slice(), selected: choose(sources, preferred) });
  publish(true);
  await Promise.all(PROVIDERS.map(async ([provider, , ask], i) => {
    let outcome: Outcome;
    try {
      outcome = await ask(q);
    } catch (error) {
      outcome = { status: 'error', synced: false, lines: [], detail: error instanceof Error ? error.message : 'It failed' };
    }
    sources[i] = { ...sources[i], ...outcome, provider };
    publish(sources.some((s) => s.status === 'searching'));
  }));
}
