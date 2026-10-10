import { useSyncExternalStore, type CSSProperties } from 'react';
import {
  ArrowLeft as ArrowLeftLine, ArrowLeftRight as ArrowLeftRightLine, ArrowRight as ArrowRightLine, BookmarkCheck as BookmarkCheckLine, BookmarkPlus as BookmarkPlusLine, Check as CheckLine,
  ChevronDown as ChevronDownLine, ChevronUp as ChevronUpLine, ChevronsUp as ChevronsUpLine, CircleStop as CircleStopLine, Columns3 as Columns3Line, Disc3 as Disc3Line,
  Download as DownloadLine, ExternalLink as ExternalLinkLine, FileAudio as FileAudioLine, Globe as GlobeLine, GripVertical as GripVerticalLine, Headphones as HeadphonesLine,
  Heart as HeartLine, Home as HomeLine, Info as InfoLine, Library as LibraryLine, Link2 as Link2Line, ListEnd as ListEndLine,
  ListMinus as ListMinusLine, ListMusic as ListMusicLine, ListPlus as ListPlusLine, ListStart as ListStartLine, ListX as ListXLine, Lock as LockLine,
  Maximize2 as Maximize2Line, Mic2 as Mic2Line, Monitor as MonitorLine, MonitorSpeaker as MonitorSpeakerLine, Moon as MoonLine, MoreHorizontal as MoreHorizontalLine,
  Music2 as Music2Line, Palette as PaletteLine, Pause as PauseLine, Pencil as PencilLine, Pin as PinLine, Play as PlayLine,
  Plus as PlusLine, QrCode as QrCodeLine, Radio as RadioLine, RefreshCw as RefreshCwLine, Repeat as RepeatLine, Repeat1 as Repeat1Line,
  Save as SaveLine, Search as SearchLine, Settings as SettingsLine, Shuffle as ShuffleLine, SkipBack as SkipBackLine, SkipForward as SkipForwardLine,
  SlidersHorizontal as SlidersHorizontalLine, Smartphone as SmartphoneLine, Square as SquareLine, Trash2 as Trash2Line, User as UserLine, UserPlus as UserPlusLine,
  Volume1 as Volume1Line, Volume2 as Volume2Line, VolumeX as VolumeXLine, X as XLine,
  type LucideIcon, type LucideProps,
} from 'lucide-react';
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

/**
 * Lucide's drawings, by the page's names for them: imported by name, so the bundle carries these and not the
 * whole of Lucide's thousand and more.
 */
const LUCIDE: Record<Exclude<IconName, 'HeartFilled'>, LucideIcon> = {
  ArrowLeft: ArrowLeftLine, ArrowLeftRight: ArrowLeftRightLine, ArrowRight: ArrowRightLine, BookmarkCheck: BookmarkCheckLine, BookmarkPlus: BookmarkPlusLine, Check: CheckLine,
  ChevronDown: ChevronDownLine, ChevronUp: ChevronUpLine, ChevronsUp: ChevronsUpLine, CircleStop: CircleStopLine, Columns3: Columns3Line, Disc3: Disc3Line,
  Download: DownloadLine, ExternalLink: ExternalLinkLine, FileAudio: FileAudioLine, Globe: GlobeLine, GripVertical: GripVerticalLine, Headphones: HeadphonesLine,
  Heart: HeartLine, Home: HomeLine, Info: InfoLine, Library: LibraryLine, Link2: Link2Line, ListEnd: ListEndLine,
  ListMinus: ListMinusLine, ListMusic: ListMusicLine, ListPlus: ListPlusLine, ListStart: ListStartLine, ListX: ListXLine, Lock: LockLine,
  Maximize2: Maximize2Line, Mic2: Mic2Line, Monitor: MonitorLine, MonitorSpeaker: MonitorSpeakerLine, Moon: MoonLine, MoreHorizontal: MoreHorizontalLine,
  Music2: Music2Line, Palette: PaletteLine, Pause: PauseLine, Pencil: PencilLine, Pin: PinLine, Play: PlayLine,
  Plus: PlusLine, QrCode: QrCodeLine, Radio: RadioLine, RefreshCw: RefreshCwLine, Repeat: RepeatLine, Repeat1: Repeat1Line,
  Save: SaveLine, Search: SearchLine, Settings: SettingsLine, Shuffle: ShuffleLine, SkipBack: SkipBackLine, SkipForward: SkipForwardLine,
  SlidersHorizontal: SlidersHorizontalLine, Smartphone: SmartphoneLine, Square: SquareLine, Trash2: Trash2Line, User: UserLine, UserPlus: UserPlusLine,
  Volume1: Volume1Line, Volume2: Volume2Line, VolumeX: VolumeXLine, X: XLine,
};

/** The thin stroke of the Line set, in Lucide's 24-unit box. */
const LINE_STROKE = 1.25;

function make(name: IconName) {
  const Drawn = LUCIDE[name as Exclude<IconName, 'HeartFilled'>];
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
    const given: LucideProps = {};
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
