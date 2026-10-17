import type { Glow, Theme, Windows98 } from '../types';
import { NOCTORIUM_98, STANDARD_98 } from '../windows98';
import { onAccent } from '../base/contrast';
import { artworkColour, glow, resolvedColour } from '../base/glow';

/*
 * Every Noctorium theme, as Base's Themes.kt has them, for the hosted player, which has no Noctorium to ask.
 * The same six colours and a switch, and for the Windows ones their skin -- with 98's scheme for the two drawn as
 * 98 -- and for the Glow ones their light; a change there is a change here.
 */

const t = (name: string, title: string, family: string, background: string, panel: string, card: string, text: string, subtext: string, accent: string, light = false, skin?: string, windows98?: Windows98): Theme =>
  ({ name, title, family, background, panel, card, text, subtext, accent, light, skin, windows98, onAccent: onAccent(accent) });

/** A theme with a light laid across its page. */
const lit = (theme: Theme, light: Glow): Theme => ({ ...theme, glow: light });

export const themes: Theme[] = [
  t('NOCTORIUM_NIGHT', 'Night', 'Noctorium', '#000000', '#07050A', '#15101C', '#F8F4FF', '#CFC5DA', '#B47CFF'),
  t('NOCTORIUM_DUSK', 'Dusk', 'Noctorium', '#0D0B12', '#141019', '#1D1826', '#F3F1F8', '#C9C2D6', '#B47CFF'),
  t('NOCTORIUM_DAY', 'Day', 'Noctorium', '#FAF7FF', '#FFFFFF', '#ECE6F6', '#1A1425', '#5B5470', '#7C3AED', true),
  t('CRIMSON', 'Crimson', 'Crimson', '#000000', '#080203', '#170609', '#FFF1F3', '#D6B4BA', '#E0243F'),
  t('CRIMSON_SCARLET', 'Scarlet', 'Crimson', '#000000', '#110404', '#230A0B', '#FFF4F1', '#E0BBB5', '#FF3B36'),
  t('CRIMSON_GARNET', 'Garnet', 'Crimson', '#000000', '#0F0307', '#2A0B15', '#FAEAEE', '#CFA7B1', '#C81E45'),
  t('CATPPUCCIN_LATTE', 'Latte', 'Catppuccin', '#EFF1F5', '#E6E9EF', '#CCD0DA', '#4C4F69', '#6C6F85', '#8839EF', true),
  t('CATPPUCCIN_FRAPPE', 'Frappé', 'Catppuccin', '#303446', '#292C3C', '#414559', '#C6D0F5', '#A5ADCE', '#CA9EE6'),
  t('CATPPUCCIN_MACCHIATO', 'Macchiato', 'Catppuccin', '#24273A', '#1E2030', '#363A4F', '#CAD3F5', '#A5ADCB', '#C6A0F6'),
  t('CATPPUCCIN_MOCHA', 'Mocha', 'Catppuccin', '#1E1E2E', '#181825', '#313244', '#CDD6F4', '#A6ADC8', '#CBA6F7'),
  t('NORD', 'Nord', 'Nord', '#2E3440', '#3B4252', '#434C5E', '#ECEFF4', '#D8DEE9', '#88C0D0'),
  t('DRACULA', 'Dracula', 'Dracula', '#282A36', '#21222C', '#44475A', '#F8F8F2', '#BFBFBF', '#BD93F9'),
  t('GRUVBOX', 'Gruvbox', 'Gruvbox', '#282828', '#1D2021', '#3C3836', '#EBDBB2', '#A89984', '#FE8019'),
  t('ROSE_PINE', 'Rosé Pine', 'Rosé Pine', '#191724', '#1F1D2E', '#26233A', '#E0DEF4', '#908CAA', '#C4A7E7'),
  t('TOKYO_NIGHT', 'Tokyo Night', 'Tokyo Night', '#1A1B26', '#16161E', '#24283B', '#C0CAF5', '#A9B1D6', '#7AA2F7'),
  t('SOLARIZED_DARK', 'Solarized Dark', 'Solarized', '#002B36', '#073642', '#0D3D49', '#EEE8D5', '#93A1A1', '#268BD2'),
  t('SOLARIZED_LIGHT', 'Solarized Light', 'Solarized', '#FDF6E3', '#EEE8D5', '#E7E0C9', '#073642', '#586E75', '#268BD2', true),
  // Near-black pages lit by a soft light: Afterglow's in the playing cover's colour, red until there is one, Cinder's
  // that red held still, Velvet's plum and Smoke's grey across the top. White is the accent of three of them.
  lit(t('AFTERGLOW', 'Afterglow', 'Glow', '#0B0A0A', '#121111', '#1A1A1A', '#F6F2F1', '#A8A2A0', '#FFF7F4'), glow('#C41E0C', 'ARTWORK', 0.34, true)),
  lit(t('CINDER', 'Cinder', 'Glow', '#0B0A0A', '#121111', '#1A1A1A', '#F6F2F1', '#A8A2A0', '#D93826'), glow('#C41E0C', 'ARTWORK', 0.28)),
  lit(t('VELVET', 'Velvet', 'Glow', '#0A0A0A', '#0F0F0F', '#141414', '#F7F7F7', '#A7A7A7', '#FFFFFF'), glow('#7A2450', 'TOP', 0.2)),
  lit(t('SMOKE', 'Smoke', 'Glow', '#0A0A0A', '#0F0F0F', '#141414', '#F7F7F7', '#A7A7A7', '#FFFFFF'), glow('#8C8C8C', 'TOP', 0.1)),
  t('WINDOWS_98', '98', 'Windows', '#C0C0C0', '#B4B4B4', '#FFFFFF', '#000000', '#3A3A3A', '#000080', true, 'WINDOWS_98', STANDARD_98),
  t('WINDOWS_98_NOCTORIUM', 'Noctorium 98', 'Windows', '#231B2E', '#1B1524', '#0B0810', '#F8F4FF', '#CFC5DA', '#B47CFF', false, 'WINDOWS_98', NOCTORIUM_98),
  t('WINDOWS_XP', 'XP', 'Windows', '#ECE9D8', '#D6DFF7', '#FFFFFF', '#000000', '#4D4D4D', '#245EDC', true, 'WINDOWS_XP'),
];

/** Base's AccentPreset: a colour, or null for the theme's own and for the artwork's. */
export const accents: Record<string, string | null> = {
  THEME: null,
  VIOLET: '#B47CFF',
  MAGENTA: '#FF6EC7',
  EMBER: '#FF9757',
  AZURE: '#5AB2FF',
  MINT: '#5FE3B0',
  ARTWORK: null,
};

/**
 * The theme in force, as Noctorium tells it to the page: with the chosen accent in it -- for "Match the artwork",
 * [artwork], the playing cover's colour as artworkColour finds it, while it has one -- the colour of writing on that
 * accent, and the theme's light, if it has one, in the colour it takes from the cover.
 */
export function colours(theme: string, accent: string, artwork?: string): Theme {
  const base = themes.find((x) => x.name === theme) ?? themes[0];
  const chosen = (accent === 'ARTWORK' ? artwork : accents[accent]) ?? base.accent;
  return {
    ...base,
    accent: chosen,
    onAccent: onAccent(chosen),
    glow: base.glow && { ...base.glow, colour: resolvedColour(base.glow, artwork) },
  };
}

/** Whether anything is drawn in the cover's colour: the artwork's accent, or a light that follows the artwork. */
export function wantsArtwork(theme: string, accent: string): boolean {
  return accent === 'ARTWORK' || !!themes.find((x) => x.name === theme)?.glow?.followsArtwork;
}

/**
 * The colour the cover at [url] is known by, as every Noctorium finds it -- see artworkColour -- or undefined for a
 * cover with no colour in it, or one that could not be read. Every cover the services serve allows a page to read it,
 * so a small copy is drawn, a hundred and twenty-eight pixels across, and its pixels counted.
 */
export function coverColour(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => resolve(undefined);
    image.onload = () => {
      try {
        const width = 128;
        const height = Math.max(1, Math.round((width * image.naturalHeight) / (image.naturalWidth || width)));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(undefined);
        context.drawImage(image, 0, 0, width, height);
        resolve(artworkColour(context.getImageData(0, 0, width, height).data, width, height));
      } catch {
        resolve(undefined);
      }
    };
    image.src = url;
  });
}
