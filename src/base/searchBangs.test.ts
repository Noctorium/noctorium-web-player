import { describe, expect, it } from 'vitest';
import { ALL, bangFor, parse, type SearchMode } from './searchBangs';

/** Base's SearchBangsTest, case for case: `!ytm daft punk`, `daft punk !sc`, and everything that only looks like one. */
describe('bangs in a search box', () => {
  it('a bang at the start sends the search to its service', () => {
    const parsed = parse('!ytm daft punk');
    expect(parsed.query).toBe('daft punk');
    expect(parsed.bang?.mode).toBe('YOUTUBE_MUSIC');
    expect(parsed.bang?.typed).toBe('!ytm');
  });

  it('a bang at the end does too', () => {
    const parsed = parse('daft punk !sc');
    expect(parsed.query).toBe('daft punk');
    expect(parsed.bang?.mode).toBe('SOUNDCLOUD');
  });

  it('every bang, in any case', () => {
    const every: [string, SearchMode][] = [
      ['!ytm', 'YOUTUBE_MUSIC'], ['!yt', 'YOUTUBE_MUSIC'], ['!YouTube', 'YOUTUBE_MUSIC'], ['!ytv', 'YOUTUBE_VIDEO'],
      ['!SC', 'SOUNDCLOUD'], ['!soundcloud', 'SOUNDCLOUD'], ['!sp', 'SPOTIFY'], ['!Spotify', 'SPOTIFY'], ['!bc', 'BANDCAMP'],
      ['!bandcamp', 'BANDCAMP'], ['!vk', 'VK'], ['!VK', 'VK'], ['!dz', 'DEEZER'], ['!Deezer', 'DEEZER'], ['!td', 'TIDAL'],
      ['!tidal', 'TIDAL'], ['!am', 'APPLE_MUSIC'], ['!AppleMusic', 'APPLE_MUSIC'], ['!all', 'HYBRID'],
    ];
    for (const [bang, mode] of every) {
      expect(parse(`${bang} around the world`).bang?.mode, bang).toBe(mode);
      expect(parse(`around the world ${bang}`).bang?.mode, bang).toBe(mode);
    }
  });

  it('an unknown bang is left in the words', () => {
    const parsed = parse('!xyz daft punk');
    expect(parsed.bang).toBeUndefined();
    expect(parsed.query).toBe('!xyz daft punk');
    expect(parse('daft punk !!!').query).toBe('daft punk !!!');
    expect(parse('!').bang).toBeUndefined();
  });

  it('only the start and the end count', () => {
    const parsed = parse('daft !sc punk');
    expect(parsed.bang).toBeUndefined();
    expect(parsed.query).toBe('daft !sc punk');
  });

  it('the bang at the start is taken over one at the end', () => {
    const parsed = parse('!sc daft punk !bc');
    expect(parsed.bang?.mode).toBe('SOUNDCLOUD');
    expect(parsed.query).toBe('daft punk !bc');
  });

  it('a bang alone chooses the service and searches for nothing yet', () => {
    const parsed = parse('!sp ');
    expect(parsed.bang?.mode).toBe('SPOTIFY');
    expect(parsed.query).toBe('');
  });

  it('text without a bang is left exactly as it was', () => {
    expect(parse('  daft punk ').query).toBe('  daft punk ');
  });

  it('a tab separates a bang as a space does', () => {
    expect(parse('!sc\tdaft punk').query).toBe('daft punk');
    expect(parse('daft punk\t!bc').bang?.mode).toBe('BANDCAMP');
  });

  it('the bang a search box suggests is the shortest', () => {
    expect(bangFor('SOUNDCLOUD')).toBe('!sc');
    expect(bangFor('YOUTUBE_MUSIC')).toBe('!yt');
    expect(bangFor('HYBRID')).toBe('!all');
    expect(bangFor('APPLE_MUSIC')).toBe('!am');
    const modes: SearchMode[] = ['HYBRID', 'SOUNDCLOUD', 'YOUTUBE_MUSIC', 'YOUTUBE_VIDEO', 'BANDCAMP', 'SPOTIFY', 'VK', 'DEEZER', 'TIDAL', 'APPLE_MUSIC'];
    for (const mode of modes) expect(parse(`${bangFor(mode)} x`).bang?.mode, mode).toBe(mode);
  });

  it('has the same table as Base', () => {
    expect([...ALL.keys()]).toEqual([
      'ytm', 'yt', 'youtube', 'ytv', 'sc', 'soundcloud', 'sp', 'spotify', 'bc', 'bandcamp', 'vk', 'dz', 'deezer', 'td', 'tidal', 'am', 'applemusic', 'all',
    ]);
  });
});
