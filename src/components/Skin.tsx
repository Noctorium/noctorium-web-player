import { useEffect, useState, type MouseEvent, type ReactElement } from 'react';
import { Disc3, Download, Home, Library, ListMusic, Mic2, MonitorSpeaker, Music2, Search, Settings } from 'lucide-react';
import { send, usePart } from '../live';
import { HOSTED } from '../mode';
import { go } from '../router';
import { cls } from '../util';
import { closeNowPlaying, openMenu, openNowPlaying, useUi } from '../ui';

/*
 * The two themes that are more than colours. Base's Windows 98 and XP themes carry a skin -- 98's bevelled grey
 * slabs, navy title bars and teal desktop; XP's rounded blue Luna and its green start button -- which every player
 * draws in its own way. Here the page is dressed by skins.css, from a class on the root, and these are the few
 * pieces a stylesheet cannot add by itself: the window's title bar, the start button and its menu, and the clock
 * in the tray. Only Noctorium's own name and mark are used, never Microsoft's.
 */

export type Skin = '98' | 'xp';

export function skinOf(theme?: string): Skin | undefined {
  return theme === 'WINDOWS_98' ? '98' : theme === 'WINDOWS_XP' ? 'xp' : undefined;
}

export function useSkin(): Skin | undefined {
  return skinOf(usePart('settings')?.theme);
}

/** The bar across the top of a window: what plays, as "Song - Noctorium", and the three buttons, drawn only. */
export function WindowTitle() {
  const track = usePart('playback')?.track;
  return (
    <div className="window-title" aria-hidden>
      <img src="/noctorium.png" alt="" />
      <span className="ellipsis">{track ? `${track.title} - Noctorium` : 'Noctorium'}</span>
      <span className="captions"><i className="minimise" /><i className="maximise" /><i className="close" /></span>
    </div>
  );
}

/** Where the start menu goes: everywhere the sidebar goes, the playlists, and the now playing screen. */
function StartMenu() {
  const library = usePart('library');
  const page = (path: string) => () => { closeNowPlaying(); go(path); };
  const lists = [
    ...(library?.playlists ?? []).map((p) => ({ id: p.key, title: p.title, open: () => { closeNowPlaying(); send('openPlaylist', { key: p.key }); go(`/playlist/${encodeURIComponent(p.key)}`); } })),
    ...(library?.local ?? []).map((p) => ({ id: p.id, title: p.title, open: page(`/local/${encodeURIComponent(p.id)}`) })),
  ].slice(0, 8);
  return (
    <div className="start-menu">
      <div className="start-banner"><img src="/noctorium.png" alt="" /><span>Noctorium</span></div>
      <div className="start-columns">
        <div className="start-main">
          <button onClick={() => openNowPlaying('queue')}><Music2 size={22} /> Now playing</button>
          <button onClick={() => openNowPlaying('lyrics')}><Mic2 size={22} /> Lyrics</button>
          <hr />
          <button onClick={page('/')}><Home size={22} /> Home</button>
          <button onClick={page('/search')}><Search size={22} /> Search</button>
          <button onClick={page('/library')}><Library size={22} /> Library</button>
          <button onClick={page('/queue')}><ListMusic size={22} /> Queue</button>
          {!HOSTED && <button onClick={page('/downloads')}><Download size={22} /> Downloads</button>}
          {!HOSTED && <button onClick={page('/devices')}><MonitorSpeaker size={22} /> Devices</button>}
        </div>
        {lists.length > 0 && (
          <div className="start-places">
            {lists.map((l) => <button key={l.id} onClick={l.open}><Disc3 size={22} /><span className="ellipsis">{l.title}</span></button>)}
          </div>
        )}
      </div>
      {/* Where 98 had Shut Down and XP Turn Off, at the foot. */}
      <div className="start-foot"><button onClick={page('/settings')}><Settings size={22} /> Settings</button></div>
    </div>
  );
}

/** The start button at the left of the taskbar, which is the player bar's bottom row; it opens the start menu. */
export function StartButton() {
  const { menu } = useUi();
  const open = (menu?.content as ReactElement | undefined)?.type === StartMenu;
  const start = (e: MouseEvent<HTMLButtonElement>) => {
    // On the taskbar's top edge at the screen's left, where a start menu opens. Layers opens a menu with no room
    // below its point upwards, from 44 pixels above the point, as from a button that tall; so the point is 44 below.
    const player = e.currentTarget.closest('.player')?.getBoundingClientRect();
    const taskbar = parseFloat(getComputedStyle(e.currentTarget).getPropertyValue('--taskbar')) || 30;
    openMenu({ clientX: 0, clientY: (player ? player.bottom - taskbar : e.clientY) + 44 }, <StartMenu />);
  };
  return (
    <button className={cls('start-button', open && 'open')} aria-haspopup="menu" aria-expanded={open} onClick={start}>
      <img src="/noctorium.png" alt="" /><span>Noctorium</span>
    </button>
  );
}

/** The clock in the tray, to the minute, in the listener's own way of writing the time. */
export function TrayClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);
  return <time className="tray-clock" dateTime={now.toISOString()}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>;
}
