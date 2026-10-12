import type { AnalysisKind } from './visualiser';

/*
 * The choices that came with the desktop-music-player look, as Base's settings/Looks.kt and its other enums have
 * them: names, the words the listener sees, and what each does. Noctorium on a computer sends its own lists with the
 * settings; these are for the hosted player, which has none to ask, and for a Noctorium from before them.
 */

/** One of a setting's choices, with what it means: the shape `Choice` has in types.ts. */
export interface Choice { name: string; title: string; description?: string }

/** The visualiser in the Playlist layout's info bar. Real audio only: see shownWith. */
export const VISUALISER_STYLES: (Choice & { wants: AnalysisKind })[] = [
  { name: 'BARS', title: 'Bars', description: 'A bar for each part of the sound, from the bass up, moving with the music.', wants: 'SPECTRUM' },
  { name: 'LEVEL_METER', title: 'Level meter', description: 'How loud each channel is, the way a mixing desk’s meters show it.', wants: 'LEVELS' },
  { name: 'OFF', title: 'Off', description: 'No visualiser, and nothing measured for one.', wants: 'NONE' },
];

/** What the [style] wants measured: a spectrum for Bars, levels for the meter, nothing when it is off. */
export function wants(style: string): AnalysisKind {
  return VISUALISER_STYLES.find((s) => s.name === style)?.wants ?? 'NONE';
}

/**
 * What is actually drawn where the player can give [available]: bars become a level meter where only levels can
 * be had, and either becomes nothing where nothing can -- a song in YouTube's embedded player, Spotify in its app.
 */
export function shownWith(style: string, available: AnalysisKind): string {
  if (style === 'OFF' || available === 'NONE') return 'OFF';
  if (style === 'BARS' && available === 'LEVELS') return 'LEVEL_METER';
  return style;
}

/** The columns of the queue's table, in Base's order, with each one's heading. */
export const QUEUE_COLUMNS: (Choice & { heading: string })[] = [
  { name: 'NUMBER', title: 'Number', heading: '#' },
  { name: 'TITLE', title: 'Title', heading: 'Title' },
  { name: 'ARTIST', title: 'Artist', heading: 'Artist' },
  { name: 'ALBUM', title: 'Album', heading: 'Album' },
  { name: 'DURATION', title: 'Duration', heading: 'Duration' },
  { name: 'SERVICE', title: 'Service', heading: 'Service' },
];

/** The table as it first appears: the service is left for whoever wants it. */
export const DEFAULT_QUEUE_COLUMNS = ['NUMBER', 'TITLE', 'ARTIST', 'ALBUM', 'DURATION'];

/** [columns] with each known column once, in the order given, and the title put first if it was left out. */
export function normalisedColumns(columns: readonly string[]): string[] {
  const known = new Set(QUEUE_COLUMNS.map((c) => c.name));
  const once = [...new Set(columns.filter((c) => known.has(c)))];
  return once.includes('TITLE') ? once : ['TITLE', ...once];
}

/** The icon sets, as Base's IconSet. */
export const ICON_SETS: Choice[] = [
  { name: 'STANDARD', title: 'Standard', description: 'The icons this player has always drawn.' },
  { name: 'ROUNDED', title: 'Rounded', description: 'Solid shapes with softened corners and round ends.' },
  { name: 'OUTLINED', title: 'Outlined', description: 'The same shapes drawn as outlines: lighter on the eye.' },
  { name: 'SHARP', title: 'Sharp', description: 'Square corners and straight ends, for a crisper look.' },
  { name: 'FILLED', title: 'Filled', description: 'Solid shapes, bold at a glance.' },
  { name: 'TWO_TONE', title: 'Two-tone', description: 'An outline over a faint fill of the same colour.' },
  { name: 'LINE', title: 'Line', description: 'Thin single strokes in one colour, like a desktop’s own icon theme.' },
];

/** How the badge that says where a song comes from is drawn, as Base's ServiceBadgeStyle: Marks unless asked. */
export const SERVICE_BADGE_STYLES: Choice[] = [
  { name: 'MARKS', title: 'Marks', description: 'Each service’s own mark: YouTube Music’s ring, SoundCloud’s cloud, Spotify’s three waves.' },
  { name: 'LETTERS', title: 'Letters', description: 'The service’s short name, YTM, SC or SP, as the badges always had it.' },
];

/** What playing a song from Home or a search plays after it, as Base's HomePlay. */
export const HOME_PLAYS: Choice[] = [
  { name: 'AUTOPLAY', title: 'Autoplay after it', description: 'The song, then songs like it, as a radio started from it.' },
  { name: 'SHELF', title: 'The songs around it', description: 'The song, then the rest of the shelf on Home, or of the results it was picked from.' },
];

/**
 * The player bar and the now playing screen, which this page keeps for itself rather than Noctorium: the page's
 * own design under Base's name for the one it is -- Centred, and Side by side -- and the desktop-music-player
 * pair beside them.
 */
export const PLAYER_BARS: (Choice & { phone: string })[] = [
  {
    name: 'CENTERED', title: 'Centred',
    description: 'The track on the left, the controls in the middle with the seek bar under them, the tools on the right.',
    phone: 'The track and the play button, with a hairline of progress along the top.',
  },
  {
    name: 'TOOLBAR', title: 'Toolbar',
    description: 'One row of flat buttons, as a desktop music player has them: add to a playlist, previous, play, pause, stop and next, a slider and the time, then repeat, shuffle and the volume.',
    phone: 'The track over a row of flat buttons -- previous, play, pause, stop and next -- with a thin slider and the time.',
  },
];

export const NOW_PLAYING_LAYOUTS: (Choice & { phone: string })[] = [
  {
    name: 'SIDE_BY_SIDE', title: 'Side by side',
    description: 'The track, the controls and the cover on the left, with the queue and lyrics beside them.',
    phone: 'The cover, the track and the controls, with the queue and lyrics under them.',
  },
  {
    name: 'PLAYLIST', title: 'Playlist',
    description: 'The cover in a panel on the left, the queue as a table with columns, and an info bar with the title large and a visualiser.',
    phone: 'A small cover and the title over the queue as a list with columns, and a visualiser beside the title.',
  },
];
