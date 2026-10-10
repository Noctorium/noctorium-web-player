import { describe, expect, it } from 'vitest';
import {
  ANALYSER_FFT_SIZE, BAND_CENTRES_HZ, BAND_COUNT, BAND_EDGES_HZ, FLOOR_DB, bandLevels, bandOf, blackmanPower, kindOf, level, meanSquareFromDecibels,
  peakAndRms, settle,
} from './visualiser';

/** A plain DFT of [samples], bins 0 to N/2 − 1, as re/im pairs. Slow and exact, which is what a test wants. */
function dft(samples: number[]): [number, number][] {
  const n = samples.length;
  return Array.from({ length: n / 2 }, (_, k) => {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += samples[i] * Math.cos((2 * Math.PI * k * i) / n);
      im -= samples[i] * Math.sin((2 * Math.PI * k * i) / n);
    }
    return [re, im];
  });
}

describe('the visualiser numbers', () => {
  it('turn decibels into heights the same way everywhere', () => {
    expect(level(0)).toBe(1);
    expect(level(FLOOR_DB)).toBe(0);
    expect(level(-30)).toBeCloseTo(0.5, 3);
    expect(level(-Infinity), 'silence is no height').toBe(0);
    expect(level(NaN)).toBe(0);
    expect(level(6), 'past full scale is still full height').toBe(1);
  });

  it("have the equaliser's bands, an octave each", () => {
    expect(BAND_CENTRES_HZ).toEqual([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]);
    expect(BAND_EDGES_HZ.length).toBe(BAND_COUNT - 1);
    BAND_CENTRES_HZ.forEach((hz, band) => expect(bandOf(hz), `${hz} Hz`).toBe(band));
    expect(bandOf(20)).toBe(0);
    expect(bandOf(20000)).toBe(9);
  });

  /** Base's own case: a full-scale 1 kHz sine through a Hann-windowed FFT lands in its band at -3 dBFS, its RMS. */
  it('put a sine through an FFT in its own band at its own level', () => {
    const n = 2048;
    const rate = 48000;
    const window = Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    const samples = window.map((w, i) => Math.sin((2 * Math.PI * 1000 * i) / rate) * w);
    const windowPower = window.reduce((sum, w) => sum + w * w, 0);
    const meanSquare = dft(samples).map(([re, im]) => (2 * (re * re + im * im)) / (n * windowPower));
    const bands = bandLevels(meanSquare, rate / n);
    expect(bands.length).toBe(10);
    expect(bands.indexOf(Math.max(...bands)), `the 1 kHz band: ${bands}`).toBe(5);
    expect(Math.abs(bands[5] - level(-3))).toBeLessThan(0.02);
    expect(bands.filter((_, band) => band < 4 || band > 6).every((b) => b < 0.3), `the rest is far below: ${bands}`).toBe(true);
  });

  /**
   * The browser's side: what an AnalyserNode reports for the same sine, worked out as Web Audio's specification
   * says it is -- a Blackman window, the FFT divided by N, 20·log10 of the magnitude -- read back through
   * meanSquareFromDecibels, stands at the same height as mpv's band and Base's FFT. At the page's fftSize: a
   * shorter one smears a bass note's window over the band below it.
   */
  it('read an AnalyserNode so a sine stands where it does on every other player', () => {
    const n = ANALYSER_FFT_SIZE;
    const rate = 44100;
    for (const [hz, band] of [[1000, 5], [100, 2], [6000, 8]] as const) {
      const windowed = Array.from({ length: n }, (_, i) => {
        const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / n) + 0.08 * Math.cos((4 * Math.PI * i) / n);
        return Math.sin((2 * Math.PI * hz * i) / rate) * w;
      });
      const decibels = dft(windowed).map(([re, im]) => 20 * Math.log10(Math.hypot(re, im) / n));
      const bands = bandLevels(meanSquareFromDecibels(decibels, n), rate / n);
      expect(bands.indexOf(Math.max(...bands)), `${hz} Hz: ${bands}`).toBe(band);
      expect(Math.abs(bands[band] - level(-3)), `${hz} Hz at ${bands[band]}`).toBeLessThan(0.02);
    }
  });

  it("know the Blackman window's power", () => {
    // 0.42² + 0.5²/2 + 0.08²/2 of N, near enough for a window this long.
    expect(blackmanPower(2048) / 2048).toBeCloseTo(0.3046, 3);
  });

  it('give nothing for silence, and the analyser silence it is', () => {
    expect(bandLevels(new Float32Array(1024), 21.5)).toEqual(new Array(10).fill(0));
    expect(bandLevels(meanSquareFromDecibels(new Float32Array(1024).fill(-Infinity), 2048), 21.5)).toEqual(new Array(10).fill(0));
  });

  it('measure a channel as a meter shows it', () => {
    const sine = Array.from({ length: 4800 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000));
    const [peak, rms] = peakAndRms(sine);
    expect(peak).toBeCloseTo(level(20 * Math.log10(0.5)), 3);
    expect(rms).toBeCloseTo(level(20 * Math.log10(0.5 / Math.SQRT2)), 2);
    expect(peakAndRms(new Float32Array(128))).toEqual([0, 0]);
  });

  it('say what a frame holds', () => {
    expect(kindOf({ bands: new Array(10).fill(0.5), peaks: [0.9, 0.9], rms: [] })).toBe('SPECTRUM');
    expect(kindOf({ bands: [], peaks: [0.9], rms: [0.7] })).toBe('LEVELS');
    expect(kindOf({ bands: [], peaks: [], rms: [] })).toBe('NONE');
    expect(kindOf(undefined)).toBe('NONE');
  });

  it('let bars rise at once and fall smoothly', () => {
    expect(settle(0.2, 0.9, 16)).toBe(0.9);
    expect(settle(0.9, 0.2, 100)).toBeCloseTo(0.75, 5);
    expect(settle(0.3, 0.2, 1000)).toBe(0.2);
  });
});
