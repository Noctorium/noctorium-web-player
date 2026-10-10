import { useSyncExternalStore, type CSSProperties } from 'react';
import * as Lucide from 'lucide-react';
import names from './names.json';

/*
 * Every icon the page draws, in the icon set the listener chose (Base's IconSet), under the names the page has
 * always used for them -- Lucide's -- so a component asks for <Play /> and gets the set in force.
 *
 * - Standard: Lucide (ISC), as this page has always drawn it -- two-pixel strokes, the transport filled in.
 * - Line: Lucide again, in thin strokes with nothing filled, like a desktop's own icon theme (the look of the
 *   screenshot that started this); a liked heart stays filled, or liking would not show.
 * - Rounded, Outlined, Sharp, Filled and Two-tone: Material Icons (Apache 2.0), in those five styles -- the same
 *   five sets Compose draws on the desktop and the phone, so a choice looks the same on every player. Only the
 *   icons here are bundled, a set at a time, fetched the first time it is chosen; Lucide stands in for the moment
 *   that takes. Written by scripts/material-icons.mjs.
 */

export type IconName = keyof typeof names;
type MaterialSet = 'FILLED' | 'OUTLINED' | 'ROUNDED' | 'SHARP' | 'TWO_TONE';

const loaders: Record<MaterialSet, () => Promise<{ default: Record<string, string> }>> = {
  FILLED: () => import('./material-filled'),
  OUTLINED: () => import('./material-outlined'),
  ROUNDED: () => import('./material-round'),
  SHARP: () => import('./material-sharp'),
  TWO_TONE: () => import('./material-two-tone'),
};

const loaded: Partial<Record<MaterialSet, Record<string, string>>> = {};
let current = 'STANDARD';
let snapshot = 'STANDARD:0:0';
/** Counts the sets fetched, so a preview of one that was not in force draws once it arrives. */
let fetched = 0;
const listeners = new Set<() => void>();

function changed() {
  snapshot = `${current}:${loaded[current as MaterialSet] ? 1 : 0}:${fetched}`;
  listeners.forEach((l) => l());
}

/** Puts [set] in force, everywhere at once, fetching its drawings first if it is one of Material's. */
export function setIconSet(set: string | undefined) {
  const next = set ?? 'STANDARD';
  if (next === current) return;
  current = next;
  changed();
  fetch(next);
}

/** Fetches [set]'s drawings, if it is one of Material's and they are not here yet, without putting it in force. */
function fetch(set: string) {
  const material = set as MaterialSet;
  if (!(material in loaders)) return;
  // The outlined styles' liked heart is the filled set's, so that one comes along with them.
  const wanted: MaterialSet[] = material === 'OUTLINED' || material === 'TWO_TONE' ? ['FILLED', material] : [material];
  if (wanted.every((s) => loaded[s])) return;
  Promise.all(wanted.map((s) => loaded[s] ?? loaders[s]().then((module) => (loaded[s] = module.default)))).then(() => {
    fetched++;
    changed();
  }, () => undefined);
}

export function useIconSet(): string {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => snapshot).split(':')[0];
}

/** Every icon set, for Settings' previews: a set drawn there is fetched for it, without being put in force. */
export const ICON_SET_NAMES = ['STANDARD', 'ROUNDED', 'OUTLINED', 'SHARP', 'FILLED', 'TWO_TONE', 'LINE'];

export interface IconProps {
  size?: number | string;
  /** "currentColor" for the shapes Lucide draws filled in: the transport's, a liked heart. */
  fill?: string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** A set to draw this one icon in, rather than the one in force: for Settings' previews. */
  set?: string;
}

/** The thin stroke of the Line set, in Lucide's 24-unit box. */
const LINE_STROKE = 1.25;

function make(name: IconName) {
  const Drawn = Lucide[name as keyof typeof Lucide] as Lucide.LucideIcon;
  function Icon({ size = 24, fill, className, style, strokeWidth, set: own }: IconProps) {
    const inForce = useIconSet();
    const set = own ?? inForce;
    if (own) fetch(own);
    const drawings = loaded[set as MaterialSet] && (set !== 'OUTLINED' && set !== 'TWO_TONE' || loaded.FILLED) ? loaded[set as MaterialSet] : undefined;
    if (drawings) {
      // A filled heart is the liked one: Material draws it as its own shape, solid in every style but its own
      // outlined ones, where solid is the only way it reads as liked.
      const liked = name === 'Heart' && fill && fill !== 'none';
      const inner = liked ? (set === 'OUTLINED' || set === 'TWO_TONE' ? loaded.FILLED! : drawings).favorite : drawings[names[name]];
      return (
        <svg
          className={className ? `icon material ${className}` : 'icon material'}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="currentColor"
          style={style}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: inner ?? '' }}
        />
      );
    }
    const line = set === 'LINE';
    // Only what is asked for is passed on: Lucide's own fill is none and its stroke two, and an undefined
    // would take their place and leave the shape filled black.
    const given: Lucide.LucideProps = {};
    const filled = line && name !== 'Heart' ? undefined : fill;
    if (filled) given.fill = filled;
    if (line) given.strokeWidth = LINE_STROKE;
    else if (strokeWidth != null) given.strokeWidth = strokeWidth;
    return <Drawn size={size} className={className} style={style} aria-hidden {...given} />;
  }
  Icon.displayName = name;
  return Icon;
}

export const ArrowLeft = make('ArrowLeft');
export const ArrowLeftRight = make('ArrowLeftRight');
export const ArrowRight = make('ArrowRight');
export const BookmarkCheck = make('BookmarkCheck');
export const BookmarkPlus = make('BookmarkPlus');
export const Check = make('Check');
export const ChevronDown = make('ChevronDown');
export const ChevronUp = make('ChevronUp');
export const ChevronsUp = make('ChevronsUp');
export const CircleStop = make('CircleStop');
export const Columns3 = make('Columns3');
export const Disc3 = make('Disc3');
export const Download = make('Download');
export const ExternalLink = make('ExternalLink');
export const FileAudio = make('FileAudio');
export const Globe = make('Globe');
export const GripVertical = make('GripVertical');
export const Headphones = make('Headphones');
export const Heart = make('Heart');
export const Home = make('Home');
export const Info = make('Info');
export const Library = make('Library');
export const Link2 = make('Link2');
export const ListEnd = make('ListEnd');
export const ListMinus = make('ListMinus');
export const ListMusic = make('ListMusic');
export const ListPlus = make('ListPlus');
export const ListStart = make('ListStart');
export const ListX = make('ListX');
export const Lock = make('Lock');
export const Maximize2 = make('Maximize2');
export const Mic2 = make('Mic2');
export const Monitor = make('Monitor');
export const MonitorSpeaker = make('MonitorSpeaker');
export const Moon = make('Moon');
export const MoreHorizontal = make('MoreHorizontal');
export const Music2 = make('Music2');
export const Palette = make('Palette');
export const Pause = make('Pause');
export const Pencil = make('Pencil');
export const Pin = make('Pin');
export const Play = make('Play');
export const Plus = make('Plus');
export const QrCode = make('QrCode');
export const Radio = make('Radio');
export const RefreshCw = make('RefreshCw');
export const Repeat = make('Repeat');
export const Repeat1 = make('Repeat1');
export const Save = make('Save');
export const Search = make('Search');
export const Settings = make('Settings');
export const Shuffle = make('Shuffle');
export const SkipBack = make('SkipBack');
export const SkipForward = make('SkipForward');
export const SlidersHorizontal = make('SlidersHorizontal');
export const Smartphone = make('Smartphone');
export const Square = make('Square');
export const Trash2 = make('Trash2');
export const User = make('User');
export const UserPlus = make('UserPlus');
export const Volume1 = make('Volume1');
export const Volume2 = make('Volume2');
export const VolumeX = make('VolumeX');
export const X = make('X');
