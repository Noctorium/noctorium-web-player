import { describe, expect, it } from 'vitest';
import { search } from '../base/settingsSearch';
import { ENTRIES, entriesFor } from './settingsEntries';

/**
 * Last.fm and Libre.fm in Settings: Libre.fm beside Last.fm, signed in to the same way; while either's sign-in waits,
 * the page to allow Noctorium on, to open in this browser or copy into another -- the way in when no browser opened
 * on the computer running Noctorium, or one did there and not here. The hosted player has neither, as before. Read
 * from the sources, as the settings' test reads them, since the pages need a browser and Noctorium behind them.
 */
const sources = import.meta.glob(['./Settings.tsx', '../hosted/Settings.tsx', '../hosted/engine.ts', '../types.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const settings = sources['./Settings.tsx'];
const you = settings.slice(settings.indexOf('function YouSettings('), settings.indexOf('// ------------------------------------------------------------------ Look'));

describe('Last.fm and Libre.fm', () => {
  it('has Libre.fm beside Last.fm, before ListenBrainz', () => {
    const lastFm = you.indexOf('<Scrobbler setting="lastfm" title="Last.fm" service={settings.lastfm} />');
    const libreFm = you.indexOf('<Scrobbler setting="librefm" title="Libre.fm" service={settings.librefm} />');
    expect(lastFm).toBeGreaterThan(0);
    expect(libreFm).toBeGreaterThan(lastFm);
    expect(you.indexOf('setting="listenbrainz"')).toBeGreaterThan(libreFm);
  });

  it('sends each one the commands noctorium web answers: connect, finish and sign out by its own name', () => {
    const scrobbler = settings.slice(settings.indexOf('function Scrobbler('), settings.indexOf('function SignInLink('));
    expect(scrobbler).toContain("send('signOut', { service: setting })");
    expect(scrobbler).toContain('send(`${setting}Finish`)');
    expect(scrobbler).toContain('send(setting)');
    expect(scrobbler).toContain("setting: 'lastfm' | 'librefm'");
  });

  it('shows the sign-in link only while that sign-in waits on a page', () => {
    expect(you).toContain('{waiting(settings.lastfm) && <SignInLink setting="lastfm-link" site="Last.fm" url={settings.lastfm.approvalUrl!} />}');
    expect(you).toContain('{waiting(settings.librefm) && <SignInLink setting="librefm-link" site="Libre.fm" url={settings.librefm.approvalUrl!} />}');
    expect(settings).toContain("return service.status === 'awaiting_approval' && !!service.approvalUrl;");
    expect(sources['../types.ts']).toContain('approvalUrl?: string');
    expect(sources['../types.ts']).toContain('librefm: Service;');
  });

  it('copies the link in this browser, with the field to copy from where the clipboard is not there, and opens it as a plain link', () => {
    const link = settings.slice(settings.indexOf('function SignInLink('), settings.indexOf('// ------------------------------------------------------------------ Look'));
    expect(link).toContain('navigator.clipboard.writeText(url)');
    // Served over the house's network as plain http, the page has no clipboard: the field is selected instead.
    expect(link).toContain('if (navigator.clipboard)');
    expect(link).toContain('field.current?.select()');
    expect(link).toContain('<input ref={field} className="field link-field" readOnly value={url}');
    expect(link).toContain('Copy link</button>');
    expect(link).toContain('<a className="button small" href={url} target="_blank" rel="noopener noreferrer">Open');
  });

  it('is not in the hosted player, which says Libre.fm is not connected as it says of Last.fm', () => {
    const hosted = sources['../hosted/Settings.tsx'];
    expect(hosted).not.toContain('lastfm');
    expect(hosted).not.toContain('librefm');
    expect(sources['../hosted/engine.ts']).toContain("lastfm: { status: 'disconnected' }, librefm: { status: 'disconnected' }");
    for (const id of ['lastfm', 'librefm', 'lastfm-link', 'librefm-link']) {
      expect(entriesFor(true).some((e) => e.id === id), id).toBe(false);
      expect(entriesFor(false).some((e) => e.id === id), id).toBe(true);
    }
  });

  it('is found by what people call it', () => {
    const found = (query: string) => search(query, entriesFor(false)).map((m) => m.entry.id);
    expect(found('libre')[0]).toBe('librefm');
    expect(found('libre.fm')[0]).toBe('librefm');
    expect(found('librefm')[0]).toBe('librefm');
    expect(found('libre fm')[0]).toBe('librefm');
    expect(found('copy link').slice(0, 2)).toEqual(['lastfm-link', 'librefm-link']);
    expect(found('browser did not open').slice(0, 2)).toEqual(['lastfm-link', 'librefm-link']);
    expect(found('scrobble')).toContain('librefm');
    expect(found('scrobble')[0]).toBe('lastfm');
  });

  it('lights up the scrobbler while its link is not on the page', () => {
    for (const [link, scrobbler] of [['lastfm-link', 'lastfm'], ['librefm-link', 'librefm']]) {
      const entry = ENTRIES.find((e) => e.id === link)!;
      expect(entry.shownWith).toBe(scrobbler);
      expect(ENTRIES.find((e) => e.id === scrobbler)!.page).toBe(entry.page);
    }
    // Every setting shown with another names one there is.
    for (const entry of ENTRIES.filter((e) => e.shownWith)) expect(ENTRIES.some((e) => e.id === entry.shownWith), entry.id).toBe(true);
    expect(settings).toContain('find(entriesFor(HOSTED).find((entry) => entry.id === wanted)?.shownWith)');
  });
});
