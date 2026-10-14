import type { SettingEntry } from '../base/settingsSearch';

/*
 * Every setting, for Settings' sections and its search box: where each lives, what it does, and the other words
 * people use for it (US spellings among them) -- "dark mode" for the theme, "louder" for the booster. Base's
 * SettingsSearch finds among them; a test makes sure every setting on the pages has one, and every one a setting.
 */

export interface Page { id: string; section: string; title: string }

/** The sections, in order, each a chip at the top of Settings, and their pages, each a tab under it. */
export const SECTIONS = ['You', 'Look', 'Listening', 'Services', 'This device', 'About'] as const;
export type Section = (typeof SECTIONS)[number];

export const PAGES: Page[] = [
  { id: 'you', section: 'You', title: 'Accounts and listening' },
  { id: 'look-theme', section: 'Look', title: 'Theme and colours' },
  { id: 'look-player', section: 'Look', title: 'Player' },
  { id: 'look-now-playing', section: 'Look', title: 'Now playing' },
  { id: 'listening-playback', section: 'Listening', title: 'Playback' },
  { id: 'listening-sound', section: 'Listening', title: 'Sound' },
  { id: 'listening-search', section: 'Listening', title: 'Search' },
  { id: 'services', section: 'Services', title: 'Services' },
  { id: 'device', section: 'This device', title: 'This device' },
  { id: 'about', section: 'About', title: 'About' },
];

export interface Entry extends SettingEntry { page: string; only?: 'hosted' | 'web' }

const e = (page: string, id: string, title: string, description: string, keywords: string[] = [], only?: Entry['only']): Entry => {
  const where = PAGES.find((p) => p.id === page)!;
  return { id, page, title, description, keywords, only, section: where.title === where.section ? where.section : `${where.section} › ${where.title}` };
};

export const ENTRIES: Entry[] = [
  e('you', 'account', 'Noctorium account', 'Counts your listening, and lets Connect find your devices.', ['sign in', 'log in', 'login', 'stats', 'listening stats', 'profile'], 'web'),
  // Switched here and at the top of Devices; the hosted player has no Connect at all.
  e('you', 'connect', 'Noctorium Connect', 'Whether this computer and your other devices find each other, to move the music between them.', [
    'turn off connect', 'turn on connect', 'disable connect', 'enable connect', 'devices', 'other devices', 'play on another device', 'cast', 'remote', 'multiroom',
  ], 'web'),
  e('you', 'lastfm', 'Last.fm', 'Scrobbles what you play to your Last.fm profile.', ['scrobble', 'scrobbling', 'last fm', 'lastfm'], 'web'),
  e('you', 'listenbrainz', 'ListenBrainz', 'Sends what you play to ListenBrainz, with your user token.', ['scrobble', 'scrobbling', 'listen history', 'token']),

  e('look-theme', 'theme', 'Theme', 'The colours everything is drawn in, and for the Windows ones, the whole skin.', ['dark mode', 'light mode', 'night mode', 'colors', 'colours', 'appearance', 'skin', 'windows 98', 'windows xp', 'catppuccin']),
  e('look-theme', 'taskbar-clock', 'Show the clock', 'The time at the right of the taskbar the 98 and XP themes draw.', ['time', 'clock', 'tray', 'taskbar']),
  e('look-theme', 'accent', 'Accent', 'The colour of the playing song, the buttons that are on, the seek bar.', ['color', 'colour', 'highlight', 'tint', 'artwork colour']),
  e('look-theme', 'animations', 'Animations', 'Pages ease in and covers lift; off makes every change instant.', ['motion', 'reduce motion', 'transitions', 'effects', 'animation']),

  e('look-player', 'player-bar', 'Player bar', 'This page’s Centred bar, or a row of flat buttons with a slider and the time: the Toolbar, or Toolbar 2 with more buttons.', ['toolbar', 'toolbar 2', 'controls', 'transport', 'buttons', 'bottom bar', 'layout']),
  e('look-player', 'stop-button', 'Stop button', 'A Stop among the buttons of the Centred bar and Toolbar 2. The Toolbar always has one.', ['stop', 'square button']),
  e('look-player', 'seek-bar', 'Seek bar', 'How the song’s progress is drawn: Minimal, Bars, Ruler, Slider and the rest.', ['progress bar', 'scrubber', 'timeline', 'slider', 'waveform', 'scrub']),
  e('look-player', 'time-display', 'The figure on the right of the seek bar', 'The song’s whole length, or the time left.', ['remaining', 'countdown', 'time left', 'duration', 'elapsed']),
  e('look-player', 'icons', 'Icons', 'The icon set every button is drawn with: Standard, Rounded, Outlined, Sharp, Filled, Two-tone or Line.', ['icon set', 'icon theme', 'icon style', 'glyphs', 'symbols', 'material']),
  e('look-player', 'service-badges', 'Service badge style', 'Each service’s own mark on the badges that say where a song comes from, or the letters, YTM, SC or SP, as before.', ['logo', 'logos', 'service logos', 'service icons', 'brand icons', 'provider icons', 'badge', 'badges', 'marks', 'letters', 'abbreviations', 'youtube logo', 'spotify logo', 'soundcloud logo', 'simple icons']),

  e('look-now-playing', 'now-playing-layout', 'Now playing layout', 'The record beside the queue, or the Playlist: a cover panel, the queue as a table, an info bar.', ['now playing screen', 'playlist view', 'full screen', 'table view', 'album art', 'layout']),
  e('look-now-playing', 'visualiser', 'Visualiser', 'Bars for the spectrum, or a level meter, from the real sound; or none.', ['visualizer', 'spectrum', 'analyser', 'analyzer', 'level meter', 'vu meter', 'equaliser bars', 'equalizer bars']),
  e('look-now-playing', 'queue-columns', 'Queue columns', 'Which columns the Playlist layout’s table has, and in what order.', ['columns', 'table', 'fields', 'track number', 'duration column']),
  e('look-now-playing', 'status-bar', 'Status bar', 'Under the Playlist layout: the stream’s format, and how far into the queue it is.', ['status', 'format', 'bitrate', 'codec', 'sample rate']),

  e('listening-playback', 'speed', 'Speed', 'Slower or faster, keeping the pitch.', ['tempo', 'faster', 'slower', 'playback rate', 'pitch'], 'web'),
  e('listening-playback', 'autoplay', 'Keep playing when the queue runs out', 'Songs like the last one, as its own service would carry on.', ['autoplay', 'auto play', 'radio', 'endless', 'continue', 'keep playing']),
  e('listening-playback', 'autoplay-from', 'Autoplay draws from', 'The last song’s own service, or YouTube Music’s radio after every song.', ['radio source', 'recommendations', 'autoplay source'], 'web'),
  e('listening-playback', 'avoid-recent', 'Autoplay skips songs played lately', 'So it does not bring back what was just heard.', ['repeats', 'played recently', 'duplicates'], 'web'),
  e('listening-playback', 'home-play', 'Playing a song from Home or a search', 'Autoplay after it, as a radio from it, or the rest of its shelf or results.', ['home', 'search', 'search results', 'shelf', 'start radio', 'tap a song', 'autoplay from home', 'autoplay from search']),
  e('listening-playback', 'keep-queue', 'Keep the queue between launches', 'Noctorium puts it back where it was left when it starts again.', ['remember queue', 'restore', 'resume', 'session'], 'web'),
  e('listening-playback', 'sleep-fade', 'The sleep timer fades out', 'Over its last seconds, rather than stopping at once.', ['sleep timer', 'fade out', 'bedtime', 'fade'], 'web'),
  e('listening-playback', 'lyrics', 'Lyrics from', 'Every source is still asked; this one is shown first when it has them.', ['words', 'karaoke', 'synced lyrics', 'lrclib', 'genius', 'musixmatch']),

  e('listening-sound', 'booster', 'Volume booster', 'Louder than full, from 100% to 1000%, behind a limiter.', ['louder', 'volume boost', 'boost', 'amplify', 'amplifier', 'loudness', 'gain', 'too quiet']),
  e('listening-sound', 'skip-non-music', 'Skip what is not the music in YouTube videos', 'Intros, outros, sponsor reads and talking, as SponsorBlock marks them.', ['sponsorblock', 'sponsor', 'intro', 'outro', 'skip talking'], 'web'),

  e('listening-search', 'hybrid-search', 'A search of every service asks', 'Which services a search of all of them asks.', ['search all', 'every service', 'hybrid', 'search sources'], 'web'),
  e('listening-search', 'bangs', 'Bangs', 'Start or end a search with !ytm, !sc and the rest to search one service.', ['bang', 'search shortcut', 'prefix', '!sc', '!ytm', 'search operator']),

  e('services', 'services-hosted', 'YouTube Music and SoundCloud', 'Both play here without signing in; your own accounts need Noctorium on a computer or phone.', ['sign in', 'log in', 'login', 'account', 'youtube', 'soundcloud'], 'hosted'),
  e('services', 'youtube', 'YouTube Music', 'Signed in with the desktop app’s sign-in, your phone, or cookies.', ['google', 'sign in', 'log in', 'login', 'youtube account', 'cookies', 'channel'], 'web'),
  e('services', 'soundcloud', 'SoundCloud', 'Signed in with the desktop app’s sign-in or cookies, and your profile name.', ['sign in', 'log in', 'login', 'soundcloud account', 'cookies', 'profile'], 'web'),
  e('services', 'spotify', 'Spotify', 'Your Spotify library, likes and search; with Premium, its songs on Spotify.', ['sign in', 'connect spotify', 'premium', 'spotify account'], 'web'),
  e('services', 'spotify-playback', 'Spotify songs play', 'In your Spotify app, or matched on YouTube Music.', ['play on spotify', 'premium', 'spotify connect'], 'web'),
  e('services', 'spotify-device', 'Spotify plays on', 'Which device your Spotify plays on.', ['speaker', 'device', 'spotify connect'], 'web'),
  e('services', 'bandcamp', 'Bandcamp collection', 'What you bought there and your wishlist, in the library.', ['collection', 'fan', 'purchases', 'wishlist', 'bandcamp account'], 'web'),
  e('services', 'bandcamp-genres', 'Bandcamp on Home', 'A row of Bandcamp’s best-sellers for each genre picked.', ['genres', 'best sellers', 'bestsellers'], 'web'),
  e('services', 'vk', 'VK Music', 'Through a signed-in browser’s vk.ru session.', ['vkontakte', 'vk', 'sign in', 'login'], 'web'),
  e('services', 'youtube-history', 'Add what plays here to your YouTube history', 'So YouTube Music’s own recommendations follow it.', ['watch history', 'history', 'recommendations'], 'web'),

  e('device', 'downloads-folder', 'Downloads are saved to', 'A folder on the computer running Noctorium.', ['download location', 'save to', 'folder', 'path', 'offline'], 'web'),
  e('device', 'discord', 'Show what is playing on Discord', 'From the computer running Noctorium, when Discord is open there.', ['rich presence', 'discord status', 'activity'], 'web'),
  e('device', 'library-save', 'Save your library as a file', 'Your likes, playlists, pins and settings, to keep or open in another browser.', ['export', 'backup', 'download library', 'file'], 'hosted'),
  e('device', 'library-open', 'Open a saved library', 'Replaces what is here with what the file holds.', ['import', 'restore', 'upload', 'file'], 'hosted'),
  e('device', 'forget', 'Forget everything', 'Every like, playlist and setting this browser keeps for Noctorium.', ['reset', 'clear data', 'delete everything', 'privacy', 'erase'], 'hosted'),

  e('about', 'about', 'About Noctorium', 'The version, updates and where the source is.', ['version', 'update', 'updates', 'diagnostics', 'licence', 'license', 'source code', 'github']),
];

/** The settings of this build. */
export function entriesFor(hosted: boolean): Entry[] {
  return ENTRIES.filter((entry) => entry.only == null || entry.only === (hosted ? 'hosted' : 'web'));
}

/** The pages of this build that have any of its settings. */
export function pagesFor(hosted: boolean): Page[] {
  const entries = entriesFor(hosted);
  return PAGES.filter((page) => entries.some((entry) => entry.page === page.id));
}
