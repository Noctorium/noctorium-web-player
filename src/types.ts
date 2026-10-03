/*
 * What the page is told by `noctorium web`, one type per part of the state. These mirror Wire.kt in
 * Noctorium-cli field for field; a change there is a change here.
 */

export type Provider = 'YOUTUBE_MUSIC' | 'YOUTUBE_VIDEO' | 'SOUNDCLOUD' | 'SPOTIFY' | 'LOCAL';

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
  at: number;
}

export interface Queue { tracks: Track[]; currentIndex: number; shuffle: boolean; repeat: 'off' | 'all' | 'one'; origin?: string }

export interface Section { id: string; title: string; subtitle?: string; provider: Provider; tracks: Track[]; playlists: Playlist[] }

export interface Home { sections: Section[]; loading: boolean; recent: Track[]; pinned: Track[]; error?: string; filter: string }

export interface Search {
  query: string;
  mode: 'HYBRID' | 'SOUNDCLOUD' | 'YOUTUBE_MUSIC' | 'YOUTUBE_VIDEO';
  loading: boolean;
  tracks: Track[];
  playlists: Playlist[];
  albums: Album[];
  artists: Artist[];
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

export interface Likes { keys: string[]; busy: string[]; soundCloudReady: boolean; youTubeReady: boolean; channels: Channel[] }

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

export interface Service { status: 'disconnected' | 'connecting' | 'awaiting_approval' | 'connected' | 'error'; username?: string; message?: string }

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
  lastfm: Service;
  listenbrainz: Service;
  scrobbles: number;
  connectEnabled: boolean;
  desktopYouTube: boolean;
  desktopSoundCloud: boolean;
  message?: string;
  version: string;
  /** The hosted player only: carry on with similar songs when the queue runs out. */
  autoplay?: boolean;
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
}

export type Command = { type: string; [field: string]: unknown };
