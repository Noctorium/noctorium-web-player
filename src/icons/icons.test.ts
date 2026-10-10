import { describe, expect, it } from 'vitest';
import * as Lucide from 'lucide-react';
import names from './names.json';
import filled from './material-filled';
import outlined from './material-outlined';
import round from './material-round';
import sharp from './material-sharp';
import twoTone from './material-two-tone';

/** Every icon the page asks for is drawn in every set, so no choice leaves a hole in a button. */
describe('the icon sets', () => {
  const sets = { filled, outlined, round, sharp, twoTone };

  it('have every icon in every Material style', () => {
    for (const [set, drawings] of Object.entries(sets)) {
      for (const [name, material] of Object.entries(names)) {
        expect(drawings[material], `${name} (${material}) in ${set}`).toMatch(/^<(path|circle|rect|g|polygon) /);
      }
    }
  });

  it("have every icon in Lucide, which Standard and Line draw", () => {
    for (const name of Object.keys(names).filter((n) => n !== 'HeartFilled')) {
      expect(Lucide[name as keyof typeof Lucide], name).toBeTruthy();
    }
  });

  it('export every icon they name, and name every icon they export', () => {
    const source = Object.values(import.meta.glob('./index.tsx', { query: '?raw', import: 'default', eager: true }))[0] as string;
    const exported = [...source.matchAll(/export const (\w+) = make\('(\w+)'\);/g)].map((m) => {
      expect(m[1]).toBe(m[2]);
      return m[1];
    });
    expect(exported.sort()).toEqual(Object.keys(names).filter((n) => n !== 'HeartFilled').sort());
  });

  it('draw the page with nothing straight from Lucide', () => {
    const files = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [file, text] of Object.entries(files)) {
      if (file.startsWith('./')) continue;
      expect(text.includes("from 'lucide-react'"), `${file} imports lucide-react directly`).toBe(false);
    }
  });
});
