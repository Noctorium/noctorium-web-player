/**
 * The first-time setup, as Noctorium-Base's SetupStep has it: the same steps in the same words on every Noctorium.
 * Shown once -- on a first start, until it is finished or skipped -- by the settings' setupDone.
 */
export type SetupStep = 'WELCOME' | 'LOOK' | 'SEARCH' | 'LISTENING' | 'ACCOUNTS' | 'DONE';

export const SETUP_STEPS: { step: SetupStep; title: string; about: string }[] = [
  {
    step: 'WELCOME',
    title: 'Welcome to Noctorium',
    about: 'YouTube Music, SoundCloud, Spotify, Bandcamp and more, in one player. A few quick choices and you’re listening — or skip them, and choose later in Settings.',
  },
  { step: 'LOOK', title: 'Pick a look', about: 'A theme to start with. There are many more in Settings, and an accent of your own.' },
  {
    step: 'SEARCH',
    title: 'Where to search',
    about: 'Which services a search asks. A bang at the start or end — !ytm, !sc, !sp — sends one search to one service.',
  },
  { step: 'LISTENING', title: 'When the queue runs out', about: 'Keep playing songs like the last one, or stop when the queue ends.' },
  {
    step: 'ACCOUNTS',
    title: 'Your accounts',
    about: 'Sign in to bring your playlists and likes. Noctorium plays without signing in, and you can sign in any time.',
  },
  { step: 'DONE', title: 'You’re all set', about: 'Search for something, or paste a link from YouTube, SoundCloud or Spotify to play it.' },
];

/** The themes the setup offers, by the names settings keep them under. */
export const SETUP_THEMES = ['NOCTORIUM_NIGHT', 'NOCTORIUM_DUSK', 'NOCTORIUM_DAY', 'CATPPUCCIN_MOCHA', 'TOKYO_NIGHT', 'ROSE_PINE', 'NORD', 'DRACULA'];

/** Where searches go: every service at once, or one of the two that need nothing set up. */
export const SETUP_SEARCH_MODES: [string, string][] = [['HYBRID', 'Every service at once'], ['YOUTUBE_MUSIC', 'YouTube Music'], ['SOUNDCLOUD', 'SoundCloud']];

/** "Step 2 of 6". */
export function setupProgress(index: number): string {
  return `Step ${index + 1} of ${SETUP_STEPS.length}`;
}
