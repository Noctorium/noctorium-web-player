/*
 * The numbers a visualiser is drawn from, the same on every player: Base's Visualiser, ported, and what the page
 * needs on top of it to read a browser's AnalyserNode the way the others read theirs.
 *
 * Ten bands, an octave each, centred where the equaliser's ten are. mpv splits the audio at BAND_EDGES_HZ with a
 * crossover and measures each band's RMS; a player with an FFT adds up the bins between the same edges
 * (bandLevels). Every value is from 0 to 1, decibels mapped by level(), so the same sound stands at the same
 * height in the terminal, on the desktop, on the phone and here.
 */

/** What a player can tell about the sound it is playing, as Base's AudioAnalysisKind names it. */
export type AnalysisKind = 'NONE' | 'LEVELS' | 'SPECTRUM';

/** One look at the sound: the spectrum low to high, and each channel's peak and RMS, left first. */
export interface Analysis { bands: number[]; peaks: number[]; rms: number[] }

/** What a frame holds, which can be less than the player's best. */
export function kindOf(frame?: Analysis | null): AnalysisKind {
  if (!frame) return 'NONE';
  if (frame.bands.length) return 'SPECTRUM';
  return frame.peaks.length || frame.rms.length ? 'LEVELS' : 'NONE';
}

/** How often a playing engine says what the sound is doing. */
export const FRAMES_PER_SECOND = 30;
export const FRAME_MS = Math.floor(1000 / FRAMES_PER_SECOND);

/** The quietest level drawn above nothing, in dBFS. */
export const FLOOR_DB = -60;

/** The bands' centres: the equaliser's. */
export const BAND_CENTRES_HZ = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/** Where one band ends and the next begins: half an octave either side of each centre. */
export const BAND_EDGES_HZ = [44, 88, 177, 354, 707, 1414, 2828, 5657, 11314];

export const BAND_COUNT = BAND_CENTRES_HZ.length;

/** [decibels] (dBFS) as a height from 0 to 1: FLOOR_DB and anything quieter is 0, full scale is 1. */
export function level(decibels: number): number {
  if (Number.isNaN(decibels)) return 0;
  return Math.min(1, Math.max(0, (decibels - FLOOR_DB) / -FLOOR_DB));
}

/** The band [hz] falls in, from 0 for the lowest. */
export function bandOf(hz: number): number {
  const at = BAND_EDGES_HZ.findIndex((edge) => hz < edge);
  return at < 0 ? BAND_COUNT - 1 : at;
}

/**
 * Band levels from a spectrum, measured the way mpv's bands are.
 *
 * [binMeanSquare] is each bin's share of the signal's mean square, normalised so that the bins of a signal add up
 * to its mean square: for an N-point FFT of real samples with window w, 2·|X[k]|² / (N·Σw²) for the bins between
 * DC and Nyquist. [binHz] is the width of a bin, the sample rate over N. Each band is the decibels of what its
 * bins add up to -- its RMS -- through level(). Bin 0, the DC, belongs to no band.
 */
export function bandLevels(binMeanSquare: ArrayLike<number>, binHz: number, out: number[] = new Array(BAND_COUNT)): number[] {
  const sums = new Float64Array(BAND_COUNT);
  for (let k = 1; k < binMeanSquare.length; k++) {
    const power = binMeanSquare[k];
    if (!(power > 0)) continue;
    sums[bandOf(k * binHz)] += power;
  }
  for (let band = 0; band < BAND_COUNT; band++) out[band] = sums[band] <= 0 ? 0 : level(10 * Math.log10(sums[band]));
  return out;
}

/**
 * How many samples a browser's AnalyserNode takes in at a time for the bars: about a tenth of a second, which is
 * enough to tell a 100 Hz note from the octave below it, and short enough for the bars to move with the beat.
 */
export const ANALYSER_FFT_SIZE = 4096;

/**
 * The sum of the squares of the window a browser's AnalyserNode uses on [n] samples: Web Audio's Blackman window,
 * a0 − a1·cos(2πi/N) + a2·cos(4πi/N) with α = 0.16.
 */
export function blackmanPower(n: number): number {
  const a0 = 0.42, a1 = 0.5, a2 = 0.08;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = a0 - a1 * Math.cos((2 * Math.PI * i) / n) + a2 * Math.cos((4 * Math.PI * i) / n);
    sum += w * w;
  }
  return sum;
}

/**
 * An AnalyserNode's frequency data -- getFloatFrequencyData, in decibels -- as the mean square bandLevels wants.
 *
 * Web Audio writes 20·log10 of |X[k]|, where X is the windowed FFT divided by N. So |X[k]|² = 10^(dB/10), the
 * unscaled FFT's |F[k]|² is N² times that, and Base's 2·|F[k]|² / (N·Σw²) is 10^(dB/10) · 2N/Σw². The analyser's
 * own smoothing is left at nothing (smoothingTimeConstant 0), so this is the sound of the last fftSize samples.
 */
export function meanSquareFromDecibels(decibels: ArrayLike<number>, fftSize: number, windowPower = blackmanPower(fftSize), out?: Float32Array): Float32Array {
  const result = out ?? new Float32Array(decibels.length);
  const scale = (2 * fftSize) / windowPower;
  for (let k = 0; k < decibels.length; k++) {
    const db = decibels[k];
    result[k] = Number.isFinite(db) ? Math.pow(10, db / 10) * scale : 0;
  }
  return result;
}

/** A channel's samples as the two heights a level meter draws: its peak and its RMS, through level(). */
export function peakAndRms(samples: ArrayLike<number>): [peak: number, rms: number] {
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const size = Math.abs(s);
    if (size > peak) peak = size;
    sum += s * s;
  }
  const meanSquare = samples.length ? sum / samples.length : 0;
  return [peak > 0 ? level(20 * Math.log10(peak)) : 0, meanSquare > 0 ? level(10 * Math.log10(meanSquare)) : 0];
}

/** How fast a bar falls once the sound under it drops: the whole height in two thirds of a second. */
export const FALL_PER_SECOND = 1.5;

/**
 * What a bar shows after [elapsedMs]: up to the sound at once, and down towards it no faster than FALL_PER_SECOND,
 * so a visualiser fed twenty frames a second still moves smoothly between them.
 */
export function settle(shown: number, measured: number, elapsedMs: number): number {
  if (measured >= shown) return measured;
  return Math.max(measured, shown - (FALL_PER_SECOND * elapsedMs) / 1000);
}
