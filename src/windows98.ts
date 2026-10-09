import type { Settings, Windows98 } from './types';

/*
 * The scheme the 98 skin is drawn in. 98 let anybody change its scheme, and every bevel, title bar and list followed,
 * because each was drawn from the scheme's roles rather than from a grey of its own; skins.css draws the same way,
 * from custom properties on the root that are set here from the scheme in force. Noctorium on a computer sends the
 * scheme with the theme; the hosted player, and a Noctorium from before Noctorium 98, are covered by the two Base
 * ships, with the same numbers as Base's Windows98Palette.
 */

/** 98 as it shipped: its Windows Standard scheme. */
export const STANDARD_98: Windows98 = {
  face: '#c0c0c0', highlight: '#ffffff', light: '#dfdfdf', shadow: '#808080', darkShadow: '#000000',
  window: '#ffffff', text: '#000000', greyText: '#808080', selection: '#000080', selectionText: '#ffffff',
  title: '#000080', titleEnd: '#1084d0', inactiveTitle: '#808080', inactiveTitleEnd: '#b5b5b5', titleText: '#ffffff',
  tooltip: '#ffffe1', desktop: '#008080', dark: false,
};

/** Noctorium 98: the same look at night. */
export const NOCTORIUM_98: Windows98 = {
  face: '#231b2e', highlight: '#8f7bb8', light: '#45395a', shadow: '#120d18', darkShadow: '#000000',
  window: '#0b0810', text: '#f8f4ff', greyText: '#7d7191', selection: '#7c3aed', selectionText: '#ffffff',
  title: '#2b0e5c', titleEnd: '#8b5cf6', inactiveTitle: '#2d2737', inactiveTitleEnd: '#5a5068', titleText: '#ffffff',
  tooltip: '#1d1826', desktop: '#140a26', dark: true,
};

/** The scheme for the theme in force: the one sent with it, or else the one Base gives that theme. */
export function windows98Of(settings?: Pick<Settings, 'theme' | 'colours'>): Windows98 {
  return settings?.colours?.windows98 ?? (settings?.theme === 'WINDOWS_98_NOCTORIUM' ? NOCTORIUM_98 : STANDARD_98);
}

/** A little picture, as a CSS url(): 98's glyphs and patterns, drawn a pixel at a time in the scheme's colours. */
function picture(width: number, height: number, ...paths: [colour: string | null, d: string, extra?: string][]): string {
  const body = paths.map(([colour, d, extra]) => `<path${colour ? ` fill='${colour.replace('#', '%23')}'` : ''}${extra ?? ''} d='${d}'/>`).join('');
  return `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>${body}</svg>")`;
}

/**
 * The custom properties skins.css draws the 98 skin from: each of the scheme's roles as a colour, and the pictures
 * that carry colours of their own -- the chequered dither, the ticks, arrows and caption glyphs, the drop-down's
 * button, the radio buttons and the hourglass -- drawn in the scheme's colours rather than in black and white.
 */
export function windows98Properties(p: Windows98): Record<string, string> {
  const radio = (dot: boolean) => picture(12, 12,
    [p.shadow, 'M4 0h4v1H4zM2 1h2v1H2zM8 1h2v1H8zM1 2h1v2H1zM0 4h1v4H0zM1 8h1v2H1z'],
    [p.darkShadow, 'M4 1h4v1H4zM2 2h2v1H2zM8 2h2v1H8zM2 3h1v1H2zM1 4h1v4H1zM2 8h1v1H2z'],
    [p.highlight, 'M10 2h1v2h-1zM11 4h1v4h-1zM10 8h1v2h-1zM8 10h2v1H8zM2 10h2v1H2zM4 11h4v1H4z'],
    [p.window, 'M3 2h6v8H3zM2 4h8v4H2z'],
    [p.light, 'M9 3h1v1H9zM10 4h1v4h-1zM9 8h1v1H9zM8 9h1v1H8zM3 9h1v1H3zM4 10h4v1H4z'],
    ...(dot ? [[p.text, 'M5 4h2v4H5zM4 5h4v2H4z'] as [string, string]] : []),
  );
  return {
    '--w-face': p.face,
    '--w-highlight': p.highlight,
    '--w-light': p.light,
    '--w-shadow': p.shadow,
    '--w-dark-shadow': p.darkShadow,
    '--w-window': p.window,
    '--w-text': p.text,
    '--w-grey-text': p.greyText,
    '--w-selection': p.selection,
    '--w-selection-text': p.selectionText,
    '--w-title-from': p.title,
    '--w-title-to': p.titleEnd,
    '--w-inactive-from': p.inactiveTitle,
    '--w-inactive-to': p.inactiveTitleEnd,
    '--w-title-text': p.titleText,
    '--w-tooltip': p.tooltip,
    '--w-desktop': p.desktop,
    // Half the pixels lit: a latched button, a scroll bar's track, the task that is in front.
    '--w-dither': picture(2, 2, [p.face, 'M0 0h1v1H0zM1 1h1v1H1z'], [p.highlight, 'M1 0h1v1H1zM0 1h1v1H0z']),
    // Half the pixels the selection's: a cover pointed at, as an icon picked out was.
    '--w-selection-dither': picture(2, 2, [p.selection, 'M0 0h1v1H0zM1 1h1v1H1z']),
    '--w-check': picture(7, 7, [p.text, 'M0 2h1v3H0zM1 3h1v3H1zM2 4h1v3H2zM3 3h1v3H3zM4 2h1v3H4zM5 1h1v3H5zM6 0h1v3H6z']),
    '--w-close': picture(8, 7, [p.text, 'M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z']),
    '--w-minimise': picture(6, 2, [p.text, 'M0 0h6v2H0z']),
    '--w-maximise': picture(9, 9, [p.text, 'M0 0h9v9H0zM1 2v6h7V2z', " fill-rule='evenodd'"]),
    '--w-arrow-up': picture(7, 4, [p.text, 'M3 0h1v1H3zM2 1h3v1H2zM1 2h5v1H1zM0 3h7v1H0z']),
    '--w-arrow-down': picture(7, 4, [p.text, 'M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z']),
    '--w-arrow-left': picture(4, 7, [p.text, 'M3 0h1v7H3zM2 1h1v5H2zM1 2h1v3H1zM0 3h1v1H0z']),
    '--w-arrow-right': picture(4, 7, [p.text, 'M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z']),
    // A drop-down's button: a raised slab, with its arrow.
    '--w-select': picture(16, 17,
      [p.face, 'M0 0h16v17H0z'],
      [p.light, 'M0 0h15v1H1v15H0z'],
      [p.highlight, 'M1 1h13v1H2v13H1z'],
      [p.shadow, 'M1 15h14V1h1v15z'],
      [p.darkShadow, 'M0 16h16v1H0zM15 0h1v16h-1z'],
      [p.text, 'M4 6h7v1H4zM5 7h5v1H5zM6 8h3v1H6zM7 9h1v1H7z'],
    ),
    '--w-radio': radio(false),
    '--w-radio-on': radio(true),
    // The busy hourglass: its glass the colour of a window, its sand the selection's.
    '--w-hourglass': picture(16, 16,
      [p.text, 'M2 0h12v2H2zM2 14h12v2H2z'],
      [p.window, 'M3.5 2.5h9v1.5L9 8l3.5 4v1.5h-9V12L7 8 3.5 4z', ` stroke='${p.text.replace('#', '%23')}'`],
      [p.selection, 'M5 4h6L8 7zM8 9l3 4H5z'],
    ),
  };
}
