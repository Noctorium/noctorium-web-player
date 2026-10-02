import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import type { LocalPlaylist, Playlist, Track } from '../types';
import { send } from '../live';
import { go } from '../router';
import { openMenu } from '../ui';
import { bigArtwork, plural, providerName } from '../util';
import { Badge, Cover } from './Common';
import { TrackMenu } from './Tracks';

export function Shelf({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="shelf-title">{title}</h2>
      {subtitle && <p className="shelf-subtitle">{subtitle}</p>}
      <div className="shelf">{children}</div>
    </section>
  );
}

export function TrackCard({ track, list, origin }: { track: Track; list: Track[]; origin: string }) {
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={() => send('play', { track, list, origin })}
      onKeyDown={(e) => { if (e.key === 'Enter') send('play', { track, list, origin }); }}
      onContextMenu={(e) => { e.preventDefault(); openMenu(e, <TrackMenu track={track} />); }}
    >
      <Cover url={bigArtwork(track.artworkUrl, 352)}>
        <span className="hover-play"><Play size={20} fill="currentColor" /></span>
      </Cover>
      <div className="card-title ellipsis">{track.title}</div>
      <div className="card-sub ellipsis">{track.artistLine || providerName[track.provider]}</div>
    </div>
  );
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const open = () => { send('openPlaylist', { key: playlist.key }); go(`/playlist/${encodeURIComponent(playlist.key)}`); };
  return (
    <div className="card" role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
      <Cover url={bigArtwork(playlist.artworkUrl, 352)}>
        <button className="hover-play" aria-label={`Play ${playlist.title}`}
          onClick={(e) => { e.stopPropagation(); send('playPlaylist', { key: playlist.key }); }}>
          <Play size={20} fill="currentColor" />
        </button>
      </Cover>
      <div className="card-title ellipsis">{playlist.title}</div>
      <div className="card-sub ellipsis" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Badge provider={playlist.provider} />
        <span className="ellipsis">{[playlist.ownerName, playlist.trackCount != null ? plural(playlist.trackCount, 'track') : null].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  );
}

export function LocalCard({ playlist }: { playlist: LocalPlaylist }) {
  const open = () => { send('openLocal', { id: playlist.id }); go(`/local/${encodeURIComponent(playlist.id)}`); };
  return (
    <div className="card" role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
      <Cover url={bigArtwork(playlist.artworkUrl, 352)} />
      <div className="card-title ellipsis">{playlist.title}</div>
      <div className="card-sub ellipsis" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Badge provider="LOCAL" /> {plural(playlist.tracks.length, 'track')}
      </div>
    </div>
  );
}
