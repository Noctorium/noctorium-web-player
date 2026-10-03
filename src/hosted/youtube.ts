import { live } from '../live';

/*
 * YouTube's own embedded player, as the hosted player's speaker for YouTube and YouTube Music.
 *
 * A page on another site may not fetch YouTube's audio, and a server fetching it for the page would be both
 * against YouTube's terms and blocked from a data centre anyway. The embedded player is the way YouTube offers
 * other sites to play its videos, so that is what plays them here: in the listener's browser, from their own
 * connection, under YouTube's terms -- which ask that the player be shown, at least 200 by 200, and not
 * hidden. It is: <YouTubeStage> puts it where the cover would be on the now playing screen, and in a small
 * card in the corner otherwise.
 *
 * It takes the same instructions as the audio element in audio.ts -- load, play, pause, seek -- and reports
 * the same events, so the engine treats the two alike.
 */

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

type Message = { command: string; generation: number; [field: string]: any };

let api: Promise<any> | undefined;

function loadApi(): Promise<any> {
  return (api ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      api = undefined;
      reject(new Error('YouTube’s player could not be loaded. Is something blocking youtube.com?'));
    };
    document.head.appendChild(script);
  }));
}

const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const ENDED = 0;

const problems: Record<number, string> = {
  2: 'YouTube did not recognise this video',
  5: 'YouTube’s player could not play this here',
  100: 'This video has been removed, or is private',
  101: 'Its owner does not let it play outside YouTube',
  150: 'Its owner does not let it play outside YouTube',
  153: 'YouTube’s player needs this page’s address to play; is the browser hiding it?',
};

class YouTubeSink {
  /** The box the player lives in, placed on the page by <YouTubeStage>. Never moved in the document, since moving an iframe reloads it. */
  readonly stage: HTMLDivElement;
  private mount: HTMLDivElement;
  private player?: any;
  private creating?: Promise<any>;
  private generation = -1;
  private timer = 0;
  private startCheck = 0;
  private looping = false;
  private volume = 0.72;
  private muted = false;
  private listeners = new Set<() => void>();
  /** True while a YouTube track is loaded, so the stage shows. */
  active = false;
  /** The video showing, for the stage's title. */
  title = '';

  constructor() {
    this.stage = document.createElement('div');
    this.stage.className = 'yt-stage';
    this.mount = document.createElement('div');
    this.stage.appendChild(this.mount);
    document.body.appendChild(this.stage);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private changed() {
    this.listeners.forEach((l) => l());
  }

  private report(event: string, extra: Record<string, unknown> = {}) {
    if (this.generation < 0) return;
    const p = this.player;
    const position = p?.getCurrentTime?.();
    const duration = p?.getDuration?.();
    live.report({
      event,
      generation: this.generation,
      positionMs: Number.isFinite(position) ? Math.round(position * 1000) : undefined,
      durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : undefined,
      ...extra,
    });
  }

  /** What should be playing, which may have changed while the player was still being made. */
  private wanted = { videoId: '', start: 0 };

  private ensure(videoId: string, startSeconds: number): Promise<any> {
    this.wanted = { videoId, start: startSeconds };
    if (this.player) {
      this.player.loadVideoById({ videoId, startSeconds });
      return Promise.resolve(this.player);
    }
    this.creating ??= loadApi().then((YT) => new Promise((resolve) => {
      const first = this.wanted;
      const player = new YT.Player(this.mount, {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        videoId: first.videoId,
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0, start: Math.floor(first.start), origin: location.origin },
        events: {
          onReady: () => {
            this.player = player;
            this.applyVolume();
            const now = this.wanted;
            if (this.generation < 0) player.stopVideo();
            else if (now.videoId !== first.videoId) player.loadVideoById({ videoId: now.videoId, startSeconds: now.start });
            else player.playVideo();
            resolve(player);
          },
          onStateChange: (e: { data: number }) => this.state(e.data),
          onError: (e: { data: number }) => this.report('error', { message: problems[e.data] ?? 'YouTube’s player stopped' }),
        },
      });
    }));
    // A player that could not be made is tried again on the next track rather than never.
    this.creating.catch(() => { this.creating = undefined; });
    return this.creating;
  }

  private applyVolume() {
    const p = this.player;
    if (!p) return;
    p.setVolume(Math.round(this.volume * 100));
    if (this.muted) p.mute();
    else p.unMute();
  }

  private state(state: number) {
    window.clearInterval(this.timer);
    switch (state) {
      case PLAYING:
        window.clearTimeout(this.startCheck);
        this.report('playing');
        this.timer = window.setInterval(() => this.report('time'), 500);
        break;
      case PAUSED:
        this.report('paused');
        break;
      case BUFFERING:
        this.report('waiting');
        break;
      case ENDED:
        if (this.looping) {
          this.player?.seekTo(0, true);
          this.player?.playVideo();
          this.report('looped');
        } else this.report('ended');
        break;
    }
  }

  command(message: Message) {
    const p = this.player;
    switch (message.command) {
      case 'load': {
        this.generation = message.generation;
        this.active = true;
        this.title = message.title ?? '';
        this.looping = !!message.loop;
        this.volume = clamp(message.volume ?? this.volume);
        this.muted = !!message.muted;
        // Shown before the player is made, not after React gets round to it: YouTube's player will not start
        // by itself while it is too small to see, and inside a hidden box it is nothing by nothing.
        if (!this.stage.classList.contains('in-slot')) this.stage.classList.add('floating');
        this.stage.classList.add('on');
        this.changed();
        const generation = message.generation;
        this.ensure(message.videoId, (message.startMs ?? 0) / 1000).catch((error) => {
          if (generation === this.generation) this.report('error', { message: error.message });
        });
        // A phone may refuse to start a video nobody tapped; the video is on screen, so a tap on it starts it.
        window.clearTimeout(this.startCheck);
        this.startCheck = window.setTimeout(() => {
          const state = this.player?.getPlayerState?.();
          if (generation === this.generation && state !== PLAYING && state !== BUFFERING) {
            live.notice('Tap the video to start it — the browser asks for that once');
          }
        }, 6000);
        break;
      }
      case 'play':
        p?.playVideo();
        break;
      case 'pause':
        p?.pauseVideo();
        break;
      case 'seek':
        if (Number.isFinite(message.positionMs)) {
          p?.seekTo(message.positionMs / 1000, true);
          this.report('time');
        }
        break;
      case 'volume':
        this.volume = clamp(message.volume);
        this.applyVolume();
        break;
      case 'mute':
        this.muted = !!message.muted;
        this.applyVolume();
        break;
      case 'loop':
        this.looping = !!message.loop;
        break;
      case 'stop':
      case 'release':
        window.clearInterval(this.timer);
        window.clearTimeout(this.startCheck);
        p?.stopVideo?.();
        this.generation = -1;
        this.stage.classList.remove('on');
        if (this.active) {
          this.active = false;
          this.changed();
        }
        break;
    }
  }
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.72));
}

export const youtube = new YouTubeSink();
