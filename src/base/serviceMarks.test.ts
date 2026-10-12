import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SERVICE_BADGE_STYLES } from './looks';
import { MARK_VIEWPORT, SERVICE_MARKS } from './serviceMarks';
import { Badge, setServiceBadgeStyle } from '../components/Badge';
import type { Provider } from '../types';
import { providerBadge, providerName } from '../util';

const providers = Object.keys(SERVICE_MARKS) as Provider[];

/**
 * The marks the badges are drawn with, as Base's ServiceMarksTest has them -- one for every service, each a whole
 * shape of its own -- and the badge drawn both ways: with a mark it says the service's name, with letters it is the
 * badge as it always was.
 */
describe('the services’ marks', () => {
  it('has a mark for every service, each a path that starts somewhere and closes', () => {
    expect([...providers].sort()).toEqual(Object.keys(providerName).sort());
    for (const provider of providers) {
      const path = SERVICE_MARKS[provider];
      expect(path, provider).toMatch(/^[Mm][MmZzLlHhVvCcSsQqTtAa0-9.,\s-]+[Zz]$/);
    }
    expect(MARK_VIEWPORT).toBe(24);
  });

  it('gives no two services one mark', () => {
    expect(new Set(Object.values(SERVICE_MARKS)).size).toBe(providers.length);
  });

  it('offers marks first, and the letters as the badges were', () => {
    expect(SERVICE_BADGE_STYLES.map((s) => s.name)).toEqual(['MARKS', 'LETTERS']);
  });
});

describe('the badge', () => {
  const draw = (provider: Provider, style?: string) => renderToStaticMarkup(createElement(Badge, { provider, style }));

  it('draws the mark over the letters, unseen, and says the service’s name', () => {
    for (const provider of providers) {
      const html = draw(provider);
      expect(html, provider).toContain(`d="${SERVICE_MARKS[provider]}"`);
      expect(html, provider).toContain(`aria-label="${providerName[provider]}"`);
      expect(html, provider).toContain(`title="${providerName[provider]}"`);
      expect(html, provider).toContain(`<span class="letters" aria-hidden="true">${providerBadge[provider]}</span>`);
    }
  });

  it('draws the letters alone once they are chosen, or asked for', () => {
    expect(draw('SOUNDCLOUD', 'LETTERS')).toBe(`<span class="badge SOUNDCLOUD" title="SoundCloud">SC</span>`);
    setServiceBadgeStyle('LETTERS');
    try {
      expect(draw('SPOTIFY')).toBe(`<span class="badge SPOTIFY" title="Spotify">SP</span>`);
      expect(draw('SPOTIFY', 'MARKS')).toContain('<svg');
    } finally {
      setServiceBadgeStyle('MARKS');
    }
  });
});
