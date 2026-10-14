import { describe, expect, it } from 'vitest';
import { search } from '../base/settingsSearch';
import { entriesFor } from './settingsEntries';

/**
 * Noctorium Connect's switch: the first thing on Devices, saying what on and off mean in the desktop's words, with
 * a calm word where the devices were while it is off; the same switch in Settings, which the search finds by what
 * people say when they want it off; and none of it in the hosted player, which has no Connect. Read from the
 * sources, as the settings' test reads them, since the pages need a browser and Noctorium behind them to be drawn.
 */
const sources = import.meta.glob(['./Other.tsx', './Settings.tsx', '../App.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const other = sources['./Other.tsx'];
const settings = sources['./Settings.tsx'];
const app = sources['../App.tsx'];
const devices = other.slice(other.indexOf('export function DevicesPage('));

describe('Noctorium Connect’s switch', () => {
  it('says what on and off mean in the desktop’s words', () => {
    expect(other).toContain("'This computer finds your other devices, and they can find it.'");
    expect(other).toContain("'Off: this computer is not looking for your other devices, and they cannot see it.'");
  });

  it('is the first thing on Devices, and sends the command noctorium web already answers', () => {
    const at = devices.indexOf('className="setting connect-switch"');
    expect(at).toBeGreaterThan(0);
    for (const later of ['<h2>Your other devices</h2>', '<h2>Play on</h2>']) expect(devices.indexOf(later), later).toBeGreaterThan(at);
    const row = devices.slice(at, devices.indexOf('</div>\n', devices.indexOf('<Switch', at)));
    expect(row).toContain('<strong>Noctorium Connect</strong>');
    expect(row).toContain('{connectSays(connectOn)}');
    expect(row).toContain("send('connect', { on })");
  });

  it('puts a calm word where the devices and their troubles were while it is off', () => {
    const on = devices.indexOf('{connectOn ? (');
    const off = devices.indexOf('title="Noctorium Connect is off"');
    expect(on).toBeGreaterThan(0);
    // The list, the account's banner and "none found" are all in the branch for on, before the one for off.
    for (const part of ['connect?.devices.map', 'Connect needs your Noctorium account', 'No other device found']) {
      const where = devices.indexOf(part);
      expect(where, part).toBeGreaterThan(on);
      expect(where, part).toBeLessThan(off);
    }
    expect(devices.indexOf(') : (', on)).toBeLessThan(off);
  });

  it('is in Settings too, in the same words, where the search finds it by what people call switching it', () => {
    const row = settings.slice(settings.indexOf('setting="connect"'), settings.indexOf('</Row>', settings.indexOf('setting="connect"')));
    expect(row).toContain('title="Noctorium Connect"');
    expect(row).toContain('connectSays(connectOn)');
    expect(row).toContain("send('connect', { on })");
    expect(row).toContain("go('/devices')");
    const first = (query: string) => search(query, entriesFor(false))[0]?.entry.id;
    for (const query of ['connect', 'noctorium connect', 'turn off connect', 'disable connect', 'turn connect on', 'enable connect', 'cast']) {
      expect(first(query), query).toBe('connect');
    }
  });

  it('is not in the hosted player, which has no Connect', () => {
    expect(entriesFor(true).map((e) => e.id)).not.toContain('connect');
    expect(app).toMatch(/HOSTED \? allPages\.filter\(\(\[id\]\) => id !== 'downloads' && id !== 'devices'\)/);
  });
});
