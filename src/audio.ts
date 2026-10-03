import type Hls from 'hls.js';
import { live } from './live';
import { HOSTED } from './mode';

/** hls.js, fetched the first time a track needs it: most never do, and it is half the page's weight. */
let hlsModule: Promise<typeof import('hls.js')> | undefined;
const loadHls = () => (hlsModule ??= import('hls.js'));

/*
 * This tab as Noctorium's speaker.
 *
 * Noctorium decides what plays; this only does as it is told -- load this, play, pause, go to 1:23 -- and
 * says what the audio element is doing, so the queue moves on when a track ends and a listen is counted as
 * it would be anywhere else. The address it is given is Noctorium's own, which fetches the service's audio
 * for it. HLS, which is how SoundCloud sends much of its catalogue, goes through hls.js except in Safari,
 * which plays it by itself.
 *
 * The Media Session API puts the track and its controls on a phone's lock screen and on a keyboard's media
 * keys, so a phone in a pocket behaves like a music player rather than a web page.
 */

type Message = { command: string; generation: number; [field: string]: any };

class Audio {
  readonly element: HTMLAudioElement;
  private hls?: Hls;
  private generation = -1;
  private lastTime = 0;
  private looping = false;
  /** True while this tab is the one playing, so the page can say so. */
  active = false;
  private onChange = new Set<() => void>();

  constructor() {
    this.element = document.createElement('audio');
    this.element.preload = 'auto';
    const a = this.element;
    a.addEventListener('playing', () => this.report('playing'));
    a.addEventListener('pause', () => { if (!a.ended) this.report('paused'); });
    a.addEventListener('waiting', () => this.report('waiting'));
    a.addEventListener('ended', () => this.report('ended'));
    a.addEventListener('error', () => this.report('error', { message: this.describeError() }));
    a.addEventListener('timeupdate', () => {
      const now = performance.now();
      if (now - this.lastTime < 450) return;
      this.lastTime = now;
      // A looping element never ends: a jump back to the start is the loop going round.
      if (this.looping && a.currentTime < 0.6 && this.previousPosition > 2) this.report('looped');
      this.previousPosition = a.currentTime;
      this.report('time');
    });
  }

  private previousPosition = 0;

  subscribe(listener: () => void) {
    this.onChange.add(listener);
    return () => this.onChange.delete(listener);
  }

  private changed() {
    this.onChange.forEach((l) => l());
  }

  private describeError(): string {
    const code = this.element.error?.code;
    if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return 'This browser cannot play this track’s audio';
    if (code === MediaError.MEDIA_ERR_NETWORK) return 'The audio stopped arriving';
    return 'The browser could not play this';
  }

  private report(event: string, extra: Record<string, unknown> = {}) {
    if (this.generation < 0) return;
    const a = this.element;
    live.report({
      event,
      generation: this.generation,
      positionMs: Math.round((a.currentTime || 0) * 1000),
      durationMs: Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : undefined,
      ...extra,
    });
  }

  command(message: Message) {
    const a = this.element;
    switch (message.command) {
      case 'load':
        this.generation = message.generation;
        this.active = true;
        this.looping = !!message.loop;
        a.loop = this.looping;
        a.volume = clamp(message.volume ?? a.volume);
        a.muted = !!message.muted;
        this.load(message.url, !!message.hls).then(() => a.play().catch((error) => this.blocked(error)));
        this.changed();
        break;
      case 'play':
        a.play().catch((error) => this.blocked(error));
        break;
      case 'pause':
        a.pause();
        break;
      case 'seek':
        if (Number.isFinite(message.positionMs)) a.currentTime = message.positionMs / 1000;
        break;
      case 'volume':
        a.volume = clamp(message.volume);
        break;
      case 'mute':
        a.muted = !!message.muted;
        break;
      case 'loop':
        this.looping = !!message.loop;
        a.loop = this.looping;
        break;
      case 'stop':
      case 'release':
        a.pause();
        this.unload();
        this.generation = -1;
        this.active = false;
        this.changed();
        break;
    }
  }

  /**
   * A browser refuses to start sound that no click asked for. The first track loaded after the page opened
   * can meet that; the next tap anywhere on the page starts it.
   */
  private blocked(error: unknown) {
    if ((error as DOMException)?.name !== 'NotAllowedError') return;
    live.notice('Tap anywhere to start the sound — the browser asks for that once');
    const resume = () => {
      this.element.play().catch(() => undefined);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  private async load(url: string, hls: boolean) {
    this.unload();
    const a = this.element;
    if (hls && !a.canPlayType('application/vnd.apple.mpegurl')) {
      const { default: Hls } = await loadHls();
      if (Hls.isSupported()) {
        // Noctorium's own address wants its cookie; SoundCloud's servers, which the hosted player reads
        // from directly, answer any page only when no cookie is sent.
        const player = new Hls(HOSTED ? {} : { xhrSetup: (xhr) => { xhr.withCredentials = true; } });
        player.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) this.report('error', { message: 'The stream could not be read' });
        });
        player.loadSource(url);
        player.attachMedia(a);
        this.hls = player;
        return;
      }
    }
    a.src = url;
  }

  private unload() {
    this.hls?.destroy();
    this.hls = undefined;
    this.element.removeAttribute('src');
    this.element.load();
  }
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.72));
}

export const audio = new Audio();
