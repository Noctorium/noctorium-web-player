import * as VolumeBoost from './base/volumeBoost';
import { ANALYSER_FFT_SIZE, BAND_COUNT, bandLevels, blackmanPower, meanSquareFromDecibels, peakAndRms, type AnalysisKind } from './base/visualiser';
import { BOOST_PROCESSOR, clipCurve } from './limiter';
import boostWorkletUrl from './boostWorklet.ts?worker&url';

/*
 * The sound this page makes itself, through Web Audio: the volume booster and what the visualiser sees.
 *
 *   audio element → MediaElementSource → volume ─┬─ dry ────────────────────────────────┬─ mix ─ mute → speakers
 *                                                 └─ boost → limiter → soft clip ── wet ──┘   └─ ÷ volume → [analysers]
 *
 * The booster is Base's VolumeBoost, which says why it is made the way it is: the listener's volume first, then
 * the boost, a gain from 1 to 10; then a limiter holding the peaks at CEILING × drive; then Base's soft clip,
 * bending what is left over towards CEILING, −0.5 dBFS, which it never reaches. The limiter is limiter.ts's, the
 * one every Noctorium player runs, and here it and the clip run in an AudioWorklet (boostWorklet.ts). Only a page
 * in a secure context may have a worklet, though, and `noctorium web` opened on a phone is plain http from another
 * computer on the house's network; there the browser's own DynamicsCompressorNode stands in for the limiter and a
 * WaveShaperNode carries the soft clip.
 *
 * Measured in Chrome by rendering offline through these very nodes: a loud master (−7.7 LUFS, peaks at −0.3 dBFS)
 * came out at −4.9, −3.1 and −1.7 LUFS at 200%, 400% and 1000% through the worklet, as Base's reference makes it
 * to the tenth, and at −4.9, −3.0 and −1.5 through the compressor; the old booster, a compressor holding everything
 * at full scale, managed −7.1, −6.4 and −5.7. Not one sample of any of it went past −0.5 dBFS, and nothing was
 * held flat at the top: three samples in a row came out the same only 17 times at 1000%, nearly all of them three
 * the same in the 16-bit recording already. (A tanh for the clip, as at first, was as loud, but in 32-bit floats it
 * stops dead at the ceiling as a hard clip does, and held 21,800 such runs, up to 228 samples long.) Noise peaking
 * at −12 dBFS came out 6.0 dB louder at 200%, untouched. At half volume, 200% left that noise exactly as it came,
 * and the master as loud as it came, with only the tops of its peaks rounded by the soft clip's knee at −1.9 dBFS.
 *
 * The compressor is set as a limiter would be: no knee, its highest ratio, no attack, RELEASE_MS's release, and
 * its threshold 0 dB, where it adds no make-up gain of its own. A ratio of 20 still lets a peak a little over, so
 * the sound is brought to it with the threshold 1 dB under the limiter's ceiling, which is where it comes nearest
 * the worklet; the shaper takes off whatever is still over, as the worklet's soft clip does, and holds anything
 * past the end of its curve just under CEILING. Its oversampling is left off: a 4× shaper's filters rang well past
 * 0 dBFS.
 *
 * At 100% the boost is out of the way altogether. Switching it on or off crosses from one way round to the other
 * over a few tens of milliseconds while the boost glides to its level, rather than cutting across: what comes out
 * of the limiter is LOOKAHEAD_MS behind (the compressor's own look-ahead is about the same), and a cut between the
 * two is a click. Played through, a 70 Hz tone moved by no more from one sample to the next while the boost was
 * switched on and off than it does anyway; the old booster, which cut across, jumped by up to 45 times that.
 *
 * The analysers hang off the mix, after the boost. The volume is in front of the boost, so there they would see
 * the volume knob; a gain of 1 ÷ volume in front of them takes it back out, and the visualiser shows the music as
 * the booster makes it, which is what reaches the speakers at full volume. (Below full volume, a boost the limiter
 * is already holding shows a little fuller than it is heard, since the booster spends the volume's slack first.)
 * Mute comes after them, so a muted song is still seen. Nothing is measured while nothing watches: the analysers
 * are connected only while a visualiser on screen asks (watch()), and read only in that visualiser's animation
 * frames.
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

/** How long a change of volume takes, as a time constant in seconds: quick, but not a click. */
const VOLUME_GLIDE = 0.015;

/** How long the boost takes to reach a new level, as a time constant in seconds: a quick swell rather than a jump. */
const SWELL = 0.03;

/** How long switching the boost on or off crosses from one way round to the other, as a time constant in seconds. */
const CROSSFADE = 0.02;

/**
 * How long after switching the boost on or off the crossing starts, in seconds. A connection is made between two
 * of the audio thread's blocks, which may be a few blocks after it is asked for, and the limiter has nothing to
 * give until LOOKAHEAD_MS of the sound has gone in; a crossing begun before then would bring the other way round
 * in from silence halfway through, which is a click.
 */
const PRIME = 0.05;

/** When the way round that has faded out is disconnected: by then it is more than 100 dB down. */
const SETTLE_MS = 300;

/** The quietest the volume node goes, −60 dB, so the analysers can still divide it back out; silence is the mute's to make. */
const QUIET = 0.001;

/** How long the booster's worklet may take to load before the compressor stands in for it after all. */
const WORKLET_PATIENCE_MS = 3000;

/** How far under the limiter's ceiling the compressor's threshold goes, in dB, for a ratio of 20 to come out near it. */
const COMPRESSOR_HEADROOM_DB = 1;

/** The largest sample the shaper's curve covers: past CEILING × drive at 1000% (2.99), with room for what the compressor lets over. */
const CLIP_RANGE = 4;

/** How a level meter reads each channel: about 40 milliseconds of it at a time. */
const METER_SIZE = 2048;

/** Moves [param] to [value] from [at], gliding with [timeConstant] seconds, or at once for 0. */
function glide(param: AudioParam, value: number, at: number, timeConstant: number) {
  if (timeConstant > 0) {
    param.setTargetAtTime(value, at, timeConstant);
  } else {
    param.cancelScheduledValues(at);
    param.setValueAtTime(value, at);
  }
}

/** The boost, the limiter and the soft clip, made by the worklet or by the browser's own nodes. */
export interface BoostChain {
  /** Where the sound goes in, at the listener's volume. */
  readonly input: AudioNode;
  /** Where it comes out, boosted and never past CEILING. */
  readonly output: AudioNode;
  /** Whether it is the worklet, rather than the compressor standing in for it. */
  readonly worklet: boolean;
  /** Sets the boost to [percent] from [at], gliding there with [timeConstant] seconds, or at once for 0. */
  level(percent: number, at: number, timeConstant: number): void;
}

/**
 * Loads the booster's worklet into [context]: whether it is there to be had. Not in a page that is not a secure
 * context, where the browser leaves audioWorklet out altogether, nor where it fails or takes too long to load.
 */
export function loadBoost(context: BaseAudioContext): Promise<boolean> {
  if (!context.audioWorklet || typeof AudioWorkletNode !== 'function') return Promise.resolve(false);
  const loaded = context.audioWorklet.addModule(boostWorkletUrl).then(() => true, () => false);
  const late = new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), WORKLET_PATIENCE_MS));
  return Promise.race([loaded, late]);
}

/** The booster in [context]: through the worklet if [worklet] says it was loaded, otherwise the browser's own nodes. */
export function boostChain(context: BaseAudioContext, worklet: boolean): BoostChain {
  if (worklet) {
    try {
      return workletChain(context);
    } catch {
      // A worklet that loaded but cannot be made is no worklet at all; the compressor stands in.
    }
  }
  return compressorChain(context);
}

function workletChain(c: BaseAudioContext): BoostChain {
  const boost = c.createGain();
  // Whatever comes in, mixed to two channels: the limiter holds them together.
  const limiter = new AudioWorkletNode(c, BOOST_PROCESSOR, {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers',
  });
  const ceiling = limiter.parameters.get('ceiling')!;
  boost.connect(limiter);
  return {
    input: boost,
    output: limiter,
    worklet: true,
    level(percent, at, timeConstant) {
      glide(boost.gain, VolumeBoost.factor(percent), at, timeConstant);
      glide(ceiling, VolumeBoost.CEILING * VolumeBoost.drive(percent), at, timeConstant);
    },
  };
}

function compressorChain(c: BaseAudioContext): BoostChain {
  // The boost, and the limiter's ceiling brought to the compressor's threshold, plus the headroom.
  const boost = c.createGain();
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = 0;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0;
  limiter.release.value = VolumeBoost.RELEASE_MS / 1000;
  // The threshold back to where it stands for, and into the shaper's range.
  const back = c.createGain();
  const clip = c.createWaveShaper();
  clip.curve = clipCurve(CLIP_RANGE);
  clip.oversample = 'none';
  boost.connect(limiter);
  limiter.connect(back);
  back.connect(clip);
  const headroom = Math.pow(10, COMPRESSOR_HEADROOM_DB / 20);
  return {
    input: boost,
    output: clip,
    worklet: false,
    level(percent, at, timeConstant) {
      const ceiling = VolumeBoost.CEILING * VolumeBoost.drive(percent);
      glide(boost.gain, (VolumeBoost.factor(percent) * headroom) / ceiling, at, timeConstant);
      glide(back.gain, ceiling / headroom / CLIP_RANGE, at, timeConstant);
    },
  };
}

class Sound {
  private context?: AudioContext;
  private element?: HTMLMediaElement;
  private source?: MediaElementAudioSourceNode;
  private volumeNode?: GainNode;
  private dry?: GainNode;
  private chain?: BoostChain;
  private wet?: GainNode;
  private mix?: GainNode;
  private output?: GainNode;
  private meter?: GainNode;
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
  /** Whether the booster's worklet loaded into the context; unknown until it has come or failed to. */
  private worklet?: boolean;
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
      loadBoost(this.context).then((worklet) => {
        this.worklet = worklet;
        this.ensure();
      });
    }
    if (this.context.state !== 'running') {
      this.waitForTap();
      this.context.resume().catch(() => undefined);
      return;
    }
    // The booster's worklet is still on its way; this comes round again once it is here, or will not be.
    if (this.worklet === undefined) return;
    this.build(this.context, this.element, this.worklet);
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

  private build(c: AudioContext, element: HTMLMediaElement, worklet: boolean) {
    this.source = c.createMediaElementSource(element);
    this.volumeNode = c.createGain();
    this.dry = c.createGain();
    this.chain = boostChain(c, worklet);
    this.wet = c.createGain();
    this.wet.gain.value = 0;
    this.mix = c.createGain();
    this.output = c.createGain();
    this.meter = c.createGain();
    // At the listener's volume from the first sample: the element is about to play at full into it.
    this.volumeNode.gain.value = Math.max(this.volume, QUIET);
    this.output.gain.value = this.muted || this.volume <= 0 ? 0 : 1;
    this.meter.gain.value = 1 / Math.max(this.volume, QUIET);
    this.source.connect(this.volumeNode);
    this.dry.connect(this.mix);
    this.chain.output.connect(this.wet);
    this.wet.connect(this.mix);
    this.mix.connect(this.output);
    this.output.connect(c.destination);
    this.mix.connect(this.meter);
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
    this.paths(true, false);
    this.route();
    this.applyVolume();
    this.changed();
  }

  /** Connects what is in use: the boost when it is on, the analysers being watched. */
  private route() {
    const c = this.context;
    const chain = this.chain;
    if (!c || !chain || !this.dry || !this.wet || !this.meter) return;
    const boosted = VolumeBoost.isOn(this.percent);
    const level = boosted ? this.percent : VolumeBoost.OFF_PERCENT;
    const now = c.currentTime;
    // Every change of what is connected happens in one go, between two of the audio thread's blocks, so connecting
    // again -- for an analyser that came or went -- is heard as nothing.
    if (boosted !== this.boostedRoute) {
      window.clearTimeout(this.unroute);
      this.boostedRoute = boosted;
      // Both ways round at once, and the crossing from one to the other a moment later (PRIME); into the boost at
      // no boost, so that switching it on swells up from the song as it was.
      this.paths(true, true);
      if (boosted) chain.level(VolumeBoost.OFF_PERCENT, now, 0);
      glide(this.dry.gain, boosted ? 0 : 1, now + PRIME, CROSSFADE);
      glide(this.wet.gain, boosted ? 1 : 0, now + PRIME, CROSSFADE);
      chain.level(level, now + PRIME, SWELL);
      this.unroute = window.setTimeout(() => this.paths(!boosted, boosted), SETTLE_MS);
    } else {
      chain.level(level, now, SWELL);
    }
    this.meter.disconnect();
    if (this.watching.SPECTRUM) this.meter.connect(this.analyser!);
    if (this.watching.LEVELS) this.meter.connect(this.splitter!);
  }

  /** Which ways round the sound goes from the volume to the mix: unboosted, boosted, or both while one fades into the other. */
  private paths(dry: boolean, wet: boolean) {
    const volume = this.volumeNode!;
    volume.disconnect();
    if (dry) volume.connect(this.dry!);
    if (wet) volume.connect(this.chain!.input);
  }

  private applyVolume() {
    const element = this.element;
    if (this.source && this.volumeNode && this.output && this.meter && this.context) {
      const now = this.context.currentTime;
      glide(this.volumeNode.gain, Math.max(this.volume, QUIET), now, VOLUME_GLIDE);
      glide(this.output.gain, this.muted || this.volume <= 0 ? 0 : 1, now, VOLUME_GLIDE);
      glide(this.meter.gain, 1 / Math.max(this.volume, QUIET), now, VOLUME_GLIDE);
    } else if (element) {
      element.volume = this.volume;
      element.muted = this.muted;
    }
  }
}

export const sound = new Sound();

/** The bands a spectrum has, for a visualiser to size its arrays. */
export const SPECTRUM_BANDS = BAND_COUNT;
