/*
 * The settings search box, the same on every player: Base's SettingsSearch, ported line for line.
 *
 * Ranked as somebody looking for a setting would rank it: a name that begins with what was typed first, then a
 * name with those words in it, then the other words people use for it, then its description, then its section;
 * within each, an exact match before one that needed a typo forgiven, and otherwise the order the player listed
 * its settings in. Case and accents do not matter, and neither does one wrong, missing, extra or swapped letter
 * in a word of five letters or more -- "equaliser" finds Equaliser and so does "equalizer", "volumn" finds Volume.
 * A shorter word has to be right: one letter off in "mode" is a different word.
 */

/** One setting as the settings search knows it. Each player lists its own, and the search finds among them. */
export interface SettingEntry {
  /** The page's own name for it, to jump to and highlight. */
  id: string;
  title: string;
  /** Where it lives, as the search shows it: "Look", or "Look › Player bar". */
  section: string;
  description?: string;
  /**
   * Other words for it: what people call it when they do not know its name -- "dark mode" for Theme, "louder"
   * for the volume booster, "hotkeys" for Shortcuts -- and other spellings of its name, "equalizer" for Equaliser.
   */
  keywords?: string[];
}

/** Which part of a setting matched, best first. */
export enum SettingMatchKind {
  /** Its name begins with what was typed: "vol" for Volume booster. */
  TITLE_START,
  /** Every word typed begins a word of its name, wherever: "boost" for Volume booster. */
  TITLE_WORD,
  /** One of its other words: "dark mode" for Theme. */
  KEYWORD,
  /** Every word typed is in what it says it does. */
  DESCRIPTION,
  /** Every word typed is in the name of the section it lives in. */
  SECTION,
}

/** A setting found, how it was found, and whether a typo had to be forgiven to find it. */
export interface SettingMatch {
  entry: SettingEntry;
  kind: SettingMatchKind;
  forgiven: boolean;
  /** The other word it was found by, for a search that wants to say so: "dark mode". */
  keyword?: string;
}

/** Words this short match only a name or another word for it, never every description with "a" in it. */
const SHORTEST_DESCRIPTION_WORD = 3;

/** A word this long or longer is forgiven one typo. */
export const FORGIVING_FROM = 5;

export function search(query: string, entries: SettingEntry[]): SettingMatch[] {
  const typed = words(query);
  if (!typed.length) return [];
  // Array.prototype.sort is stable, as Kotlin's sortedWith is, so the player's own order breaks the ties.
  return entries
    .map((entry) => match(typed, entry))
    .filter((m): m is SettingMatch => m != null)
    .sort((a, b) => a.kind - b.kind || Number(a.forgiven) - Number(b.forgiven));
}

function match(query: string[], entry: SettingEntry): SettingMatch | undefined {
  const title = words(entry.title);
  const start = inOrderFromStart(query, title);
  if (start != null) return { entry, kind: SettingMatchKind.TITLE_START, forgiven: start };
  const word = anywhere(query, title);
  if (word != null) return { entry, kind: SettingMatchKind.TITLE_WORD, forgiven: word };
  const keywords = (entry.keywords ?? [])
    .map((keyword) => [keyword, anywhere(query, words(keyword))] as const)
    .filter((k): k is readonly [string, boolean] => k[1] != null);
  const keyword = keywords.find((k) => !k[1]) ?? keywords[0];
  if (keyword) return { entry, kind: SettingMatchKind.KEYWORD, forgiven: keyword[1], keyword: keyword[0] };
  if (query.some((w) => w.length < SHORTEST_DESCRIPTION_WORD)) return undefined;
  const described = anywhere(query, words(entry.description ?? ''));
  if (described != null) return { entry, kind: SettingMatchKind.DESCRIPTION, forgiven: described };
  const section = anywhere(query, words(entry.section));
  if (section != null) return { entry, kind: SettingMatchKind.SECTION, forgiven: section };
  return undefined;
}

/** Whether the query's words begin the target's, in order from its first word; whether a typo was forgiven. */
function inOrderFromStart(query: string[], target: string[]): boolean | undefined {
  if (query.length > target.length) return undefined;
  let forgiven = false;
  for (let i = 0; i < query.length; i++) {
    const matched = wordMatch(query[i], target[i]);
    if (matched == null) return undefined;
    if (matched === 'forgiven') forgiven = true;
  }
  return forgiven;
}

/** Whether every word of the query begins some word of the target; whether a typo was forgiven. */
function anywhere(query: string[], target: string[]): boolean | undefined {
  if (!target.length) return undefined;
  let forgiven = false;
  for (const word of query) {
    const matches = target.map((t) => wordMatch(word, t));
    if (matches.includes('exact')) continue;
    if (matches.includes('forgiven')) forgiven = true;
    else return undefined;
  }
  return forgiven;
}

/** [typed] against one word: the start of it, or -- for a long enough word -- the start of it with one typo. */
function wordMatch(typed: string, word: string): 'exact' | 'forgiven' | undefined {
  if (word.startsWith(typed)) return 'exact';
  if (typed.length < FORGIVING_FROM) return undefined;
  // The typo can have made what was typed a letter longer or shorter than the part of the word it means.
  for (let length = typed.length - 1; length <= typed.length + 1; length++) {
    if (length <= word.length && withinOneEdit(typed, word.slice(0, length))) return 'forgiven';
  }
  return undefined;
}

/** Whether [a] becomes [b] with at most one letter changed, added, removed, or swapped with its neighbour. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const differ: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differ.push(i);
    return differ.length === 1 ||
      (differ.length === 2 && differ[1] === differ[0] + 1 && a[differ[0]] === b[differ[1]] && a[differ[1]] === b[differ[0]]);
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let at = 0;
  while (at < shorter.length && shorter[at] === longer[at]) at++;
  if (at === shorter.length) return true;
  return shorter.slice(at) === longer.slice(at + 1);
}

/** [text] as words to match: lower case, accents off, apostrophes gone, everything else not a letter or digit a gap. */
export function words(text: string): string[] {
  return normalise(text).split(' ').filter((w) => w.length > 0);
}

/** [text] lower case, without accents, with nothing but letters, digits and single spaces. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
