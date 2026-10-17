import type { Glow, GlowShape } from '../types';
import { relativeLuminance } from './contrast';

/*
 * The soft light the Glow themes lay across their page, and the colour a cover is known by: Base's Glow.kt, ported.
 *
 * What the page draws, and in what order: the page in the theme's background, then the light straight on top of it,
 * then everything else -- the light is part of the page, under every panel, card and bar, which keep their own colours
 * and cover it where they are. Each of the light's shapes is one gradient of one colour, its opacity running from the
 * glow's strength times the shape's at its middle (a pool's) or its top edge (a band's) down through FALLOFF to none,
 * and clear beyond; one colour with only its opacity changing, so that a browser, which blends a gradient's stops
 * premultiplied, draws the same light the desktop and the phone draw unpremultiplied. glowImage writes it as CSS.
 *
 * Base does its sums on a cover's pixels and on the light's colour in 32-bit floats, and so does this, by rounding to
 * one wherever Base has one: a cover that only just has colour enough to count has it here too, and gives the same
 * colour to the last bit.
 */

const f = Math.fround;

/** How a light fades from its middle to its rim: how far out, from 0 to 1, and how much of its strength is left. */
export const FALLOFF: [number, number][] = [
  [0, 1], [0.125, 0.96], [0.25, 0.84], [0.375, 0.68], [0.5, 0.5], [0.625, 0.32], [0.75, 0.16], [0.875, 0.04], [1, 0],
];

/** FALLOFF at [t], between its stops as a gradient draws it: in a straight line from one to the next. */
export function falloff(t: number): number {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  const after = FALLOFF.findIndex(([at]) => at >= t);
  const [from, fromLeft] = FALLOFF[after - 1];
  const [to, toLeft] = FALLOFF[after];
  return fromLeft + ((toLeft - fromLeft) * (t - from)) / (to - from);
}

/**
 * Base's GlowPlacement: where on the page a light lies, as the shapes it is drawn with, in fractions of the page.
 * ARTWORK is behind a now playing screen's cover and up the side beyond it, a pool low behind the controls and a
 * broader one rising towards the words; TOP a band across the top, gone before the middle.
 */
export const PLACEMENTS: Record<string, GlowShape[]> = {
  ARTWORK: [
    { kind: 'pool', x: 0.325, y: 0.72, radius: 0.21, strength: 0.82 },
    { kind: 'pool', x: 0.56, y: 0.36, radius: 0.34, strength: 1 },
  ],
  TOP: [{ kind: 'band', depth: 0.62, strength: 1 }],
};

/** A light of [colour] in [placement]'s shapes, as Base's ThemeGlow. */
export function glow(colour: string, placement: keyof typeof PLACEMENTS, strength: number, followsArtwork = false): Glow {
  return { colour, followsArtwork, placement, strength, shapes: PLACEMENTS[placement] };
}

/** How much of the light's strength one shape lays at [x], [y] on a page [width] by [height]. */
function reachAt(shape: GlowShape, x: number, y: number, width: number, height: number): number {
  if (shape.kind === 'band') return shape.strength * falloff(y / (shape.depth * height));
  const dx = x - shape.x * width;
  const dy = y - shape.y * height;
  return shape.strength * falloff(Math.sqrt(dx * dx + dy * dy) / (shape.radius * Math.max(width, height)));
}

/** How opaque the light is at [x], [y] on a page [width] by [height]: what its gradients come to there. */
export function opacityAt(light: Glow, x: number, y: number, width: number, height: number): number {
  let clear = 1;
  for (const shape of light.shapes) clear *= 1 - light.strength * reachAt(shape, x, y, width, height);
  return 1 - clear;
}

/** Below this saturation a cover's colour is a grey, and its hue is noise. */
export const GREYEST = 0.2;

/** How much brighter than its fallback a light from the artwork may be, in luminance. */
export const BRIGHTEST = 2.0;

/**
 * The light's colour while [artwork] is the playing cover's, as artworkColour finds it: undefined with nothing
 * playing, no cover, or none with colour in it. The cover lends the light its hue and nothing else -- the fallback's
 * saturation and brightness, held to BRIGHTEST times its luminance -- and a light that does not follow the artwork
 * ignores it.
 */
export function resolvedColour(light: Glow, artwork?: string | null): string {
  if (!light.followsArtwork || !artwork) return light.colour.toLowerCase();
  const cover = hsvOf(artwork);
  if (cover.saturation < f(GREYEST)) return light.colour.toLowerCase();
  const fallback = hsvOf(light.colour);
  const tinted = hsvColour(cover.hue, fallback.saturation, fallback.value);
  const ceiling = BRIGHTEST * relativeLuminance(light.colour);
  const luminance = relativeLuminance(tinted);
  return luminance <= ceiling ? tinted : dimmed(tinted, ceiling / luminance);
}

/**
 * The colour a cover is known by, as every Noctorium finds it: its most common vivid hue, as the average of the pixels
 * in it. The pixels are sorted into twelve hues, and the nearly black, the nearly white and the washed out are passed
 * over as the background of a cover rather than its character; a cover with nothing vivid in it has no colour, and
 * the answer is undefined rather than a guess. [pixels] are [width] by [height] as a canvas gives them -- red, green,
 * blue and alpha a pixel, a row at a time from the top -- from a small copy: a hundred-odd pixels across is plenty.
 */
export function artworkColour(pixels: ArrayLike<number>, width: number, height: number): string | undefined {
  if (pixels.length < width * height * 4) throw new Error(`${width} by ${height} needs ${width * height} pixels, not ${pixels.length / 4}`);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 48));
  const buckets = Array.from({ length: 12 }, () => [0, 0, 0, 0]);
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const red = f(pixels[i] / 255);
      const green = f(pixels[i + 1] / 255);
      const blue = f(pixels[i + 2] / 255);
      const brightest = Math.max(red, green, blue);
      const darkest = Math.min(red, green, blue);
      const saturation = brightest <= 0 ? 0 : f(f(brightest - darkest) / brightest);
      if (brightest > f(0.15) && brightest < f(0.97) && saturation > f(0.22)) {
        const bucket = buckets[Math.min(11, Math.max(0, Math.trunc(f(hue(red, green, blue) / 30))))];
        bucket[0] = f(bucket[0] + red);
        bucket[1] = f(bucket[1] + green);
        bucket[2] = f(bucket[2] + blue);
        bucket[3] = f(bucket[3] + 1);
      }
    }
  }
  // The first of the most counted, as Base's maxByOrNull takes it.
  let most: number[] | undefined;
  for (const bucket of buckets) if (bucket[3] > 0 && (!most || bucket[3] > most[3])) most = bucket;
  if (!most) return undefined;
  return colourOf(f(most[0] / most[3]), f(most[1] / most[3]), f(most[2] / most[3]));
}

/**
 * The light as CSS: one gradient a shape, of [colour] -- a colour, or a var() of one, so the page can ease it --
 * for a page [width] by [height] pixels, the topmost first, as background-image takes them. A pool is a circle with
 * its radius in pixels, a radius written as a percentage making an ellipse; a band runs down from the top, its stops
 * at depth times their place.
 */
export function glowImage(light: Glow, width: number, height: number, colour = 'var(--glow)'): string {
  const longer = Math.max(width, height);
  const stops = (shape: GlowShape, at: (t: number) => number) =>
    FALLOFF.map(([t, left]) => `color-mix(in srgb, ${colour} ${number(light.strength * shape.strength * left * 100)}%, transparent) ${number(at(t) * 100)}%`).join(', ');
  return [...light.shapes].reverse().map((shape) =>
    shape.kind === 'pool'
      ? `radial-gradient(circle ${number(shape.radius * longer)}px at ${number(shape.x * 100)}% ${number(shape.y * 100)}%, ${stops(shape, (t) => t)})`
      : `linear-gradient(to bottom, ${stops(shape, (t) => t * shape.depth)})`,
  ).join(', ');
}

/** A number for CSS: at most three places, and no trailing zeros. */
function number(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

// ------------------------------------------------------------------ Base's float sums on colours

interface Hsv { hue: number; saturation: number; value: number }

function channels(colour: string): [number, number, number] {
  const n = parseInt(colour.replace('#', '').slice(-6), 16);
  return [f(((n >> 16) & 255) / 255), f(((n >> 8) & 255) / 255), f((n & 255) / 255)];
}

/** The hue of a colour in degrees, 0 for a grey. */
function hue(red: number, green: number, blue: number): number {
  const brightest = Math.max(red, green, blue);
  const delta = f(brightest - Math.min(red, green, blue));
  if (delta <= 0) return 0;
  const h = brightest === red
    ? f(60 * (f(f(green - blue) / delta) % 6))
    : brightest === green
      ? f(60 * f(f(f(blue - red) / delta) + 2))
      : f(60 * f(f(f(red - green) / delta) + 4));
  return h < 0 ? f(h + 360) : h;
}

function hsvOf(colour: string): Hsv {
  const [red, green, blue] = channels(colour);
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  return { hue: hue(red, green, blue), saturation: brightest <= 0 ? 0 : f(f(brightest - darkest) / brightest), value: brightest };
}

function hsvColour(hueDegrees: number, saturation: number, value: number): string {
  const chroma = f(value * saturation);
  const h = f(f(hueDegrees / 60) % 6);
  const second = f(chroma * f(1 - Math.abs(f(f(h % 2) - 1))));
  const [r, g, b] = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second], [0, second, chroma], [second, 0, chroma],
  ][Math.trunc(h)] ?? [chroma, 0, second];
  const m = f(value - chroma);
  return colourOf(f(r + m), f(g + m), f(b + m));
}

/** [colour] with its light cut to [fraction] of what it was, in linear light so the hue stays put. */
function dimmed(colour: string, fraction: number): string {
  const n = parseInt(colour.replace('#', '').slice(-6), 16);
  const channel = (c: number) => {
    const v = c / 255;
    const linear = (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)) * fraction;
    return f(linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055);
  };
  return colourOf(channel((n >> 16) & 255), channel((n >> 8) & 255), channel(n & 255));
}

/** An opaque colour from three channels between 0 and 1, rounded as Base rounds a Float to a byte. */
function colourOf(red: number, green: number, blue: number): string {
  const byte = (c: number) => Math.round(f(Math.min(1, Math.max(0, c)) * 255)).toString(16).padStart(2, '0');
  return `#${byte(red)}${byte(green)}${byte(blue)}`;
}
