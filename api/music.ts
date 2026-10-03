import { interleave, Upstream, type Locale } from './_lib/common.js';
import * as soundcloud from './_lib/soundcloud.js';
import * as youtube from './_lib/youtube.js';

/*
 * The hosted player's one function: what a page cannot ask YouTube Music or SoundCloud itself, because neither
 * answers another site's page. It answers in the page's own shapes (src/types.ts), and only ever with lists
 * and addresses -- never audio, which the listener's browser fetches from the services directly.
 *
 *   ?op=search&q=…&mode=HYBRID|YOUTUBE_MUSIC|SOUNDCLOUD|YOUTUBE_VIDEO
 *   ?op=home
 *   ?op=playlist&key=yt:<id> | sc:pl:<id> | sc:sys:<urn> | sc:url:<address>
 *   ?op=radio&key=<provider>:<id>
 *   ?op=stream&id=<SoundCloud track id>
 *   ?op=link&url=<a YouTube, YouTube Music or SoundCloud address>
 *
 * hl and gl, from the browser's language, say which language and which country's catalogue to ask for.
 */

function json(body: unknown, maxAge: number, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // The same search from anyone is the same answer, so the edge keeps it a while.
      'Cache-Control': maxAge > 0 ? `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 6}` : 'no-store',
    },
  });
}

function locale(url: URL): Locale {
  const hl = url.searchParams.get('hl') ?? 'en';
  const gl = url.searchParams.get('gl') ?? 'US';
  return {
    hl: /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(hl) ? hl : 'en',
    gl: /^[A-Z]{2}$/.test(gl) ? gl : 'US',
  };
}

function youTubeId(address: URL): string | undefined {
  if (address.hostname === 'youtu.be') return address.pathname.slice(1).split('/')[0] || undefined;
  return address.searchParams.get('v') ?? /^\/(shorts|embed|live)\/([\w-]{11})/.exec(address.pathname)?.[2] ?? undefined;
}

async function link(text: string, where: Locale) {
  const address = new URL(/^https?:\/\//.test(text) ? text : `https://${text}`);
  const host = address.hostname.replace(/^(www|m)\./, '');
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') return soundcloud.resolve(address.toString());
  if (host === 'music.youtube.com' || host === 'youtube.com' || host === 'youtu.be') {
    const list = address.searchParams.get('list');
    const video = youTubeId(address);
    // A song opened from a playlist plays the song; the playlist link on its own opens the playlist.
    if (video) {
      const found = await youtube.single(video, where);
      if (!found) throw new Upstream('YouTube has no such video');
      return { track: found };
    }
    if (list) return { playlist: { key: `yt:${list}` } };
    const browse = /^\/browse\/(MPRE[\w-]+)/.exec(address.pathname)?.[1];
    if (browse) {
      const id = await youtube.albumPlaylist(browse, where);
      if (id) return { playlist: { key: `yt:${id}` } };
    }
  }
  throw new Upstream('Noctorium opens YouTube, YouTube Music and SoundCloud links');
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const where = locale(url);
  try {
    switch (url.searchParams.get('op')) {
      case 'search': {
        const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
        if (!q) return json({ tracks: [], playlists: [], albums: [], artists: [] }, 3600);
        const mode = url.searchParams.get('mode') ?? 'HYBRID';
        if (mode === 'SOUNDCLOUD') return json({ ...(await soundcloud.search(q)), albums: [] }, 900);
        if (mode === 'YOUTUBE_MUSIC' || mode === 'YOUTUBE_VIDEO') return json(await youtube.search(q, mode === 'YOUTUBE_VIDEO', where), 900);
        // Both: whichever answers, side by side, so one service being down still leaves the other.
        const [yt, sc] = await Promise.allSettled([youtube.search(q, false, where), soundcloud.search(q)]);
        if (yt.status === 'rejected' && sc.status === 'rejected') throw yt.reason;
        const a = yt.status === 'fulfilled' ? yt.value : { tracks: [], playlists: [], albums: [], artists: [] };
        const b = sc.status === 'fulfilled' ? sc.value : { tracks: [], playlists: [], artists: [] };
        return json({
          tracks: interleave(a.tracks, b.tracks),
          playlists: interleave(a.playlists, b.playlists),
          albums: a.albums,
          artists: interleave(a.artists, b.artists),
        }, 900);
      }
      case 'home': {
        const [yt, sc] = await Promise.allSettled([youtube.home(where), soundcloud.home()]);
        if (yt.status === 'rejected' && sc.status === 'rejected') throw yt.reason;
        const sections = [...(yt.status === 'fulfilled' ? yt.value : []), ...(sc.status === 'fulfilled' ? sc.value : [])];
        return json({ sections }, 1800);
      }
      case 'playlist': {
        const key = url.searchParams.get('key') ?? '';
        if (key.startsWith('yt:')) return json(await youtube.playlist(key.slice(3), where), 900);
        if (key.startsWith('sc:')) return json(await soundcloud.playlist(key.slice(3)), 900);
        throw new Upstream('No such playlist');
      }
      case 'radio': {
        const key = url.searchParams.get('key') ?? '';
        const [provider, ...rest] = key.split(':');
        const id = rest.join(':');
        if (provider === 'SOUNDCLOUD') return json({ tracks: await soundcloud.radio(id) }, 3600);
        if (provider === 'YOUTUBE_MUSIC' || provider === 'YOUTUBE_VIDEO') return json({ tracks: await youtube.radio(id, where) }, 3600);
        throw new Upstream('No radio for that');
      }
      case 'stream': {
        const id = url.searchParams.get('id') ?? '';
        if (!/^\d+$/.test(id)) throw new Upstream('No such track');
        // Signed addresses last a couple of hours; never hand out one somebody else was given earlier.
        return json(await soundcloud.stream(id), 0);
      }
      case 'link': {
        const text = (url.searchParams.get('url') ?? '').trim();
        if (!text) throw new Upstream('Paste a link');
        return json(await link(text, where), 600);
      }
      default:
        return json({ error: 'Unknown request' }, 0, 400);
    }
  } catch (error) {
    const message = error instanceof Upstream ? error.message
      : error instanceof Error && error.name === 'TimeoutError' ? 'The service took too long to answer'
        : 'The service could not be reached';
    if (!(error instanceof Upstream)) console.error(error);
    return json({ error: message }, 0, 502);
  }
}
