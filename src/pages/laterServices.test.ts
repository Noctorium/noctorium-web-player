import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { search } from '../base/settingsSearch';
import { SERVICE_MARKS } from '../base/serviceMarks';
import { Badge } from '../components/Badge';
import { entriesFor } from './settingsEntries';
import { canLike, isArtist, likeKey, opensReleases, playlistKind, providerBadge, providerName } from '../util';
import type { Playlist, Provider, Track } from '../types';

/**
 * Apple Music, Deezer and Tidal in the page `noctorium web` serves: their names, marks and letters, their songs' like
 * keys and their albums and artists opened as playlists; their blocks in Settings under the beta warning, as Spotify's,
 * Bandcamp's and VK's now are, and YouTube Music's and SoundCloud's are not; the commands those send, as Noctorium
 * answers them; and none of it in the hosted player, which has none of these accounts. The pages need a browser and
 * Noctorium behind them to be drawn, so they are read from their sources, as the settings' test reads them.
 */
const sources = import.meta.glob(
  ['./Settings.tsx', './Home.tsx', './Search.tsx', './Library.tsx', '../hosted/Settings.tsx', '../hosted/engine.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;
// Read as the lines are, whatever this checkout ends them with.
for (const name of Object.keys(sources)) sources[name] = sources[name].replace(/\r\n/g, '\n');
const settings = sources['./Settings.tsx'];
const services = settings.slice(settings.indexOf('function ServicesSettings('), settings.indexOf('function DeviceSettings('));
const block = (name: string) => settings.slice(settings.indexOf(`function ${name}(`), settings.indexOf('\n}\n', settings.indexOf(`function ${name}(`)) + 3);
const later: Provider[] = ['APPLE_MUSIC', 'DEEZER', 'TIDAL'];

const track = (provider: Provider): Track => ({
  key: `${provider}:1001`, provider, id: '1001', title: 'Awake', artists: [{ id: '2002', name: 'Tycho', provider }], artistLine: 'Tycho', sourceUrl: 'https://example.invalid/track/1001',
});
const playlist = (provider: Provider, id: string): Playlist => ({ key: `${provider}:${id}`, id, title: 'Awake', provider, editable: false });

describe('Apple Music, Deezer and Tidal', () => {
  it('are named, lettered and marked as Base has them', () => {
    expect(later.map((p) => providerName[p])).toEqual(['Apple Music', 'Deezer', 'Tidal']);
    expect(later.map((p) => providerBadge[p])).toEqual(['AM', 'DZ', 'TD']);
    for (const provider of later) {
      const html = renderToStaticMarkup(createElement(Badge, { provider }));
      expect(html, provider).toContain(`d="${SERVICE_MARKS[provider]}"`);
      expect(html, provider).toContain(`class="badge mark ${provider}"`);
    }
  });

  it('keep their songs’ likes under their own keys, and offer no heart that would go nowhere', () => {
    expect(later.map((p) => likeKey(track(p)))).toEqual(['am:1001', 'dz:1001', 'td:1001']);
    const ready = { keys: [], busy: [], soundCloudReady: true, youTubeReady: true, channels: [], spotifyReady: true, vkReady: true };
    for (const provider of later) expect(canLike(ready, track(provider)), provider).toBe(false);
  });

  it('open their albums and artists as playlists, and their playlists as playlists', () => {
    for (const provider of later) {
      expect(opensReleases(provider), provider).toBe(true);
      expect(playlistKind(playlist(provider, 'album:3003')), provider).toBe('Album');
      expect(isArtist(playlist(provider, 'artist:2002')), provider).toBe(true);
      expect(playlistKind(playlist(provider, 'playlist:4004')), provider).toBe('Playlist');
      expect(playlistKind(playlist(provider, 'pl.u-made-up')), provider).toBe('Playlist');
    }
    // Spotify's own playlists are playlists too, not albums, as the search page used to show them.
    expect(playlistKind(playlist('SPOTIFY', '37i9dQZF1DX0XUsuxWHRQd'))).toBe('Playlist');
    const search = sources['./Search.tsx'];
    expect(search).toContain("const release = (p: PlaylistState) => opensReleases(p.provider) && !isArtist(p) && playlistKind(p) !== 'Playlist';");
  });

  it('can be chosen on Home, in search and in the library, in the page Noctorium serves only', () => {
    const [home, search, library] = [sources['./Home.tsx'], sources['./Search.tsx'], sources['./Library.tsx']];
    expect(home).toContain("['apple_music', 'Apple Music'], ['deezer', 'Deezer'], ['tidal', 'Tidal']");
    expect(search).toContain("['APPLE_MUSIC', 'Apple Music'], ['DEEZER', 'Deezer'],\n    ['TIDAL', 'Tidal']");
    expect(library).toContain("['APPLE_MUSIC', 'Apple Music'], ['DEEZER', 'Deezer'], ['TIDAL', 'Tidal']");
    // The hosted player searches YouTube and SoundCloud alone, and says whose the others are.
    const engine = sources['../hosted/engine.ts'];
    expect(engine).toContain("const SEARCHABLE = new Set<Search['mode']>(['HYBRID', 'YOUTUBE_MUSIC', 'SOUNDCLOUD', 'YOUTUBE_VIDEO']);");
    expect(engine).toContain('Bandcamp, Spotify, VK, Apple Music, Deezer and Tidal are searched by Noctorium on your computer or phone');
  });
});

describe('their sign-ins in Settings', () => {
  it('come after VK’s, each with its warning, and the warning is on every service in beta and on no other', () => {
    const at = (text: string) => services.indexOf(text);
    expect(at('<VkSettings')).toBeGreaterThan(0);
    expect(at('<AppleMusicSettings')).toBeGreaterThan(at('<VkSettings'));
    expect(at('<DeezerSettings')).toBeGreaterThan(at('<AppleMusicSettings'));
    expect(at('<TidalSettings')).toBeGreaterThan(at('<DeezerSettings'));
    for (const provider of ['SPOTIFY', 'BANDCAMP', 'VK', 'APPLE_MUSIC', 'DEEZER', 'TIDAL']) {
      expect(services, provider).toContain(`warning={betaWarning('${provider}', settings)}`);
    }
    expect(services).not.toContain("betaWarning('YOUTUBE_MUSIC'");
    expect(services).not.toContain("betaWarning('SOUNDCLOUD'");
    for (const row of ['<Row setting="youtube"', '<Row setting="soundcloud"']) {
      const tag = services.slice(at(row), services.indexOf('>', at(row) + row.length));
      expect(tag, row).not.toContain('warning=');
    }
    // Each block puts the warning on its sign-in's row, under the service's name.
    for (const [name, row] of [['SpotifySettings', 'spotify'], ['BandcampSettings', 'bandcamp'], ['VkSettings', 'vk'], ['AppleMusicSettings', 'apple-music'], ['DeezerSettings', 'deezer'], ['TidalSettings', 'tidal']]) {
      expect(block(name), name).toMatch(new RegExp(`<Row setting="${row}" title="[^"]+" warning=\\{warning\\}`));
    }
    expect(settings).toContain('<strong>{title}</strong>{warning && <BetaWarning text={warning} />}{detail && <small>{detail}</small>}');
  });

  it('send the commands noctorium web answers', () => {
    const apple = block('AppleMusicSettings') + block('AppleMusicSignIn');
    expect(apple).toContain("send('appleMusicSignIn', { text: text.trim() })");
    expect(apple).toContain("send('appleMusicDeveloperToken', { token })");
    expect(apple).toContain("send('appleMusicDeveloperToken', { token: '' })");
    expect(apple).toContain("send('signOut', { service: 'applemusic' })");
    const deezer = block('DeezerSettings');
    expect(deezer).toContain("send('deezerProfile', { profile })");
    expect(deezer).toContain("send('deezerProfile', { profile: '' })");
    const tidal = block('TidalSettings') + block('TidalApp');
    expect(tidal).toContain("send('tidal')");
    expect(tidal).toContain("send('signOut', { service: 'tidal' })");
    expect(tidal).toContain("send('tidalApp', { clientId: id.trim(), secret: secret.trim() })");
    expect(tidal).toContain("send('tidalApp', { clientId: '', secret: '' })");
    // The redirect address is copied here, in the listener's own browser, and the app is registered at Tidal's.
    expect(tidal).toContain('<CopyField value={tidal.redirectUri} label="Tidal redirect address" what="address" />');
    expect(tidal).toContain('href={tidal.developerPortal}');
  });

  it('say where Apple Music’s token is before asking for it, and keep the secrets out of sight as they are typed', () => {
    const signIn = block('AppleMusicSignIn');
    expect(signIn).toContain('{how.map((paragraph, i) => <p key={i}>{paragraph}</p>)}');
    expect(signIn).toContain('autoComplete="off"');
    expect(block('AppleMusicSettings')).toContain('secret submit={(token) => send(\'appleMusicDeveloperToken\', { token })}');
    expect(block('TidalApp')).toContain('type="password" placeholder="Client secret (optional)"');
  });

  it('are found by what people call them, in the page Noctorium serves, and are not in the hosted player', () => {
    const first = (query: string, hosted = false) => search(query, entriesFor(hosted))[0]?.entry.id;
    expect(first('apple music')).toBe('apple-music');
    expect(first('media-user-token')).toBe('apple-music');
    expect(first('developer token')).toBe('apple-music-token');
    expect(first('deezer')).toBe('deezer');
    expect(first('tidal')).toBe('tidal');
    expect(first('client id')).toBe('tidal');
    expect(first('redirect uri')).toBe('tidal-redirect');
    for (const id of ['apple-music', 'apple-music-token', 'deezer', 'tidal', 'tidal-redirect']) {
      expect(entriesFor(true).some((e) => e.id === id), id).toBe(false);
    }
    const hosted = sources['../hosted/Settings.tsx'];
    for (const name of ['appleMusic', 'deezer', 'tidal', 'betaWarning']) expect(hosted, name).not.toContain(name);
  });
});
