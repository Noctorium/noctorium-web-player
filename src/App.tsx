import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Home as HomeIcon, Library as LibraryIcon, ListMusic, MonitorSpeaker, Search as SearchIcon, Settings as SettingsIcon } from 'lucide-react';
import { live, send, useLive, usePart } from './live';
import { go, useRoute } from './router';
import { cls } from './util';
import { Badge, Layers } from './components/Common';
import { MediaSession, PlayerBar } from './components/Player';
import { NowPlaying } from './components/NowPlaying';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Library, LocalPage, PlaylistPage } from './pages/Library';
import { DevicesPage, DownloadsPage, QueuePage } from './pages/Other';
import { SettingsPage } from './pages/Settings';
import { closeNowPlaying, openNowPlaying, useUi } from './ui';

const pages = [
  ['home', 'Home', HomeIcon],
  ['search', 'Search', SearchIcon],
  ['library', 'Library', LibraryIcon],
  ['queue', 'Queue', ListMusic],
  ['downloads', 'Downloads', Download],
  ['devices', 'Devices', MonitorSpeaker],
  ['settings', 'Settings', SettingsIcon],
] as const;

/** The theme's colours on the page, so every Noctorium theme is this page's theme too. */
function useTheme() {
  const settings = usePart('settings');
  const playback = usePart('playback');
  useLayoutEffect(() => {
    const c = settings?.colours;
    if (!c) return;
    const root = document.documentElement;
    root.style.setProperty('--bg', c.background);
    root.style.setProperty('--panel', c.panel);
    root.style.setProperty('--card', c.card);
    root.style.setProperty('--text', c.text);
    root.style.setProperty('--subtext', c.subtext);
    root.style.setProperty('--accent', c.accent);
    root.style.setProperty('--on-accent', luminance(c.accent) > 0.6 ? '#111111' : '#ffffff');
    root.classList.toggle('light', c.light);
    root.classList.toggle('no-motion', settings.animations === false);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.panel);
  }, [settings?.colours, settings?.animations]);
  useEffect(() => {
    const t = playback?.track;
    document.title = t ? `${t.title} · ${t.artistLine} — Noctorium` : 'Noctorium';
  }, [playback?.track?.key]);
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Space, the arrows and a few letters, wherever the page is, except while typing. */
function useKeys() {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const playback = live.state.playback;
      switch (e.key) {
        case ' ': e.preventDefault(); send('toggle'); break;
        case 'ArrowRight': if (playback?.track) send('seek', { positionMs: Math.min(playback.positionMs + (e.shiftKey ? 30000 : 5000), playback.durationMs - 500) }); break;
        case 'ArrowLeft': if (playback?.track) send('seek', { positionMs: Math.max(0, playback.positionMs - (e.shiftKey ? 30000 : 5000)) }); break;
        case 'n': send('next'); break;
        case 'p': send('previous'); break;
        case 's': send('shuffle'); break;
        case 'r': send('repeat'); break;
        case 'm': send('mute'); break;
        case 'l': if (playback?.track) send('like', { track: playback.track }); break;
        case '/': e.preventDefault(); document.querySelector<HTMLInputElement>('.searchbox input')?.focus(); break;
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
}

function Sidebar() {
  const route = useRoute();
  const library = usePart('library');
  return (
    <aside className="sidebar">
      <div className="brand"><img src="/noctorium.png" alt="" /> NOCTORIUM</div>
      {pages.map(([id, label, Icon]) => (
        <button key={id} className={cls('nav-item', route.page === id && 'active')} onClick={() => { closeNowPlaying(); go(id === 'home' ? '/' : `/${id}`); }}>
          <Icon size={20} /> {label}
        </button>
      ))}
      <div className="sidebar-heading">Playlists</div>
      <div className="sidebar-lists">
        {library?.playlists.map((p) => (
          <button key={p.key} className={cls('sidebar-list', route.page === 'playlist' && route.arg === p.key && 'active')}
            onClick={() => { closeNowPlaying(); send('openPlaylist', { key: p.key }); go(`/playlist/${encodeURIComponent(p.key)}`); }}>
            {p.artworkUrl ? <img src={p.artworkUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="art" style={{ background: 'var(--card)' }} />}
            <span>{p.title}</span>
            <span style={{ marginLeft: 'auto' }}><Badge provider={p.provider} /></span>
          </button>
        ))}
        {library?.local.map((p) => (
          <button key={p.id} className={cls('sidebar-list', route.page === 'local' && route.arg === p.id && 'active')}
            onClick={() => { closeNowPlaying(); go(`/local/${encodeURIComponent(p.id)}`); }}>
            <span className="art" style={{ background: 'var(--card)' }} />
            <span>{p.title}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function TopBar() {
  const route = useRoute();
  const connection = useLive((l) => l.connection);
  const [text, setText] = useState(route.page === 'search' ? route.query.get('q') ?? '' : '');
  const timer = useRef<number>(0);
  useEffect(() => { if (route.page === 'search') setText(route.query.get('q') ?? ''); }, [route]);

  function typed(value: string) {
    setText(value);
    window.clearTimeout(timer.current);
    // Search as it is typed, a moment after the typing stops, and replace rather than stack the history.
    timer.current = window.setTimeout(() => {
      const q = value.trim();
      if (/^https?:\/\//.test(q)) return;
      if (q) go(`/search?q=${encodeURIComponent(q)}`, route.page === 'search');
    }, 350);
  }

  function submit() {
    const q = text.trim();
    if (!q) return;
    if (/^https?:\/\//.test(q) || /^(music\.youtube\.com|soundcloud\.com|youtu\.be)/.test(q)) {
      send('openLink', { text: q }).then((e) => !e && live.notice('Opening the link…'));
      return;
    }
    closeNowPlaying();
    go(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="topbar">
      <button className="round-button" aria-label="Back" onClick={() => history.back()}><ArrowLeft size={20} /></button>
      <button className="round-button" aria-label="Forward" onClick={() => history.forward()}><ArrowRight size={20} /></button>
      <form className="searchbox" onSubmit={(e) => { e.preventDefault(); submit(); }} role="search">
        <SearchIcon size={18} />
        <input value={text} onChange={(e) => typed(e.target.value)} placeholder="Songs, artists, playlists — or paste a link" aria-label="Search" />
      </form>
      <span className="connection">
        <span className={cls('dot', connection !== 'open' && 'off')} />
        <span>{connection === 'open' ? 'Connected' : connection === 'connecting' ? 'Connecting…' : 'Reconnecting…'}</span>
      </span>
    </header>
  );
}

function TabBar() {
  const route = useRoute();
  const { nowPlaying } = useUi();
  return (
    <nav className="tabbar">
      {pages.filter(([id]) => ['home', 'search', 'library', 'queue', 'settings'].includes(id)).map(([id, label, Icon]) => (
        <button key={id} className={cls(route.page === id && !nowPlaying && 'active')} onClick={() => { closeNowPlaying(); go(id === 'home' ? '/' : `/${id}`); }}>
          <Icon size={21} /> {label}
        </button>
      ))}
    </nav>
  );
}

function Notices() {
  const notices = useLive((l) => l.notices);
  return (
    <div className="notices" aria-live="polite">
      {notices.map((n) => <div key={n.id} className={cls('notice', n.tone)}>{n.text}</div>)}
    </div>
  );
}

function Page() {
  const route = useRoute();
  switch (route.page) {
    case 'search': return <Search />;
    case 'library': return <Library />;
    case 'playlist': return <PlaylistPage />;
    case 'local': return <LocalPage />;
    case 'queue': return <QueuePage />;
    case 'downloads': return <DownloadsPage />;
    case 'devices': return <DevicesPage />;
    case 'settings': return <SettingsPage />;
    case 'now-playing': openNowPlaying(); return <Home />;
    default: return <Home />;
  }
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gate">
      <div>
        <img src="/noctorium.png" alt="" />
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function App() {
  useTheme();
  useKeys();
  const connection = useLive((l) => l.connection);
  const hasState = useLive((l) => !!l.state.settings);
  const { nowPlaying } = useUi();
  const route = useRoute();

  if (connection === 'unauthorised') {
    return (
      <Gate title="This needs the link with the key">
        Open the address <code>noctorium web</code> printed — it ends in <code>?key=…</code> — or scan the code it showed with your phone.
        Anyone on the network can reach this page; only someone with the key can use it.
      </Gate>
    );
  }
  if (!hasState) return <Gate title="Noctorium">{connection === 'closed' ? 'Noctorium is not answering. Is noctorium web still running?' : 'Connecting…'}</Gate>;

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <TopBar />
        <div className="content" key={route.page + (route.arg ?? '')}><Page /></div>
      </main>
      {nowPlaying && <NowPlaying />}
      <PlayerBar />
      <TabBar />
      <Notices />
      <Layers />
      <MediaSession />
    </div>
  );
}
