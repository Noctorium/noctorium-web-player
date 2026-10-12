import { describe, expect, it } from 'vitest';
import * as VolumeBoost from './volumeBoost';

/** The booster's numbers, as Base's VolumeBoost has them, so "400%" is the same everywhere. */
describe('the volume booster', () => {
  it('goes from 100% to 1000%', () => {
    expect(VolumeBoost.OFF_PERCENT).toBe(100);
    expect(VolumeBoost.MAX_PERCENT).toBe(1000);
    expect(VolumeBoost.clamp(5000)).toBe(1000);
    expect(VolumeBoost.clamp(20)).toBe(100);
    expect(VolumeBoost.clamp(NaN)).toBe(100);
  });

  it('snaps a slider to round numbers', () => {
    expect(VolumeBoost.snap(437)).toBe(440);
    expect(VolumeBoost.snap(435)).toBe(440);
    expect(VolumeBoost.snap(434.9)).toBe(430);
    expect(VolumeBoost.snap(1200)).toBe(1000);
    expect(VolumeBoost.snap(-3)).toBe(100);
  });

  it('is on above 100% and loud above 200%', () => {
    expect(VolumeBoost.isOn(100)).toBe(false);
    expect(VolumeBoost.isOn(110)).toBe(true);
    expect(VolumeBoost.isLoud(200)).toBe(false);
    expect(VolumeBoost.isLoud(210)).toBe(true);
    expect(VolumeBoost.LOUD_WARNING).toBe('Loud: mind your ears and your speakers');
  });

  it('multiplies the amplitude, ten times at most, twenty decibels', () => {
    expect(VolumeBoost.factor(100)).toBe(1);
    expect(VolumeBoost.factor(400)).toBe(4);
    expect(VolumeBoost.factor(1000)).toBe(10);
    expect(VolumeBoost.gainDb(100)).toBe(0);
    expect(VolumeBoost.gainDb(200)).toBeCloseTo(6.02, 2);
    expect(VolumeBoost.gainDb(1000)).toBeCloseTo(20, 4);
  });

  it('never goes past −0.5 dBFS, and bends into it from a knee', () => {
    expect(VolumeBoost.CEILING).toBe(0.944);
    expect(20 * Math.log10(VolumeBoost.CEILING)).toBeCloseTo(-0.5, 2);
    expect(VolumeBoost.CLIP_KNEE).toBe(0.85);
    expect(VolumeBoost.LOOKAHEAD_MS).toBe(5);
    expect(VolumeBoost.RELEASE_MS).toBe(60);
  });

  it("lets half of the boost's decibels through the limiter, for the soft clip to take off", () => {
    expect(VolumeBoost.drive(100)).toBe(1);
    expect(VolumeBoost.drive(200)).toBeCloseTo(1.414, 3);
    expect(VolumeBoost.drive(400)).toBe(2);
    expect(VolumeBoost.drive(1000)).toBeCloseTo(3.162, 3);
    expect(VolumeBoost.drive(5000), 'clamped as the level is').toBeCloseTo(3.162, 3);
    for (const percent of [110, 200, 370, 1000]) {
      expect(20 * Math.log10(VolumeBoost.drive(percent))).toBeCloseTo(VolumeBoost.gainDb(percent) / 2, 4);
    }
  });

  it('writes its level for a slider and for the volume button', () => {
    expect(VolumeBoost.percentLabel(400)).toBe('400%');
    expect(VolumeBoost.percentLabel(9000)).toBe('1000%');
    expect(VolumeBoost.timesLabel(400)).toBe('×4');
    expect(VolumeBoost.timesLabel(250)).toBe('×2.5');
    expect(VolumeBoost.timesLabel(1000)).toBe('×10');
    expect(VolumeBoost.timesLabel(110)).toBe('×1.1');
  });
});
