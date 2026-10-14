import { describe, expect, it } from 'vitest';

/**
 * The Playlist layout's tabs: Up next, then the lyrics, then the playlist the queue came from where the page knows
 * it -- the lyrics ahead of the tab that comes and goes, so they are always in the same place -- and in the lyrics
 * tab the lyrics the other layout shows, asked for in either build and kept in time with the song. Read from the
 * sources, as the player bars' test reads them, since the page's parts need a browser and Noctorium behind them.
 */
const sources = import.meta.glob(['./PlaylistLayout.tsx', './NowPlaying.tsx', '../hosted/engine.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const layout = sources['./PlaylistLayout.tsx'];
const nowPlaying = sources['./NowPlaying.tsx'];
const hosted = sources['../hosted/engine.ts'];

describe('the Playlist layout', () => {
  it('has the lyrics in the tab after Up next, ahead of the playlist’s, which comes and goes', () => {
    const tabs = layout.slice(layout.indexOf('className="playlist-tabs"'), layout.indexOf('className="spacer"'));
    expect([...tabs.matchAll(/setTab\('(\w+)'\)/g)].map((m) => m[1])).toEqual(['queue', 'lyrics', 'source']);
    expect(tabs).toMatch(/>Lyrics<\/button>/);
    // Only the playlist's tab waits on anything; Up next and the lyrics are always there.
    expect(tabs.match(/\{\w+ && \(/g)).toEqual(['{source && (']);
    expect(tabs.indexOf('{source && (')).toBeGreaterThan(tabs.indexOf("setTab('lyrics')"));
  });

  it('shows in its lyrics tab the lyrics the other layout shows', () => {
    expect(layout).toContain("import { LyricsPanel } from './NowPlaying'");
    expect(layout).toContain("shownTab === 'lyrics' ? <LyricsPanel />");
  });

  it('asks for the lyrics in either build, lights the line being sung, and says what the tab is for with nothing playing', () => {
    const panel = nowPlaying.slice(nowPlaying.indexOf('export function LyricsPanel('));
    expect(panel).toContain("send('lyrics', { track })");
    // The hosted player answers the same command from its own sources; noctorium web answers it from Base.
    expect(hosted).toContain("case 'lyrics':");
    expect(panel).toContain('usePosition(playback)');
    expect(panel).toContain("i === active && 'active'");
    const nothing = panel.indexOf('if (!track) return <Empty');
    expect(nothing).toBeGreaterThan(0);
    expect(panel.slice(nothing, panel.indexOf('\n', nothing))).toContain('title="Nothing playing"');
    // After every hook, so that the same ones are called whether or not anything is playing.
    const hooks = [...panel.matchAll(/\buse[A-Z]\w*\(/g)].map((m) => m.index!);
    expect(nothing).toBeGreaterThan(Math.max(...hooks));
  });
});
