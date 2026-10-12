import { describe, expect, it } from 'vitest';
import * as VolumeBoost from './base/volumeBoost';
import { Limiter, clipCurve, limitAndClip } from './limiter';

const RATE = 48000;
const { CEILING } = VolumeBoost;

/** A fixed stream of numbers from 0 to 1, so every run of a test hears the same "music". */
function random(seed: number) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 4294967296;
}

/**
 * Two seconds of something like a modern master: noise, a kick twice a second and a tone, saturated into full scale
 * so that its peaks sit at −0.3 dBFS and its RMS only 8 dB under them. This is what the old booster barely moved.
 */
function master(seconds = 2): Float32Array[] {
  const next = random(7);
  const frames = RATE * seconds;
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const t = i / RATE;
    const kick = Math.exp(-((t * 2) % 1) * 12) * Math.sin(2 * Math.PI * 55 * t);
    const s = 0.35 * (next() + next() + next() + next() - 2) + 0.5 * kick + 0.2 * Math.sin(2 * Math.PI * 440 * t);
    left[i] = s;
    right[i] = 0.8 * s + 0.2 * (next() - 0.5);
  }
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  for (const channel of [left, right]) {
    for (let i = 0; i < frames; i++) channel[i] = (0.966 * Math.tanh((2.2 * channel[i]) / peak)) / Math.tanh(2.2);
  }
  return [left, right];
}

/**
 * [input] through the booster as the worklet runs it, in blocks of 128 frames: the volume and the boost, then the
 * limiter at [ceiling] (CEILING × drive unless a test says otherwise), then the soft clip.
 */
function boost(input: Float32Array[], percent: number, volume = 1, ceiling = CEILING * VolumeBoost.drive(percent)): Float32Array[] {
  const gain = volume * VolumeBoost.factor(percent);
  const limiter = new Limiter(RATE);
  const frames = input[0].length;
  const scaled = input.map((channel) => channel.map((sample) => sample * gain));
  const output = input.map(() => new Float32Array(frames));
  for (let at = 0; at < frames; at += 128) {
    const n = Math.min(128, frames - at);
    limitAndClip(limiter, scaled.map((c) => c.subarray(at, at + n)), output.map((c) => c.subarray(at, at + n)), n, ceiling);
  }
  return output;
}

/** The loudest sample of every channel. */
const peakOf = (channels: Float32Array[]) => Math.max(...channels.map((c) => c.reduce((m, s) => Math.max(m, Math.abs(s)), 0)));

/**
 * How many times a sample over 0.5 is the same as the two before it: what a hard clip does, holding the top of a
 * peak flat. Two the same either side of a slow crest can happen by rounding; three is a flat top.
 */
function heldFlat(channels: Float32Array[]): number {
  let held = 0;
  for (const channel of channels) {
    for (let i = 2; i < channel.length; i++) {
      if (Math.abs(channel[i]) > 0.5 && channel[i] === channel[i - 1] && channel[i] === channel[i - 2]) held++;
    }
  }
  return held;
}

/** The RMS in dB, leaving out the look-ahead at the start, where the limiter has had nothing yet. */
function rmsDb(channels: Float32Array[], skip = 0): number {
  let sum = 0;
  let n = 0;
  for (const channel of channels) {
    for (let i = skip; i < channel.length; i++) {
      sum += channel[i] * channel[i];
      n++;
    }
  }
  return 10 * Math.log10(sum / n);
}

describe("the shaper's curve", () => {
  it('is the soft clip, still rising at the very end, where a shaper holds whatever is past it', () => {
    const curve = clipCurve(4, 8193);
    expect(curve.length).toBe(8193);
    expect(curve[4096]).toBe(0);
    // Sample i stands for 4 × (i / 4096 − 1).
    expect(curve[4096 + 512]).toBeCloseTo(0.5, 6);
    expect(curve[4096 + 1024]).toBeCloseTo(VolumeBoost.clip(1), 6);
    expect(curve[8192]).toBeCloseTo(CEILING, 3);
    expect(curve[8192]).toBeLessThan(CEILING);
    expect(curve[0]).toBe(-curve[8192]);
    for (let i = 1; i < curve.length; i++) expect(curve[i], `point ${i}`).toBeGreaterThan(curve[i - 1]);
  });
});

describe('the limiter', () => {
  it('looks five milliseconds ahead and leaves what is under its ceiling exactly as it was, that much later', () => {
    const limiter = new Limiter(RATE);
    expect(limiter.lookahead).toBe(240);
    const next = random(3);
    const input = [Float32Array.from({ length: 4800 }, () => next() - 0.5), Float32Array.from({ length: 4800 }, () => next() - 0.5)];
    const output = input.map(() => new Float32Array(4800));
    limiter.process(input, output, 4800, 1);
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < 239; i++) expect(output[c][i]).toBe(0);
      for (let i = 239; i < 4800; i++) expect(output[c][i]).toBe(input[c][i - 239]);
    }
  });

  it('lets not one sample past its ceiling, whatever comes', () => {
    const next = random(11);
    const frames = RATE;
    const cases: Record<string, Float32Array[]> = {
      'loud noise': [0, 1].map(() => Float32Array.from({ length: frames }, () => 20 * (next() - 0.5))),
      'single spikes': [0, 1].map((c) => Float32Array.from({ length: frames }, (_, i) => (i % 997 === c * 13 ? 50 : 0.1 * (next() - 0.5)))),
      'a square wave': [0, 1].map(() => Float32Array.from({ length: frames }, (_, i) => (Math.floor(i / 100) % 2 ? 8 : -8))),
      'a step up': [0, 1].map(() => Float32Array.from({ length: frames }, (_, i) => (i < frames / 2 ? 0.5 : 30))),
    };
    for (const [name, input] of Object.entries(cases)) {
      for (const ceiling of [CEILING, 2, 0.3]) {
        const limiter = new Limiter(RATE);
        const output = input.map(() => new Float32Array(frames));
        for (let at = 0; at < frames; at += 128) {
          limiter.process(input.map((c) => c.subarray(at, at + 128)), output.map((c) => c.subarray(at, at + 128)), 128, ceiling);
        }
        expect(peakOf(output), `${name} at ${ceiling}`).toBeLessThanOrEqual(ceiling * (1 + 1e-6));
      }
    }
  });

  it('holds both channels together, so a loud one turns the other down too', () => {
    const limiter = new Limiter(RATE);
    const left = new Float32Array(2400).fill(4);
    const right = new Float32Array(2400).fill(0.5);
    const output = [new Float32Array(2400), new Float32Array(2400)];
    limiter.process([left, right], output, 2400, 1);
    expect(output[0][2000]).toBeCloseTo(1, 6);
    expect(output[1][2000]).toBeCloseTo(0.125, 6);
  });

  it('turns down smoothly, a little at a time, and comes back up over sixty milliseconds', () => {
    const limiter = new Limiter(RATE);
    const frames = RATE;
    // A constant 1, which a ceiling of 0.5 halves, for a tenth of a second; then a quarter, which it leaves alone.
    const input = [Float32Array.from({ length: frames }, (_, i) => (i < 4800 ? 1 : 0.25))];
    const output = [new Float32Array(frames)];
    limiter.process(input, output, frames, 0.5);
    // Its gain, frame by frame: what came out over what went in, 239 frames before.
    const gain = (i: number) => output[0][i] / input[0][i - 239];
    for (let i = 240; i < frames; i++) {
      expect(Math.abs(gain(i) - gain(i - 1)), `frame ${i}`).toBeLessThanOrEqual(1 / 240 + 1e-6);
    }
    expect(gain(4000)).toBeCloseTo(0.5, 6);
    // Sixty milliseconds and a look-ahead after the loud part has gone, it has come back most of the way: 1 − e⁻¹.
    const after = 4800 + 239 + 240 + 2880;
    expect((gain(after) - 0.5) / 0.5).toBeCloseTo(1 - Math.exp(-1), 1);
    expect(gain(frames - 1)).toBeCloseTo(1, 4);
  });

  it('treats a channel with nothing connected as silence, and drains what it was holding', () => {
    const limiter = new Limiter(RATE);
    const block = () => [new Float32Array(128), new Float32Array(128)];
    limiter.process([new Float32Array(128).fill(0.5), new Float32Array(128).fill(0.5)], block(), 128, 1);
    // The 128 frames held back come out over the next two blocks, 239 frames late, and then there is nothing.
    const drained = [block(), block(), block()].map((output) => {
      limiter.process([], output, 128, 1);
      return peakOf(output);
    });
    expect(drained).toEqual([0.5, 0.5, 0]);
  });
});

describe('the booster', () => {
  it('gets clearly louder at every step on a loud master, and never past −0.5 dBFS', () => {
    const music = master();
    const levels = [100, 200, 400, 1000].map((percent) => {
      const out = percent === 100 ? music : boost(music, percent);
      return { percent, rms: rmsDb(out, 480), peak: peakOf(out) };
    });
    expect(20 * Math.log10(levels[0].peak)).toBeCloseTo(-0.3, 1);
    expect(levels[0].rms - 20 * Math.log10(levels[0].peak)).toBeCloseTo(-7.9, 0);
    expect(levels[1].rms - levels[0].rms, '200% over 100%').toBeGreaterThan(2.5);
    expect(levels[2].rms - levels[1].rms, '400% over 200%').toBeGreaterThan(1.25);
    expect(levels[3].rms - levels[2].rms, '1000% over 400%').toBeGreaterThan(1);
    for (const { percent, peak } of levels.slice(1)) expect(peak, `${percent}%`).toBeLessThan(CEILING);
  });

  it('holds nothing flat at the top, as a hard clip would, even driven ten times', () => {
    // A full-scale 1 kHz tone at 1000%: the limiter lets its crests through at CEILING × 3.16, and the clip rounds
    // every one of them off, with not three samples in a row the same.
    const tone = [0, 1].map(() => Float32Array.from({ length: RATE / 2 }, (_, i) => 0.966 * Math.sin((2 * Math.PI * 1000 * i) / RATE)));
    const loudTone = boost(tone, 1000);
    expect(peakOf(loudTone)).toBeGreaterThan(0.94);
    expect(heldFlat(loudTone)).toBe(0);
    const music = master();
    expect(heldFlat(music)).toBe(0);
    for (const percent of [200, 400, 1000]) expect(heldFlat(boost(music, percent)), `music at ${percent}%`).toBe(0);
    // A tanh in the clip's place, as the first one was, goes flat in 32-bit floats once its input is past about
    // 1.8, and holds the tone's crests there just as a hard clip would.
    const tanh = (x: number) => {
      const knee = VolumeBoost.CLIP_KNEE * CEILING;
      const room = CEILING - knee;
      return Math.abs(x) <= knee ? x : Math.sign(x) * (knee + room * Math.tanh((Math.abs(x) - knee) / room));
    };
    const limited = tone.map(() => new Float32Array(RATE / 2));
    new Limiter(RATE).process(tone.map((c) => c.map((s) => s * 10)), limited, RATE / 2, CEILING * VolumeBoost.drive(1000));
    expect(heldFlat(limited.map((c) => c.map(tanh)))).toBeGreaterThan(1000);
    // A square wave is the same sample over and over, so whatever the clip, so is what comes out; it stays under.
    const square = [Float32Array.from({ length: RATE }, (_, i) => (Math.floor(i / 100) % 2 ? 1 : -1))];
    expect(peakOf(boost(square, 1000))).toBeLessThan(CEILING);
  });

  it('would barely get louder with the limiter held at the ceiling, as the old booster held it at full scale', () => {
    const music = master();
    const at200 = rmsDb(boost(music, 200, 1, CEILING), 480);
    const at1000 = rmsDb(boost(music, 1000, 1, CEILING), 480);
    expect(at1000 - at200).toBeLessThan(0.5);
  });

  it('takes up the volume first: at half volume, 200% is the sound as it came, and noise is +6 dB', () => {
    const next = random(5);
    // Peaks at −12 dBFS, as the noise the booster was measured with does.
    const noise = [0, 1].map(() => Float32Array.from({ length: RATE / 2 }, () => 0.5 * (next() - 0.5)));
    const half = boost(noise, 200, 0.5);
    for (let i = 239; i < noise[0].length; i++) expect(half[0][i]).toBeCloseTo(noise[0][i - 239], 6);
    const full = boost(noise, 200, 1);
    expect(rmsDb(full, 239) - rmsDb(noise.map((c) => c.subarray(0, c.length - 239)))).toBeCloseTo(6.02, 1);
    // And a song at half volume is clean +6 dB at 400% until it reaches the knee.
    const quiet = [Float32Array.from({ length: 4800 }, (_, i) => 0.4 * Math.sin(i / 7))];
    const doubled = boost(quiet, 400, 0.5);
    for (let i = 239; i < 4800; i++) expect(doubled[0][i]).toBeCloseTo(2 * quiet[0][i - 239], 5);
  });
});
