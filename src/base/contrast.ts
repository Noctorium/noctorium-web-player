/*
 * How colours read against each other, and the colour of writing on the accent: Base's contrastRatio and onAccent
 * (Themes.kt), ported, so that a button's label here is the colour every Noctorium writes it in.
 *
 * Colours are "#rrggbb", as the page is told them, either case.
 */

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(-6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "#rrggbb" from three channels of 0 to 255. */
export function hex(red: number, green: number, blue: number): string {
  return '#' + [red, green, blue].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('');
}

/** WCAG's relative luminance, 0 for black and 1 for white. */
export function relativeLuminance(colour: string): number {
  const [r, g, b] = channels(colour).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast between two colours as WCAG counts it, 1 for identical and 21 for black on white. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** [from] taken [ratio] of the way to [to], channel by channel, rounded as Base rounds it. */
export function mix(from: string, to: string, ratio: number): string {
  const a = channels(from);
  const b = channels(to);
  return hex(...(a.map((c, i) => Math.round(c + (b[i] - c) * ratio)) as [number, number, number]));
}

/**
 * The colour of writing and icons laid on [accent]: a button's label, the triangle on a play button, the thumb of a
 * switch that is on. Dark on a bright accent, the accent itself taken most of the way to black so that it still
 * belongs to it, and white on a deep one -- a white button with a white triangle on it being a white circle.
 */
export function onAccent(accent: string): string {
  return relativeLuminance(accent) > 0.35 ? mix(accent, '#000000', 0.84) : '#ffffff';
}

/**
 * Whether [accent] is the writing's own colour, or too near it to be told from it, on a dark page: the white of
 * Afterglow, Velvet and Smoke. What the page picks out only by drawing it in the accent rather than the writing's
 * colour it then picks out some other way as well.
 */
export function accentIsWriting(accent: string, text: string, light: boolean): boolean {
  return !light && contrastRatio(accent, text) < 1.25;
}
