import * as VolumeBoost from './base/volumeBoost';
import { ANALYSER_FFT_SIZE, BAND_COUNT, bandLevels, blackmanPower, meanSquareFromDecibels, peakAndRms, type AnalysisKind } from './base/visualiser';

/*
 * The sound this page makes itself, through Web Audio: the volume booster and what the visualiser sees.
 *
 *   audio element → MediaElementSource → [boost → limiter → soft clip] → [analysers] → volume → speakers
 *
 * The boost is a gain from 1 to 10, as Base's VolumeBoost has it, behind a DynamicsCompressorNode set as a limiter:
 * threshold −3 dB, no knee, ratio 20, no attack, a tenth of a second's release. A browser's compressor adds its own
 * make-up gain (0.6 of what its curve takes off a full-scale signal, +1.7 dB here), which the boost gives back, so
 * 200% is +6 dB and 400% +12 dB on anything the limiter leaves alone, exactly as mpv's are. Its attack still lets
 * the first millisecond of a drum through, so after it a soft clip rounds whatever is left over full scale instead
 * of the speakers squaring it off. Measured in Chrome by rendering offline: a 1 kHz tone at ×2 and ×4 came out
 * +6.02 and +12.04 dB louder; noise peaking at −12 dBFS, at 1000%, peaked at −0.4 dBFS, 11.6 dB louder; drum-like
 * hits at full scale, at 1000%, never went over (scratchpad/audacious/web/tools/limiter.mjs). At 100% the three
 * are left out of the way altogether, as mpv's filter is.
 *
 * The analysers hang off the sound after the boost and before the volume -- where mpv's meter is -- so the
 * visualiser shows the music rather than the volume knob. Nothing is measured while nothing watches: they are
 * connected only while a visualiser on screen asks (watch()), and read only in that visualiser's animation frames.
 *
 * Three things a browser asks of this, all minded here:
 * - An element whose sound goes through Web Audio is heard only while the AudioContext runs, and a context made
 *   before the page was touched waits for a tap or a key. So the element is connected only once the context runs;
 *   until then it plays as it always did, unboosted, and the booster says it starts at the next tap.
 * - The sound of a file from another site reaches Web Audio as silence unless that site allows it (CORS). Every
 *   stream `noctorium web` gives is its own address; the hosted player's SoundCloud MP3s are asked for with
 *   crossOrigin, which SoundCloud's servers allow, and its HLS goes through hls.js into a Media Source, which is
 *   this page's own. A stream that could not be asked for that way is marked, and never connected (audio.ts).
 * - Once connected, an element stays connected: the browser has no way back. So the graph is made only when it
 *   is first wanted -- a boost, or a visualiser -- and from then on routes round whatever is not in use.
 */

type Listener = () => void;

/** The limiter's settings; see above. */
const LIMITER = { threshold: -3, knee: 0, ratio: 20, attack: 0, release: 0.1 };

/** What the compressor's make-up gain adds, in dB, which the boost takes back off so a level means what it says. */
const MAKEUP_DB = -0.6 * LIMITER.threshold * (1 - 1 / LIMITER.ratio);

/** Where the soft clip starts bending, as a sample's size: −1 dBFS. */
const CLIP_KNEE = 0.89;

/** The soft clip's curve, for samples up to twice full scale (the shaper is fed half of each): straight to the knee, then curving into 1. */
function clipCurve(): Float32Array<ArrayBuffer> {
  const n = 8193;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = 2 * ((i / (n - 1)) * 2 - 1);
    const size = Math.abs(x);
    curve[i] = Math.sign(x) * (size <= CLIP_KNEE ? size : CLIP_KNEE + (1 - CLIP_KNEE) * Math.tanh((size - CLIP_KNEE) / (1 - CLIP_KNEE)));
  }
  return curve;
}

/** How a level meter reads each channel: about 40 milliseconds of it at a time. */
const METER_SIZE = 2048;

class Sound {
  private context?: AudioContext;
  private element?: HTMLMediaElement;
  private source?: MediaElementAudioSourceNode;
  private boost?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private half?: GainNode;
  private clip?: WaveShaperNode;
  private volumeNode?: GainNode;
  private analyser?: AnalyserNode;
  private splitter?: ChannelSplitterNode;
  private meters: AnalyserNode[] = [];
  private decibels = new Float32Array(ANALYSER_FFT_SIZE / 2);
  private meanSquare = new Float32Array(ANALYSER_FFT_SIZE / 2);
  private samples = new Float32Array(METER_SIZE);
  private windowPower = 0;
  private listeners = new Set<Listener>();
  private watching: Record<'SPECTRUM' | 'LEVELS', number> = { SPECTRUM: 0, LEVELS: 0 };
  private volume = 0.72;
  private muted = false;
  private boostedRoute = false;
  private unroute = 0;
  private waitingForTap = false;
  /** The boost asked for, from 100 to 1000. */
  percent = VolumeBoost.OFF_PERCENT;
  /** False where this browser has no Web Audio at all. */
  readonly supported = typeof window !== 'undefined' && typeof window.AudioContext === 'function';
  /** Whether what is loaded now may go through the graph; see audio.ts. */
  private reachable = true;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Counts every change, for a component that wants to know one happened. */
  version = 0;

  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  /** The element the page plays through. Its volume is set here from now on, on it or in the graph. */
  bind(element: HTMLMediaElement) {
    this.element = element;
    this.applyVolume();
  }

  /** Whether the element's sound goes through Web Audio now. */
  get connected() {
    return !!this.source;
  }

  /** Whether the graph is wanted and only waits for the browser to let the sound start: a tap, or a key. */
  get waiting() {
    return this.wanted && !this.source && this.reachable && this.supported && this.context?.state !== 'running';
  }

  /** Whether what plays now can be boosted and seen: Web Audio is here, and the stream allows it. */
  get reaches() {
    return this.supported && this.reachable;
  }

  private get wanted() {
    return VolumeBoost.isOn(this.percent) || this.watching.SPECTRUM + this.watching.LEVELS > 0;
  }

  /** Whether the stream loaded now may go through the graph; a stream from another site without CORS may not. */
  setReachable(reachable: boolean) {
    if (this.reachable === reachable) return;
    this.reachable = reachable;
    this.ensure();
    this.changed();
  }

  setVolume(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
    this.applyVolume();
  }

  setBoost(percent: number) {
    this.percent = VolumeBoost.clamp(percent);
    this.ensure();
    this.route();
    this.changed();
  }

  /**
   * A visualiser on screen, wanting [kind] measured until the function this returns is called. Only then are the
   * analysers in the graph at all.
   */
  watch(kind: AnalysisKind): () => void {
    if (kind === 'NONE') return () => undefined;
    this.watching[kind]++;
    this.ensure();
    this.route();
    this.changed();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.watching[kind]--;
      this.route();
      this.changed();
    };
  }

  /** The spectrum now, into [out] (ten bands, 0 to 1); false while the graph cannot see the sound. */
  spectrum(out: number[]): boolean {
    const analyser = this.analyser;
    if (!analyser || !this.source || this.context?.state !== 'running' || !this.watching.SPECTRUM) return false;
    analyser.getFloatFrequencyData(this.decibels);
    meanSquareFromDecibels(this.decibels, analyser.fftSize, this.windowPower, this.meanSquare);
    bandLevels(this.meanSquare, this.context.sampleRate / analyser.fftSize, out);
    return true;
  }

  /**
   * Each channel's peak and RMS now, left first, into [peaks] and [rms]; how many channels, or 0 while the graph
   * cannot see the sound. A mono stream has nothing in its second channel, and is said to be one.
   */
  levels(peaks: number[], rms: number[]): number {
    if (!this.source || this.context?.state !== 'running' || !this.watching.LEVELS || this.meters.length < 2) return 0;
    let channels = 0;
    for (let i = 0; i < 2; i++) {
      this.meters[i].getFloatTimeDomainData(this.samples);
      [peaks[i], rms[i]] = peakAndRms(this.samples);
      if (i === 0 || peaks[i] > 0 || peaks[0] === 0) channels = i + 1;
    }
    return channels;
  }

  /** Makes the graph once it is wanted, the stream allows it and the browser lets the sound start. */
  private ensure() {
    if (this.source || !this.wanted || !this.reachable || !this.supported || !this.element) return;
    if (!this.context) {
      try {
        this.context = new AudioContext({ latencyHint: 'playback' });
      } catch {
        return;
      }
      this.context.addEventListener('statechange', () => {
        this.ensure();
        this.changed();
      });
      this.windowPower = blackmanPower(ANALYSER_FFT_SIZE);
    }
    if (this.context.state !== 'running') {
      this.waitForTap();
      this.context.resume().catch(() => undefined);
      return;
    }
    this.build(this.context, this.element);
  }

  /** A browser starts sound only for a tap or a key; the next one, anywhere, lets the graph start. */
  private waitForTap() {
    if (this.waitingForTap) return;
    this.waitingForTap = true;
    const resume = () => {
      this.context?.resume().then(() => this.ensure(), () => undefined);
      if (this.context?.state === 'running' || this.source) stop();
    };
    const stop = () => {
      this.waitingForTap = false;
      for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(type, resume, true);
    };
    for (const type of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(type, resume, true);
    this.context?.addEventListener('statechange', () => { if (this.context?.state === 'running') stop(); });
    this.changed();
  }

  private build(c: AudioContext, element: HTMLMediaElement) {
    this.source = c.createMediaElementSource(element);
    this.boost = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = LIMITER.threshold;
    this.limiter.knee.value = LIMITER.knee;
    this.limiter.ratio.value = LIMITER.ratio;
    this.limiter.attack.value = LIMITER.attack;
    this.limiter.release.value = LIMITER.release;
    this.half = c.createGain();
    this.half.gain.value = 0.5;
    this.clip = c.createWaveShaper();
    this.clip.curve = clipCurve();
    this.clip.oversample = 'none';
    this.boost.connect(this.limiter);
    this.limiter.connect(this.half);
    this.half.connect(this.clip);
    this.volumeNode = c.createGain();
    this.volumeNode.connect(c.destination);
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = ANALYSER_FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0;
    this.splitter = c.createChannelSplitter(2);
    this.meters = [0, 1].map((channel) => {
      const meter = c.createAnalyser();
      meter.fftSize = METER_SIZE;
      this.splitter!.connect(meter, channel);
      return meter;
    });
    // From here on the listener's volume is the graph's, and the element plays at full into it.
    element.volume = 1;
    element.muted = false;
    this.boostedRoute = false;
    this.route();
    this.applyVolume();
    this.changed();
  }

  /** Connects what is in use: the boost when it is on, the analysers being watched. */
  private route() {
    const c = this.context;
    const source = this.source;
    if (!c || !source || !this.boost || !this.clip || !this.volumeNode) return;
    const boosted = VolumeBoost.isOn(this.percent);
    const level = VolumeBoost.factor(this.percent) * Math.pow(10, -MAKEUP_DB / 20);
    const now = c.currentTime;
    window.clearTimeout(this.unroute);
    if (boosted) {
      if (!this.boostedRoute) {
        // Into the boost at no boost, then up to the level, so switching it on is a quick swell rather than a jump.
        this.boost.gain.cancelScheduledValues(now);
        this.boost.gain.setValueAtTime(Math.pow(10, -MAKEUP_DB / 20), now);
        this.reconnect(true);
      }
      this.boost.gain.setTargetAtTime(level, now, 0.03);
    } else if (this.boostedRoute) {
      // Down to no boost first, then round the limiter once it is there.
      this.boost.gain.setTargetAtTime(Math.pow(10, -MAKEUP_DB / 20), now, 0.03);
      this.unroute = window.setTimeout(() => this.reconnect(false), 160);
    } else {
      this.reconnect(false);
    }
  }

  private reconnect(boosted: boolean) {
    const source = this.source!;
    const tail: AudioNode = boosted ? this.clip! : source;
    source.disconnect();
    this.clip!.disconnect();
    if (boosted) source.connect(this.boost!);
    tail.connect(this.volumeNode!);
    if (this.watching.SPECTRUM) tail.connect(this.analyser!);
    if (this.watching.LEVELS) tail.connect(this.splitter!);
    this.boostedRoute = boosted;
  }

  private applyVolume() {
    const element = this.element;
    if (this.source && this.volumeNode && this.context) {
      this.volumeNode.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.015);
    } else if (element) {
      element.volume = this.volume;
      element.muted = this.muted;
    }
  }
}

export const sound = new Sound();

/** The bands a spectrum has, for a visualiser to size its arrays. */
export const SPECTRUM_BANDS = BAND_COUNT;
