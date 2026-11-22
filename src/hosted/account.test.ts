import { describe, expect, it } from 'vitest';
import { listenCounts } from './account';

describe('a listen counts for the Noctorium account', () => {
  it('after half a minute, or half of a shorter song', () => {
    expect(listenCounts(29_999, 200_000)).toBe(false);
    expect(listenCounts(30_000, 200_000)).toBe(true);
    expect(listenCounts(10_000, 20_000)).toBe(true);
    expect(listenCounts(9_999, 20_000)).toBe(false);
    // A song whose length is not known yet needs the full half minute.
    expect(listenCounts(29_000, 0)).toBe(false);
  });
});
