/*
 * The volume booster's numbers, so that every player means the same thing by "400%": Base's VolumeBoost, ported.
 *
 * A level is a percentage of the amplitude: 100 is the sound as it came, 200 is twice the amplitude (+6 dB) and
 * 1000 is ten times (+20 dB). Every player puts a limiter straight after the gain, which is what makes a level this
 * high usable at all; here that is a DynamicsCompressorNode set as one (see sound.ts).
 */

/** No boost: the sound as it came. The booster is off at this level and nowhere else. */
export const OFF_PERCENT = 100;

/** Ten times the amplitude, +20 dB. */
export const MAX_PERCENT = 1000;

/** Where the boost button goes the first time it is switched on, before any level has been chosen. */
export const FIRST_PERCENT = 200;

/** Past this the booster says LOUD_WARNING. */
export const LOUD_PERCENT = 200;

/** The slider's step, so a level is always a round number. */
export const STEP_PERCENT = 10;

/** What the booster says once it is past LOUD_PERCENT. Short, because it sits under a slider. */
export const LOUD_WARNING = 'Loud: mind your ears and your speakers';

/** What a player that cannot boost says in the booster's place. */
export const UNAVAILABLE = 'The volume can only be boosted where Noctorium makes the sound itself.';

/** [percent] within OFF_PERCENT..MAX_PERCENT. A level from an older or hand-edited store is never trusted. */
export function clamp(percent: number): number {
  if (!Number.isFinite(percent)) return OFF_PERCENT;
  return Math.min(MAX_PERCENT, Math.max(OFF_PERCENT, Math.trunc(percent)));
}

/** [percent] clamped and rounded to the nearest STEP_PERCENT, for a slider that can land anywhere. */
export function snap(percent: number): number {
  if (!Number.isFinite(percent)) return OFF_PERCENT;
  // Kotlin's roundToInt rounds a half up, as Math.round does.
  return clamp(Math.round(percent / STEP_PERCENT) * STEP_PERCENT);
}

/** Whether [percent] boosts at all. */
export const isOn = (percent: number) => clamp(percent) > OFF_PERCENT;

/** Whether [percent] is past the point where the booster warns. */
export const isLoud = (percent: number) => clamp(percent) > LOUD_PERCENT;

/** What the samples are multiplied by: 1 at 100%, 10 at 1000%. A 32-bit float, as Base's is. */
export const factor = (percent: number) => Math.fround(clamp(percent) / 100);

/** The gain in decibels: 0 at 100%, about 6 at 200%, 20 at 1000%. */
export const gainDb = (percent: number) => 20 * Math.log10(factor(percent));

/** "400%", for a slider's label. */
export const percentLabel = (percent: number) => `${clamp(percent)}%`;

/** "×4", or "×2.5", for the volume button while the boost is on, where four characters is all there is. */
export function timesLabel(percent: number): string {
  const f = factor(percent);
  const whole = Math.round(f);
  if (Math.abs(f - whole) < 0.005) return `×${whole}`;
  return '×' + f.toFixed(1).replace(/0+$/, '').replace(/\.$/, '');
}
