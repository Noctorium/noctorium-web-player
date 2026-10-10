import type Hls from 'hls.js';
import { live } from './live';
import { HOSTED } from './mode';
import { sound } from './sound';

/** hls.js, fetched the first time a track needs it: most never do, and it is half the page's weight. */
let hlsModule: Promise<typeof import('hls.js')> | undefined;
const loadHls = () => (hlsModule ??= import('hls.js'));

/*
 * This tab as Noctorium's speaker.
 *
 * Noctorium decides what plays; this only does as it is told -- load this, play, pause, go to 1:23 -- and
 * says what the audio element is doing, so the queue moves on when a track ends and a listen is counted as
 * it would be anywhere else. The address it is given is Noctorium's own, which fetches the service's audio
 * for it. HLS, which is how SoundCloud sends much of its catalogue, goes through hls.js wherever hls.js runs --
 * which is what Web Audio can hear -- and through the browser's own HLS only where it cannot, as on an old iPhone.
 *
 * The volume and the booster are sound.ts's: on the element, or in Web Audio once the booster or a visualiser
 * has wanted it there. And the tab says what it can tell of the stream -- the codec and channels hls.js found,
 * the bitrate of an MP3 stream measured as it arrives -- for the status bar.
 *
 * The Media Session API puts the track and its controls on a phone's lock screen and on a keyboard's media
 * keys, so a phone in a pocket behaves like a music player rather than a web page.
 */

type Message = { command: string; generation: number; [field: string]: any };

class Audio {
  /**
   * The element that plays. Web Audio takes it over for good once the booster or a visualiser wants the sound,
   * and a stream Web Audio may not hear -- another site's, sent without CORS -- would be silent in it then; such
   * a stream plays in a second, plain element instead, made the first time one turns up.
   */
  private main: HTMLAudioElement;
  private plain?: HTMLAudioElement;
  private current: HTMLAudioElement;
  private hls?: Hls;
  private generation = -1;
  private lastTime = 0;
  private looping = false;
  private volume = 0.72;
  private muted = false;
  /** The stream loaded now, for loading it again a second way. */
  private loaded?: { url: string; hls: boolean; crossOrigin: boolean };
  /** True while this tab is the one playing, so the page can say so. */
  active = false;
  private onChange = new Set<() => void>();
  private previousPosition = 0;
  /** What hls.js has said about the stream, and the bytes and seconds of MP3 counted for its bitrate. */
  private format: { codec?: string; channels?: number; bitsPerSecond?: number } = {};
  private counted = { bytes: 0, seconds: 0 };

  constructor() {
    this.main = this.make();
    this.current = this.main;
    sound.bind(this.main);
  }

  /** The element playing now. */
  get element(): HTMLAudioElement {
    return this.current;
  }

  private make(): HTMLAudioElement {
    const a = document.createElement('audio');
    a.preload = 'auto';
    // Only the element playing now speaks for the tab; the other is quiet until it is used.
    const mine = () => a === this.current;
    a.addEventListener('playing', () => mine() && this.report('playing'));
    a.addEventListener('pause', () => { if (mine() && !a.ended) this.report('paused'); });
    a.addEventListener('waiting', () => mine() && this.report('waiting'));
    a.addEventListener('ended', () => mine() && this.report('ended'));
    a.addEventListener('error', () => { if (mine() && !this.retried()) this.report('error', { message: this.describeError() }); });
    a.addEventListener('timeupdate', () => {
      if (!mine()) return;
      const now = performance.now();
      if (now - this.lastTime < 450) return;
      this.lastTime = now;
      // A looping element never ends: a jump back to the start is the loop going round.
      if (this.looping && a.currentTime < 0.6 && this.previousPosition > 2) this.report('looped');
      this.previousPosition = a.currentTime;
      this.report('time');
    });
    return a;
  }

  subscribe(listener: () => void) {
    this.onChange.add(listener);
    return () => this.onChange.delete(listener);
  }

  private changed() {
    this.onChange.forEach((l) => l());
  }

  private describeError(): string {
    const code = this.current.error?.code;
    if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return 'This browser cannot play this track’s audio';
    if (code === MediaError.MEDIA_ERR_NETWORK) return 'The audio stopped arriving';
    return 'The browser could not play this';
  }

  private report(event: string, extra: Record<string, unknown> = {}) {
    if (this.generation < 0) return;
    const a = this.current;
    live.report({
      event,
      generation: this.generation,
      positionMs: Math.round((a.currentTime || 0) * 1000),
      durationMs: Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : undefined,
      ...extra,
    });
  }

  command(message: Message) {
    const a = this.current;
    switch (message.command) {
      case 'load':
        this.generation = message.generation;
        this.active = true;
        this.looping = !!message.loop;
        this.volume = clamp(message.volume ?? this.volume);
        this.muted = !!message.muted;
        if (Number.isFinite(message.boostPercent)) sound.setBoost(message.boostPercent);
        this.format = {};
        this.counted = { bytes: 0, seconds: 0 };
        this.load(message.url, !!message.hls, message.generation);
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
        this.volume = clamp(message.volume);
        this.applyVolume();
        break;
      case 'mute':
        this.muted = !!message.muted;
        this.applyVolume();
        break;
      case 'boost':
        if (Number.isFinite(message.percent)) sound.setBoost(message.percent);
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

  /** The volume, through Web Audio for the element it has, on the element itself for the plain one. */
  private applyVolume() {
    if (this.current === this.main) sound.setVolume(this.volume, this.muted);
    else {
      this.current.volume = this.volume;
      this.current.muted = this.muted;
    }
  }

  /**
   * A browser refuses to start sound that no click asked for. The first track loaded after the page opened
   * can meet that; the next tap anywhere on the page starts it.
   */
  private blocked(error: unknown) {
    if ((error as DOMException)?.name !== 'NotAllowedError') return;
    live.notice('Tap anywhere to start the sound — the browser asks for that once');
    const element = this.current;
    const resume = () => {
      element.play().catch(() => undefined);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  /**
   * Loads [url] into the element Web Audio can hear it through, if it can: every address `noctorium web` gives is
   * its own, and the hosted player's SoundCloud MP3s are asked for with crossOrigin, which SoundCloud allows.
   */
  private async load(url: string, hls: boolean, generation: number) {
    this.unload();
    this.use(this.main);
    const crossOrigin = HOSTED && !hls;
    this.loaded = { url, hls, crossOrigin };
    await this.attach(url, hls, crossOrigin);
    if (generation !== this.generation) return;
    this.current.play().catch((error) => this.blocked(error));
  }

  /**
   * A stream that would not load with crossOrigin is another site's that does not allow it: it is loaded again
   * without, which Web Audio hears as silence, so it plays in the plain element if Web Audio has the main one, and
   * the booster and the visualiser sit this one out. True when it was tried again.
   */
  private retried(): boolean {
    const loaded = this.loaded;
    if (!loaded?.crossOrigin || this.current.currentTime > 0) return false;
    this.loaded = { ...loaded, crossOrigin: false };
    sound.setReachable(false);
    this.unload(false);
    this.use(sound.connected ? (this.plain ??= this.make()) : this.main);
    const generation = this.generation;
    this.attach(loaded.url, loaded.hls, false).then(() => {
      if (generation === this.generation) this.current.play().catch((error) => this.blocked(error));
    });
    return true;
  }

  private use(element: HTMLAudioElement) {
    if (this.current !== element) {
      this.current.pause();
      this.current = element;
    }
    element.loop = this.looping;
    this.applyVolume();
  }

  private async attach(url: string, hls: boolean, crossOrigin: boolean) {
    const a = this.current;
    // hls.js wherever it works, into a Media Source of this page's own, which Web Audio hears; a browser's own HLS
    // -- Safari's, and lately Chrome's -- only where hls.js cannot run, since Safari's reaches Web Audio as silence.
    const native = hls && !!a.canPlayType('application/vnd.apple.mpegurl');
    if (hls) {
      const { default: Hls } = await loadHls();
      if (Hls.isSupported()) {
        // Noctorium's own address wants its cookie; SoundCloud's servers, which the hosted player reads
        // from directly, answer any page only when no cookie is sent.
        const player = new Hls(HOSTED ? {} : { xhrSetup: (xhr) => { xhr.withCredentials = true; } });
        player.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) this.report('error', { message: 'The stream could not be read' });
        });
        player.on(Hls.Events.BUFFER_CODECS, (_, data) => {
          const track = data.audio ?? data.audiovideo;
          this.described({ codec: track?.codec || track?.container, channels: track?.metadata?.channelCount });
        });
        player.on(Hls.Events.FRAG_LOADED, (_, data) => this.measure(data.payload.byteLength, data.frag.duration, player));
        player.loadSource(url);
        player.attachMedia(a);
        this.hls = player;
        sound.setReachable(a === this.main);
        return;
      }
    }
    // A browser's own HLS, or a plain file: Web Audio hears the second, and is not trusted with the first.
    sound.setReachable(a === this.main && !(hls && native) && (crossOrigin || !HOSTED));
    if (crossOrigin) a.crossOrigin = 'anonymous';
    else a.removeAttribute('crossorigin');
    a.src = url;
  }

  /** What hls.js found the stream to be, passed on when it adds something. */
  private described(found: { codec?: string; channels?: number; bitsPerSecond?: number }) {
    const next = {
      codec: found.codec ?? this.format.codec,
      channels: found.channels ?? this.format.channels,
      bitsPerSecond: found.bitsPerSecond ?? this.format.bitsPerSecond,
    };
    if (next.codec === this.format.codec && next.channels === this.format.channels && next.bitsPerSecond === this.format.bitsPerSecond) return;
    this.format = next;
    this.report('format', Object.fromEntries(Object.entries(next).filter(([, v]) => v != null)));
  }

  /**
   * An MP3 stream's bitrate, from the segments as they arrive: an MP3 segment is the codec's frames and nothing
   * else, so its size over its length is the bitrate. The playlist's own figure, where it gives one, comes first;
   * any other container would count its own overhead, so nothing is said for those.
   */
  private measure(bytes: number, seconds: number, player: Hls) {
    const declared = player.levels[player.currentLevel]?.bitrate;
    if (declared && declared > 0) return this.described({ bitsPerSecond: declared });
    if (!/mp3|mpeg/.test(this.format.codec ?? '') || !(seconds > 0)) return;
    this.counted = { bytes: this.counted.bytes + bytes, seconds: this.counted.seconds + seconds };
    if (this.counted.seconds < 8) return;
    // Rounded to 8 kbit/s, where MP3's own steps are, so a variable stream does not change the figure every segment.
    const kbits = Math.round((this.counted.bytes * 8) / this.counted.seconds / 8000) * 8;
    this.described({ bitsPerSecond: kbits * 1000 });
  }

  private unload(all = true) {
    this.hls?.destroy();
    this.hls = undefined;
    for (const element of all ? [this.main, this.plain] : [this.current]) {
      if (!element) continue;
      element.removeAttribute('src');
      element.load();
    }
    if (all) sound.setReachable(true);
  }
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.72));
}

export const audio = new Audio();
