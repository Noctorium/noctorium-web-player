import type {
  Command, Home, Library, Likes, LocalPlaylist, Lyrics, Playback, Playlist, Queue, Search, Section, Service, Settings, State, Track,
} from '../types';
import { audio } from '../audio';
import { go } from '../router';
import { likeKey } from '../util';
import { version } from '../../package.json';
import { ask } from './api';
import { choose, findLyrics } from './lyrics';
import { everything, forget, load, save } from './store';
import { accents, artworkAccent, colours, themes } from './themes';
import { youtube } from './youtube';

/*
 * Noctorium for the hosted player: what `noctorium web` does on a computer, done in the browser instead.
 *
 * The page talks to this exactly as it talks to `noctorium web` -- the same commands in, the same parts of the
 * state out -- so every screen is the same screen. What differs is underneath: there are no accounts here, so
 * likes, playlists, pins and what played lately are kept in this browser; search, playlists and radios come from
 * the hosted player's own small API (api/music.ts); and the audio is played by the browser from the services
 * themselves -- SoundCloud through the audio element, YouTube through YouTube's own embedded player.
 */

export interface Store {
  state: State;
  part<K extends keyof State>(name: K, data: State[K]): void;
  notice(text: string, tone?: 'normal' | 'good' | 'bad'): void;
}

interface Prefs {
  theme: string;
  accent: string;
  progressBarStyle: string;
  timeDisplay: string;
  animations: boolean;
  lyricsProvider?: string;
  autoplay: boolean;
  volume: number;
  muted: boolean;
  listenbrainzToken?: string;
  listenbrainzUser?: string;
}

const DEFAULTS: Prefs = {
  theme: 'NOCTORIUM_NIGHT', accent: 'THEME', progressBarStyle: 'MINIMAL', timeDisplay: 'TOTAL', animations: true,
  autoplay: true, volume: 0.72, muted: false,
};

const LIKED = 'liked';
const isYouTube = (t: Track) => t.provider === 'YOUTUBE_MUSIC' || t.provider === 'YOUTUBE_VIDEO';

class Problem extends Error {}

function shuffled<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function move<T>(items: T[], from: number, to: number): T[] {
  const out = items.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

export class HostedEngine {
  private prefs: Prefs = { ...DEFAULTS, ...load<Partial<Prefs>>('prefs', {}) };
  private likes: Track[] = load('likes', []);
  private playlists: LocalPlaylist[] = load('playlists', []);
  private saved: Playlist[] = load('saved', []);
  private pinned: Track[] = load('pinned', []);
  private recent: Track[] = load('recent', []);
  private queue: Queue = load('queue', { tracks: [], currentIndex: -1, shuffle: false, repeat: 'off' } as Queue);
  private unshuffled?: Track[] = load<Track[] | undefined>('unshuffled', undefined);
  private playback: Playback;
  private generation = 0;
  private search: Search = { query: '', mode: load('searchMode', 'HYBRID'), loading: false, tracks: [], playlists: [], albums: [], artists: [] };
  private searchId = 0;
  private sections: Section[] = [];
  private homeLoading = false;
  private homeError?: string;
  private filter: string = load('homeFilter', 'all');
  private open?: Playlist;
  private openLoading = false;
  private openError?: string;
  private openWanted?: string;
  private lyrics: Lyrics = { loading: false, sources: [] };
  private accentFromArtwork?: string;
  /** Playlists seen on a card or in search, so one opened from there keeps the title the card showed. */
  private known = new Map<string, Playlist>();
  private fetched = new Map<string, { playlist: Playlist; at: number }>();
  private streams = new Map<string, { url: string; hls: boolean; at: number }>();
  private pendingSeek?: number;
  private sleepEndsAt?: number;
  private sleepAtEnd = false;
  private sleepTimer = 0;
  private listenbrainz: Service;
  private scrobbles = 0;
  /** This play's listening, for ListenBrainz: when it began, how much was heard, whether it was sent. */
  private listen = { generation: -1, startedAt: 0, heardMs: 0, lastAt: 0, nowPlaying: false, sent: false };
  private savePosition = 0;

  constructor(private store: Store) {
    const current = this.queue.tracks[this.queue.currentIndex];
    this.playback = {
      status: 'idle', track: current, volume: this.prefs.volume, positionMs: current ? load('position', 0) : 0,
      durationMs: current?.durationMs ?? 0, muted: this.prefs.muted, boost: false, output: 'browser', sleep: { kind: 'off' }, at: Date.now(),
    };
    this.listenbrainz = this.prefs.listenbrainzToken
      ? { status: 'connected', username: this.prefs.listenbrainzUser }
      : { status: 'disconnected' };
  }

  start() {
    this.emitSettings();
    this.emitPlayback();
    this.emitQueue();
    this.emitLibrary();
    this.emitLikes();
    this.emitHome();
    this.store.part('search', this.search);
    this.store.part('lyrics', this.lyrics);
    this.loadHome();
    window.addEventListener('pagehide', () => this.persistPosition());
  }

  // ------------------------------------------------------------ parts

  private emitSettings() {
    const p = this.prefs;
    const settings: Settings = {
      theme: p.theme, themes, colours: colours(p.theme, p.accent, this.accentFromArtwork), accent: p.accent, accents: Object.keys(accents),
      progressBarStyle: p.progressBarStyle, timeDisplay: p.timeDisplay, skipNonMusic: false, youtubeHistory: false,
      lyricsProvider: p.lyricsProvider, discord: false, animations: p.animations,
      youtube: { status: 'disconnected' }, soundcloud: { status: 'disconnected' }, youtubeChannel: '', soundCloudUsername: '',
      spotifyConnected: false, spotifyConnecting: false, spotifyAccount: '', lastfm: { status: 'disconnected' },
      listenbrainz: this.listenbrainz, scrobbles: this.scrobbles, connectEnabled: false, desktopYouTube: false, desktopSoundCloud: false,
      version, autoplay: p.autoplay,
    };
    this.store.part('settings', settings);
  }

  private emitPlayback() {
    this.playback = {
      ...this.playback,
      volume: this.prefs.volume,
      muted: this.prefs.muted,
      sleep: this.sleepAtEnd ? { kind: 'endOfTrack' } : this.sleepEndsAt ? { kind: 'countdown', remainingMs: Math.max(0, this.sleepEndsAt - Date.now()) } : { kind: 'off' },
      at: Date.now(),
    };
    this.store.part('playback', this.playback);
  }

  private emitQueue() {
    this.store.part('queue', this.queue);
    save('queue', this.queue);
    save('unshuffled', this.unshuffled);
  }

  private likedList(): LocalPlaylist {
    return { id: LIKED, title: 'Liked songs', tracks: this.likes, artworkUrl: this.likes[0]?.artworkUrl };
  }

  private emitLibrary() {
    const library: Library = {
      playlists: this.saved, local: [this.likedList(), ...this.playlists], loading: false, loaded: true, needsSoundCloudUsername: false,
      open: this.open, openLoading: this.openLoading, openError: this.openError, enriching: false,
    };
    this.store.part('library', library);
  }

  private emitLikes() {
    const likes: Likes = { keys: this.likes.map(likeKey), busy: [], soundCloudReady: true, youTubeReady: true, channels: [] };
    this.store.part('likes', likes);
  }

  private emitHome() {
    const sections = this.sections.filter((s) =>
      this.filter === 'youtube_music' ? s.provider !== 'SOUNDCLOUD' : this.filter === 'soundcloud' ? s.provider === 'SOUNDCLOUD' : true);
    const home: Home = { sections, loading: this.homeLoading, recent: this.recent, pinned: this.pinned, error: this.homeError, filter: this.filter };
    this.store.part('home', home);
  }

  private setPlayback(change: Partial<Playback>) {
    this.playback = { ...this.playback, ...change };
    this.emitPlayback();
  }

  private savePrefs() {
    save('prefs', this.prefs);
  }

  // ------------------------------------------------------------ commands

  async send(command: Command): Promise<string | undefined> {
    try {
      await this.handle(command);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  private async handle(c: Command): Promise<void> {
    const track = c.track as Track | undefined;
    switch (c.type) {
      case 'toggle': return this.toggle();
      case 'seek': return this.seek(Number(c.positionMs));
      case 'next': return this.next();
      case 'previous': return this.previous();
      case 'shuffle': return this.toggleShuffle();
      case 'repeat': return this.cycleRepeat();
      case 'mute': return this.setVolume(this.prefs.volume, !this.prefs.muted);
      case 'volume': return this.setVolume(Number(c.value), Number(c.value) > 0 ? false : this.prefs.muted);
      case 'like': if (track) this.toggleLike(track); return;
      case 'play': return this.playFrom((c.list as Track[] | undefined) ?? (track ? [track] : []), track, c.origin as string | undefined);
      case 'playPlaylist': return this.playPlaylist(String(c.key), c.startAt as string | undefined, !!c.shuffle);
      case 'playLocal': {
        const list = this.local(String(c.id));
        if (!list?.tracks.length) throw new Problem('Nothing in it yet');
        return this.playFrom(c.shuffle ? shuffled(list.tracks) : list.tracks, list.tracks.find((t) => t.key === c.startAt), `LOCAL:${list.id}`);
      }
      case 'jump': return this.playIndex(Number(c.index));
      case 'openPlaylist': return this.openPlaylist(String(c.key));
      case 'openLocal':
      case 'refreshLibrary': return this.emitLibrary();
      case 'search': return this.runSearch(String(c.query ?? ''));
      case 'searchMode':
        this.search = { ...this.search, mode: c.mode as Search['mode'] };
        save('searchMode', this.search.mode);
        return this.runSearch(this.search.query, true);
      case 'filter':
        this.filter = String(c.filter);
        save('homeFilter', this.filter);
        return this.emitHome();
      case 'refreshHome': return this.loadHome();
      case 'openLink': return this.openLink(String(c.text ?? ''));
      case 'playNext': if (track) this.insert([track], true); return;
      case 'addToQueue': if (track) this.insert([track], false); return;
      case 'radio': if (track) return this.startRadio(track); return;
      case 'addToPlaylist': return this.addToPlaylist(c, track);
      case 'createPlaylist': {
        const title = String(c.title ?? '').trim();
        if (!title) throw new Problem('A playlist needs a name');
        const made: LocalPlaylist = { id: `p${Date.now().toString(36)}`, title, tracks: track ? [track] : [], artworkUrl: track?.artworkUrl };
        this.playlists = [...this.playlists, made];
        this.savePlaylists();
        return;
      }
      case 'removeFromPlaylist': {
        if (!c.localId) throw new Problem('That playlist can only be changed where it lives');
        if (c.localId === LIKED && track) return this.toggleLike(track);
        this.editLocal(String(c.localId), (p) => ({ ...p, tracks: p.tracks.filter((t) => t.key !== track?.key) }));
        return;
      }
      case 'movePlaylistTrack': {
        if (!c.localId) throw new Problem('That playlist can only be changed where it lives');
        const from = Number(c.from), to = Number(c.to);
        if (c.localId === LIKED) {
          this.likes = move(this.likes, from, to);
          save('likes', this.likes);
          return this.emitLibrary();
        }
        this.editLocal(String(c.localId), (p) => ({ ...p, tracks: move(p.tracks, from, to) }));
        return;
      }
      case 'renamePlaylist': {
        const title = String(c.title ?? '').trim();
        if (!c.localId || c.localId === LIKED) throw new Problem('That one keeps its name');
        if (title) this.editLocal(String(c.localId), (p) => ({ ...p, title }));
        return;
      }
      case 'deletePlaylist': {
        if (c.key) return this.unsave(String(c.key));
        if (!c.localId || c.localId === LIKED) throw new Problem('That one cannot be deleted');
        this.playlists = this.playlists.filter((p) => p.id !== c.localId);
        this.savePlaylists();
        return;
      }
      case 'savePlaylist': {
        const playlist = (c.playlist as Playlist | undefined) ?? this.open;
        if (!playlist) return;
        const { tracks: _, ...listing } = playlist;
        this.saved = [listing, ...this.saved.filter((p) => p.key !== listing.key)];
        save('saved', this.saved);
        this.store.notice(`Saved “${listing.title}” to your library`, 'good');
        return this.emitLibrary();
      }
      case 'unsavePlaylist': return this.unsave(String(c.key));
      case 'moveQueue': return this.moveQueue(Number(c.from), Number(c.to));
      case 'removeQueue': return this.removeQueue(Number(c.index));
      case 'clearQueue': return this.clearQueue();
      case 'pin': {
        if (!track) return;
        const pinned = this.pinned.some((t) => t.key === track.key);
        this.pinned = pinned ? this.pinned.filter((t) => t.key !== track.key) : [track, ...this.pinned].slice(0, 30);
        save('pinned', this.pinned);
        this.store.notice(pinned ? 'Taken off Home' : 'Pinned to Home', 'good');
        return this.emitHome();
      }
      case 'lyrics': if (track) return this.loadLyrics(track, !!c.force); return;
      case 'lyricsProvider': {
        this.prefs.lyricsProvider = (c.provider as string | null) ?? undefined;
        this.savePrefs();
        this.emitSettings();
        if (this.lyrics.sources.length) {
          this.lyrics = { ...this.lyrics, selected: choose(this.lyrics.sources, this.prefs.lyricsProvider) };
          this.store.part('lyrics', this.lyrics);
        }
        return;
      }
      case 'sleep': return this.setSleep(c);
      case 'theme':
        if (!themes.some((t) => t.name === c.name)) throw new Problem('No such theme');
        this.prefs.theme = String(c.name);
        this.savePrefs();
        return this.refreshAccent();
      case 'accent':
        if (!(String(c.name) in accents)) throw new Problem('No such accent');
        this.prefs.accent = String(c.name);
        this.savePrefs();
        return this.refreshAccent();
      case 'seekBar': this.prefs.progressBarStyle = String(c.name); this.savePrefs(); return this.emitSettings();
      case 'timeDisplay': this.prefs.timeDisplay = String(c.name); this.savePrefs(); return this.emitSettings();
      case 'animations': this.prefs.animations = !!c.on; this.savePrefs(); return this.emitSettings();
      case 'autoplay': this.prefs.autoplay = !!c.on; this.savePrefs(); return this.emitSettings();
      case 'listenbrainz': return this.connectListenBrainz(String(c.token ?? ''));
      case 'signOut':
        if (c.service !== 'listenbrainz') throw new Problem('There is nothing to sign out of here');
        this.prefs.listenbrainzToken = undefined;
        this.prefs.listenbrainzUser = undefined;
        this.listenbrainz = { status: 'disconnected' };
        this.savePrefs();
        return this.emitSettings();
      case 'importLibrary': return this.importLibrary(c.data);
      case 'forgetEverything':
        forget();
        location.reload();
        return;
      case 'follow':
        throw new Problem('Following an artist needs your YouTube Music account: Noctorium on your computer or phone has it');
      default:
        throw new Problem('That needs Noctorium on your computer — this player keeps everything in the browser');
    }
  }

  // ------------------------------------------------------------ the queue and the player

  private async playFrom(list: Track[], start?: Track, origin?: string) {
    if (!list.length) return;
    let index = Math.max(0, start ? list.findIndex((t) => t.key === start.key) : 0);
    let tracks = list.slice();
    if (this.queue.shuffle) {
      this.unshuffled = list.slice();
      const first = tracks[index];
      tracks = [first, ...shuffled(tracks.filter((_, i) => i !== index))];
      index = 0;
    } else this.unshuffled = undefined;
    this.queue = { ...this.queue, tracks, currentIndex: index, origin };
    return this.playIndex(index);
  }

  private async playIndex(index: number, startMs = 0) {
    const track = this.queue.tracks[index];
    if (!track) return;
    this.queue = { ...this.queue, currentIndex: index };
    this.emitQueue();
    const generation = ++this.generation;
    this.pendingSeek = startMs > 0 ? startMs : undefined;
    this.listen = { generation, startedAt: Math.floor(Date.now() / 1000), heardMs: 0, lastAt: 0, nowPlaying: false, sent: false };
    this.setPlayback({ status: 'resolving', track, error: undefined, positionMs: startMs, durationMs: track.durationMs ?? 0 });
    this.remember(track);
    if (this.prefs.accent === 'ARTWORK') this.refreshAccent();
    const loop = this.queue.repeat === 'one';
    const { volume, muted } = this.prefs;

    if (isYouTube(track)) {
      audio.command({ command: 'stop', generation });
      youtube.command({ command: 'load', generation, videoId: track.id, title: track.title, startMs, volume, muted, loop });
    } else if (track.provider === 'SOUNDCLOUD') {
      youtube.command({ command: 'stop', generation });
      this.recoveries = 0;
      return this.loadSoundCloud(track, generation);
    } else {
      this.failed('This one plays only in Noctorium on your computer or phone');
    }
  }

  private async loadSoundCloud(track: Track, generation: number) {
    let stream;
    try {
      stream = await this.stream(track);
    } catch (error) {
      if (generation === this.generation) this.failed(error instanceof Error ? error.message : 'SoundCloud would not play this');
      return;
    }
    if (generation !== this.generation) return;
    const { volume, muted } = this.prefs;
    audio.command({ command: 'load', generation, url: stream.url, hls: stream.hls, volume, muted, loop: this.queue.repeat === 'one' });
  }

  /**
   * SoundCloud's addresses expire -- a plain MP3's after about ten minutes -- so one that stops working mid-track
   * is asked for again and the track carries on from where it was, rather than the queue skipping it.
   */
  private recoveries = 0;

  private recover(): boolean {
    const track = this.playback.track;
    if (track?.provider !== 'SOUNDCLOUD' || this.recoveries >= 2) return false;
    this.recoveries++;
    this.streams.delete(track.id);
    this.pendingSeek = this.playback.positionMs > 1000 ? this.playback.positionMs : undefined;
    this.loadSoundCloud(track, this.generation);
    return true;
  }

  private async stream(track: Track) {
    const cached = this.streams.get(track.id);
    if (cached && Date.now() - cached.at < 5 * 60_000) return cached;
    const found = await ask<{ url: string; hls: boolean }>('stream', { id: track.id });
    const entry = { ...found, at: Date.now() };
    this.streams.set(track.id, entry);
    return entry;
  }

  /** SoundCloud takes a moment to say where a track is, so the next one is asked as this one starts. */
  private prefetchNext() {
    const next = this.queue.tracks[this.queue.currentIndex + 1];
    if (next?.provider === 'SOUNDCLOUD') this.stream(next).catch(() => undefined);
  }

  private failed(message: string) {
    this.setPlayback({ status: 'error', error: message });
    this.store.notice(message, 'bad');
    // One track that will not play should not stop the whole queue.
    const generation = this.generation;
    if (this.queue.currentIndex < this.queue.tracks.length - 1) {
      window.setTimeout(() => { if (generation === this.generation) this.next(); }, 2500);
    }
  }

  private sink() {
    return this.playback.track && isYouTube(this.playback.track) ? youtube : audio;
  }

  private toggle() {
    const status = this.playback.status;
    if (status === 'playing') {
      this.sink().command({ command: 'pause', generation: this.generation });
      this.setPlayback({ status: 'paused' });
    } else if (status === 'paused') {
      this.sink().command({ command: 'play', generation: this.generation });
    } else if (status === 'resolving') {
      // Still finding it; pressing again is not a reason to start over.
    } else if (this.queue.tracks.length) {
      const index = Math.max(0, this.queue.currentIndex);
      return this.playIndex(index, status === 'idle' && this.playback.track === this.queue.tracks[index] ? this.playback.positionMs : 0);
    }
  }

  private seek(positionMs: number) {
    if (!Number.isFinite(positionMs) || !this.playback.track) return;
    if (this.playback.status === 'idle' || this.playback.status === 'error') {
      this.setPlayback({ positionMs });
      return;
    }
    this.sink().command({ command: 'seek', generation: this.generation, positionMs });
    this.setPlayback({ positionMs });
  }

  private async next() {
    const index = this.queue.currentIndex + 1;
    if (index < this.queue.tracks.length) return this.playIndex(index);
    if (this.queue.repeat === 'all' && this.queue.tracks.length) return this.playIndex(0);
    const last = this.queue.tracks[this.queue.currentIndex];
    if (this.prefs.autoplay && last) {
      // The queue ran out: carry on with what the service would play after the last song.
      try {
        const { tracks } = await ask<{ tracks: Track[] }>('radio', { key: `${last.provider}:${last.id}` });
        const seen = new Set(this.queue.tracks.map((t) => t.key));
        const more = tracks.filter((t) => !seen.has(t.key)).slice(0, 25);
        if (more.length) {
          this.queue = { ...this.queue, tracks: [...this.queue.tracks, ...more] };
          return this.playIndex(index);
        }
      } catch {
        // No radio: the music stops as it would have anyway.
      }
    }
    this.stopAtEnd();
  }

  private stopAtEnd() {
    this.sink().command({ command: 'stop', generation: this.generation });
    this.generation++;
    this.setPlayback({ status: 'idle', positionMs: 0 });
  }

  private previous() {
    const position = this.playback.positionMs;
    if (position > 3000 || this.queue.currentIndex <= 0) return this.seek(0);
    return this.playIndex(this.queue.currentIndex - 1);
  }

  private toggleShuffle() {
    const { tracks, currentIndex } = this.queue;
    const current = tracks[currentIndex];
    if (!this.queue.shuffle) {
      this.unshuffled = tracks.slice();
      const rest = shuffled(tracks.filter((_, i) => i !== currentIndex));
      this.queue = { ...this.queue, shuffle: true, tracks: current ? [current, ...rest] : rest, currentIndex: current ? 0 : -1 };
    } else {
      const before = this.unshuffled ?? tracks;
      const now = new Set(tracks.map((t) => t.key));
      const was = new Set(before.map((t) => t.key));
      const restored = [...before.filter((t) => now.has(t.key)), ...tracks.filter((t) => !was.has(t.key))];
      this.unshuffled = undefined;
      this.queue = { ...this.queue, shuffle: false, tracks: restored, currentIndex: current ? restored.findIndex((t) => t.key === current.key) : -1 };
    }
    this.emitQueue();
    this.prefetchNext();
  }

  private cycleRepeat() {
    const repeat = this.queue.repeat === 'off' ? 'all' : this.queue.repeat === 'all' ? 'one' : 'off';
    this.queue = { ...this.queue, repeat };
    this.emitQueue();
    this.sink().command({ command: 'loop', generation: this.generation, loop: repeat === 'one' });
  }

  private setVolume(volume: number, muted: boolean) {
    this.prefs.volume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : this.prefs.volume));
    this.prefs.muted = muted;
    this.savePrefs();
    for (const sink of [audio, youtube]) {
      sink.command({ command: 'volume', generation: this.generation, volume: this.prefs.volume });
      sink.command({ command: 'mute', generation: this.generation, muted });
    }
    this.emitPlayback();
  }

  private insert(tracks: Track[], next: boolean) {
    const wasEmpty = !this.queue.tracks.length;
    const at = next ? this.queue.currentIndex + 1 : this.queue.tracks.length;
    const list = this.queue.tracks.slice();
    list.splice(at, 0, ...tracks);
    this.queue = { ...this.queue, tracks: list, currentIndex: wasEmpty ? 0 : this.queue.currentIndex };
    if (this.unshuffled) this.unshuffled = [...this.unshuffled, ...tracks];
    this.emitQueue();
    if (wasEmpty) return this.playIndex(0);
    this.store.notice(next ? 'Plays next' : 'Added to the queue', 'good');
    if (next) this.prefetchNext();
  }

  private moveQueue(from: number, to: number) {
    const current = this.queue.tracks[this.queue.currentIndex];
    const tracks = move(this.queue.tracks, from, to);
    let currentIndex = this.queue.currentIndex;
    if (from === currentIndex) currentIndex = to;
    else if (from < currentIndex && to >= currentIndex) currentIndex--;
    else if (from > currentIndex && to <= currentIndex) currentIndex++;
    this.queue = { ...this.queue, tracks, currentIndex: current ? currentIndex : -1 };
    this.emitQueue();
  }

  private removeQueue(index: number) {
    if (index < 0 || index >= this.queue.tracks.length) return;
    const tracks = this.queue.tracks.filter((_, i) => i !== index);
    const current = this.queue.currentIndex;
    this.queue = { ...this.queue, tracks, currentIndex: index < current ? current - 1 : current };
    this.emitQueue();
    if (index === current) {
      if (index < tracks.length && this.playback.status !== 'idle') return this.playIndex(index);
      if (!tracks.length) return this.clearQueue();
    }
  }

  private clearQueue() {
    audio.command({ command: 'stop', generation: this.generation });
    youtube.command({ command: 'stop', generation: this.generation });
    this.generation++;
    this.unshuffled = undefined;
    this.queue = { ...this.queue, tracks: [], currentIndex: -1 };
    this.emitQueue();
    this.setPlayback({ status: 'idle', track: undefined, positionMs: 0, durationMs: 0, error: undefined });
  }

  private async startRadio(track: Track) {
    this.store.notice(`Starting a radio from ${track.title}…`);
    const { tracks } = await ask<{ tracks: Track[] }>('radio', { key: `${track.provider}:${track.id}` });
    const list = [track, ...tracks.filter((t) => t.key !== track.key)];
    this.queue = { ...this.queue, shuffle: false };
    return this.playFrom(list, track, `RADIO:${track.key}`);
  }

  // ------------------------------------------------------------ what the audio does

  report(event: Record<string, any>) {
    if (event.generation !== this.generation) return;
    const positionMs = Number.isFinite(event.positionMs) ? event.positionMs : this.playback.positionMs;
    const durationMs = Number.isFinite(event.durationMs) && event.durationMs > 0 ? event.durationMs : this.playback.durationMs;
    switch (event.event) {
      case 'playing':
        if (this.pendingSeek != null) {
          const at = this.pendingSeek;
          this.pendingSeek = undefined;
          this.sink().command({ command: 'seek', generation: this.generation, positionMs: at });
        }
        this.setPlayback({ status: 'playing', positionMs, durationMs, error: undefined });
        this.heard(positionMs, true);
        this.prefetchNext();
        break;
      case 'paused':
        this.setPlayback({ status: 'paused', positionMs, durationMs });
        this.persistPosition();
        break;
      case 'time':
        this.heard(positionMs, this.playback.status === 'playing');
        this.setPlayback({ positionMs, durationMs });
        if (Date.now() - this.savePosition > 5000) this.persistPosition();
        break;
      case 'looped':
        this.submitListen(true);
        this.listen = { ...this.listen, startedAt: Math.floor(Date.now() / 1000), heardMs: 0, sent: false };
        break;
      case 'ended':
        this.submitListen(false);
        if (this.sleepAtEnd) {
          this.sleepAtEnd = false;
          this.setPlayback({ status: 'paused', positionMs: durationMs });
          this.store.notice('Sleep well');
          return;
        }
        this.next();
        break;
      case 'error':
        if (!this.recover()) this.failed(event.message ?? 'It stopped playing');
        break;
    }
  }

  private persistPosition() {
    this.savePosition = Date.now();
    save('position', Math.round(this.playback.positionMs));
  }

  private remember(track: Track) {
    this.recent = [track, ...this.recent.filter((t) => t.key !== track.key)].slice(0, 24);
    save('recent', this.recent);
    this.emitHome();
  }

  // ------------------------------------------------------------ likes, playlists, the library

  private toggleLike(track: Track) {
    const liked = this.likes.some((t) => t.key === track.key);
    this.likes = liked ? this.likes.filter((t) => t.key !== track.key) : [track, ...this.likes];
    save('likes', this.likes);
    this.emitLikes();
    this.emitLibrary();
  }

  private local(id: string) {
    return id === LIKED ? this.likedList() : this.playlists.find((p) => p.id === id);
  }

  private editLocal(id: string, change: (p: LocalPlaylist) => LocalPlaylist) {
    const found = this.playlists.find((p) => p.id === id);
    if (!found) throw new Problem('That playlist is gone');
    this.playlists = this.playlists.map((p) => (p.id === id ? (() => { const c = change(p); return { ...c, artworkUrl: c.tracks[0]?.artworkUrl }; })() : p));
    this.savePlaylists();
  }

  private savePlaylists() {
    save('playlists', this.playlists);
    this.emitLibrary();
  }

  private addToPlaylist(c: Command, track?: Track) {
    if (!track) return;
    if (!c.localId) throw new Problem('That playlist can only be changed where it lives');
    if (c.localId === LIKED) {
      if (!this.likes.some((t) => t.key === track.key)) this.toggleLike(track);
      return;
    }
    const list = this.playlists.find((p) => p.id === c.localId);
    if (list?.tracks.some((t) => t.key === track.key)) throw new Problem(`It is already in ${list.title}`);
    this.editLocal(String(c.localId), (p) => ({ ...p, tracks: [...p.tracks, track] }));
  }

  private unsave(key: string) {
    this.saved = this.saved.filter((p) => p.key !== key);
    save('saved', this.saved);
    this.store.notice('Taken out of your library');
    this.emitLibrary();
  }

  private learn(playlists: Playlist[]) {
    for (const p of playlists) if (!this.known.has(p.key)) this.known.set(p.key, p);
  }

  private async fetchPlaylist(key: string): Promise<Playlist> {
    const cached = this.fetched.get(key);
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached.playlist;
    const found = await ask<Playlist>('playlist', { key });
    const listed = this.known.get(key) ?? this.saved.find((p) => p.key === key);
    const playlist: Playlist = listed ? {
      ...found,
      title: found.title === 'Playlist' ? listed.title : found.title,
      ownerName: found.ownerName ?? listed.ownerName,
      artworkUrl: listed.artworkUrl ?? found.artworkUrl,
    } : found;
    this.fetched.set(key, { playlist, at: Date.now() });
    return playlist;
  }

  private async openPlaylist(key: string) {
    this.openWanted = key;
    if (this.open?.key === key && this.fetched.has(key)) return this.emitLibrary();
    const listed = this.known.get(key) ?? this.saved.find((p) => p.key === key);
    this.open = listed ? { ...listed, tracks: [] } : undefined;
    this.openLoading = true;
    this.openError = undefined;
    this.emitLibrary();
    try {
      const playlist = await this.fetchPlaylist(key);
      if (this.openWanted === key) this.open = playlist;
    } catch (error) {
      if (this.openWanted === key) this.openError = error instanceof Error ? error.message : 'It would not open';
    } finally {
      if (this.openWanted === key) {
        this.openLoading = false;
        this.emitLibrary();
      }
    }
  }

  private async playPlaylist(key: string, startAt?: string, shuffle = false) {
    const playlist = this.open?.key === key && this.open.tracks?.length ? this.open : await this.fetchPlaylist(key);
    const tracks = playlist.tracks ?? [];
    if (!tracks.length) throw new Problem('Nothing in it can be played');
    if (shuffle && !this.queue.shuffle) this.queue = { ...this.queue, shuffle: true };
    return this.playFrom(tracks, tracks.find((t) => t.key === startAt) ?? (shuffle ? tracks[Math.floor(Math.random() * tracks.length)] : undefined), `PLAYLIST:${key}`);
  }

  // ------------------------------------------------------------ search, home, links

  private async runSearch(query: string, again = false) {
    const q = query.trim();
    if (!q) return;
    if (!again && q === this.search.query && !this.search.loading && this.search.tracks.length) return;
    const id = ++this.searchId;
    const changed = q !== this.search.query;
    this.search = { ...this.search, query: q, loading: true, ...(changed || again ? { tracks: [], playlists: [], albums: [], artists: [] } : {}) };
    this.store.part('search', this.search);
    try {
      const found = await ask<Omit<Search, 'query' | 'mode' | 'loading'>>('search', { q, mode: this.search.mode });
      if (id !== this.searchId) return;
      this.learn(found.playlists);
      this.learn(found.albums.map((a) => ({
        key: a.id, id: a.id.slice(3), title: a.title, provider: a.provider, ownerName: a.artists.map((x) => x.name).join(', '),
        artworkUrl: a.artworkUrl, editable: false,
      })));
      this.search = { ...this.search, ...found, loading: false };
    } catch (error) {
      if (id === this.searchId) this.search = { ...this.search, loading: false };
      throw error;
    } finally {
      if (id === this.searchId) this.store.part('search', this.search);
    }
  }

  private async loadHome() {
    if (this.homeLoading) return;
    this.homeLoading = true;
    this.homeError = undefined;
    this.emitHome();
    try {
      const { sections } = await ask<{ sections: Section[] }>('home');
      this.sections = sections;
      sections.forEach((s) => this.learn(s.playlists));
    } catch (error) {
      this.homeError = error instanceof Error ? error.message : 'Home would not load';
    } finally {
      this.homeLoading = false;
      this.emitHome();
    }
  }

  private async openLink(text: string) {
    const found = await ask<{ track?: Track; playlist?: Playlist }>('link', { url: text });
    if (found.track) return this.playFrom([found.track], found.track, 'LINK');
    if (found.playlist) {
      if (found.playlist.title) this.learn([found.playlist]);
      go(`/playlist/${encodeURIComponent(found.playlist.key)}`);
      return this.openPlaylist(found.playlist.key);
    }
  }

  // ------------------------------------------------------------ lyrics, the look, the sleep timer

  private async loadLyrics(track: Track, force: boolean) {
    if (!force && this.lyrics.trackKey === track.key) return;
    await findLyrics(track, this.prefs.lyricsProvider, (lyrics) => {
      if (this.playback.track && this.playback.track.key !== track.key && lyrics.trackKey !== this.playback.track.key) return;
      this.lyrics = lyrics;
      this.store.part('lyrics', lyrics);
    });
  }

  private refreshAccent() {
    this.emitSettings();
    const url = this.playback.track?.artworkUrl;
    if (this.prefs.accent !== 'ARTWORK' || !url) return;
    const light = themes.find((t) => t.name === this.prefs.theme)?.light ?? false;
    const key = this.playback.track?.key;
    artworkAccent(url, light).then((colour) => {
      if (this.playback.track?.key !== key) return;
      this.accentFromArtwork = colour;
      this.emitSettings();
    });
  }

  private setSleep(c: Command) {
    window.clearInterval(this.sleepTimer);
    const minutes = Number(c.minutes);
    if (c.how === 'off') {
      this.sleepEndsAt = undefined;
      this.sleepAtEnd = false;
    } else if (c.how === 'endOfTrack') {
      this.sleepEndsAt = undefined;
      this.sleepAtEnd = true;
    } else if (Number.isFinite(minutes) && minutes > 0) {
      const from = c.how === 'extend' && this.sleepEndsAt ? this.sleepEndsAt : Date.now();
      this.sleepEndsAt = from + minutes * 60_000;
      this.sleepAtEnd = false;
    }
    if (this.sleepEndsAt) {
      this.sleepTimer = window.setInterval(() => {
        if (!this.sleepEndsAt) return;
        if (Date.now() >= this.sleepEndsAt) {
          window.clearInterval(this.sleepTimer);
          this.sleepEndsAt = undefined;
          if (this.playback.status === 'playing') this.toggle();
          this.store.notice('Sleep well');
        }
        this.emitPlayback();
      }, 1000);
    }
    this.emitPlayback();
  }

  // ------------------------------------------------------------ ListenBrainz

  private async connectListenBrainz(token: string) {
    const clean = token.trim();
    if (!clean) throw new Problem('Paste the token from listenbrainz.org/settings');
    this.listenbrainz = { status: 'connecting' };
    this.emitSettings();
    try {
      const reply = await fetch('https://api.listenbrainz.org/1/validate-token', { headers: { Authorization: `Token ${clean}` } }).then((r) => r.json());
      if (!reply.valid) throw new Problem('ListenBrainz does not know that token');
      this.prefs.listenbrainzToken = clean;
      this.prefs.listenbrainzUser = reply.user_name;
      this.savePrefs();
      this.listenbrainz = { status: 'connected', username: reply.user_name };
    } catch (error) {
      this.listenbrainz = { status: 'error', message: error instanceof Problem ? error.message : 'ListenBrainz could not be reached' };
      throw error instanceof Problem ? error : new Problem('ListenBrainz could not be reached');
    } finally {
      this.emitSettings();
    }
  }

  /** Counts what was actually heard: time moving forward while playing, not a jump from a seek. */
  private heard(positionMs: number, playing: boolean) {
    const l = this.listen;
    if (l.generation !== this.generation) return;
    if (playing && l.lastAt > 0) {
      const step = positionMs - l.lastAt;
      if (step > 0 && step < 2500) l.heardMs += step;
    }
    l.lastAt = positionMs;
    if (playing && !l.nowPlaying) {
      l.nowPlaying = true;
      this.submit('playing_now');
    }
    const duration = this.playback.durationMs;
    // Last.fm's rule, which ListenBrainz follows: half the track, or four minutes, whichever is first.
    if (!l.sent && duration >= 30_000 && l.heardMs >= Math.min(duration / 2, 240_000)) this.submitListen(false);
  }

  private submitListen(force: boolean) {
    const l = this.listen;
    if (l.sent || l.generation !== this.generation) return;
    const duration = this.playback.durationMs;
    if (!force && !(duration >= 30_000 && l.heardMs >= Math.min(duration / 2, 240_000))) return;
    l.sent = true;
    this.submit('single', l.startedAt);
  }

  private submit(kind: 'single' | 'playing_now', listenedAt?: number) {
    const token = this.prefs.listenbrainzToken;
    const t = this.playback.track;
    if (!token || !t) return;
    const listen: Record<string, unknown> = {
      track_metadata: {
        artist_name: t.artists[0]?.name ?? t.artistLine,
        track_name: t.title,
        ...(t.album ? { release_name: t.album.title } : {}),
        additional_info: {
          media_player: 'Noctorium', submission_client: 'Noctorium web player', submission_client_version: version,
          music_service: isYouTube(t) ? 'youtube.com' : 'soundcloud.com', origin_url: t.sourceUrl,
          ...(this.playback.durationMs ? { duration_ms: Math.round(this.playback.durationMs) } : {}),
        },
      },
    };
    if (listenedAt) listen.listened_at = listenedAt;
    fetch('https://api.listenbrainz.org/1/submit-listens', {
      method: 'POST',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listen_type: kind, payload: [listen] }),
    }).then((r) => {
      if (kind === 'single' && r.ok) {
        this.scrobbles++;
        this.emitSettings();
      }
      if (r.status === 401) {
        this.listenbrainz = { status: 'error', message: 'ListenBrainz no longer accepts the token' };
        this.emitSettings();
      }
    }).catch(() => undefined);
  }

  // ------------------------------------------------------------ the library as a file

  exportLibrary(): string {
    return JSON.stringify({ kind: 'noctorium-web-library', version: 1, saved: new Date().toISOString(), data: everything() }, null, 2);
  }

  private importLibrary(data: unknown) {
    const root = data as { kind?: string; data?: Record<string, unknown> };
    if (root?.kind !== 'noctorium-web-library' || !root.data) throw new Problem('That is not a library this player saved');
    const d = root.data;
    const tracks = (v: unknown) => (Array.isArray(v) ? (v as Track[]).filter((t) => t && t.key && t.id && t.provider) : []);
    this.likes = tracks(d.likes);
    this.pinned = tracks(d.pinned);
    this.recent = tracks(d.recent);
    this.playlists = Array.isArray(d.playlists) ? (d.playlists as LocalPlaylist[]).filter((p) => p && p.id && p.title).map((p) => ({ ...p, tracks: tracks(p.tracks) })) : [];
    this.saved = Array.isArray(d.saved) ? (d.saved as Playlist[]).filter((p) => p && p.key && p.title) : [];
    if (d.prefs && typeof d.prefs === 'object') this.prefs = { ...DEFAULTS, ...(d.prefs as Partial<Prefs>) };
    save('likes', this.likes);
    save('pinned', this.pinned);
    save('recent', this.recent);
    save('playlists', this.playlists);
    save('saved', this.saved);
    this.savePrefs();
    this.listenbrainz = this.prefs.listenbrainzToken ? { status: 'connected', username: this.prefs.listenbrainzUser } : { status: 'disconnected' };
    this.emitSettings();
    this.emitLikes();
    this.emitLibrary();
    this.emitHome();
    this.store.notice('Your library is back', 'good');
  }
}
