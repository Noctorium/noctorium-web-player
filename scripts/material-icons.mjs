// Writes src/icons/material-<set>.ts: the Material Icons this page draws, in each of the five styles the desktop
// and the phone draw them in (Compose's Filled, Outlined, Rounded, Sharp and Two-tone), from the
// @material-design-icons/svg package (Apache 2.0). Only the icons in src/icons/names.json are taken, so each set
// is a few kilobytes, fetched the first time it is chosen. Run it again after adding an icon to names.json:
//
//   node scripts/material-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const names = JSON.parse(readFileSync(join(here, '../src/icons/names.json'), 'utf8'));
const pkg = dirname(createRequire(import.meta.url).resolve('@material-design-icons/svg/package.json'));
const { version } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
const sets = { FILLED: 'filled', OUTLINED: 'outlined', ROUNDED: 'round', SHARP: 'sharp', TWO_TONE: 'two-tone' };
const wanted = [...new Set(Object.values(names))].sort();

for (const [set, folder] of Object.entries(sets)) {
  const lines = wanted.map((name) => {
    const svg = readFileSync(join(pkg, folder, `${name}.svg`), 'utf8').trim();
    const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    return `  ${name}: '${inner.replace(/'/g, "\\'")}',`;
  });
  const file = `/*
 * Material Icons, ${folder} -- from @material-design-icons/svg ${version}, Apache License 2.0, (c) Google.
 * Written by scripts/material-icons.mjs from src/icons/names.json; not edited by hand.
 */
const icons: Record<string, string> = {
${lines.join('\n')}
};

export default icons;
`;
  writeFileSync(join(here, `../src/icons/material-${folder}.ts`), file);
  console.log(`material-${folder}.ts: ${wanted.length} icons`);
}
