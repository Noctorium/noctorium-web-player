/*
 * What the page is told by `noctorium web`, one type per part of the state. These mirror Wire.kt in
 * Noctorium-cli field for field; a change there is a change here.
 */

export type Provider =
  | 'YOUTUBE_MUSIC' | 'YOUTUBE_VIDEO' | 'SOUNDCLOUD' | 'SPOTIFY' | 'BANDCAMP' | 'VK' | 'APPLE_MUSIC' | 'DEEZER' | 'TIDAL' | 'LOCAL';

export interface Artist { id: string; name: string; provider: Provider }

export interface Album { id: string; title: string; artists: Artist[]; provider: Provider; artworkUrl?: string }

export interface Track {
  key: string;
  provider: Provider;
  id: string;
  title: string;
  artists: Artist[];
  artistLine: string;
  album?: Album;
  durationMs?: number;
  artworkUrl?: string;
  sourceUrl: string;
}

export interface Playlist {
  key: string;
  id: string;
  title: string;
  provider: Provider;
  ownerName?: string;
  artworkUrl?: string;
  trackCount?: number;
  isPublic?: boolean;
  editable: boolean;
  sourceUrl?: string;
  tracks?: Track[];
}

export interface LocalPlaylist { id: string; title: string; tracks: Track[]; artworkUrl?: string }

export interface Sleep { kind: 'off' | 'countdown' | 'endOfTrack'; remainingMs?: number }

export interface Playback {
  status: 'idle' | 'resolving' | 'playing' | 'paused' | 'error';
  track?: Track;
  error?: string;
  volume: number;
  positionMs: number;
  durationMs: number;
  muted: boolean;
  boost: boolean;
  output: 'computer' | 'browser';
  sleep: Sleep;
  /** A Spotify song the account's own Spotify app is playing, rather than the computer or this tab. */
  onSpotify?: boolean;
  at: number;
  /**
   * The booster's level as chosen, 100 to 1000 (`boost` is whether it is on where the music is now), and whether
   * it can reach the sound there at all: not Spotify playing in its own app, nor YouTube in the hosted player's
   * embedded one. These, down to analysisKind, come from a Noctorium from the Audacious release on.
   */
  volumeBoostPercent?: number;
  volumeBoostAvailable?: boolean;
  /** Base's StreamFormat.describe(): "Opus, stereo, 48 kHz, 128 kbit/s"; absent when nothing is known. */
  format?: string;
  /** The music stops when this song ends, and the queue waits on the next. */
  stopAfterCurrent?: boolean;
  /** What the computer's player can measure for a visualiser now; NONE while this tab is the speaker. */
  analysisKind?: 'NONE' | 'LEVELS' | 'SPECTRUM';
}

/**
 * What autoplay is doing after the queue, as Noctorium on a computer says it, and its terminal's Queue page with
 * it: off; the queue repeats; songs lined up; Spotify carrying on by itself; looking; none came back; not yet.
 */
export type AutoplayState = 'off' | 'repeating' | 'ready' | 'spotify' | 'waiting' | 'nothing' | 'later';

export interface Queue {
  tracks: Track[];
  currentIndex: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  origin?: string;
  /**
   * Autoplay's songs, lined up after the queue but not in it until they play or are kept, and where they come
   * from. These, down to autoplay, come from Noctorium on a computer; the hosted player's radio sends none.
   */
  suggestions?: Track[];
  suggestionsFrom?: string;
  /** Spotify, playing on Spotify itself, chooses what comes next; next asks it to move on. */
  continuesElsewhere?: boolean;
  /** Whether next would go anywhere. */
  hasNext?: boolean;
  autoplay?: AutoplayState;
  /** The whole queue's length, of the songs whose length is known, and the songs' before the one playing. */
  durationMs?: number;
  elapsedBeforeMs?: number;
}

export interface Section { id: string; title: string; subtitle?: string; provider: Provider; tracks: Track[]; playlists: Playlist[] }

export interface Home { sections: Section[]; loading: boolean; recent: Track[]; pinned: Track[]; error?: string; filter: string }

export interface Search {
  query: string;
  mode: 'HYBRID' | 'SOUNDCLOUD' | 'YOUTUBE_MUSIC' | 'YOUTUBE_VIDEO' | 'BANDCAMP' | 'SPOTIFY' | 'VK' | 'DEEZER' | 'TIDAL' | 'APPLE_MUSIC';
  loading: boolean;
  tracks: Track[];
  playlists: Playlist[];
  albums: Album[];
  artists: Artist[];
  /**
   * The bang in force, as typed ("!sc"), and the search it chose -- or the page's own mode without one. The
   * query keeps what was typed, bang and all.
   */
  searchBang?: string;
  activeSearchMode?: Search['mode'];
}

export interface Library {
  playlists: Playlist[];
  local: LocalPlaylist[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  needsSoundCloudUsername: boolean;
  open?: Playlist;
  openLocal?: LocalPlaylist;
  openLoading: boolean;
  openError?: string;
  enriching: boolean;
}

export interface Channel { pageId: string; name: string; authUser: number; photoUrl?: string; handle?: string; selected: boolean }

export interface Likes {
  keys: string[];
  busy: string[];
  soundCloudReady: boolean;
  youTubeReady: boolean;
  channels: Channel[];
  /** Hearts on Spotify songs go to its Liked Songs, and on VK's to My music. Not in the hosted player. */
  spotifyReady?: boolean;
  vkReady?: boolean;
}

export interface LyricLine { text: string; startMs?: number }

export interface LyricsSource {
  provider: string;
  name: string;
  status: 'searching' | 'found' | 'link_only' | 'not_found' | 'needs_key' | 'error';
  synced: boolean;
  lines: LyricLine[];
  sourceUrl?: string;
  attribution?: string;
  message?: string;
  detail?: string;
}

export interface Lyrics { trackKey?: string; loading: boolean; sources: LyricsSource[]; selected?: string; error?: string }

export interface Account { status: 'disconnected' | 'checking' | 'connected' | 'warning' | 'error'; detail?: string; hint?: string }

/**
 * A scrobbler: Last.fm, Libre.fm or ListenBrainz. While Last.fm or Libre.fm waits for Noctorium to be allowed,
 * [approvalUrl] is the page to allow it on, to open or copy in this browser.
 */
export interface Service { status: 'disconnected' | 'connecting' | 'awaiting_approval' | 'connected' | 'error'; username?: string; message?: string; approvalUrl?: string }

/** One of Bandcamp's genres, which Home can have a row of best-sellers for. */
export interface Genre { name: string; title: string }

/** One of a setting's choices, with what it means. */
export interface Choice { name: string; title: string; description?: string }

/** Bandcamp: a name rather than a sign-in, whose collection the library shows, and the genres Home has rows for. */
export interface Bandcamp {
  /** The name in bandcamp.com/<name>; blank for none. */
  username: string;
  /** What the fan calls themselves, once Bandcamp has confirmed the name since Noctorium started. */
  fanName: string;
  checking: boolean;
  message?: string;
  /** The genres Home has a row for, by name, in their order. */
  genres: string[];
  allGenres: Genre[];
  /** The name Noctorium on the computer shows, to be offered here too. */
  desktop?: string;
}

export interface SpotifyDevice { id: string; name: string; type: string; active: boolean; restricted: boolean; volume?: number }

/** Spotify's two sign-ins, and where its songs play once the Premium one is made. */
export interface Spotify {
  connected: boolean;
  connecting: boolean;
  account: string;
  message?: string;
  /** The Premium sign-in: Spotify songs can play in the account's own Spotify app. */
  canPlay: boolean;
  playsOnSpotify: boolean;
  /** Where the account's Spotify is open, as last asked; empty until asked. */
  devices: SpotifyDevice[];
  /** The device chosen, by Spotify's id; blank for whichever Spotify has active. */
  device: string;
  /**
   * Spotify with nobody signed in, from a Noctorium that has it: the public playlists the library follows, in the
   * order they were added, each as last read; addingPublicPlaylist while one is read before it is added; and
   * publicMessage, what the last addition or removal said, apart from [message], which is the sign-in's.
   */
  publicPlaylists?: SpotifyPublicPlaylist[];
  addingPublicPlaylist?: boolean;
  publicMessage?: string;
  /** The import of Spotify's data download, while it runs and once it has. */
  dataImport?: SpotifyImport;
  /**
   * Base's own words, shown as they are, as every player shows them: what following public playlists can and cannot
   * do, over the box for a link; how to get Spotify's data download; and what its import leaves out.
   */
  publicLimits?: string;
  dataExportHow?: string;
  dataExportLimits?: string;
  /** The largest file the import's upload takes, in bytes. */
  importLimitBytes?: number;
}

/**
 * One public Spotify playlist followed without a sign-in: [title] is blank until it has been read once, and
 * [lastError] says why the last read did not work, the copy before it still the one in the library. [mayBeLonger]
 * is a page that showed its most, the first hundred songs.
 */
export interface SpotifyPublicPlaylist {
  id: string;
  title: string;
  owner: string;
  songCount?: number;
  mayBeLonger: boolean;
  lastError?: string;
  artworkUrl?: string;
  /** Its address on Spotify. */
  url: string;
}

/** What the last import of Spotify's data download made. */
export interface SpotifyImportSummary { playlists: number; songs: number; likedSongs: number; replaced: number; emptyPlaylists: number; savedAlbums: number; message: string }

/** The import of Spotify's data download: under way and how far, or what came of the last one -- [failed] when it did not happen. */
export interface SpotifyImport { importing: boolean; progress?: string; message?: string; failed: boolean; summary?: SpotifyImportSummary }

/**
 * The link pasted last, and what came of it: canKeepInLibrary while it is a public Spotify playlist, read from its
 * public page, that the library does not follow yet -- Keep in library is spotifyPublicAdd with its url.
 */
export interface Link {
  status: 'idle' | 'opening' | 'done' | 'failed';
  url?: string;
  provider?: Provider;
  kind?: 'track' | 'playlist' | 'short';
  message?: string;
  trackCount: number;
  canKeepInLibrary: boolean;
}

/** VK, signed in with a browser's session, and what to read before signing in. */
export interface Vk {
  connected: boolean;
  account: string;
  checking: boolean;
  message?: string;
  notice: string[];
}

/**
 * Apple Music, signed in with the token Apple's web player keeps in its media-user-token cookie, pasted here: a page
 * cannot read another site's cookies, nor show Apple's sign-in to Noctorium.
 */
export interface AppleMusic {
  connected: boolean;
  checking: boolean;
  /** The storefront the catalogue is read in, "us" or "gb": the account's once signed in, the computer's before. */
  storefront: string;
  /** A MusicKit developer token of the listener's own is in use, rather than the one Apple's web player is served. */
  ownDeveloperToken: boolean;
  message?: string;
  /** Where the cookie is, and what signing in adds. */
  how: string[];
}

/** Deezer: a public profile rather than a sign-in, whose playlists, loved tracks and albums the library shows. */
export interface Deezer {
  /** The profile's number, deezer.com/profile/<number>; blank for none. */
  profileId: string;
  found: boolean;
  /** The profile's own name, as Deezer gave it. */
  name: string;
  checking: boolean;
  message?: string;
}

/**
 * Tidal: its own sign-in page, through a Tidal app of the listener's own until Noctorium has one, which answers to
 * [redirectUri] on the computer running Noctorium -- so the browser that signs in has to be on that computer.
 */
export interface Tidal {
  /** A Tidal app is in force, so signing in is possible. */
  configured: boolean;
  /** It is the listener's own, from developer.tidal.com. */
  ownApp: boolean;
  /** Tidal's catalogue can be read: somebody is signed in, or the app's secret is known. */
  readsCatalogue: boolean;
  connected: boolean;
  connecting: boolean;
  account: string;
  /** The address to register among the app's redirect URIs, exactly as written. */
  redirectUri: string;
  /** Where a Tidal app is registered. */
  developerPortal: string;
  message?: string;
}

export interface Theme {
  name: string;
  title: string;
  family: string;
  background: string;
  panel: string;
  card: string;
  text: string;
  subtext: string;
  accent: string;
  light: boolean;
  /** How it is drawn beyond its colours, by Base's ThemeSkin: STANDARD, WINDOWS_98 or WINDOWS_XP. */
  skin?: string;
  /** With the 98 skin, the scheme it is drawn in: 98's own grey, or Noctorium 98's night. */
  windows98?: Windows98;
}

/**
 * Base's Windows98Palette: every colour the 98 skin draws its bevels, title bars, lists and desktop in, as 98 drew
 * them from the scheme chosen in its Display Properties.
 */
export interface Windows98 {
  face: string;
  highlight: string;
  light: string;
  shadow: string;
  darkShadow: string;
  window: string;
  text: string;
  greyText: string;
  selection: string;
  selectionText: string;
  title: string;
  titleEnd: string;
  inactiveTitle: string;
  inactiveTitleEnd: string;
  titleText: string;
  tooltip: string;
  desktop: string;
  /** A dark face, on which whatever 98 took to be pale has to be turned round. */
  dark: boolean;
}

export interface Settings {
  theme: string;
  themes: Theme[];
  colours: Theme;
  accent: string;
  accents: string[];
  progressBarStyle: string;
  timeDisplay: string;
  skipNonMusic: boolean;
  youtubeHistory: boolean;
  lyricsProvider?: string;
  discord: boolean;
  animations: boolean;
  exportFolder?: string;
  youtube: Account;
  soundcloud: Account;
  youtubeChannel: string;
  soundCloudUsername: string;
  spotifyConnected: boolean;
  spotifyConnecting: boolean;
  spotifyAccount: string;
  /** These, down to sleepFade, come from Noctorium on a computer; the hosted player has none of them. */
  spotify?: Spotify;
  bandcamp?: Bandcamp;
  vk?: Vk;
  /** Apple Music, Deezer and Tidal, from a Noctorium that has them. */
  appleMusic?: AppleMusic;
  deezer?: Deezer;
  tidal?: Tidal;
  /**
   * What goes above the sign-in or setup of each service in beta, by provider: Base's one warning, for Spotify,
   * Bandcamp, VK, Apple Music, Deezer and Tidal, and none for YouTube Music, YouTube or SoundCloud. A Noctorium from
   * before the warning sends none, and Base's own, in base/serviceStanding.ts, stands in.
   */
  betaWarnings?: Partial<Record<Provider, string>>;
  /** How fast it plays, 1 being as recorded, from 0.5 to 2. */
  playbackSpeed?: number;
  /** The services a Hybrid search asks, by name, and every one it could. */
  hybridSearch?: string[];
  hybridServices?: string[];
  /** Seconds a sleep timer fades out over; zero for none. */
  sleepFade?: number;
  lastfm: Service;
  /** Libre.fm, signed in to as Last.fm is. The hosted player has neither, and says it is not connected. */
  librefm: Service;
  listenbrainz: Service;
  scrobbles: number;
  connectEnabled: boolean;
  desktopYouTube: boolean;
  desktopSoundCloud: boolean;
  message?: string;
  version: string;
  /** Carry on with similar songs when the queue runs out. */
  autoplay?: boolean;
  /**
   * Where autoplay's songs come from, by name, and the choices; whether it leaves out what played lately; and
   * whether the queue is kept between launches. Noctorium on a computer only.
   */
  autoplayFrom?: string;
  autoplaySources?: Choice[];
  avoidRecent?: boolean;
  keepQueue?: boolean;
  /**
   * Whether the taskbar the 98 and XP themes draw shows the clock in its tray. A Noctorium on the computer from
   * before the switch does not send it, and its clock shows.
   */
  taskbarClock?: boolean;
  /** Every seek bar, in core's order, with what it is; Slider among them from the Audacious release on. */
  progressBarStyles?: Choice[];
  /**
   * The desktop-music-player look's choices, which every player shares: the visualiser, the queue table's
   * columns, the status bar, the icon set, and what a song picked on Home plays after it -- each with its choices.
   */
  visualiser?: string;
  visualiserStyles?: Choice[];
  queueColumns?: string[];
  allQueueColumns?: Choice[];
  statusBar?: boolean;
  iconSet?: string;
  iconSets?: Choice[];
  homePlay?: string;
  homePlays?: Choice[];
  /**
   * How the badge that says where a song comes from is drawn, by ServiceBadgeStyle's name -- MARKS, each service's
   * own, or LETTERS, as the badges were -- and the choices. A Noctorium from before the marks sends neither.
   */
  serviceBadgeStyle?: string;
  serviceBadgeStyles?: Choice[];
}

export interface Download { track: Track; bytes: number; at: number }
export interface Job { track: Track; stage: 'queued' | 'downloading' | 'failed'; progress: number; detail?: string }
export interface Downloads { entries: Download[]; active: Job[]; message?: string; canSaveAsMp3: boolean }

export interface Peer { id: string; name: string; kind: string }
export interface Connect { available: boolean; enabled: boolean; thisDevice: string; devices: Peer[]; target?: Peer; controlledBy?: string; busy: boolean }

export interface SignIn { state: 'idle' | 'waiting' | 'checking' | 'done' | 'failed'; code?: string; message?: string }

export interface NoctoriumAccount { signedIn: boolean; name?: string; email?: string; streams: number; hours: number; message?: string }

export interface State {
  settings?: Settings;
  playback?: Playback;
  queue?: Queue;
  home?: Home;
  search?: Search;
  library?: Library;
  likes?: Likes;
  lyrics?: Lyrics;
  downloads?: Downloads;
  connect?: Connect;
  signIn?: SignIn;
  account?: NoctoriumAccount;
  /** From a Noctorium that tells of pasted links; the hosted player sends none. */
  link?: Link;
}

export type Command = { type: string; [field: string]: unknown };
