import { useEffect } from 'react';
import { Play, Search as SearchIcon, User } from 'lucide-react';
import { send, usePart } from '../live';
import { useRoute, go } from '../router';
import { bigArtwork, cls, isArtist, providerName } from '../util';
import { Badge, Cover, Empty, Spinner } from '../components/Common';
import { PlaylistCard, Shelf } from '../components/Cards';
import { TrackList } from '../components/Tracks';
import type { Search as SearchState } from '../types';
import { HOSTED } from '../mode';

/**
 * Bandcamp, Spotify and VK are read by Noctorium itself, so the hosted player, which has none behind it,
 * searches the other two.
 */
const modes: [SearchState['mode'], string][] = HOSTED
  ? [['HYBRID', 'Both'], ['YOUTUBE_MUSIC', 'YouTube Music'], ['SOUNDCLOUD', 'SoundCloud'], ['YOUTUBE_VIDEO', 'YouTube videos']]
  : [
    ['HYBRID', 'All'], ['YOUTUBE_MUSIC', 'YouTube Music'], ['SOUNDCLOUD', 'SoundCloud'], ['YOUTUBE_VIDEO', 'YouTube videos'],
    ['BANDCAMP', 'Bandcamp'], ['SPOTIFY', 'Spotify'], ['VK', 'VK Music'],
  ];

/**
 * The services whose search answers with albums and artists as playlists, which is how they open -- and with
 * the same again as bare names, which are left out for them.
 */
const opened = new Set<string>(['BANDCAMP', 'SPOTIFY']);

export function Search() {
  const route = useRoute();
  const search = usePart('search');
  const query = route.query.get('q') ?? '';

  useEffect(() => {
    if (query && query !== search?.query) send('search', { query });
  }, [query]);

  if (!query) {
    return <Empty icon={<SearchIcon size={44} />} title="Find something to play">{HOSTED ? 'Both services at once — or paste a link from either.' : 'Every service at once — or paste a link from any of them.'}</Empty>;
  }
  const top = search?.tracks[0];
  // Bandcamp's and Spotify's albums and artists come as playlists, which is how they open, and are shown as what
  // they are. They come a second time as bare names in `albums` and `artists`, which are left out for them.
  const playlists = search?.playlists.filter((p) => !opened.has(p.provider)) ?? [];
  const releases = search?.playlists.filter((p) => opened.has(p.provider) && !isArtist(p)) ?? [];
  const bands = search?.playlists.filter(isArtist) ?? [];
  const albums = search?.albums.filter((a) => !opened.has(a.provider)) ?? [];
  const artists = search?.artists.filter((a) => !opened.has(a.provider)) ?? [];
  const nothing = !search?.tracks.length && !search?.playlists.length && !search?.albums.length && !search?.artists.length;
  return (
    <>
      <div className="chips" style={{ marginTop: 14 }}>
        {modes.map(([mode, label]) => (
          <button key={mode} className={cls('chip', search?.mode === mode && 'on')} onClick={() => send('searchMode', { mode })}>{label}</button>
        ))}
        {search?.loading && <Spinner />}
      </div>
      {top && (
        <section className="top-result">
          <div className="card" style={{ background: 'var(--card)', padding: 20, margin: 0 }} role="button" tabIndex={0}
            onClick={() => send('play', { track: top, list: search!.tracks, origin: 'SEARCH' })}>
            <Cover url={bigArtwork(top.artworkUrl, 352)} className="" />
            <h2 style={{ margin: '16px 0 4px', fontSize: 24 }} className="ellipsis">{top.title}</h2>
            <div className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Badge provider={top.provider} /> <span className="ellipsis">{top.artistLine}</span></div>
            <div style={{ marginTop: 14 }}><span className="play-fab" style={{ width: 48, height: 48 }}><Play size={20} fill="currentColor" /></span></div>
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 className="shelf-title" style={{ marginTop: 0 }}>Tracks</h2>
            <TrackList tracks={search!.tracks.slice(0, 6)} context={{ kind: 'list', origin: 'SEARCH' }} numbered={false} compact />
          </div>
        </section>
      )}
      {search && search.tracks.length > 6 && (
        <>
          <h2 className="shelf-title">More tracks</h2>
          <TrackList tracks={search.tracks.slice(6)} context={{ kind: 'list', origin: 'SEARCH' }} startIndex={6} />
        </>
      )}
      {playlists.length ? <Shelf title="Playlists">{playlists.map((p) => <PlaylistCard key={p.key} playlist={p} />)}</Shelf> : null}
      {releases.length || albums.length ? (
        <Shelf title="Albums">
          {releases.map((p) => <PlaylistCard key={p.key} playlist={p} />)}
          {albums.map((a) => (
            <div key={a.id} className="card" role="button" tabIndex={0} onClick={() => {
              // The hosted player opens an album as the playlist YouTube Music keeps of its songs.
              if (HOSTED) { send('openPlaylist', { key: a.id }); go(`/playlist/${encodeURIComponent(a.id)}`); }
              else go(`/search?q=${encodeURIComponent(`${a.title} ${a.artists[0]?.name ?? ''}`.trim())}`);
            }}>
              <Cover url={bigArtwork(a.artworkUrl, 352)} />
              <div className="card-title ellipsis">{a.title}</div>
              <div className="card-sub ellipsis">{a.artists.map((x) => x.name).join(', ') || providerName[a.provider]}</div>
            </div>
          ))}
        </Shelf>
      ) : null}
      {bands.length || artists.length ? (
        <Shelf title="Artists">
          {bands.map((p) => <PlaylistCard key={p.key} playlist={p} />)}
          {artists.map((a) => (
            <div key={`${a.provider}:${a.id}`} className="card" role="button" tabIndex={0} style={{ textAlign: 'center' }} onClick={() => go(`/search?q=${encodeURIComponent(a.name)}`)}>
              <div className="cover" style={{ borderRadius: '50%', display: 'grid', placeItems: 'center' }}><User size={52} className="faint" /></div>
              <div className="card-title ellipsis">{a.name}</div>
              <div className="card-sub">{providerName[a.provider]}</div>
            </div>
          ))}
        </Shelf>
      ) : null}
      {search && !search.loading && search.query === query && nothing && (
        <Empty icon={<SearchIcon size={44} />} title={`Nothing for “${query}”`}>{HOSTED ? 'Try fewer words, or the other service.' : 'Try fewer words, or another service.'}</Empty>
      )}
    </>
  );
}
