import { useEffect } from 'react';
import { Play, Search as SearchIcon, User } from 'lucide-react';
import { send, usePart } from '../live';
import { useRoute, go } from '../router';
import { bigArtwork, cls, providerName } from '../util';
import { Badge, Cover, Empty, Spinner } from '../components/Common';
import { PlaylistCard, Shelf } from '../components/Cards';
import { TrackList } from '../components/Tracks';
import type { Search as SearchState } from '../types';

const modes: [SearchState['mode'], string][] = [['HYBRID', 'Both'], ['YOUTUBE_MUSIC', 'YouTube Music'], ['SOUNDCLOUD', 'SoundCloud'], ['YOUTUBE_VIDEO', 'YouTube videos']];

export function Search() {
  const route = useRoute();
  const search = usePart('search');
  const query = route.query.get('q') ?? '';

  useEffect(() => {
    if (query && query !== search?.query) send('search', { query });
  }, [query]);

  if (!query) {
    return <Empty icon={<SearchIcon size={44} />} title="Find something to play">Both services at once — or paste a link from either.</Empty>;
  }
  const top = search?.tracks[0];
  return (
    <>
      <div className="chips" style={{ marginTop: 14 }}>
        {modes.map(([mode, label]) => (
          <button key={mode} className={cls('chip', search?.mode === mode && 'on')} onClick={() => send('searchMode', { mode })}>{label}</button>
        ))}
        {search?.loading && <Spinner />}
      </div>
      {top && (
        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 28, marginTop: 24 }} className="top-result">
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
      {search?.playlists.length ? <Shelf title="Playlists">{search.playlists.map((p) => <PlaylistCard key={p.key} playlist={p} />)}</Shelf> : null}
      {search?.albums.length ? (
        <Shelf title="Albums">
          {search.albums.map((a) => (
            <div key={a.id} className="card" role="button" tabIndex={0} onClick={() => go(`/search?q=${encodeURIComponent(`${a.title} ${a.artists[0]?.name ?? ''}`.trim())}`)}>
              <Cover url={bigArtwork(a.artworkUrl, 352)} />
              <div className="card-title ellipsis">{a.title}</div>
              <div className="card-sub ellipsis">{a.artists.map((x) => x.name).join(', ') || providerName[a.provider]}</div>
            </div>
          ))}
        </Shelf>
      ) : null}
      {search?.artists.length ? (
        <Shelf title="Artists">
          {search.artists.map((a) => (
            <div key={`${a.provider}:${a.id}`} className="card" role="button" tabIndex={0} style={{ textAlign: 'center' }} onClick={() => go(`/search?q=${encodeURIComponent(a.name)}`)}>
              <div className="cover" style={{ borderRadius: '50%', display: 'grid', placeItems: 'center' }}><User size={52} className="faint" /></div>
              <div className="card-title ellipsis">{a.name}</div>
              <div className="card-sub">{providerName[a.provider]}</div>
            </div>
          ))}
        </Shelf>
      ) : null}
      {search && !search.loading && search.query === query && !search.tracks.length && !search.playlists.length && (
        <Empty icon={<SearchIcon size={44} />} title={`Nothing for “${query}”`}>Try fewer words, or the other service.</Empty>
      )}
    </>
  );
}
