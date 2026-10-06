import { Disc3, RefreshCw } from 'lucide-react';
import { send, usePart } from '../live';
import { cls } from '../util';
import { Empty } from '../components/Common';
import { PlaylistCard, Shelf, TrackCard } from '../components/Cards';
import { go } from '../router';
import { HOSTED } from '../mode';
import { HostedWelcome } from '../hosted/Welcome';

/** Which service's rows Home shows, by core's names for them. Bandcamp is read by Noctorium, so not hosted. */
const filters = HOSTED
  ? [['all', 'Both services'], ['youtube_music', 'YouTube Music'], ['soundcloud', 'SoundCloud']]
  : [['all', 'All services'], ['youtube_music', 'YouTube Music'], ['soundcloud', 'SoundCloud'], ['bandcamp', 'Bandcamp']];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const home = usePart('home');
  const settings = usePart('settings');
  const signedIn = settings?.youtube.status === 'connected' || settings?.soundcloud.status === 'connected';
  return (
    <>
      <h1 className="page-title">{greeting()}</h1>
      <div className="chips">
        {filters.map(([id, label]) => (
          <button key={id} className={cls('chip', home?.filter === id && 'on')} onClick={() => send('filter', { filter: id })}>{label}</button>
        ))}
        <button className="chip" aria-label="Refresh" onClick={() => send('refreshHome')}><RefreshCw size={14} /></button>
      </div>
      {HOSTED && <HostedWelcome />}
      {!HOSTED && !signedIn && settings && (
        <div className="banner">
          <span>Sign in to YouTube Music or SoundCloud to see your own playlists, likes and mixes here.</span>
          <button className="button small primary" style={{ marginLeft: 'auto' }} onClick={() => go('/settings')}>Sign in</button>
        </div>
      )}
      {home?.pinned.length ? <Shelf title="Pinned">{home.pinned.map((t) => <TrackCard key={t.key} track={t} list={home.pinned} origin="HOME" />)}</Shelf> : null}
      {home?.recent.length ? <Shelf title="Played lately">{home.recent.map((t) => <TrackCard key={t.key} track={t} list={home.recent} origin="HOME" />)}</Shelf> : null}
      {home?.sections.map((section) => (
        <Shelf key={section.id} title={section.title} subtitle={section.subtitle}>
          {section.tracks.map((t) => <TrackCard key={t.key} track={t} list={section.tracks} origin="HOME" />)}
          {section.playlists.map((p) => <PlaylistCard key={p.key} playlist={p} />)}
        </Shelf>
      ))}
      {home && !home.sections.length && (home.loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 18, marginTop: 30 }}>
          {Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1' }} />)}
        </div>
      ) : (
        <Empty icon={<Disc3 size={44} />} title="Nothing here yet">{home.error ?? (HOSTED ? 'Search for something to play.' : 'Search for something to play, or sign in to see your own music.')}</Empty>
      ))}
    </>
  );
}
