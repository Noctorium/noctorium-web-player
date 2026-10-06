import { useEffect, useState } from 'react';
import {
  ChevronUp, Heart, ListMusic, Mic2, Monitor, MonitorSpeaker, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack,
  SkipForward, Smartphone, Volume1, Volume2, VolumeX, Moon,
} from 'lucide-react';
import { audio } from '../audio';
import { live, send, usePart } from '../live';
import { openMenu, openNowPlaying, useUi, closeNowPlaying } from '../ui';
import { canLike, cls, formatTime, isLiked } from '../util';
import { Cover, Spinner } from './Common';
import type { Playback } from '../types';
import { HOSTED } from '../mode';

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

/** The seek bar, in whichever of Noctorium's six styles is chosen. */
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
      className={cls('bar', style)}
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
  return (
    <footer className="player">
      <div className="mini-progress"><i style={{ width: `${fraction * 100}%` }} /></div>
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
