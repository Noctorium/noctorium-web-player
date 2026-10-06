/*
 * The seek bar's styles and the numbers the drawn ones are made of, as Base's ProgressBarStyle and SeekBar have
 * them, so the same song has the same bars and a ruler the same ticks on the desktop, the phone, in the terminal
 * and here. Base counts in dp; a CSS pixel is one.
 */

/** Every style, by core's name for it and in its order, with the name the listener sees. */
export const seekBarStyles: [string, string][] = [
  ['MINIMAL', 'Minimal'], ['MATERIAL', 'Material'], ['WAVE', 'Wave'], ['SEGMENTS', 'Segments'], ['CAPSULE', 'Capsule'],
  ['BARS', 'Bars'], ['BEADS', 'Beads'], ['NEON', 'Neon'], ['RULER', 'Ruler'], ['CLASSIC', 'Classic'], ['LUNA', 'Luna'],
];

/** One bar and the gap after it, and how wide the bar itself is within that. */
export const BARS_PITCH = 5;
export const BARS_WIDTH = 3;
/** The tallest a bar stands. The rest are a fraction of it, and none less than BARS_MIN_FRACTION. */
export const BARS_HEIGHT = 22;
const BARS_MIN_FRACTION = Math.fround(0.18);

/** One bead and the gap after it, a bead, and the larger one the song has reached. */
export const BEAD_PITCH = 10;
export const BEAD_RADIUS = 2.5;
export const BEAD_HEAD_RADIUS = 5;

/** The ruler: a tick, the longer one on each minute, and the pointer riding above them. */
export const RULER_TICK = 6;
export const RULER_MAJOR_TICK = 12;
export const RULER_POINTER = 8;

/** How many swells a song's bars rise and fall through from end to end, and how finely they are made. */
const BARS_SECTIONS = 8;
const BARS_SAMPLES = 160;

/*
 * Core does this in 32-bit floats and ints, and a few bars a pixel taller here than on the desktop would be a
 * different song: so every sum is rounded to a float as the JVM rounds it, and the hashing wraps as an Int does.
 */
const f = Math.fround;

/**
 * The heights of [count] bars for the song keyed [seed] -- its queue key, `PROVIDER:id` -- each from 0.18 up to 1.
 *
 * Taken along the song rather than bar by bar, so a wider bar has more of them and the same shape: slow swells
 * across its length, like the sections of a song, with quicker beats inside them softened against their
 * neighbours. FNV-1a over the key's UTF-16 code units, then xorshift, exactly as core's SeekBar.barHeights.
 */
export function barHeights(seed: string, count: number): number[] {
  if (count <= 0) return [];
  let hash = 0x811c9dc5 | 0;
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  let state = hash === 0 ? 0x9e3779b9 | 0 : hash;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 8) / 16_777_216;
  };
  const sections = Array.from({ length: BARS_SECTIONS + 1 }, () => f(f(0.35) + f(f(0.65) * next())));
  const raw = Array.from({ length: BARS_SAMPLES }, () => next());
  const beats = raw.map((_, i) => f(f(f(raw[Math.max(i - 1, 0)] + 2 * raw[i]) + raw[Math.min(i + 1, BARS_SAMPLES - 1)]) / 4));
  return Array.from({ length: count }, (_, i) => {
    const along = f((i + 0.5) / count);
    const height = Math.min(1, Math.max(0, f(sampled(sections, along) * f(f(0.45) + f(f(0.55) * sampled(beats, along))))));
    return f(BARS_MIN_FRACTION + f(f(1 - BARS_MIN_FRACTION) * height));
  });
}

/** [values] read at [along], from 0 to 1, between the two nearest. */
function sampled(values: number[], along: number): number {
  const at = f(Math.min(1, Math.max(0, along)) * (values.length - 1));
  const below = Math.min(Math.trunc(at), values.length - 2);
  return f(values[below] + f(f(values[below + 1] - values[below]) * f(at - below)));
}

/** One of the ruler's ticks: how far along the song it is, from 0 to 1, and whether it marks a minute. */
export interface RulerTick { fraction: number; major: boolean }

/** The spacings a ruler is allowed, in seconds, finest first. */
const RULER_STEPS = [5, 10, 15, 30, 60, 120, 300, 600];

/**
 * Where the ruler's ticks fall along a song [durationMs] long, no more than [maxTicks] of them: the finest spacing
 * that fits, from every five seconds up to every ten minutes. The long ones are the minutes, or every five minutes
 * once a tick is a minute or more apart, or every half hour on a set hours long. The ends are left bare, since the
 * times are written there. Nothing for a song with no length yet.
 */
export function rulerTicks(durationMs: number, maxTicks: number): RulerTick[] {
  if (durationMs <= 0 || maxTicks <= 0) return [];
  const seconds = durationMs / 1000;
  const step = RULER_STEPS.find((s) => seconds / s <= maxTicks);
  if (step == null) return [];
  const majorEvery = step < 60 ? 60 : step < 300 ? 300 : 1800;
  const ticks: RulerTick[] = [];
  for (let at = step; at < Math.trunc(seconds); at += step) ticks.push({ fraction: f(at / seconds), major: at % majorEvery === 0 });
  return ticks;
}
