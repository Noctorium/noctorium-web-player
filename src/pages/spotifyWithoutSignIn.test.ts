import { describe, expect, it } from 'vitest';
import { search } from '../base/settingsSearch';
import { entriesFor } from './settingsEntries';
import { IMPORT_LIMIT_BYTES, followedAbout, importAddress, refused, sizeName } from '../spotifyWithoutSignIn';
import type { SpotifyPublicPlaylist } from '../types';

/**
 * Spotify with nobody signed in, in the page `noctorium web` serves: the public playlists followed by their links
 * under Base's warning of what that can and cannot do, and Spotify's data download chosen here and sent to be
 * imported; Keep in library over a pasted link; the search finding both; and none of it in the hosted player, which
 * has no Noctorium to follow or import anything. The pages need a browser and Noctorium behind them to be drawn, so
 * they are read from their sources, as the settings' test reads them. Every name here is made up.
 */
const sources = import.meta.glob(['./Settings.tsx', '../App.tsx', '../hosted/Settings.tsx', '../hosted/engine.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
// Read as the lines are, whatever this checkout ends them with.
for (const name of Object.keys(sources)) sources[name] = sources[name].replace(/\r\n/g, '\n');
const settings = sources['./Settings.tsx'];
const app = sources['../App.tsx'];
const blockOf = (text: string, name: string) => text.slice(text.indexOf(`function ${name}(`), text.indexOf('\n}\n', text.indexOf(`function ${name}(`)) + 3);
const block = (name: string) => blockOf(settings, name);

const followed = (more: Partial<SpotifyPublicPlaylist> = {}): SpotifyPublicPlaylist => ({
  id: '0MadeUpNightBus0000001', title: '', owner: '', mayBeLonger: false, url: 'https://open.spotify.com/playlist/0MadeUpNightBus0000001', ...more,
});

describe('public Spotify playlists, without signing in', () => {
  it('come under the sign-ins, which are as they were, from a Noctorium that has them', () => {
    const sign = block('SpotifySettings');
    expect(sign.indexOf('<SpotifyPublicPlaylists')).toBeGreaterThan(sign.indexOf('setting="spotify-device"'));
    expect(sign.indexOf('<SpotifyDataImport')).toBeGreaterThan(sign.indexOf('<SpotifyPublicPlaylists'));
    expect(sign).toContain('{spotify.publicLimits && <SpotifyPublicPlaylists spotify={spotify} limits={spotify.publicLimits} library={library?.playlists} />}');
    expect(sign).toContain('{spotify.dataExportHow && <SpotifyDataImport spotify={spotify} how={spotify.dataExportHow} />}');
    // The sign-ins still send what they sent, under the beta warning.
    expect(sign).toContain("send('spotify')");
    expect(sign).toContain("send('spotifyPremium')");
    expect(sign).toMatch(/<Row setting="spotify" title="Spotify" warning=\{warning\}/);
  });

  it('warn of what they can and cannot do, marked as a warning apart from the beta warning, over the box for a link', () => {
    const code = block('SpotifyPublicPlaylists');
    expect(code).toContain('<Row setting="spotify-public" title="Public playlists, without signing in" wide');
    expect(code.indexOf('<LimitsWarning text={limits} />')).toBeGreaterThan(0);
    expect(code.indexOf('<form className="link-row"')).toBeGreaterThan(code.indexOf('<LimitsWarning text={limits} />'));
    expect(block('LimitsWarning')).toContain('<div className="limits-warning" role="note"><span aria-hidden><TriangleAlert size={16} /></span><span>{text}</span></div>');
    expect(code).toContain('placeholder="https://open.spotify.com/playlist/…"');
  });

  it('list each one followed as last read, with why a read failed in the error colour, and say while one is read', () => {
    const code = block('SpotifyPublicPlaylists');
    expect(code).toContain("<li key={p.id} className={cls('followed-item', p.lastError && 'failed')}>");
    expect(code).toContain('<strong>{p.title || p.id}</strong>');
    expect(code).toContain('{p.lastError && <small className="error-text">{p.lastError}</small>}');
    expect(code).toContain('{spotify.publicMessage && <p className="setting-said" role="status">{spotify.publicMessage}</p>}');
    expect(code).toContain("{adding ? <><span className=\"spinner small\" aria-hidden /> Reading its page…</> : <><Plus size={14} /> Add</>}");
    // Opened from here only once the library lists it.
    expect(code).toContain("const listed = library?.find((l) => l.provider === 'SPOTIFY' && l.id === p.id);");
    expect(code).toContain('{listed && <button');

    expect(followedAbout(followed({ owner: 'Sample Listener', songCount: 12 }))).toBe('Sample Listener · 12 songs');
    expect(followedAbout(followed({ owner: 'Paper Satellites', songCount: 100, mayBeLonger: true }))).toBe('Paper Satellites · 100 songs · first 100 songs');
    expect(followedAbout(followed({ songCount: 1 }))).toBe('1 song');
    expect(followedAbout(followed())).toBe('Not read yet');
    expect(followedAbout(followed({ lastError: 'This playlist is private or does not exist.' }))).toBe('');
  });

  it('send the commands noctorium web answers', () => {
    const code = block('SpotifyPublicPlaylists');
    expect(code).toContain("send('spotifyPublicAdd', { link: given })");
    expect(code).toContain("send('spotifyPublicRemove', { id: p.id })");
    expect(code).toContain("send('openPlaylist', { key: listed.key })");
    expect(code).toContain('detail="Nothing changes on Spotify; it is forgotten here."');
  });
});

describe('the import of Spotify’s data download', () => {
  it('says how to get the file, asks for a .zip or a .json, and says what the import leaves out', () => {
    const code = block('SpotifyDataImport');
    expect(code).toContain('<Row setting="spotify-import" title="Import from Spotify’s data download" wide detail={how}>');
    expect(code).toContain('<input ref={picker} type="file" accept=".zip,.json" hidden');
    expect(code).toContain('Choose file…');
    expect(code).toContain('{spotify.dataExportLimits && <LimitsNote text={spotify.dataExportLimits} />}');
  });

  it('says how far it has got while it runs, and what it made, or why not, after', () => {
    const code = block('SpotifyDataImport');
    expect(code).toContain("state?.importing ? state.progress ?? 'Importing…'");
    expect(code).toContain('<button className="button small primary" disabled={busy}');
    expect(code).toContain("{result && <p className={cls('setting-said', result.failed ? 'bad' : 'good')} role=\"status\">{result.text}</p>}");
    expect(code).toContain('sendSpotifyData(file, (part) => setSending({ name: file.name, part }), spotify.importLimitBytes)');
  });

  it('sends the file chosen as it is, and turns away in Noctorium’s own words what Noctorium would', () => {
    expect(IMPORT_LIMIT_BYTES).toBe(50 * 1024 * 1024);
    expect(importAddress('my spotify data (1).zip')).toBe('/api/spotify/import?name=my%20spotify%20data%20(1).zip');
    expect(sizeName(4096)).toBe('4 KB');
    expect(sizeName(1024)).toBe('1 KB');
    expect(sizeName(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(sizeName(80 * 1024 * 1024)).toBe('80 MB');
    // The same sentence WebCommands.kt says of a file it will not take.
    expect(refused({ name: 'everything.zip', size: 4096 }, 1024)).toBe(
      "everything.zip is 4 KB, and the import takes 1 KB at most. Spotify's data download is a few megabytes: choose my_spotify_data.zip, the file Spotify emailed you a link to.",
    );
    expect(refused({ name: 'my_spotify_data.zip', size: 0 })).toBe('my_spotify_data.zip is empty. Choose my_spotify_data.zip, the file Spotify emailed you a link to.');
    expect(refused({ name: 'my_spotify_data.zip', size: 3 * 1024 * 1024 })).toBeUndefined();
    expect(refused({ name: 'my_spotify_data.zip', size: IMPORT_LIMIT_BYTES })).toBeUndefined();
  });
});

describe('a pasted link that is a public Spotify playlist', () => {
  it('can be kept in the library from over the page, in the page Noctorium serves only', () => {
    const keep = blockOf(app, 'KeepLink');
    expect(keep).toContain("if (!link?.canKeepInLibrary || link.status !== 'done' || !link.url || putAway === link.url) return null;");
    expect(keep).toContain("send('spotifyPublicAdd', { link: url })");
    expect(keep).toContain('Keep in library');
    expect(app).toContain('<TopBar />\n        {!HOSTED && <KeepLink />}');
  });
});

describe('the settings search', () => {
  it('finds both by what their listeners would look for, and the hosted player has neither', () => {
    const first = (query: string, hosted = false) => search(query, entriesFor(hosted))[0]?.entry.id;
    expect(first('spotify public playlist')).toBe('spotify-public');
    expect(first('public playlist')).toBe('spotify-public');
    expect(first('without premium')).toBe('spotify-public');
    expect(first('import spotify')).toBe('spotify-import');
    expect(first('spotify data')).toBe('spotify-import');
    expect(first('liked songs')).toBe('spotify-import');
    expect(first('my_spotify_data')).toBe('spotify-import');
    expect(first('download your data')).toBe('spotify-import');
    expect(first('spotify')).toBe('spotify');
    for (const id of ['spotify-public', 'spotify-import']) expect(entriesFor(true).some((e) => e.id === id), id).toBe(false);
    expect(first('my_spotify_data', true)).toBeUndefined();
    const hosted = sources['../hosted/Settings.tsx'] + sources['../hosted/engine.ts'];
    for (const word of ['spotifyPublicAdd', 'spotify/import', 'canKeepInLibrary']) expect(hosted, word).not.toContain(word);
  });
});
