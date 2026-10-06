import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  ChevronUp, Heart, ListMusic, Mic2, Monitor, MonitorSpeaker, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack,
  SkipForward, Smartphone, Volume1, Volume2, VolumeX, Moon,
} from 'lucide-react';
import { audio } from '../audio';
import { live, send, usePart } from '../live';
import { openMenu, openNowPlaying, useUi, closeNowPlaying } from '../ui';
import { canLike, cls, formatTime, isLiked } from '../util';
import { Cover, Spinner } from './Common';
import { StartButton, TrayClock, taskbarMenu, useSkin } from './Skin';
import type { Playback } from '../types';
import { HOSTED } from '../mode';
import { BARS_HEIGHT, BARS_PITCH, BARS_WIDTH, BEAD_HEAD_RADIUS, BEAD_PITCH, BEAD_RADIUS, RULER_MAJOR_TICK, RULER_POINTER, RULER_TICK, barHeights, rulerTicks } from '../seekbar';

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

/** The seek bar, in whichever of Noctorium's eleven styles is chosen. */
export function SeekBar({ playback, compact }: { playback?: Playback; compact?: boolean }) {
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
      style={{ ['--fill' as string]: `${fraction * 100}%` }}
      onChange={(e) => setDragging(Number(e.target.value))}
      onPointerUp={() => { if (dragging != null) { send('seek', { positionMs: Math.round(dragging) }); setDragging(null); } }}
      onKeyUp={() => { if (dragging != null) { send('seek', { positionMs: Math.round(dragging) }); setDragging(null); } }}
    />
  );
  return (
    <div className={cls('seek', playback?.status !== 'playing' && 'paused')}>
      {!compact && <span className="time">{formatTime(shown)}</span>}
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
      {!compact && <span className="time">{remaining && duration > 0 ? `-${formatTime(duration - shown)}` : formatTime(duration)}</span>}
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

export function Controls({ big }: { big?: boolean }) {
  const playback = usePart('playback');
  const queue = usePart('queue');
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
    <button className={cls('round-button', liked && 'on')} aria-label={liked ? 'Unlike' : 'Like'} onClick={() => send('like', { track })}>
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

export function PlayerBar() {
  const playback = usePart('playback');
  const { nowPlaying } = useUi();
  const track = playback?.track;
  const position = usePosition(playback);
  const fraction = playback && playback.durationMs > 0 ? position / playback.durationMs : 0;
  const VolumeIcon = playback?.muted || (playback?.volume ?? 1) === 0 ? VolumeX : (playback?.volume ?? 1) < 0.5 ? Volume1 : Volume2;
  const sleeping = playback?.sleep.kind !== 'off' && playback?.sleep;
  // In a Windows skin the bar's bottom row is a taskbar: a start button at its left, a clock in its tray if wanted,
  // and its own menu on a right-click.
  const skin = useSkin();
  return (
    <footer className="player" onContextMenu={skin ? taskbarMenu : undefined}>
      <div className="mini-progress"><i style={{ width: `${fraction * 100}%` }} /></div>
      {skin && <StartButton />}
      <div className="now">
        {track ? (
          <>
            <Cover url={track.artworkUrl} className="" />
            <div className="words" onClick={() => (nowPlaying ? closeNowPlaying() : openNowPlaying())}>
              <div className="title ellipsis">{track.title}</div>
              <div className="artist ellipsis">
                {playback?.status === 'resolving' ? 'Finding the audio…' : playback?.status === 'error' ? (playback.error ?? 'Could not play this')
                  : playback?.onSpotify ? `${track.artistLine} · on Spotify` : track.artistLine}
              </div>
            </div>
            <span className="hide-small"><LikeButton /></span>
          </>
        ) : (
          <div className="words faint">Nothing playing</div>
        )}
      </div>
      <div className="middle">
        <Controls />
        <SeekBar playback={playback} />
      </div>
      <div className="right">
        {playback?.onSpotify && <span className="output-chip hide-small"><MonitorSpeaker size={13} /> On Spotify</span>}
        {!HOSTED && !playback?.onSpotify && playback?.output === 'browser' && audio.active && <span className="output-chip hide-small"><Smartphone size={13} /> This browser</span>}
        {!HOSTED && !playback?.onSpotify && playback?.output === 'computer' && <span className="output-chip hide-small"><Monitor size={13} /> The computer</span>}
        {sleeping && <span className="output-chip"><Moon size={13} /> {sleeping.kind === 'endOfTrack' ? 'End of track' : formatTime(sleeping.remainingMs)}</span>}
        <button className="round-button" aria-label="Sleep timer" onClick={(e) => openMenu(e, <SleepMenu />)}><Moon size={18} /></button>
        <button className="round-button" aria-label="Lyrics" onClick={() => openNowPlaying('lyrics')}><Mic2 size={18} /></button>
        <button className="round-button" aria-label="Queue" onClick={() => openNowPlaying('queue')}><ListMusic size={18} /></button>
        {!HOSTED && <button className="round-button" aria-label="Where it plays" onClick={(e) => openMenu(e, <OutputMenu />)}><MonitorSpeaker size={18} /></button>}
        <button className="round-button" aria-label="Mute" onClick={() => send('mute')}><VolumeIcon size={18} /></button>
        <input
          className="bar volume"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={playback?.muted ? 0 : playback?.volume ?? 0.72}
          aria-label="Volume"
          style={{ ['--fill' as string]: `${(playback?.muted ? 0 : playback?.volume ?? 0.72) * 100}%` }}
          onChange={(e) => send('volume', { value: Number(e.target.value) })}
        />
        <button className="round-button" aria-label="Now playing" onClick={() => (nowPlaying ? closeNowPlaying() : openNowPlaying())}>
          <ChevronUp size={20} style={{ transform: nowPlaying ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
        </button>
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
      ['seekto', (details) => { if (details.seekTime != null) send('seek', { positionMs: Math.round(details.seekTime * 1000) }); }],
    ];
    handlers.forEach(([action, handler]) => { try { session.setActionHandler(action, handler); } catch { /* not offered here */ } });
    return () => handlers.forEach(([action]) => { try { session.setActionHandler(action, null); } catch { /* not offered */ } });
  }, []);
  return null;
}
