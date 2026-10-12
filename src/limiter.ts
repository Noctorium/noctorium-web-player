import * as VolumeBoost from './base/volumeBoost';

/*
 * The volume booster's limiter and soft clip, in plain TypeScript: what boostWorklet.ts runs on the audio thread,
 * and what the tests run here. It is the same limiter, step for step, as every other Noctorium player's, with
 * Base's VolumeBoost giving the numbers, so a level sounds the same wherever it is set.
 *
 * Every frame (one sample of each channel) the limiter works out the gain that frame needs to stay under the
 * ceiling, the channels together so the stereo picture never leans: 1 if it is under already, ceiling ÷ peak if
 * not. The gain it actually uses is the smallest of those over the last LOOKAHEAD_MS, so it is already down
 * when a peak arrives; it comes back up from there over RELEASE_MS, and is then averaged over LOOKAHEAD_MS more
 * so that it moves smoothly rather than in steps, which would be heard as a crackle. The sound comes out
 * LOOKAHEAD_MS late, and by then the gain is down far enough: every one of the gains averaged for a frame was
 * the smallest over a stretch with that frame in it, so none of them is above what the frame needs, and nor is
 * their average. Not one sample goes past the ceiling.
 *
 * The soft clip comes after it, to CEILING: what the limiter let over by drive (VolumeBoost.drive) is rounded off
 * there, and whatever reaches it, nothing comes out past CEILING.
 */

/** The name boostWorklet.ts registers its processor by, for an AudioWorkletNode to ask for. */
export const BOOST_PROCESSOR = 'noctorium-boost';

/** Where the soft clip starts bending, as a sample's size: CLIP_KNEE of CEILING, −1.9 dBFS. */
const KNEE = VolumeBoost.CLIP_KNEE * VolumeBoost.CEILING;

/** How far from the knee to CEILING. */
const ROOM = VolumeBoost.CEILING - KNEE;

/**
 * The soft clip: [x] as it is up to the knee, then bending into CEILING along a tanh, which leaves the knee at the
 * same slope it arrived with, so the bend has no corner to be heard. Nothing comes out past CEILING.
 */
export function softClip(x: number): number {
  const size = Math.abs(x);
  if (size <= KNEE) return x;
  return Math.sign(x) * (KNEE + ROOM * Math.tanh((size - KNEE) / ROOM));
}

/**
 * softClip for a WaveShaperNode fed each sample divided by [range]: [points] values of it, evenly from −range to
 * +range. A shaper holds anything past either end at that end's value, which is CEILING or next to it.
 */
export function clipCurve(range: number, points = 8193): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) curve[i] = softClip(range * ((i / (points - 1)) * 2 - 1));
  return curve;
}

/**
 * What the booster does to a block once the gain has been put on: [limiter] holds it at [ceiling] (CEILING ×
 * drive), and the soft clip rounds what that leaves into CEILING. From [input] into [output], [frames] frames.
 */
export function limitAndClip(limiter: Limiter, input: readonly Float32Array[], output: readonly Float32Array[], frames: number, ceiling: number) {
  limiter.process(input, output, frames, ceiling);
  for (const channel of output) {
    for (let i = 0; i < frames; i++) channel[i] = softClip(channel[i]);
  }
}

/** The look-ahead limiter described above, for [channels] channels at [sampleRate]. */
export class Limiter {
  /** How many frames it looks ahead. What goes in comes out this many frames less one later. */
  readonly lookahead: number;
  /** How far the gain comes back up towards what is needed each frame, for RELEASE_MS as a time constant. */
  private readonly release: number;
  /** The gains needed by the frames still in the look-ahead, as a queue that only falls: its head is the smallest. */
  private readonly needed: Float64Array;
  private readonly neededAt: Float64Array;
  private head = 0;
  private queued = 0;
  /** The gains of the last `lookahead` frames, for their average, and that average's sum. */
  private readonly gains: Float64Array;
  private gainSum: number;
  private gainAt = 0;
  private gain = 1;
  /** Each channel's sound, held back while the gain catches up with it. */
  private readonly delay: Float32Array[];
  private delayAt = 0;
  private frame = 0;

  constructor(sampleRate: number, readonly channels = 2) {
    this.lookahead = Math.max(1, Math.round((VolumeBoost.LOOKAHEAD_MS / 1000) * sampleRate));
    this.release = 1 - Math.exp(-1 / ((VolumeBoost.RELEASE_MS / 1000) * sampleRate));
    this.needed = new Float64Array(this.lookahead);
    this.neededAt = new Float64Array(this.lookahead);
    this.gains = new Float64Array(this.lookahead).fill(1);
    this.gainSum = this.lookahead;
    this.delay = Array.from({ length: channels }, () => new Float32Array(Math.max(1, this.lookahead - 1)));
  }

  /**
   * [frames] frames of [input] (one array a channel; a channel missing is silence, as an input with nothing
   * connected to it is) into [output], their peaks held at [ceiling]. [input] and [output] may be the same arrays.
   */
  process(input: readonly Float32Array[], output: readonly Float32Array[], frames: number, ceiling: number) {
    const span = this.lookahead;
    const held = span - 1;
    const channels = Math.min(this.channels, output.length);
    for (let i = 0; i < frames; i++) {
      let peak = 0;
      for (let c = 0; c < channels; c++) {
        const size = Math.abs(input[c]?.[i] ?? 0);
        if (size > peak) peak = size;
      }
      const need = peak > ceiling ? ceiling / peak : 1;
      const frame = this.frame++;
      // The smallest gain needed over the look-ahead: drop what has left it, then everything behind the new one
      // that needs no less, so the queue only ever falls and its head is the smallest.
      if (this.queued > 0 && this.neededAt[this.head] <= frame - span) {
        this.head = (this.head + 1) % span;
        this.queued--;
      }
      while (this.queued > 0 && this.needed[(this.head + this.queued - 1) % span] >= need) this.queued--;
      const tail = (this.head + this.queued) % span;
      this.needed[tail] = need;
      this.neededAt[tail] = frame;
      this.queued++;
      const lowest = this.needed[this.head];
      // Straight down to it, and back up only gradually.
      this.gain = lowest < this.gain ? lowest : this.gain + (lowest - this.gain) * this.release;
      // The average of the last `lookahead` gains, its sum worked out afresh once round so that it never drifts.
      this.gainSum += this.gain - this.gains[this.gainAt];
      this.gains[this.gainAt] = this.gain;
      if (++this.gainAt === span) {
        this.gainAt = 0;
        this.gainSum = 0;
        for (let k = 0; k < span; k++) this.gainSum += this.gains[k];
      }
      const gain = this.gainSum / span;
      for (let c = 0; c < channels; c++) {
        const sample = input[c]?.[i] ?? 0;
        if (held === 0) {
          output[c][i] = sample * gain;
        } else {
          const line = this.delay[c];
          output[c][i] = line[this.delayAt] * gain;
          line[this.delayAt] = sample;
        }
      }
      if (held > 0 && ++this.delayAt === held) this.delayAt = 0;
    }
  }
}
