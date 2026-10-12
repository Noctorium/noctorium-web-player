/*
 * The volume booster's numbers, so that every player means the same thing by "400%": Base's VolumeBoost, ported.
 *
 * A level is a percentage of the amplitude: 100 is the sound as it came, 200 is twice the amplitude (+6 dB) and
 * 1000 is ten times (+20 dB). The same three steps make it on every player:
 *
 * 1. The listener's volume comes first, then the boost: the samples are multiplied by volume × factor. So the
 *    booster takes up the volume's slack before anything else -- at half volume, 200% is a clean +6 dB with
 *    nothing limited at all.
 * 2. A limiter that looks LOOKAHEAD_MS ahead holds the peaks at CEILING × drive, turning the whole sound down for
 *    a moment around each one and coming back up over RELEASE_MS.
 * 3. A soft clip rounds whatever is over the knee into CEILING, so nothing the booster makes ever goes past it.
 *
 * Why both, and why the limiter's ceiling moves: mastered music already touches full scale, so a limiter holding
 * the peaks where they were can only bring the rest up towards them, and the song barely gets louder (1000% was
 * about 2 LU louder than 100% on a loud master, measured). Letting the limiter go over full scale by drive, for
 * the soft clip to take back off the tops, splits the boost's decibels half and half between the two, which is
 * what makes 1000% sound like a great deal more than 200%. sound.ts says how a browser does it.
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

/** The most the booster ever puts out, as a sample's size: −0.5 dBFS. Nothing it makes goes past it. */
export const CEILING = 0.944;

/** The soft clip is a straight line up to this much of CEILING, and bends into CEILING above it. */
export const CLIP_KNEE = 0.85;

/** How far ahead the limiter looks, so that it is already down when a peak arrives: five milliseconds. */
export const LOOKAHEAD_MS = 5;

/** How long the limiter takes to come back up after a peak, as a time constant: sixty milliseconds. */
export const RELEASE_MS = 60;

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

/**
 * How far over CEILING the limiter lets the sound go, for the soft clip to take back off: the square root of the
 * factor, so half of the boost's decibels. ×1.41 at 200%, ×2 at 400%, ×3.16 at 1000%, and 1 at 100%. A 32-bit
 * float, as factor is.
 */
export const drive = (percent: number) => Math.fround(Math.sqrt(factor(percent)));

/** "400%", for a slider's label. */
export const percentLabel = (percent: number) => `${clamp(percent)}%`;

/** "×4", or "×2.5", for the volume button while the boost is on, where four characters is all there is. */
export function timesLabel(percent: number): string {
  const f = factor(percent);
  const whole = Math.round(f);
  if (Math.abs(f - whole) < 0.005) return `×${whole}`;
  return '×' + f.toFixed(1).replace(/0+$/, '').replace(/\.$/, '');
}
