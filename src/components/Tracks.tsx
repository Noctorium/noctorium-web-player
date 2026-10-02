import { useState, type MouseEvent } from 'react';
import { Download, Heart, Link2, ListEnd, ListPlus, ListStart, MoreHorizontal, Pause, Pin, Play, Plus, ExternalLink, Trash2 } from 'lucide-react';
import type { LocalPlaylist, Playlist, Track } from '../types';
import { live, send, usePart } from '../live';
import { canLike, cls, formatTime, isLiked, providerName } from '../util';
import { Badge, Eq, Prompt } from './Common';
import { openDialog, openMenu } from '../ui';

/** Where a list came from, which decides what playing from it means and what can be done to it. */
export type Context =
  | { kind: 'list'; origin: string }
  | { kind: 'playlist'; playlist: Playlist }
  | { kind: 'local'; playlist: LocalPlaylist }
  | { kind: 'queue' }
  | { kind: 'downloads' };

export function playFrom(context: Context, track: Track, list: Track[], index: number) {
  switch (context.kind) {
    case 'playlist': return send('playPlaylist', { key: context.playlist.key, startAt: track.key });
    case 'local': return send('playLocal', { id: context.playlist.id, startAt: track.key });
    case 'queue': return send('jump', { index });
    case 'downloads': return send('playDownloads', { startAt: track.key });
    default: return send('play', { track, list, origin: context.origin });
  }
}

export function TrackList({ tracks, context, numbered = true, startIndex = 0, compact }: { tracks: Track[]; context: Context; numbered?: boolean; startIndex?: number; compact?: boolean }) {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const likes = usePart('likes');
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const reorderable = context.kind === 'queue' || context.kind === 'local' ||
    (context.kind === 'playlist' && context.playlist.editable && context.playlist.provider !== 'SOUNDCLOUD');

  function drop(to: number) {
    if (dragging == null || dragging === to) return;
    const from = dragging + startIndex;
    const target = to + startIndex;
    if (context.kind === 'queue') send('moveQueue', { from, to: target });
    else if (context.kind === 'local') send('movePlaylistTrack', { localId: context.playlist.id, from, to: target });
    else if (context.kind === 'playlist') send('movePlaylistTrack', { key: context.playlist.key, from, to: target });
  }

  return (
    <div className="tracks" role="list">
      {tracks.map((track, i) => {
        const index = i + startIndex;
        const playing = context.kind === 'queue' ? index === queue?.currentIndex : playback?.track?.key === track.key;
        return (
          <TrackRow
            key={`${track.key}:${index}`}
            track={track}
            number={numbered ? index + 1 : undefined}
            playing={playing}
            paused={playback?.status !== 'playing'}
            liked={isLiked(likes, track)}
            likeable={canLike(likes, track)}
            compact={compact}
            onPlay={() => (playing ? send('toggle') : playFrom(context, track, tracks, index))}
            onMenu={(e) => openMenu(e, <TrackMenu track={track} context={context} index={index} />)}
            drag={reorderable ? {
              dragging: dragging === i,
              over: over === i && dragging !== i,
              start: () => setDragging(i),
              enter: () => setOver(i),
              end: () => { setDragging(null); setOver(null); },
              drop: () => drop(i),
            } : undefined}
          />
        );
      })}
    </div>
  );
}

interface Drag { dragging: boolean; over: boolean; start(): void; enter(): void; end(): void; drop(): void }

export function TrackRow({ track, number, playing, paused, liked, likeable, compact, onPlay, onMenu, drag }: {
  track: Track; number?: number; playing: boolean; paused: boolean; liked: boolean; likeable: boolean; compact?: boolean;
  onPlay(): void; onMenu(e: MouseEvent<HTMLButtonElement>): void; drag?: Drag;
}) {
  return (
    <div
      role="listitem"
      className={cls('track', playing && 'playing', paused && 'paused', drag?.dragging && 'dragging', drag?.over && 'drop')}
      onDoubleClick={onPlay}
      onContextMenu={(e) => { e.preventDefault(); onMenu(e as unknown as MouseEvent<HTMLButtonElement>); }}
      draggable={!!drag}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; drag?.start(); }}
      onDragEnter={() => drag?.enter()}
      onDragOver={(e) => { if (drag) e.preventDefault(); }}
      onDragEnd={() => drag?.end()}
      onDrop={(e) => { e.preventDefault(); drag?.drop(); drag?.end(); }}
    >
      {!compact && <span className="number">{playing ? <Eq /> : number}</span>}
      <div className="thumb">
        {track.artworkUrl && <img src={track.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}
        <button aria-label={playing && !paused ? 'Pause' : `Play ${track.title}`} onClick={onPlay}>
          {playing && !paused ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="title ellipsis">{track.title}</div>
        <div className="artist ellipsis">{track.artistLine || providerName[track.provider]}</div>
      </div>
      {!compact && <div className="album ellipsis">{track.album?.title ?? ''}</div>}
      {!compact && <span className="badge-cell"><Badge provider={track.provider} /></span>}
      {!compact && <span className="duration">{formatTime(track.durationMs)}</span>}
      <div className="actions">
        {!compact && likeable && (
          <button className={cls('round-button like', liked && 'on')} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => send('like', { track })}>
            <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
          </button>
        )}
        <button className="round-button" aria-label="More" onClick={onMenu}><MoreHorizontal size={18} /></button>
      </div>
    </div>
  );
}

/** What can be done to a track, wherever it is listed. */
export function TrackMenu({ track, context, index }: { track: Track; context?: Context; index?: number }) {
  const likes = live.state.likes;
  const liked = isLiked(likes, track);
  return (
    <>
      <button onClick={() => send('playNext', { track })}><ListStart size={17} /> Play next</button>
      <button onClick={() => send('addToQueue', { track }).then((e) => !e && live.notice('Added to the queue'))}><ListEnd size={17} /> Add to the queue</button>
      <button data-keep onClick={(e) => openMenu(e, <AddToPlaylist track={track} />)}><ListPlus size={17} /> Add to a playlist…</button>
      <hr />
      {canLike(likes, track) && (
        <button onClick={() => send('like', { track })}><Heart size={17} fill={liked ? 'currentColor' : 'none'} /> {liked ? 'Remove from your likes' : `Like on ${providerName[track.provider]}`}</button>
      )}
      <button onClick={() => send('download', { track }).then((e) => !e && live.notice(`Downloading ${track.title}…`))}><Download size={17} /> Download to keep</button>
      <button onClick={() => send('pin', { track })}><Pin size={17} /> Pin to Home</button>
      <button onClick={() => { navigator.clipboard?.writeText(track.sourceUrl).then(() => live.notice('Link copied', 'good'), () => send('copyLink', { track })); }}><Link2 size={17} /> Copy the link</button>
      <button onClick={() => window.open(track.sourceUrl, '_blank', 'noopener')}><ExternalLink size={17} /> Open on {providerName[track.provider]}</button>
      {context?.kind === 'queue' && index != null && (
        <><hr /><button onClick={() => send('removeQueue', { index })}><Trash2 size={17} /> Take out of the queue</button></>
      )}
      {context?.kind === 'local' && (
        <><hr /><button onClick={() => send('removeFromPlaylist', { localId: context.playlist.id, track })}><Trash2 size={17} /> Take out of this playlist</button></>
      )}
      {context?.kind === 'playlist' && context.playlist.editable && (
        <><hr /><button onClick={() => send('removeFromPlaylist', { key: context.playlist.key, track })}><Trash2 size={17} /> Take out of this playlist</button></>
      )}
      {context?.kind === 'downloads' && (
        <><hr /><button onClick={() => send('deleteDownload', { key: track.key })}><Trash2 size={17} /> Delete the download</button></>
      )}
    </>
  );
}

/** The playlists this track can go in: the same service's own, and the ones on this computer. */
export function AddToPlaylist({ track }: { track: Track }) {
  const library = live.state.library;
  const youTube = track.provider === 'YOUTUBE_MUSIC' || track.provider === 'YOUTUBE_VIDEO';
  const service = (library?.playlists ?? []).filter((p) => p.editable && (track.provider === 'SOUNDCLOUD' ? p.provider === 'SOUNDCLOUD' : youTube && p.provider !== 'SOUNDCLOUD'));
  const make = (provider: string, where: string) => openDialog(
    <Prompt title={`New playlist ${where}`} hint={provider === 'LOCAL' ? 'Kept in Noctorium on the computer.' : 'Private to begin with.'} action="Make it"
      submit={(title) => send('createPlaylist', { title, provider, track }).then((e) => !e && live.notice(`Made “${title}”`, 'good'))} />,
  );
  return (
    <>
      <div className="heading">Add to a playlist</div>
      {service.map((p) => (
        <button key={p.key} onClick={() => send('addToPlaylist', { key: p.key, track }).then((e) => !e && live.notice(`Added to ${p.title}`, 'good'))}>
          <Badge provider={p.provider} /> <span className="ellipsis">{p.title}</span>
        </button>
      ))}
      {(library?.local ?? []).map((p) => (
        <button key={p.id} onClick={() => send('addToPlaylist', { localId: p.id, track }).then((e) => !e && live.notice(`Added to ${p.title}`, 'good'))}>
          <Badge provider="LOCAL" /> <span className="ellipsis">{p.title}</span>
        </button>
      ))}
      <hr />
      {(youTube || track.provider === 'SOUNDCLOUD') && (
        <button onClick={() => make(youTube ? 'YOUTUBE_MUSIC' : 'SOUNDCLOUD', `on ${youTube ? 'YouTube Music' : 'SoundCloud'}`)}><Plus size={17} /> New playlist on {youTube ? 'YouTube Music' : 'SoundCloud'}…</button>
      )}
      <button onClick={() => make('LOCAL', 'on the computer')}><Plus size={17} /> New playlist on the computer…</button>
    </>
  );
}
