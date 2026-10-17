import { describe, expect, it } from 'vitest';
import { artworkColour, BRIGHTEST, FALLOFF, falloff, glow, glowImage, opacityAt, PLACEMENTS, resolvedColour } from './glow';
import { contrastRatio, relativeLuminance } from './contrast';
import { themes } from '../hosted/themes';
import type { Glow } from '../types';
import stylesheet from '../styles.css?raw';

/**
 * The light some themes lay across their page, as Base's GlowTest has it, case for case: where it falls, what colour
 * it takes from a cover, that the writing still reads where it is brightest, and the colour a cover is known by --
 * and then that the CSS the page draws it with is that light.
 */

const glowThemes = themes.filter((t) => t.glow);
const light = (name: string) => themes.find((t) => t.name === name)!.glow!;

/** A desktop window, the one the screenshots were taken in, a phone held upright and on its side, and a wide screen. */
const pages: [number, number][] = [[1200, 780], [412, 892], [892, 412], [1920, 1080]];

/** The light over [page] at [opacity], as a gradient lays a colour over what is under it. */
function lit(page: string, colour: string, opacity: number): string {
  const p = parseInt(page.slice(1), 16);
  const c = parseInt(colour.slice(1), 16);
  const channel = (shift: number) => {
    const under = (p >> shift) & 255;
    return Math.round(under + (((c >> shift) & 255) - under) * opacity);
  };
  return '#' + [16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('');
}

/** The most opaque the light comes anywhere on a page [width] by [height], looked for every few pixels. */
function brightest(g: Glow, width: number, height: number): number {
  let most = 0;
  for (let y = 0; y <= height; y += 4) for (let x = 0; x <= width; x += 4) most = Math.max(most, opacityAt(g, x, y, width, height));
  return most;
}

function hsv(hue: number, saturation: number, value: number): string {
  const chroma = value * saturation;
  const h = hue / 60;
  const second = chroma * (1 - Math.abs((h % 2) - 1));
  const [r, g, b] = [[chroma, second, 0], [second, chroma, 0], [0, chroma, second], [0, second, chroma], [second, 0, chroma]][Math.trunc(h)] ?? [chroma, 0, second];
  const m = value - chroma;
  return '#' + [r, g, b].map((c) => Math.round((c + m) * 255).toString(16).padStart(2, '0')).join('');
}

/** [width] by [height] pixels as a canvas gives them, each [colour] at x, y. */
function image(width: number, height: number, colour: (x: number, y: number) => number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = colour(x, y);
      pixels.set([(c >> 16) & 255, (c >> 8) & 255, c & 255, 255], (y * width + x) * 4);
    }
  }
  return pixels;
}

describe('a glow', () => {
  it('fades from all of it at the middle to none at the rim, smoothly', () => {
    expect(falloff(0)).toBe(1);
    expect(falloff(1)).toBe(0);
    expect(falloff(1.5)).toBe(0);
    expect(falloff(0.5)).toBe(0.5);
    expect(falloff(0.3125)).toBeCloseTo((0.84 + 0.68) / 2, 5);
    expect(FALLOFF[0]).toEqual([0, 1]);
    expect(FALLOFF[FALLOFF.length - 1]).toEqual([1, 0]);
    for (let i = 1; i < FALLOFF.length; i++) {
      expect(FALLOFF[i][0]).toBeGreaterThan(FALLOFF[i - 1][0]);
      expect(FALLOFF[i][1]).toBeLessThan(FALLOFF[i - 1][1]);
    }
  });

  it('is its strength where it is brightest, and nothing far from it', () => {
    for (const theme of glowThemes) {
      for (const [width, height] of pages) {
        const most = brightest(theme.glow!, width, height);
        expect(most, `${theme.name} at ${width} by ${height}`).toBeLessThanOrEqual(theme.glow!.strength + 1e-4);
        expect(most, `${theme.name} at ${width} by ${height}`).toBeGreaterThanOrEqual(theme.glow!.strength * 0.97);
      }
    }
    const top = light('VELVET');
    expect(opacityAt(top, 600, 0, 1200, 780)).toBeCloseTo(top.strength, 5);
    expect(opacityAt(top, 600, 600, 1200, 780)).toBe(0);
    expect(opacityAt(top, 0, 100, 1200, 780)).toBe(opacityAt(top, 1200, 100, 1200, 780));
    const artwork = light('AFTERGLOW');
    expect(opacityAt(artwork, 1200, 780, 1200, 780)).toBe(0);
    expect(opacityAt(artwork, 672, 281, 1200, 780)).toBeGreaterThan(opacityAt(artwork, 1100, 100, 1200, 780));
  });

  it('leaves the writing on the page reading where it is brightest, whatever the cover', () => {
    const covers: (string | undefined)[] = [...Array.from({ length: 72 }, (_, i) => hsv(i * 5, 1, 0.9)), undefined];
    for (const theme of glowThemes) {
      for (const cover of covers) {
        const colour = resolvedColour(theme.glow!, cover);
        const page = lit(theme.background, colour, theme.glow!.strength);
        expect(contrastRatio(theme.text, page), `${theme.name} under ${colour}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.subtext, page), `${theme.name} under ${colour}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('is soft, a glow rather than a lamp', () => {
    for (const theme of glowThemes) {
      const page = lit(theme.background, resolvedColour(theme.glow!), theme.glow!.strength);
      expect(contrastRatio(page, theme.background), theme.name).toBeLessThan(1.6);
      expect(contrastRatio(page, theme.background), theme.name).toBeGreaterThan(1.05);
    }
  });

  it("takes the cover's hue when it follows the artwork, and falls back on its own colour", () => {
    const afterglow = light('AFTERGLOW');
    expect(resolvedColour(afterglow)).toBe('#c41e0c');
    expect(resolvedColour(afterglow, '#808080')).toBe('#c41e0c');
    expect(resolvedColour(afterglow, '#FFF7F4')).toBe('#c41e0c');
    const blue = parseInt(resolvedColour(afterglow, '#2A7AC8').slice(1), 16);
    expect(blue & 255).toBeGreaterThan(((blue >> 16) & 255) * 4);
    expect(resolvedColour(afterglow, '#98B0E0')).toBe(resolvedColour(afterglow, '#183060'));
    expect(resolvedColour(afterglow, '#FF5050')).toBe(resolvedColour(afterglow, '#801010'));
    for (const loud of ['#FFFF00', '#00FFFF', '#00FF00']) {
      expect(relativeLuminance(resolvedColour(afterglow, loud))).toBeLessThanOrEqual(BRIGHTEST * relativeLuminance('#C41E0C') + 0.002);
    }
    expect(resolvedColour(light('CINDER'), '#2A7AC8')).toBe('#c41e0c');
    expect(resolvedColour(light('VELVET'), '#2A7AC8')).toBe('#7a2450');
  });

  it("gives the very colours Base gives, for covers of every hue", () => {
    // Base's own answers, worked out by its ThemeGlow.resolvedColour for Afterglow's light.
    const afterglow = glow('#C41E0C', 'ARTWORK', 0.34, true);
    const base: [string, string][] = [
      ['#e60000', '#c40c0c'], ['#663333', '#c40c0c'], ['#b39191', '#c41e0c'], ['#e61b00', '#c4220c'], ['#b3918d', '#c41f0c'],
      ['#e6a100', '#b4810a'], ['#665733', '#b3810a'], ['#e6d600', '#968c07'], ['#dae600', '#899006'], ['#a4e600', '#6d9707'],
      ['#04e600', '#0aa008'], ['#00e617', '#08a017'], ['#8db39a', '#08a03c'], ['#00e682', '#089e5d'],
    ];
    for (const [cover, answer] of base) expect(resolvedColour(afterglow, cover), cover).toBe(answer);
  });
});

describe("a cover's colour", () => {
  it('is its most common vivid hue', () => {
    // A dark cover with a red bar down it and a little blue in the corner: the red is what it is known by.
    const pixels = image(96, 96, (x, y) => (x >= 40 && x <= 56 ? 0xc0261a : x < 12 && y < 12 ? 0x2a7ac8 : 0x141414));
    expect(artworkColour(pixels, 96, 96)).toBe('#c0261a');
  });

  it('is none for a cover with nothing vivid in it', () => {
    expect(artworkColour(image(64, 64, (x, y) => ((y * 64 + x) % 3 === 0 ? 0xffffff : 0x303030)), 64, 64)).toBeUndefined();
    expect(artworkColour(image(64, 64, () => 0x200000), 64, 64)).toBeUndefined();
    expect(artworkColour(image(64, 64, () => 0xe8d8d8), 64, 64)).toBeUndefined();
    expect(() => artworkColour(new Uint8ClampedArray(40), 64, 64)).toThrow();
  });

  it('is averaged over its hue, so a gradient gives its middle', () => {
    const colour = artworkColour(image(48, 48, (x) => ((128 + x * 2) << 16) | (24 << 8) | 16), 48, 48)!;
    expect(parseInt(colour.slice(1, 3), 16)).toBe(128 + 47);
    expect(parseInt(colour.slice(3, 5), 16)).toBe(24);
  });

  it('is the colour Base finds, for pictures of every size', () => {
    // Base's own answers, worked out by its ArtworkColour.of for these pictures.
    const picture = (formula: number, k: number) => (x: number, y: number): number => {
      const [r, g, b] = formula === 0
        ? [(x * (k + 3) * 7 + y * 3) % 256, (y * (k + 2) * 5 + x) % 256, (x * y + k * 40) % 256]
        : formula === 1
          ? [(x * 2 + k * 30) % 256, (y + Math.trunc(x / 3)) % 200, (255 - y * 2 + k) & 255]
          : formula === 2
            ? (Math.trunc(x / 8) + Math.trunc(y / 8)) % 3 === 0 ? [200, 40 + k * 10, 30] : [(x * 9) % 60, (y * 5) % 60, 50]
            : [((x ^ y) * (k + 1)) & 255, ((x * y) >> 3) & 255, ((x + y) * 3) & 255];
      return (r << 16) | (g << 8) | b;
    };
    const base: [number, number, number, number, string][] = [
      [0, 0, 48, 48, '#ae4930'], [1, 0, 48, 48, '#3d20d2'], [2, 0, 48, 48, '#c8281e'], [3, 0, 48, 48, '#214291'],
      [0, 2, 96, 96, '#9339b3'], [1, 2, 96, 96, '#9d2fc3'], [3, 2, 96, 96, '#3ba94b'],
      [0, 3, 128, 128, '#b73a98'], [3, 3, 128, 128, '#ad2f8d'],
      [0, 4, 100, 80, '#9939b9'], [1, 4, 100, 80, '#a322cd'], [3, 4, 100, 80, '#a51f75'],
      [0, 5, 120, 120, '#5637b7'], [3, 5, 120, 120, '#9d234b'],
      [0, 6, 50, 130, '#36ba57'], [1, 6, 50, 130, '#d82fb2'], [2, 6, 50, 130, '#c8641e'], [3, 6, 50, 130, '#b51a48'],
    ];
    for (const [formula, k, width, height, answer] of base) {
      expect(artworkColour(image(width, height, picture(formula, k)), width, height), `${formula}:${k}`).toBe(answer);
    }
  });
});

describe('the CSS a glow is drawn with', () => {
  it('is a circle a pool, its radius in pixels of the longer side, at its place as fractions of the page', () => {
    const css = glowImage(light('AFTERGLOW'), 1200, 780);
    const gradients = css.split(/, (?=radial|linear)/);
    // Base's shapes in order, one over the other: the later on top, which CSS lists first.
    expect(gradients).toHaveLength(2);
    expect(gradients[0]).toMatch(/^radial-gradient\(circle 408px at 56% 36%, /);
    expect(gradients[1]).toMatch(/^radial-gradient\(circle 252px at 32\.5% 72%, /);
    // Upright, the longer side is the height.
    expect(glowImage(light('AFTERGLOW'), 412, 892)).toContain('circle 303.28px at 56% 36%');
  });

  it("is a band from the top for TOP, its stops at the depth's share of their places", () => {
    const css = glowImage(light('VELVET'), 1200, 780);
    expect(css).toMatch(/^linear-gradient\(to bottom, /);
    expect(css).toContain('color-mix(in srgb, var(--glow) 20%, transparent) 0%');
    expect(css).toContain('color-mix(in srgb, var(--glow) 10%, transparent) 31%');
    expect(css).toContain('color-mix(in srgb, var(--glow) 0%, transparent) 62%');
  });

  it("runs each gradient through Base's falloff in one colour, only its opacity changing, to none at the rim", () => {
    const afterglow = light('AFTERGLOW');
    const [broad, low] = glowImage(afterglow, 1200, 780).split(/, (?=radial|linear)/);
    const stops = (gradient: string) => [...gradient.matchAll(/color-mix\(in srgb, (.+?) ([\d.]+)%, transparent\) ([\d.]+)%/g)];
    for (const [gradient, shape] of [[broad, afterglow.shapes[1]], [low, afterglow.shapes[0]]] as const) {
      const found = stops(gradient);
      expect(found).toHaveLength(FALLOFF.length);
      expect(new Set(found.map((m) => m[1]))).toEqual(new Set(['var(--glow)']));
      found.forEach((m, i) => {
        expect(Number(m[2])).toBeCloseTo(afterglow.strength * shape.strength * FALLOFF[i][1] * 100, 2);
        expect(Number(m[3])).toBeCloseTo(FALLOFF[i][0] * 100, 2);
      });
    }
    // At the middle of the low pool, a third as strong again as the glow, and beyond its rim, nothing.
    expect(stops(low)[0][2]).toBe('27.88');
    expect(stops(low)[FALLOFF.length - 1][2]).toBe('0');
  });

  it('can be drawn in a colour of its own', () => {
    expect(glowImage(light('SMOKE'), 800, 600, '#8c8c8c')).toContain('color-mix(in srgb, #8c8c8c 10%, transparent) 0%');
  });

  it("is drawn for every placement Base has, and from the shapes alone", () => {
    expect(Object.keys(PLACEMENTS)).toEqual(['ARTWORK', 'TOP']);
    const made = glow('#123456', 'TOP', 0.5);
    expect(made.shapes).toBe(PLACEMENTS.TOP);
    expect(glowImage({ ...made, placement: 'SOMEWHERE_LATER' }, 800, 600)).toBe(glowImage(made, 800, 600));
  });
});

/** The page's own rules for the light, read from its stylesheet as the browser reads them. */
describe("the page's stylesheet", () => {
  const css = stylesheet.replace(/\r\n/g, '\n');
  const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

  it('lays the light on the page and on the now playing screen, fixed to the window so the two line up', () => {
    const page = rule(':root.glow body, :root.glow .now-playing');
    expect(page).toContain('background-color: var(--bg)');
    expect(page).toContain('background-image: var(--glow-image)');
    expect(page).toContain('background-attachment: fixed');
  });

  it("eases the light's colour as a colour, and not where animations are off", () => {
    expect(css).toMatch(/@property --glow \{ syntax: '<color>'; inherits: true; initial-value: transparent; \}/);
    expect(rule(':root.glow')).toContain('transition: --glow 0.6s');
    expect(rule(':root.glow.no-motion')).toContain('transition: none');
  });

  it('keeps panels in their own colour over it, and puts the blurred cover away', () => {
    expect(rule(':root.glow .panel')).toContain('background: var(--card)');
    expect(rule(':root.glow .now-playing .backdrop')).toContain('display: none');
    // The sidebar and the player bar are panels already, in their own colour.
    expect(rule('.sidebar')).toContain('background: var(--panel)');
    expect(rule('.player')).toContain('background: var(--panel)');
  });

  it("writes on the accent in the accent's own writing colour, the switch's thumb too", () => {
    expect(rule('.switch.on::after')).toContain('background: var(--on-accent)');
    expect(rule('.button.primary')).toContain('color: var(--on-accent)');
  });

  it('marks a button that is on by more than its colour where the accent is the writing’s', () => {
    expect(rule(':root.accent-is-writing .round-button.on:not(.like)::after')).toContain('background: currentColor');
    expect(rule(':root.accent-is-writing .tool.on:not([data-button="LIKE"])')).toContain('background: var(--press)');
  });
});
