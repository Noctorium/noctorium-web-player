import { useEffect, useMemo, useState, useSyncExternalStore, type DragEvent, type MouseEvent } from 'react';
import { ChevronDown, ListMinus, MoreHorizontal, Mic2, Play, Trash2 } from '../icons';
import { send, usePart } from '../live';
import { closeNowPlaying, openDialog, openMenu } from '../ui';
import { bigArtwork, cls, formatTime, providerName } from '../util';
import { HOSTED } from '../mode';
import { useLooks } from '../looks';
import { QUEUE_COLUMNS } from '../base/looks';
import { queueDurationMs } from '../base/streamFormat';
import { Badge, Confirm, Cover, Empty } from './Common';
import { Controls, LikeButton, SeekBar, usePosition } from './Player';
import { playFrom, suggestion, TrackMenu, type Context } from './Tracks';
import { Visualiser } from './Visualiser';
import { LyricsPanel } from './NowPlaying';
import { useReach } from '../reach';
import type { Track } from '../types';

/*
 * The Playlist layout of the now playing screen, after a desktop music player's main window: the cover in a panel
 * of its own at the left; the queue as a table with the columns the listener chose, in tabs -- Up next, the playlist
 * it came from where the page knows it, and the lyrics; under it an info bar with a small cover, the title large,
 * the artist and album, and a visualiser of the real sound; and along the foot a status bar with what is known of
 * the stream and how far into the queue it is. On a phone the info bar is at the top, over the table, with the
 * controls under it, since the player bar is under the screen there.
 */

type Tab = 'queue' | 'source' | 'lyrics';

const isYouTube = (t?: Track) => t?.provider === 'YOUTUBE_MUSIC' || t?.provider === 'YOUTUBE_VIDEO';

/** The playlist the queue was played from, where the page can know it: the hosted player says which. */
function useSource(): { title: string; tracks: Track[]; context: Context } | undefined {
  const queue = usePart('queue');
  const library = usePart('library');
  const origin = queue?.origin ?? '';
  if (origin.startsWith('LOCAL:')) {
    const playlist = library?.local.find((p) => p.id === origin.slice(6));
    if (playlist?.tracks.length) return { title: playlist.title, tracks: playlist.tracks, context: { kind: 'local', playlist } };
  }
  if (origin.startsWith('PLAYLIST:')) {
    const open = library?.open;
    if (open && open.key === origin.slice(9) && open.tracks?.length) return { title: open.title, tracks: open.tracks, context: { kind: 'playlist', playlist: open } };
  }
  return undefined;
}

export function PlaylistLayout() {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const looks = useLooks();
  const source = useSource();
  const [tab, setTab] = useState<Tab>('queue');
  const track = playback?.track;
  const video = HOSTED && isYouTube(track);
  const shownTab = tab === 'source' && !source ? 'queue' : tab;
  const current = queue?.tracks[queue.currentIndex];

  return (
    <div className={cls('now-playing', 'playlist-layout', video && 'has-video', !looks.statusBar && 'no-status')}>
      <aside className="album-art pane">
        <div className="pane-title">Album Art</div>
        {video
          // YouTube's own player is laid over this spot, as over the cover's in the other layout; see hosted/Stage.tsx.
          ? <div className="cover yt-slot" />
          : <Cover url={bigArtwork(track?.artworkUrl)} />}
      </aside>

      <section className="playlist pane">
        <div className="playlist-tabs" role="tablist">
          <button role="tab" aria-selected={shownTab === 'queue'} className={cls('tab', shownTab === 'queue' && 'on')} onClick={() => setTab('queue')}>
            Up next <small>({queue?.tracks.length ?? 0})</small>
          </button>
          {source && (
            <button role="tab" aria-selected={shownTab === 'source'} className={cls('tab', shownTab === 'source' && 'on')} onClick={() => setTab('source')}>
              <span className="ellipsis">{source.title}</span> <small>({source.tracks.length})</small>
            </button>
          )}
          <button role="tab" aria-selected={shownTab === 'lyrics'} className={cls('tab', shownTab === 'lyrics' && 'on')} onClick={() => setTab('lyrics')}>Lyrics</button>
          <span className="spacer" />
          {shownTab === 'queue' && (
            <>
              <button className="tool" title="Clear all but this song" aria-label="Clear all but this song" disabled={!current || (queue?.tracks.length ?? 0) < 2}
                onClick={() => send('clearAllButCurrent')}><ListMinus size={17} /></button>
              <button className="tool" title="Clear the queue" aria-label="Clear the queue" disabled={!queue?.tracks.length}
                onClick={() => openDialog(<Confirm title="Clear the queue?" detail="Playback stops too." action="Clear" danger yes={() => send('clearQueue')} />)}><Trash2 size={17} /></button>
            </>
          )}
          <button className="tool" title="Close" aria-label="Close" onClick={closeNowPlaying}><ChevronDown size={18} /></button>
        </div>
        <div className="playlist-body">
          {shownTab === 'lyrics' ? <LyricsPanel /> : shownTab === 'source' && source ? (
            <QueueTable tracks={source.tracks} context={source.context} columns={looks.queueColumns} />
          ) : queue?.tracks.length ? (
            <QueueTable tracks={queue.tracks} context={{ kind: 'queue' }} columns={looks.queueColumns} suggestions={HOSTED ? undefined : queue.suggestions} suggestionsFrom={queue.suggestionsFrom} />
          ) : (
            <Empty icon={<Mic2 size={34} />} title="The queue is empty">Find something on Home or in Search, and it plays here.</Empty>
          )}
        </div>
        <InfoBar />
      </section>

      <div className="playlist-controls">
        <SeekBar playback={playback} />
        <div className="row"><LikeButton size={20} /><Controls /></div>
      </div>

      {looks.statusBar && <StatusBar />}
    </div>
  );
}

/** A small cover, the title large, the artist and album under it, and the visualiser at the right. */
function InfoBar() {
  const playback = usePart('playback');
  const track = playback?.track;
  return (
    <div className="info-bar">
      <Cover url={track?.artworkUrl} />
      <div className="words">
        <div className="title ellipsis">{track?.title ?? 'Nothing playing'}</div>
        {track && (
          <div className="artist ellipsis">
            {track.artistLine || providerName[track.provider]}{track.album?.title ? <> — {track.album.title}</> : null}
          </div>
        )}
        {playback?.status === 'error' && <div className="error ellipsis">{playback.error}</div>}
      </div>
      <Visualiser />
    </div>
  );
}

/**
 * What a desktop player's status bar says: the stream's format as far as it is known, and at the right how far
 * into the queue the music is, of how long it all is -- "12:41 / 1:03:41".
 */
function StatusBar() {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const reach = useReach();
  const position = usePosition(playback);
  const tracks = queue?.tracks ?? [];
  const total = queue?.durationMs ?? queueDurationMs(tracks);
  const before = queue?.elapsedBeforeMs ?? queueDurationMs(tracks.slice(0, Math.max(0, queue?.currentIndex ?? 0)));
  const format = playback?.format
    ?? (reach.where === 'youtube' ? 'In YouTube’s own player' : reach.where === 'spotify' ? 'In Spotify’s own app' : undefined);
  return (
    <footer className="status-bar">
      <span className="cell format ellipsis" title={format}>{format ?? (playback?.status === 'playing' || playback?.status === 'resolving' ? 'Format not known yet' : playback?.status === 'paused' ? 'Paused' : 'Stopped')}</span>
      {playback?.stopAfterCurrent && <span className="cell">Stops after this song</span>}
      <span className="cell count">{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</span>
      <span className="cell time">{formatTime(before + position) === '–:––' ? '0:00' : formatTime(before + position)} / {formatTime(total)}</span>
    </footer>
  );
}

/** Whether the screen is a phone's, where the table keeps only the number, the title and the length. */
const narrow = window.matchMedia('(max-width: 860px)');
function useNarrow() {
  return useSyncExternalStore((l) => { narrow.addEventListener('change', l); return () => narrow.removeEventListener('change', l); }, () => narrow.matches);
}

/** The columns' widths in the table's grid, and the row's menu button after them. */
const WIDTHS: Record<string, string> = {
  NUMBER: '44px', TITLE: 'minmax(0, 2fr)', ARTIST: 'minmax(0, 1.2fr)', ALBUM: 'minmax(0, 1.2fr)', DURATION: '64px', SERVICE: '62px',
};

/**
 * The queue as a table, in the columns chosen and their order: the playing row marked ▶ and lit, a click choosing a
 * row and a double-click (or Enter) playing it, a right-click its menu, and rows dragged to reorder the queue.
 * Autoplay's songs follow the queue's, dimmer, under a line saying where they come from.
 */
export function QueueTable({ tracks, context, columns: chosenColumns, suggestions, suggestionsFrom }: {
  tracks: Track[]; context: Context; columns: string[]; suggestions?: Track[]; suggestionsFrom?: string;
}) {
  const small = useNarrow();
  const columns = small ? chosenColumns.filter((c) => c === 'NUMBER' || c === 'TITLE' || c === 'DURATION') : chosenColumns;
  const playback = usePart('playback');
  const queue = usePart('queue');
  const [chosen, setChosen] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const template = useMemo(() => [...columns.map((c) => WIDTHS[c] ?? 'minmax(0, 1fr)'), '36px'].join(' '), [columns]);
  const headings = Object.fromEntries(QUEUE_COLUMNS.map((c) => [c.name, c.heading]));
  const reorderable = context.kind === 'queue' || context.kind === 'local';
  const playingIndex = context.kind === 'queue' ? queue?.currentIndex ?? -1 : tracks.findIndex((t) => t.key === playback?.track?.key);

  // The playing row is kept in sight as the queue moves on.
  useEffect(() => {
    document.querySelector('.queue-table .row.playing')?.scrollIntoView({ block: 'nearest' });
  }, [playingIndex]);

  const play = (track: Track, index: number) => (index === playingIndex && context.kind === 'queue' ? send('toggle') : playFrom(context, track, tracks, index));
  const menu = (e: MouseEvent<HTMLElement>, track: Track, index: number, offered = false) => {
    e.preventDefault();
    setChosen(offered ? null : index);
    openMenu(e.type === 'contextmenu' ? { clientX: e.clientX, clientY: e.clientY + 44 } : e, <TrackMenu track={track} context={offered ? { kind: 'suggestions' } : context} index={index} />);
  };
  const drop = (to: number) => {
    if (dragging == null || dragging === to) return;
    if (context.kind === 'queue') send('moveQueue', { from: dragging, to });
    else if (context.kind === 'local') send('movePlaylistTrack', { localId: context.playlist.id, from: dragging, to });
  };

  const cell = (column: string, track: Track, index: number, playing: boolean) => {
    switch (column) {
      case 'NUMBER': return <span key={column} className="cell number">{playing ? <Play size={11} fill="currentColor" /> : index + 1}</span>;
      case 'TITLE': return <span key={column} className="cell title ellipsis">{track.title}{!columns.includes('ARTIST') && <small className="ellipsis">{track.artistLine}</small>}</span>;
      case 'ARTIST': return <span key={column} className="cell artist ellipsis">{track.artistLine || providerName[track.provider]}</span>;
      case 'ALBUM': return <span key={column} className="cell album ellipsis">{track.album?.title ?? ''}</span>;
      case 'DURATION': return <span key={column} className="cell duration">{formatTime(track.durationMs)}</span>;
      case 'SERVICE': return <span key={column} className="cell service"><Badge provider={track.provider} /></span>;
      default: return null;
    }
  };

  const row = (track: Track, index: number, offered: boolean) => {
    const playing = !offered && index === playingIndex;
    return (
      <div
        key={`${offered ? 's' : 'q'}:${track.key}:${index}`}
        role="row"
        aria-selected={!offered && chosen === index}
        tabIndex={0}
        className={cls('row', playing && 'playing', !offered && chosen === index && 'chosen', offered && 'offered', !offered && dragging === index && 'dragging', !offered && over === index && dragging !== index && 'drop')}
        style={{ gridTemplateColumns: template }}
        onClick={() => !offered && setChosen(index)}
        onDoubleClick={() => (offered ? send('playSuggestion', suggestion(track, index)) : play(track, index))}
        onKeyDown={(e) => { if (e.key === 'Enter') (offered ? send('playSuggestion', suggestion(track, index)) : play(track, index)); }}
        onContextMenu={(e) => menu(e, track, index, offered)}
        draggable={reorderable && !offered}
        onDragStart={(e: DragEvent) => { e.dataTransfer.effectAllowed = 'move'; setDragging(index); }}
        onDragEnter={() => setOver(index)}
        onDragOver={(e) => { if (reorderable && !offered) e.preventDefault(); }}
        onDragEnd={() => { setDragging(null); setOver(null); }}
        onDrop={(e) => { e.preventDefault(); drop(index); setDragging(null); setOver(null); }}
      >
        {columns.map((column) => cell(column, track, index, playing))}
        <button className="cell more round-button" aria-label="More" onClick={(e) => menu(e, track, index, offered)}><MoreHorizontal size={16} /></button>
      </div>
    );
  };

  return (
    <div className="queue-table" role="grid" aria-label="Up next">
      <div className="row head" role="row" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => <span key={c} role="columnheader" className={cls('cell', c.toLowerCase())}>{headings[c] ?? c}</span>)}
        <span />
      </div>
      {tracks.map((track, i) => row(track, i, false))}
      {!!suggestions?.length && (
        <>
          <div className="row divider" role="row"><span className="ellipsis">Autoplay{suggestionsFrom ? ` · ${suggestionsFrom}` : ''}</span></div>
          {suggestions.map((track, i) => row(track, i, true))}
        </>
      )}
    </div>
  );
}
