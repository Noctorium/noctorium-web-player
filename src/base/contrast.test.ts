import { describe, expect, it } from 'vitest';
import { accentIsWriting, contrastRatio, onAccent } from './contrast';
import { accents, colours, themes, wantsArtwork } from '../hosted/themes';

/** Writing on the accent as Base's ThemesTest has it, and the hosted player's copy of the themes beside Base's. */
describe('writing on the accent', () => {
  it('is dark on a white one and white on a deep one', () => {
    expect(onAccent('#FFFFFF')).toBe('#292929');
    expect(onAccent('#D93826')).toBe('#ffffff');
    expect(onAccent('#000080')).toBe('#ffffff');
    // The sums the desktop and the phone already did: the accent taken 84% of the way to black on a bright one.
    expect(onAccent(accents.MINT!)).toBe('#0f241c');
    expect(onAccent('#B47CFF')).toBe('#ffffff');
    for (const name of ['AFTERGLOW', 'VELVET', 'SMOKE']) {
      const theme = themes.find((t) => t.name === name)!;
      expect(contrastRatio(onAccent(theme.accent), theme.accent), name).toBeGreaterThanOrEqual(12);
    }
  });

  it("is Base's for every theme, and reads on every Glow theme's accent", () => {
    // Base's own answers for each theme's accent.
    const base: Record<string, string> = {
      NOCTORIUM_NIGHT: '#ffffff', CATPPUCCIN_FRAPPE: '#201925', CATPPUCCIN_MOCHA: '#201b28', NORD: '#161f21', GRUVBOX: '#291404',
      SOLARIZED_DARK: '#ffffff', AFTERGLOW: '#292827', CINDER: '#ffffff', VELVET: '#292929', WINDOWS_XP: '#ffffff',
    };
    for (const [name, answer] of Object.entries(base)) expect(themes.find((t) => t.name === name)!.onAccent, name).toBe(answer);
    for (const theme of themes.filter((t) => t.family === 'Glow')) {
      expect(contrastRatio(theme.onAccent!, theme.accent), theme.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('tells a white accent from a coloured one', () => {
    const writing = themes.filter((t) => accentIsWriting(t.accent, t.text, t.light)).map((t) => t.name);
    expect(writing).toEqual(['AFTERGLOW', 'VELVET', 'SMOKE']);
    expect(accentIsWriting(accents.MINT!, '#F7F7F7', false)).toBe(false);
  });
});

describe("the hosted player's themes", () => {
  it('have the Glow ones after Solarized and before Windows, each with its light', () => {
    const names = themes.map((t) => t.name);
    expect(names.slice(names.indexOf('SOLARIZED_LIGHT'), names.indexOf('SOLARIZED_LIGHT') + 6))
      .toEqual(['SOLARIZED_LIGHT', 'AFTERGLOW', 'CINDER', 'VELVET', 'SMOKE', 'WINDOWS_98']);
    expect(themes.filter((t) => t.glow).map((t) => t.name)).toEqual(['AFTERGLOW', 'CINDER', 'VELVET', 'SMOKE']);
    expect(themes.filter((t) => t.family === 'Glow').map((t) => t.title)).toEqual(['Afterglow', 'Cinder', 'Velvet', 'Smoke']);
    const afterglow = themes.find((t) => t.name === 'AFTERGLOW')!;
    expect([afterglow.background, afterglow.panel, afterglow.card, afterglow.text, afterglow.subtext, afterglow.accent])
      .toEqual(['#0B0A0A', '#121111', '#1A1A1A', '#F6F2F1', '#A8A2A0', '#FFF7F4']);
    expect(afterglow.glow).toMatchObject({ colour: '#C41E0C', followsArtwork: true, placement: 'ARTWORK', strength: 0.34 });
    expect(themes.find((t) => t.name === 'CINDER')!.glow).toMatchObject({ colour: '#C41E0C', followsArtwork: false, placement: 'ARTWORK', strength: 0.28 });
    expect(themes.find((t) => t.name === 'VELVET')!.glow).toMatchObject({ colour: '#7A2450', followsArtwork: false, placement: 'TOP', strength: 0.2 });
    expect(themes.find((t) => t.name === 'SMOKE')!.glow).toMatchObject({ colour: '#8C8C8C', followsArtwork: false, placement: 'TOP', strength: 0.1 });
  });

  it("put the cover's colour in Afterglow's light and in the artwork's accent, and nowhere else", () => {
    expect(colours('AFTERGLOW', 'THEME').glow!.colour).toBe('#c41e0c');
    const blue = colours('AFTERGLOW', 'THEME', '#2A7AC8');
    expect(blue.glow!.colour).not.toBe('#c41e0c');
    expect(blue.accent).toBe('#FFF7F4');
    expect(blue.onAccent).toBe('#292827');
    const artwork = colours('VELVET', 'ARTWORK', '#2A7AC8');
    expect(artwork.accent).toBe('#2A7AC8');
    expect(artwork.onAccent).toBe(onAccent('#2A7AC8'));
    expect(artwork.glow!.colour).toBe('#7a2450');
    expect(colours('VELVET', 'ARTWORK').accent).toBe('#FFFFFF');
    expect(colours('NOCTORIUM_NIGHT', 'MINT').onAccent).toBe('#0f241c');
    expect(colours('NOCTORIUM_NIGHT', 'THEME').glow).toBeUndefined();
  });

  it('look at the cover only while something is drawn in its colour', () => {
    expect(wantsArtwork('AFTERGLOW', 'THEME')).toBe(true);
    expect(wantsArtwork('CINDER', 'THEME')).toBe(false);
    expect(wantsArtwork('NOCTORIUM_NIGHT', 'ARTWORK')).toBe(true);
    expect(wantsArtwork('NOCTORIUM_NIGHT', 'THEME')).toBe(false);
  });
});
