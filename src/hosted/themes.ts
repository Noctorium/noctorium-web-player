import type { Theme } from '../types';

/*
 * Every Noctorium theme, as Base's Themes.kt has them, for the hosted player, which has no Noctorium to ask.
 * The same six colours and a switch; a change there is a change here.
 */

const t = (name: string, title: string, family: string, background: string, panel: string, card: string, text: string, subtext: string, accent: string, light = false): Theme =>
  ({ name, title, family, background, panel, card, text, subtext, accent, light });

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
  t('WINDOWS_98', '98', 'Windows', '#C0C0C0', '#B4B4B4', '#FFFFFF', '#000000', '#3A3A3A', '#000080', true),
  t('WINDOWS_XP', 'XP', 'Windows', '#ECE9D8', '#D6DFF7', '#FFFFFF', '#000000', '#4D4D4D', '#245EDC', true),
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

/** The theme with the chosen accent in it -- the artwork's when that is chosen and one was found. */
export function colours(theme: string, accent: string, artwork?: string): Theme {
  const base = themes.find((x) => x.name === theme) ?? themes[0];
  const chosen = accent === 'ARTWORK' ? artwork : accents[accent];
  return chosen ? { ...base, accent: chosen } : base;
}

/**
 * The cover's most vivid colour, kept light enough to read on a dark theme and dark enough on a light one.
 * Every cover the services serve allows a page to read it, so a small copy is drawn and its pixels counted.
 */
export function artworkAccent(url: string, light: boolean): Promise<string | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => resolve(undefined);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 24;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return resolve(undefined);
        context.drawImage(image, 0, 0, 24, 24);
        const data = context.getImageData(0, 0, 24, 24).data;
        let best: [number, number, number] | undefined;
        let score = -1;
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const value = max / 255;
          const s = saturation * 0.75 + value * 0.25 - (value < 0.2 ? 1 : 0);
          if (s > score) { score = s; best = [r, g, b]; }
        }
        if (!best || score < 0.25) return resolve(undefined);
        resolve(readable(best, light));
      } catch {
        resolve(undefined);
      }
    };
    image.src = url;
  });
}

function readable([r, g, b]: [number, number, number], light: boolean): string {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const target = light ? Math.min(lum, 0.45) : Math.max(lum, 0.55);
  const factor = lum === 0 ? 1 : target / lum;
  const mix = (c: number) => {
    const scaled = light ? c * factor : c + (255 - c) * Math.max(0, (target - lum) / (1 - lum || 1));
    return Math.round(Math.min(255, Math.max(0, scaled))).toString(16).padStart(2, '0');
  };
  return `#${mix(r)}${mix(g)}${mix(b)}`.toUpperCase();
}
