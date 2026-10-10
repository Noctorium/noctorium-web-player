import { describe, expect, it } from 'vitest';
import { normalise, search, SettingMatchKind, withinOneEdit, words, type SettingEntry } from './settingsSearch';

/** Base's SettingsSearchTest, case for case: what the box finds, in what order, and what it forgives. */
describe('the settings search', () => {
  const entries: SettingEntry[] = [
    { id: 'theme', title: 'Theme', section: 'Look', description: 'The colours everything is drawn in.', keywords: ['dark mode', 'light mode', 'colours'] },
    { id: 'booster', title: 'Volume booster', section: 'Listening › Sound', description: 'Louder than full, from 100% to 1000%, behind a limiter.', keywords: ['louder', 'amplify'] },
    { id: 'volume-step', title: 'Volume step', section: 'Listening › Sound', description: 'How far the volume keys move it.' },
    { id: 'equaliser', title: 'Equaliser', section: 'Listening › Sound', description: 'Ten bands and a preamp.', keywords: ['equalizer', 'eq', 'bass'] },
    { id: 'shortcuts', title: 'Shortcuts', section: 'This device', description: 'Keys that do things, in Noctorium and from anywhere.', keywords: ['hotkeys', 'keyboard'] },
    { id: 'player-bar', title: 'Player bar', section: 'Look', description: 'Where the controls sit and how they are laid out.' },
    { id: 'cafe', title: 'Café mode', section: 'Look', description: 'Quieter colours for a crowded room.' },
  ];
  const ids = (query: string) => search(query, entries).map((m) => m.entry.id);

  it('puts a name that begins with what was typed first', () => {
    expect(ids('vol')).toEqual(['booster', 'volume-step']);
    expect(ids('volume b')[0]).toBe('booster');
    expect(search('vol', entries)[0].kind).toBe(SettingMatchKind.TITLE_START);
  });

  it('then a name with the word in it, then another word for it, then the description', () => {
    const found = search('boost', entries);
    expect(found.map((m) => m.entry.id)).toEqual(['booster']);
    expect(found[0].kind).toBe(SettingMatchKind.TITLE_WORD);

    const louder = search('louder', entries);
    expect(louder[0].entry.id).toBe('booster');
    expect(louder[0].kind).toBe(SettingMatchKind.KEYWORD);
    expect(louder[0].keyword).toBe('louder');

    const colours = search('colours', entries);
    expect(colours.map((m) => m.entry.id), 'the keyword first, then the description').toEqual(['theme', 'cafe']);
    expect(colours.map((m) => m.kind)).toEqual([SettingMatchKind.KEYWORD, SettingMatchKind.DESCRIPTION]);
  });

  it('finds the setting meant by the other words people use', () => {
    expect(ids('dark mode')[0]).toBe('theme');
    expect(ids('hotkeys')[0]).toBe('shortcuts');
    expect(ids('equalizer')[0]).toBe('equaliser');
    expect(ids('eq')[0]).toBe('equaliser');
  });

  it('minds neither case nor accents', () => {
    expect(ids('CAFE')).toEqual(['cafe']);
    expect(ids('café')).toEqual(['cafe']);
    expect(ids('THEME')).toEqual(['theme']);
  });

  it('forgives one typo in a long word, and ranks it after the right spelling', () => {
    const volumn = search('volumn', entries);
    expect(volumn.map((m) => m.entry.id)).toEqual(['booster', 'volume-step']);
    expect(volumn.every((m) => m.forgiven)).toBe(true);
    expect(ids('shortcts')[0], 'a letter missing').toBe('shortcuts');
    expect(ids('shrotcuts')[0], 'two letters swapped').toBe('shortcuts');
    expect(ids('equalisre')[0]).toBe('equaliser');
  });

  it('wants a short word right', () => {
    expect(ids('thme'), 'four letters, one wrong, is another word').toEqual([]);
    expect(ids('bsas')).toEqual([]);
  });

  it('does not take two typos for one', () => {
    expect(ids('vloumn')).toEqual([]);
  });

  it('does not let a short word find every description it happens to start', () => {
    expect(ids('fu'), '"full" is in a description, and two letters are not enough to look there').toEqual([]);
    expect(ids('ful')).toEqual(['booster']);
    expect(ids('look'), "a section's name finds what is in it, last of all").toEqual(['theme', 'player-bar', 'cafe']);
    expect(search('look', entries).every((m) => m.kind === SettingMatchKind.SECTION)).toBe(true);
  });

  it('finds nothing for nothing typed', () => {
    expect(ids('')).toEqual([]);
    expect(ids('  !! ')).toEqual([]);
  });

  it('counts one edit exactly', () => {
    expect(withinOneEdit('volume', 'volumn')).toBe(true);
    expect(withinOneEdit('short', 'shrot')).toBe(true);
    expect(withinOneEdit('colour', 'color')).toBe(true);
    expect(withinOneEdit('colour', 'colr')).toBe(false);
    expect(withinOneEdit('abcd', 'badc')).toBe(false);
  });

  it('reads words as what is left of the text without its punctuation', () => {
    expect(words('Don’t stop — Two-tone!')).toEqual(['dont', 'stop', 'two', 'tone']);
    expect(words("Don't stop")).toEqual(['dont', 'stop']);
    expect(normalise('Égaliseur')).toBe('egaliseur');
  });
});
