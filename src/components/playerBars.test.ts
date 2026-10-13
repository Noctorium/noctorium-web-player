import { describe, expect, it } from 'vitest';
import { PLAYER_BARS } from '../base/looks';

/**
 * The player bars offered in Settings are the ones the page draws: each under Base's PlayerBarStyle name, drawn by
 * PlayerBar, with a preview of its own, and either Toolbar a bar of the Toolbar's height. Toolbar 2 is the Toolbar
 * asked for again without the add button, with play and pause one button and the rest after the slider, in the
 * order the desktop has them. Read from the sources, as the icons' test reads them, since the page's parts need a
 * browser and Noctorium behind them to be drawn.
 */
const sources = import.meta.glob(['./Player.tsx', './LookPreviews.tsx', '../App.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const player = sources['./Player.tsx'];
const previews = sources['./LookPreviews.tsx'];
const app = sources['../App.tsx'];

/** The source of the function [name] in Player.tsx, up to the next one. */
function body(name: string): string {
  const start = player.indexOf(`function ${name}(`);
  expect(start, name).toBeGreaterThan(0);
  const end = player.indexOf('\nfunction ', start + 1);
  const next = player.indexOf('\nexport function ', start + 1);
  return player.slice(start, Math.min(...[end, next].filter((i) => i > 0)));
}

describe('the player bars', () => {
  it('are Base’s, in its order, with Toolbar 2 after the Toolbar in its words', () => {
    expect(PLAYER_BARS.map((b) => b.name)).toEqual(['CENTERED', 'TOOLBAR', 'TOOLBAR_2']);
    const second = PLAYER_BARS.find((b) => b.name === 'TOOLBAR_2')!;
    expect(second.title).toBe('Toolbar 2');
    expect(second.description).toContain('play and pause as one');
    for (const bar of PLAYER_BARS) expect(bar.description!.length, bar.name).toBeGreaterThan(20);
  });

  it('are each drawn, each previewed, and either Toolbar is the Toolbar’s height', () => {
    for (const { name } of PLAYER_BARS.filter((b) => b.name !== 'CENTERED')) {
      expect(body('PlayerBar'), name).toContain(`playerBar === '${name}'`);
      expect(previews, name).toContain(`name === '${name}'`);
      expect(app, name).toContain(`looks.playerBar === '${name}'`);
    }
  });

  it('give Toolbar 2 play and pause as one button, no add button, and the rest in the desktop’s order', () => {
    const second = body('Toolbar2Bar');
    expect(second).not.toContain('Add to a playlist');
    expect(second).not.toContain('AddToPlaylist');
    expect(second.match(/send\('toggle'\)/g)).toHaveLength(1);
    // Stop only where it was asked for, as on the Centred bar.
    expect(second).toContain('{stopButton && <StopButton flat');
    const order = [...second.matchAll(/data-button="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['LIKE', 'LYRICS', 'QUEUE', 'REPEAT', 'SHUFFLE', 'SLEEP_TIMER', 'DEVICES', 'SPEED']);
    expect(second.indexOf('<SeekBar')).toBeLessThan(second.indexOf('data-button="LIKE"'));
    expect(second.indexOf('data-button="SPEED"')).toBeLessThan(second.indexOf('<VolumeButton'));
    // The hosted player has nowhere else to play and no speed of its own to change.
    expect(second).toMatch(/!HOSTED && \(\s*<button[^>]*data-button="DEVICES"/);
    expect(second).toMatch(/!HOSTED && \(\s*<button[^>]*data-button="SPEED"/);
  });

  it('keep the Toolbar as it was: add, previous, play, pause, stop and next', () => {
    const first = body('ToolbarBar');
    for (const label of ['Add to a playlist', 'Previous', '"Play"', '"Pause"', '<StopButton flat', 'Next']) expect(first, label).toContain(label);
  });
});
