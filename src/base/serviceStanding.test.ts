import { describe, expect, it } from 'vitest';
import { BETA_WARNING, betaWarning, inBeta } from './serviceStanding';
import type { Provider } from '../types';

const every: Provider[] = ['YOUTUBE_MUSIC', 'YOUTUBE_VIDEO', 'SOUNDCLOUD', 'SPOTIFY', 'BANDCAMP', 'VK', 'APPLE_MUSIC', 'DEEZER', 'TIDAL', 'LOCAL'];

/** Base's ServiceStandingTest, case for case: which services carry the beta warning, and what it says. */
describe('the services in beta', () => {
  it('are every service but YouTube Music, YouTube, SoundCloud and music with no service', () => {
    expect(every.filter(inBeta)).toEqual(['SPOTIFY', 'BANDCAMP', 'VK', 'APPLE_MUSIC', 'DEEZER', 'TIDAL']);
    for (const provider of ['YOUTUBE_MUSIC', 'YOUTUBE_VIDEO', 'SOUNDCLOUD', 'LOCAL'] as Provider[]) expect(betaWarning(provider), provider).toBeUndefined();
  });

  it('are warned of in the words the listener asked for', () => {
    expect(betaWarning('DEEZER')).toBe(BETA_WARNING);
    for (const words of ['beta', 'may not work', 'small chance', 'blocked', 'at your own risk']) {
      expect(BETA_WARNING.toLowerCase(), words).toContain(words);
    }
  });

  it('are warned of in Noctorium’s words where it sends them, and Base’s where it sends none', () => {
    const sent = { betaWarnings: { TIDAL: 'Tidal, in other words.' } };
    expect(betaWarning('TIDAL', sent)).toBe('Tidal, in other words.');
    // What Noctorium leaves out of what it sends is not in beta there.
    expect(betaWarning('SPOTIFY', sent)).toBeUndefined();
    expect(betaWarning('SPOTIFY', {})).toBe(BETA_WARNING);
    expect(betaWarning('SOUNDCLOUD', {})).toBeUndefined();
  });
});
