import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  Check, ChevronUp, CircleStop, Disc3, Gauge, Heart, ListMusic, Mic2, Monitor, MonitorSpeaker, Pause, Play, Plus, Repeat, Repeat1,
  Shuffle, SkipBack, SkipForward, Smartphone, Square, User, Moon,
} from '../icons';
import { audio } from '../audio';
import { live, send, usePart } from '../live';
import { openMenu, openNowPlaying, useUi, closeNowPlaying } from '../ui';
import { SPEEDS, canLike, cls, formatTime, isLiked, speedName } from '../util';
import { Cover, Spinner } from './Common';
import { StartButton, TrayClock, taskbarMenu, useSkin } from './Skin';
import { AddToPlaylist, TrackMenu } from './Tracks';
import { VolumeButton, VolumeSlider } from './Volume';
import { useLooks } from '../looks';
import { go } from '../router';
import type { Playback, Track } from '../types';
import { HOSTED } from '../mode';
import {
  BARS_HEIGHT, BARS_PITCH, BARS_WIDTH, BEAD_HEAD_RADIUS, BEAD_PITCH, BEAD_RADIUS, RULER_MAJOR_TICK, RULER_POINTER, RULER_TICK, SLIDER_GROOVE,
  SLIDER_HANDLE_RADIUS, barHeights, rulerTicks,
} from '../seekbar';

/** The Slider's groove and handle, as Base measures them, for skins.css and styles.css to draw. */
const slider = { ['--groove' as string]: `${SLIDER_GROOVE}px`, ['--handle' as string]: `${SLIDER_HANDLE_RADIUS * 2}px` };

/** Where the track is now, carried forward between the updates Noctorium sends, or read from this tab's own audio. */
export function usePosition(playback?: Playback): number {
  const [, tick] = useState(0);
  useEffect(() => {
    if (playback?.status !== 'playing') return;
    const timer = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, [playback?.status]);
  if (!playback) return 0;
  // Spotify's own app plays a Spotify song on Spotify, so this tab's audio says nothing about where it is.
  if (audio.active && playback.output === 'browser' && !playback.onSpotify && Number.isFinite(audio.element.currentTime) && playback.status !== 'resolving') {
    return audio.element.currentTime * 1000;
  }
  if (playback.status !== 'playing') return playback.positionMs;
  return Math.min(playback.positionMs + (performance.now() - live.playbackAt), playback.durationMs || Infinity);
}

/**
 * The styles drawn rather than painted on the range input's own track. The input is still there, see-through and
 * over the drawing, so they seek by click, by drag and by keyboard exactly as the others do.
 */
const drawn = new Set(['BARS', 'BEADS', 'NEON', 'RULER', 'LUNA']);

/**
 * The seek bar, in whichever of Noctorium's twelve styles is chosen: with the times at its two ends, or none, or --
 * as the Toolbar has it -- both after it, "0:58 / 2:31".
 */
export function SeekBar({ playback, compact, times = compact ? 'none' : 'ends' }: { playback?: Playback; compact?: boolean; times?: 'ends' | 'after' | 'none' }) {
  const settings = usePart('settings');
  const position = usePosition(playback);
  const [dragging, setDragging] = useState<number | null>(null);
  const duration = playback?.durationMs ?? 0;
  const shown = dragging ?? position;
  const fraction = duration > 0 ? Math.min(1, shown / duration) : 0;
  const style = settings?.progressBarStyle ?? 'MINIMAL';
  const remaining = settings?.timeDisplay === 'REMAINING';
  const input = (
    <input
      className={cls('bar', !drawn.has(style) && style)}
      type="range"
      min={0}
      max={Math.max(duration, 1)}
      step={500}
      value={shown}
      disabled={!playback?.track || duration <= 0}
      aria-label="Seek"
      style={{ ['--fill' as string]: `${fraction * 100}%`, ...(style === 'SLIDER' ? slider : {}) }}
      onChange={(e) => setDragging(Number(e.target.value))}
      onPointerUp={() => { if (dragging != null) { send('seek', { positionMs: Math.round(dragging) }); setDragging(null); } }}
      onKeyUp={() => { if (dragging != null) { send('seek', { positionMs: Math.round(dragging) }); setDragging(null); } }}
    />
  );
  return (
    <div className={cls('seek', playback?.status !== 'playing' && 'paused', times === 'after' && 'times-after')}>
      {times === 'ends' && <span className="time">{formatTime(shown)}</span>}
      {style === 'WAVE' ? (
        <div className="wave-wrap">
          <svg width={`${fraction * 100}%`} viewBox={`0 0 100 16`} preserveAspectRatio="none" aria-hidden>
            <defs><clipPath id="wave-clip"><rect width="100" height="16" /></clipPath></defs>
            <g clipPath="url(#wave-clip)">
              <path className="wave-path" d={wave()} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
          {input}
        </div>
      ) : drawn.has(style) ? (
        <Drawing style={style} fraction={fraction} durationMs={duration} seed={playback?.track?.key}>{input}</Drawing>
      ) : input}
      {times === 'ends' && <span className="time">{remaining && duration > 0 ? `-${formatTime(duration - shown)}` : formatTime(duration)}</span>}
      {times === 'after' && (
        <span className="time both">{duration > 0 && shown < 1000 ? '0:00' : formatTime(shown)} / {remaining && duration > 0 ? `-${formatTime(duration - shown)}` : formatTime(duration)}</span>
      )}
    </div>
  );
}

function wave() {
  let d = 'M0 8';
  for (let x = 0; x <= 140; x += 5) d += ` Q${x + 2.5} ${x % 10 === 0 ? 4 : 12} ${x + 5} 8`;
  return d;
}

/** How wide an element is, in whole pixels, kept up to date as the window changes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * One of the drawn seek bars, under the input that seeks. The played part is the same drawing again in the
 * accent, cut off at --fill, so the colour changes exactly at the song's place, mid-bar if need be.
 */
function Drawing({ style, fraction, durationMs, seed, children }: { style: string; fraction: number; durationMs: number; seed?: string; children: ReactNode }) {
  const [box, width] = useWidth<HTMLDivElement>();
  // Where the pointer is over the bars, which SoundCloud's player lights up to show where a click would go.
  const hover = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--seek-hover', `${Math.max(0, Math.min(r.width, e.clientX - r.left))}px`);
  };
  return (
    <div
      ref={box}
      className={cls('drawn', style)}
      style={{ ['--fill' as string]: `${fraction * 100}%` }}
      onPointerMove={style === 'BARS' ? hover : undefined}
      onPointerLeave={style === 'BARS' ? (e) => e.currentTarget.style.removeProperty('--seek-hover') : undefined}
    >
      {width > 0 && style === 'BARS' && <Bars width={width} seed={seed} />}
      {width > 0 && style === 'BEADS' && <Beads width={width} fraction={fraction} going={durationMs > 0} />}
      {width > 0 && style === 'RULER' && <Ruler width={width} durationMs={durationMs} />}
      {style === 'NEON' && <div className="neon" aria-hidden><i className="neon-rest" /><i className="neon-line" /><i className="neon-spark" /></div>}
      {style === 'LUNA' && <Luna />}
      {children}
    </div>
  );
}

/** How far a reflection hangs below the bars, as a part of each bar's height, and how much of the row it takes. */
const REFLECTION = 0.3;
const BARS_ROW = BARS_HEIGHT + 1 + Math.ceil(BARS_HEIGHT * REFLECTION);

/** A row of bars the song keeps, rising from a line with a short reflection under it, as SoundCloud draws a waveform. */
function Bars({ width, seed }: { width: number; seed?: string }) {
  const count = Math.max(0, Math.floor((width + BARS_PITCH - BARS_WIDTH) / BARS_PITCH));
  const [bars, reflections] = useMemo(() => {
    // Nothing playing has no pattern: a row of the shortest bars says so.
    const heights = seed ? barHeights(seed, count) : new Array<number>(count).fill(0.18);
    let up = '';
    let down = '';
    heights.forEach((fraction, i) => {
      const x = i * BARS_PITCH;
      const h = Math.max(1, Math.round(fraction * BARS_HEIGHT));
      up += `M${x} ${BARS_HEIGHT - h}h${BARS_WIDTH}v${h}h-${BARS_WIDTH}z`;
      down += `M${x} ${BARS_HEIGHT + 1}h${BARS_WIDTH}v${Math.max(1, Math.round(h * REFLECTION))}h-${BARS_WIDTH}z`;
    });
    return [up, down];
  }, [seed, count]);
  const drawing = <svg width={width} height={BARS_ROW} aria-hidden><path d={bars} /><path className="reflection" d={reflections} /></svg>;
  return (
    <>
      {drawing}
      <div className="hovered">{drawing}</div>
      <div className="played">{drawing}</div>
    </>
  );
}

/** A string of dots, the ones played filled in and the one the song has reached larger, in a halo. */
function Beads({ width, fraction, going }: { width: number; fraction: number; going: boolean }) {
  const count = Math.max(2, Math.floor(width / BEAD_PITCH));
  const pitch = width / count;
  const head = going ? Math.min(count - 1, Math.floor(fraction * count)) : -1;
  const middle = BEAD_HEAD_RADIUS * 2 - 1;
  return (
    <svg width={width} height={middle * 2} aria-hidden>
      {head >= 0 && <circle className="halo" cx={(head + 0.5) * pitch} cy={middle} r={BEAD_HEAD_RADIUS + 4} />}
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} className={cls(i < head && 'played', i === head && 'head')} cx={(i + 0.5) * pitch} cy={middle} r={i === head ? BEAD_HEAD_RADIUS : BEAD_RADIUS} />
      ))}
    </svg>
  );
}

/** The fewest pixels between two of the ruler's ticks: closer than this, it takes a longer step. */
const RULER_SPACING = 8;

/** A hairline marked every few seconds and longer each minute, with a pointer above the song's place. */
function Ruler({ width, durationMs }: { width: number; durationMs: number }) {
  const ticks = useMemo(() => rulerTicks(durationMs, Math.floor(width / RULER_SPACING)), [durationMs, width]);
  const line = RULER_POINTER + 1;
  const d = ticks.map((t) => `M${Math.round(t.fraction * width) + 0.5} ${line + 1}v${t.major ? RULER_MAJOR_TICK : RULER_TICK}`).join('');
  const drawing = (
    <svg width={width} height={line + 1 + RULER_MAJOR_TICK} aria-hidden>
      <path d={`M0 ${line + 0.5}H${width}${d}`} />
    </svg>
  );
  return (
    <>
      {drawing}
      <div className="played">{drawing}</div>
      <i className="ruler-pointer" />
    </>
  );
}

/** Windows XP's progress bar: green blocks filling a white well, under its trackbar's pointed handle. */
function Luna() {
  // The player bar and the now playing screen can both show one, and an id is for one element only.
  const face = useId();
  return (
    <div className="luna" aria-hidden>
      <div className="luna-well"><i /></div>
      <svg className="luna-thumb" width="11" height="21" viewBox="0 0 11 21">
        <defs>
          <linearGradient id={face} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#f3f2ee" />
            <stop offset="1" stopColor="#d6d0c5" />
          </linearGradient>
        </defs>
        <path className="face" fill={`url(#${face})`} d="M1.5 0.5h8a1 1 0 0 1 1 1v13.3l-5 5.2-5-5.2V1.5a1 1 0 0 1 1-1z" />
        <path className="foot" d="M1.5 13.6v1l4 4.1 4-4.1v-1" />
      </svg>
    </div>
  );
}

/**
 * Shuffle, previous, play or pause, next and repeat -- and Stop after next, where the listener asked for it, as
 * the desktop offers it among its player buttons.
 */
export function Controls({ big }: { big?: boolean }) {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const { stopButton } = useLooks();
  const size = big ? 26 : 20;
  return (
    <div className="controls">
      <button className={cls('round-button hide-small', queue?.shuffle && 'on')} aria-label="Shuffle" onClick={() => send('shuffle')}><Shuffle size={18} /></button>
      <button className="round-button" aria-label="Previous" onClick={() => send('previous')}><SkipBack size={size} fill="currentColor" /></button>
      <button className="play" style={big ? { width: 60, height: 60 } : undefined} aria-label={playback?.status === 'playing' ? 'Pause' : 'Play'} onClick={() => send('toggle')}>
        {playback?.status === 'resolving' ? <Spinner /> : playback?.status === 'playing' ? <Pause size={size} fill="currentColor" /> : <Play size={size} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      {/* Off where next would go nowhere, as Noctorium on a computer says; the hosted player does not say. */}
      <button className="round-button" aria-label="Next" disabled={queue?.hasNext === false} onClick={() => send('next')}><SkipForward size={size} fill="currentColor" /></button>
      {stopButton && <StopButton size={big ? 22 : 17} className="hide-small" />}
      <button className={cls('round-button hide-small', queue?.repeat !== 'off' && 'on')} aria-label="Repeat" onClick={() => send('repeat')}>
        {queue?.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
      </button>
    </div>
  );
}

export function LikeButton({ size = 18 }: { size?: number }) {
  const playback = usePart('playback');
  const likes = usePart('likes');
  const track = playback?.track;
  if (!track || !canLike(likes, track)) return null;
  const liked = isLiked(likes, track);
  return (
    <button className={cls('round-button like', liked && 'on')} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => send('like', { track })}>
      <Heart size={size} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}

function OutputMenu() {
  const playback = usePart('playback');
  const connect = usePart('connect');
  return (
    <>
      <div className="heading">Play on</div>
      <button onClick={() => { live.claim(); send('output', { to: 'browser' }); }}>
        <Smartphone size={17} /> This browser {playback?.output === 'browser' && audio.active ? '✓' : ''}
      </button>
      <button onClick={() => send('output', { to: 'computer' })}>
        <Monitor size={17} /> The computer running Noctorium {playback?.output === 'computer' ? '✓' : ''}
      </button>
      {connect?.available && connect.devices.length > 0 && (
        <>
          <hr />
          <div className="heading">Noctorium Connect</div>
          {connect.devices.map((d) => (
            <button key={d.id} onClick={() => send('playOn', { id: d.id })}><MonitorSpeaker size={17} /> {d.name}{connect.target?.id === d.id ? ' ✓' : ''}</button>
          ))}
        </>
      )}
    </>
  );
}

function SleepMenu() {
  const playback = usePart('playback');
  const on = playback?.sleep.kind !== 'off';
  return (
    <>
      <div className="heading">Sleep timer</div>
      {on && <button onClick={() => send('sleep', { how: 'off' })}>Turn it off</button>}
      {[15, 30, 45, 60, 90].map((m) => <button key={m} onClick={() => send('sleep', { minutes: m })}>In {m} minutes</button>)}
      <button onClick={() => send('sleep', { how: 'endOfTrack' })}>At the end of this track</button>
      {on && <button onClick={() => send('sleep', { how: 'extend', minutes: 10 })}>Ten more minutes</button>}
    </>
  );
}

/** The speeds Settings offers, the one in force ticked, for Toolbar 2's speed button. */
function SpeedMenu() {
  const settings = usePart('settings');
  const speed = settings?.playbackSpeed ?? 1;
  return (
    <>
      <div className="heading">Speed</div>
      {SPEEDS.map((s) => <button key={s} onClick={() => send('speed', { value: s })}>{speedName(s)} {Math.abs(speed - s) < 0.01 ? '✓' : ''}</button>)}
    </>
  );
}

/** The bar along the foot of the page, in the look chosen: this page's own Centred bar, the Toolbar, or Toolbar 2. */
export function PlayerBar() {
  const { playerBar } = useLooks();
  if (playerBar === 'TOOLBAR') return <ToolbarBar />;
  if (playerBar === 'TOOLBAR_2') return <Toolbar2Bar />;
  return <CentredBar />;
}

/**
 * The song playing, as a bar shows it: its cover, its name and who it is by. A click opens the record, and a
 * right-click the song's menu -- add it to a playlist, like it, queue it, stop after it -- on every bar and skin.
 */
function NowSong({ like = true }: { like?: boolean }) {
  const playback = usePart('playback');
  const { nowPlaying } = useUi();
  const track = playback?.track;
  if (!track) return <div className="now"><div className="words faint">Nothing playing</div></div>;
  return (
    <div className="now" onContextMenu={(e) => {
      e.preventDefault();
      // Not the taskbar's menu, under a Windows skin, but the song's.
      e.stopPropagation();
      openMenu({ clientX: e.clientX, clientY: e.clientY + 44 }, <SongMenu track={track} />);
    }}>
      <Cover url={track.artworkUrl} className="" />
      <div className="words" onClick={() => (nowPlaying ? closeNowPlaying() : openNowPlaying())}>
        <div className="title ellipsis">{track.title}</div>
        <div className="artist ellipsis">
          {playback?.status === 'resolving' ? 'Finding the audio…' : playback?.status === 'error' ? (playback.error ?? 'Could not play this')
            : playback?.onSpotify ? `${track.artistLine} · on Spotify` : track.artistLine}
        </div>
      </div>
      {like && <span className="hide-small"><LikeButton /></span>}
    </div>
  );
}

/** The menu of the song playing: stop after it, stop, find its artist and album, and everything a song's menu has. */
export function SongMenu({ track }: { track: Track }) {
  const playback = usePart('playback');
  // A Noctorium from before Stop says nothing of stopping after a song, and would not know the command.
  const stops = playback?.stopAfterCurrent != null;
  const find = (words: string) => () => { closeNowPlaying(); go(`/search?q=${encodeURIComponent(words)}`); };
  return (
    <>
      {stops && (
        <>
          <button aria-pressed={!!playback?.stopAfterCurrent} onClick={() => send('stopAfterCurrent', { on: !playback?.stopAfterCurrent })}>
            {playback?.stopAfterCurrent ? <Check size={17} /> : <CircleStop size={17} />} Stop after this song
          </button>
          <button onClick={() => send('stop')}><Square size={17} /> Stop</button>
          <hr />
        </>
      )}
      <button onClick={find(track.artists[0]?.name ?? track.artistLine)}><User size={17} /> Find {track.artists[0]?.name ?? 'the artist'}</button>
      {track.album && <button onClick={find(`${track.album.title} ${track.artists[0]?.name ?? ''}`.trim())}><Disc3 size={17} /> Find the album</button>}
      <hr />
      <TrackMenu track={track} />
    </>
  );
}

/** Stop: pause and back to the start of the song, the queue as it was. */
export function StopButton({ size = 17, className, flat }: { size?: number; className?: string; flat?: boolean }) {
  const playback = usePart('playback');
  return (
    <button className={cls(flat ? 'tool' : 'round-button', className)} aria-label="Stop" title="Stop" disabled={!playback?.track} onClick={() => send('stop')}>
      <Square size={size} fill="currentColor" />
    </button>
  );
}

/** What the bar says at its right: where the music is coming out, and the sleep timer while it runs. */
function Chips() {
  const playback = usePart('playback');
  const sleeping = playback?.sleep.kind !== 'off' && playback?.sleep;
  return (
    <>
      {playback?.onSpotify && <span className="output-chip hide-small"><MonitorSpeaker size={13} /> On Spotify</span>}
      {!HOSTED && !playback?.onSpotify && playback?.output === 'browser' && audio.active && <span className="output-chip hide-small"><Smartphone size={13} /> This browser</span>}
      {!HOSTED && !playback?.onSpotify && playback?.output === 'computer' && <span className="output-chip hide-small"><Monitor size={13} /> The computer</span>}
      {sleeping && <span className="output-chip"><Moon size={13} /> {sleeping.kind === 'endOfTrack' ? 'End of track' : formatTime(sleeping.remainingMs)}</span>}
    </>
  );
}

function NowPlayingButton() {
  const { nowPlaying } = useUi();
  return (
    <button className="round-button" aria-label="Now playing" onClick={() => (nowPlaying ? closeNowPlaying() : openNowPlaying())}>
      <ChevronUp size={20} style={{ transform: nowPlaying ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
    </button>
  );
}

/** This page's own bar: the song at the left, the controls in the middle over the seek bar, the tools at the right. */
function CentredBar() {
  const playback = usePart('playback');
  const position = usePosition(playback);
  const fraction = playback && playback.durationMs > 0 ? position / playback.durationMs : 0;
  // In a Windows skin the bar's bottom row is a taskbar: a start button at its left, a clock in its tray if wanted,
  // and its own menu on a right-click.
  const skin = useSkin();
  return (
    <footer className="player" onContextMenu={skin ? taskbarMenu : undefined}>
      <div className="mini-progress"><i style={{ width: `${fraction * 100}%` }} /></div>
      {skin && <StartButton />}
      <NowSong />
      <div className="middle">
        <Controls />
        <SeekBar playback={playback} />
      </div>
      <div className="right">
        <Chips />
        <button className="round-button" aria-label="Sleep timer" onClick={(e) => openMenu(e, <SleepMenu />)}><Moon size={18} /></button>
        <button className="round-button" aria-label="Lyrics" onClick={() => openNowPlaying('lyrics')}><Mic2 size={18} /></button>
        <button className="round-button" aria-label="Queue" onClick={() => openNowPlaying('queue')}><ListMusic size={18} /></button>
        {!HOSTED && <button className="round-button" aria-label="Where it plays" onClick={(e) => openMenu(e, <OutputMenu />)}><MonitorSpeaker size={18} /></button>}
        <VolumeButton />
        <VolumeSlider />
        <NowPlayingButton />
        {skin && <TrayClock />}
      </div>
    </footer>
  );
}

/**
 * The Toolbar: one row of flat buttons, as a desktop music player has them -- add to a playlist, previous, play,
 * pause, stop and next, a thin slider with "0:58 / 2:31" after it, then repeat, shuffle and the volume. Play and
 * pause are buttons of their own here, and Stop is part of the row. The song sits at the row's left, so it is
 * never out of sight; on a phone it is over the slider and the buttons.
 */
function ToolbarBar() {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const skin = useSkin();
  const track = playback?.track;
  const status = playback?.status;
  return (
    <footer className="player toolbar" onContextMenu={skin ? taskbarMenu : undefined}>
      {skin && <StartButton />}
      <NowSong like={false} />
      <div className="middle">
        <div className="tools transport">
          <button className="tool" aria-label="Add to a playlist" title="Add to a playlist" disabled={!track}
            onClick={(e) => track && openMenu(e, <AddToPlaylist track={track} />)}><Plus size={18} /></button>
          <button className="tool" aria-label="Previous" title="Previous" onClick={() => send('previous')}><SkipBack size={18} fill="currentColor" /></button>
          <button className={cls('tool', status === 'playing' && 'on')} aria-label="Play" title="Play" aria-pressed={status === 'playing'}
            onClick={() => { if (status !== 'playing') send('toggle'); }}>
            {status === 'resolving' ? <Spinner /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className={cls('tool', status === 'paused' && 'on')} aria-label="Pause" title="Pause" aria-pressed={status === 'paused'}
            onClick={() => { if (status === 'playing') send('toggle'); }}><Pause size={18} fill="currentColor" /></button>
          <StopButton flat size={16} />
          <button className="tool" aria-label="Next" title="Next" disabled={queue?.hasNext === false} onClick={() => send('next')}><SkipForward size={18} fill="currentColor" /></button>
        </div>
        <SeekBar playback={playback} times="after" />
        <div className="tools modes">
          <button className={cls('tool', queue?.repeat !== 'off' && 'on')} aria-label="Repeat" title="Repeat" onClick={() => send('repeat')}>
            {queue?.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <button className={cls('tool', queue?.shuffle && 'on')} aria-label="Shuffle" title="Shuffle" onClick={() => send('shuffle')}><Shuffle size={18} /></button>
          <VolumeButton className="tool" />
        </div>
      </div>
      <div className="right">
        <Chips />
        <button className="round-button" aria-label="Sleep timer" onClick={(e) => openMenu(e, <SleepMenu />)}><Moon size={18} /></button>
        <button className="round-button" aria-label="Lyrics" onClick={() => openNowPlaying('lyrics')}><Mic2 size={18} /></button>
        <button className="round-button" aria-label="Queue" onClick={() => openNowPlaying('queue')}><ListMusic size={18} /></button>
        {!HOSTED && <button className="round-button" aria-label="Where it plays" onClick={(e) => openMenu(e, <OutputMenu />)}><MonitorSpeaker size={18} /></button>}
        <NowPlayingButton />
        {skin && <TrayClock />}
      </div>
    </footer>
  );
}

/**
 * Toolbar 2: the Toolbar with play and pause one button again and no add button, and every other button the bar
 * can carry after the slider, in groups -- like, lyrics and the queue; repeat and shuffle; the sleep timer, where it
 * plays, the speed and the volume. Stop is among the transport when asked for, as on the Centred bar. The hosted
 * player has nowhere else to play and no speed to change, so it leaves out those two.
 *
 * As the row narrows, lyrics and the queue go first, both only ways to the now playing screen; then repeat,
 * shuffle, the sleep timer and the speed, unless the timer is counting down or the song is playing faster or
 * slower, as on the desktop. The row's own width decides, not the window's (see looks.css), so a Windows skin's
 * control strip, which has the whole width, keeps them all. On a phone it is the Toolbar's three rows -- the song,
 * the slider, and like, previous, play, next, the queue, shuffle and repeat, as the phone's Toolbar 2 has them.
 */
function Toolbar2Bar() {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const likes = usePart('likes');
  const connect = usePart('connect');
  const settings = usePart('settings');
  const { stopButton } = useLooks();
  const skin = useSkin();
  const track = playback?.track;
  const status = playback?.status;
  const playing = status === 'playing';
  const likeable = !!track && canLike(likes, track);
  const liked = likeable && isLiked(likes, track);
  const sleeping = !!playback && playback.sleep.kind !== 'off';
  const elsewhere = !!connect?.target || !!connect?.controlledBy;
  const speed = settings?.playbackSpeed ?? 1;
  const changed = Math.abs(speed - 1) >= 0.01;
  return (
    <footer className="player toolbar toolbar-2" onContextMenu={skin ? taskbarMenu : undefined}>
      {skin && <StartButton />}
      <NowSong like={false} />
      <div className="middle">
        <div className="tools transport">
          <button className="tool" aria-label="Previous" title="Previous" onClick={() => send('previous')}><SkipBack size={18} fill="currentColor" /></button>
          {/* One button that says what it will do, as the Centred bar's does. */}
          <button className="tool" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'} onClick={() => send('toggle')}>
            {status === 'resolving' ? <Spinner /> : playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          {stopButton && <StopButton flat size={16} />}
          <button className="tool" aria-label="Next" title="Next" disabled={queue?.hasNext === false} onClick={() => send('next')}><SkipForward size={18} fill="currentColor" /></button>
        </div>
        <SeekBar playback={playback} times="after" />
        <div className="tools song-tools">
          {/* Kept in its place, off, where the song cannot be liked from here, so the row does not shift. */}
          <button className={cls('tool', liked && 'on')} data-button="LIKE" aria-label={liked ? 'Unlike' : 'Like'} title={liked ? 'Unlike' : 'Like'}
            disabled={!likeable} onClick={() => track && send('like', { track })}>
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button className="tool goes-first" data-button="LYRICS" aria-label="Lyrics" title="Lyrics" onClick={() => openNowPlaying('lyrics')}><Mic2 size={18} /></button>
          <button className="tool goes-first" data-button="QUEUE" aria-label="Queue" title="Queue" onClick={() => openNowPlaying('queue')}><ListMusic size={18} /></button>
        </div>
        <div className="tools modes">
          <button className={cls('tool', queue?.repeat !== 'off' && 'on')} data-button="REPEAT" aria-label="Repeat" title="Repeat" onClick={() => send('repeat')}>
            {queue?.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
          <button className={cls('tool', queue?.shuffle && 'on')} data-button="SHUFFLE" aria-label="Shuffle" title="Shuffle" onClick={() => send('shuffle')}><Shuffle size={18} /></button>
        </div>
        <div className="tools extras">
          <button className={cls('tool goes-next', sleeping && 'on under-way')} data-button="SLEEP_TIMER" aria-label="Sleep timer" title="Sleep timer"
            onClick={(e) => openMenu(e, <SleepMenu />)}><Moon size={18} /></button>
          {!HOSTED && (
            <button className={cls('tool', elsewhere && 'on')} data-button="DEVICES" aria-label="Where it plays" title="Where it plays"
              onClick={(e) => openMenu(e, <OutputMenu />)}><MonitorSpeaker size={18} /></button>
          )}
          {/* The speed itself while it is not the song's own, as the volume shows its boost. */}
          {!HOSTED && (
            <button className={cls('tool speed goes-next', changed && 'on under-way')} data-button="SPEED" aria-label={`Speed, ${speedName(speed)}`} title={`Speed, ${speedName(speed)}`}
              onClick={(e) => openMenu(e, <SpeedMenu />)}>
              {changed ? <span className="speed-mark">{speedName(speed)}</span> : <Gauge size={18} />}
            </button>
          )}
          <VolumeButton className="tool" />
        </div>
      </div>
      <div className="right">
        <Chips />
        <NowPlayingButton />
        {skin && <TrayClock />}
      </div>
    </footer>
  );
}

/** The track and its controls on a phone's lock screen, and the keyboard's media keys. */
export function MediaSession() {
  const playback = usePart('playback');
  const track = playback?.track;
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = track ? new MediaMetadata({
      title: track.title,
      artist: track.artistLine,
      album: track.album?.title ?? '',
      artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: '512x512' }] : [],
    }) : null;
  }, [track?.key, track?.title, track?.artworkUrl]);
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    session.playbackState = playback?.status === 'playing' ? 'playing' : playback?.track ? 'paused' : 'none';
  }, [playback?.status, playback?.track]);
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => send('toggle')],
      ['pause', () => send('toggle')],
      ['nexttrack', () => send('next')],
      ['previoustrack', () => send('previous')],
      // A keyboard's Stop key: pause and back to the start, as the Stop button does.
      ['stop', () => send('stop')],
      ['seekto', (details) => { if (details.seekTime != null) send('seek', { positionMs: Math.round(details.seekTime * 1000) }); }],
    ];
    handlers.forEach(([action, handler]) => { try { session.setActionHandler(action, handler); } catch { /* not offered here */ } });
    return () => handlers.forEach(([action]) => { try { session.setActionHandler(action, null); } catch { /* not offered */ } });
  }, []);
  return null;
}
