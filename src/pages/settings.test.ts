import { describe, expect, it } from 'vitest';
import { ENTRIES, PAGES, SECTIONS, entriesFor, pagesFor } from './settingsEntries';
import { search } from '../base/settingsSearch';

/**
 * Every setting on Settings' pages has an entry for the search, and every entry is a setting there: a setting the
 * search cannot find, or a match that jumps to nothing, is what this keeps out. The settings are read from the
 * pages' source, where each is marked `setting="…"`.
 */
const sources = import.meta.glob(['./Settings.tsx', '../hosted/Settings.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const marked = new Set(Object.values(sources).flatMap((text) => [...text.matchAll(/setting="([\w-]+)"/g)].map((m) => m[1])));

describe('the settings and their search', () => {
  it('has an entry for every setting on the pages', () => {
    const known = new Set(ENTRIES.map((e) => e.id));
    expect([...marked].filter((id) => !known.has(id)), 'settings with no entry').toEqual([]);
  });

  it('has a setting on the pages for every entry', () => {
    expect(ENTRIES.map((e) => e.id).filter((id) => !marked.has(id)), 'entries with no setting').toEqual([]);
  });

  it('names each setting once, on a page of a section that exists', () => {
    const ids = ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of ENTRIES) {
      const page = PAGES.find((p) => p.id === entry.page);
      expect(page, entry.id).toBeTruthy();
      expect(SECTIONS).toContain(page!.section);
    }
  });

  it('gives each build its own settings, and every page of either something on it', () => {
    expect(entriesFor(true).some((e) => e.only === 'web')).toBe(false);
    expect(entriesFor(false).some((e) => e.only === 'hosted')).toBe(false);
    for (const hosted of [true, false]) {
      for (const page of pagesFor(hosted)) expect(entriesFor(hosted).some((e) => e.page === page.id), page.id).toBe(true);
    }
  });

  it('finds what people call things', () => {
    const first = (query: string, hosted = false) => search(query, entriesFor(hosted))[0]?.entry.id;
    expect(first('dark mode')).toBe('theme');
    expect(first('louder')).toBe('booster');
    expect(first('louder', true)).toBe('booster');
    expect(first('visualizer')).toBe('visualiser');
    expect(first('icon')).toBe('icons');
    expect(first('toolbar')).toBe('player-bar');
    expect(first('toolbar 2')).toBe('player-bar');
    expect(first('toolbar 2', true)).toBe('player-bar');
    expect(first('scrobble')).toBe('lastfm');
    expect(first('scrobble', true)).toBe('listenbrainz');
    expect(first('columns')).toBe('queue-columns');
    expect(first('volumn boost')).toBe('booster');
    expect(first('bang')).toBe('bangs');
    expect(first('search shortcut')).toBe('bangs');
  });

  it('finds the badges by their marks, logos and letters, in either build', () => {
    for (const hosted of [false, true]) {
      const found = (query: string) => search(query, entriesFor(hosted)).map((m) => m.entry.id);
      for (const query of ['logo', 'service icons', 'badge', 'marks']) expect(found(query)[0], query).toBe('service-badges');
      for (const query of ['icons', 'letters', 'ytm']) expect(found(query), query).toContain('service-badges');
      expect(found('icon')[0]).toBe('icons');
    }
  });

  it('describes every setting, for the search to look in', () => {
    for (const entry of ENTRIES) expect(entry.description?.length, entry.id).toBeGreaterThan(10);
  });
});
