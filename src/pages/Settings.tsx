import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ExternalLink, Headphones, Info, ListMusic, Monitor, Palette, Pause, Play, Search as SearchIcon, Shuffle,
  SkipForward, Smartphone, User, Globe, Heart,
} from '../icons';
import { send, usePart } from '../live';
import { go, useRoute } from '../router';
import { cls, providerName, speedName } from '../util';
import { Confirm, Dialog, Prompt, QrDialog, Spinner, Switch } from '../components/Common';
import { closeDialog, openDialog } from '../ui';
import type { Account, Bandcamp, Choice, Provider, Service, Settings, Spotify, Vk } from '../types';
import { HOSTED } from '../mode';
import { HostedAbout, HostedLibrary, HostedListenBrainz, HostedServices } from '../hosted/Settings';
import { seekBarStyles } from '../seekbar';
import { skinOf } from '../components/Skin';
import { BoostControl } from '../components/Volume';
import { Visualiser } from '../components/Visualiser';
import { BarPreview, LayoutPreview } from '../components/LookPreviews';
import { setLook, useLooks } from '../looks';
import { ICON_SET_NAMES } from '../icons';
import { HOME_PLAYS, ICON_SETS, NOW_PLAYING_LAYOUTS, PLAYER_BARS, QUEUE_COLUMNS, VISUALISER_STYLES, normalisedColumns } from '../base/looks';
import { ALL as BANGS, bangFor, type SearchMode } from '../base/searchBangs';
import { search as searchSettings, words, type SettingMatch } from '../base/settingsSearch';
import { SECTIONS, entriesFor, pagesFor, type Entry, type Page, type Section } from './settingsEntries';

const accents: Record<string, [string, string | null]> = {
  THEME: ['Theme’s own', null], VIOLET: ['Violet', '#b47cff'], MAGENTA: ['Magenta', '#ff6ec7'], EMBER: ['Ember', '#ff9757'],
  AZURE: ['Azure', '#5ab2ff'], MINT: ['Mint', '#5fe3b0'], ARTWORK: ['Match the artwork', null],
  // The listener's own colour, chosen on the desktop or the phone; the page shows it as the accent in force.
  CUSTOM: ['Your own', null],
};
const lyricSources = [['', 'Whichever has them'], ['LRCLIB', 'LRCLIB'], ['BETTER_LYRICS', 'Better Lyrics'], ['KARALYR', 'Karalyr'], ['SYNCLRC', 'SyncLRC'], ['LYRICS_OVH', 'lyrics.ovh'], ['MUSIXMATCH', 'Musixmatch'], ['HAPPI', 'Happi'], ['GENIUS', 'Genius']];

function statusText(account: Account) {
  switch (account.status) {
    case 'connected': return 'Signed in';
    case 'checking': return 'Checking…';
    case 'disconnected': return 'Not signed in';
    default: return account.detail ?? 'Needs attention';
  }
}

export function serviceText(service: Service) {
  switch (service.status) {
    case 'connected': return `Scrobbling as ${service.username ?? ''}`;
    case 'awaiting_approval': return 'Approve it in the tab that opened, then press Finish';
    case 'connecting': return 'Connecting…';
    case 'error': return service.message ?? 'Not working';
    default: return 'Not connected';
  }
}

function CookiesDialog({ service }: { service: 'youtube' | 'soundcloud' }) {
  const [text, setText] = useState('');
  return (
    <Dialog title={`${service === 'youtube' ? 'YouTube Music' : 'SoundCloud'} from cookies`}
      buttons={<><button className="button" onClick={closeDialog}>Cancel</button><button className="button primary" disabled={!text.trim()} onClick={() => { closeDialog(); send('cookies', { service, text }); }}>Sign in</button></>}>
      <p>Export the cookies from a browser that is signed in — a cookies.txt from an extension, or the Cookie header from its developer tools — and paste them here. They are checked with {service === 'youtube' ? 'YouTube' : 'SoundCloud'} and kept on the computer running Noctorium, nowhere else.</p>
      <textarea className="field" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="# Netscape HTTP Cookie File …" />
    </Dialog>
  );
}

function PhoneSignIn() {
  const signIn = usePart('signIn');
  useEffect(() => {
    if (signIn?.state === 'done') closeDialog();
  }, [signIn?.state]);
  if (signIn?.state !== 'waiting' || !signIn.code) {
    return <Dialog title="Sign in with your phone" buttons={<button className="button" onClick={() => { closeDialog(); send('cancelSignIn'); }}>Cancel</button>}>
      {signIn?.state === 'failed' ? <p>{signIn.message}</p> : signIn?.state === 'checking' ? <p>Checking the session with YouTube…</p> : <Spinner />}
    </Dialog>;
  }
  return (
    <QrDialog title="Sign in with your phone" text={signIn.code} onClose={() => send('cancelSignIn')}>
      <p>On your phone: Noctorium → Settings → YouTube Music → <b>Sign in a computer</b>, then point it at this code. The phone hands its session over your own network, encrypted.</p>
    </QrDialog>
  );
}

/**
 * One setting: its name and what it does, and its controls. [setting] is its name in settingsEntries.ts, which the
 * search finds it by, jumps to and lights up. A wide one has its controls under the words rather than beside them.
 */
export function Row({ setting, title, detail, children, wide }: { setting: string; title: string; detail?: ReactNode; children?: ReactNode; wide?: boolean }) {
  return (
    // No inline style on these: a Windows skin takes a row whose controls are one styled box for a download's
    // progress bar.
    <div className={cls('setting', wide && 'wide')} data-setting={setting}>
      <div className="label"><strong>{title}</strong>{detail && <small>{detail}</small>}</div>
      <div className="actions">{children}</div>
    </div>
  );
}

/** A setting drawn as a block of its own -- the themes, the accents -- under a heading, found by the search all the same. */
function Block({ setting, title, children }: { setting: string; title: string; children: ReactNode }) {
  return (
    <div className="setting-block" data-setting={setting}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** Choices drawn as cards with what each does, for the looks whose names alone say little. */
function Cards({ choices, chosen, choose, extra }: { choices: Choice[]; chosen?: string; choose: (name: string) => void; extra?: (choice: Choice) => ReactNode }) {
  return (
    <div className="choice-cards" role="radiogroup">
      {choices.map((c) => (
        <button key={c.name} role="radio" aria-checked={chosen === c.name} className={cls('choice-card', chosen === c.name && 'on')} onClick={() => choose(c.name)}>
          {extra?.(c)}
          {chosen === c.name && <span className="tick"><Check size={14} /></span>}
          <strong>{c.title}</strong>
          {c.description && <small>{c.description}</small>}
        </button>
      ))}
    </div>
  );
}

function Chips({ choices, chosen, choose }: { choices: [string, string][]; chosen?: string; choose: (name: string) => void }) {
  return (
    <div className="chips flush">
      {choices.map(([id, label]) => <button key={id} className={cls('chip', chosen === id && 'on')} onClick={() => choose(id)}>{label}</button>)}
    </div>
  );
}

const sectionIcons: Record<Section, ReactNode> = {
  You: <User size={15} />, Look: <Palette size={15} />, Listening: <Headphones size={15} />, Services: <Globe size={15} />,
  'This device': HOSTED ? <Smartphone size={15} /> : <Monitor size={15} />, About: <Info size={15} />,
};

/**
 * Settings: sections along the top -- You, Look, Listening, Services, This device, About -- the longer ones in
 * pages, and over them a search box that finds any setting by its name, by what it does, or by the other words
 * people use for it, jumps to it and lights it up. The same in the hosted player, with what it has.
 */
export function SettingsPage() {
  const settings = usePart('settings');
  const route = useRoute();
  const pages = pagesFor(HOSTED);
  const page = pages.find((p) => p.id === route.arg) ?? pages.find((p) => p.id === 'look-theme')!;
  const sections = SECTIONS.filter((s) => pages.some((p) => p.section === s));
  const inSection = pages.filter((p) => p.section === page.section);
  const wanted = route.query.get('setting');

  // The setting a search chose, brought into view and lit up for a moment once its page is drawn.
  useLayoutEffect(() => {
    if (!wanted || !settings) return;
    const element = document.querySelector<HTMLElement>(`[data-setting="${CSS.escape(wanted)}"]`);
    if (!element) return;
    // A tall one -- the themes -- from its top, so its name is in sight; anything else in the middle.
    const room = element.closest('.content')?.clientHeight ?? window.innerHeight;
    element.scrollIntoView({ block: element.offsetHeight > room * 0.6 ? 'start' : 'center' });
    element.classList.remove('found');
    void element.offsetWidth;
    element.classList.add('found');
    const timer = window.setTimeout(() => element.classList.remove('found'), 2600);
    return () => window.clearTimeout(timer);
  }, [wanted, page.id, !!settings]);

  if (!settings) return <div style={{ padding: 60, display: 'grid', placeItems: 'center' }}><Spinner /></div>;
  return (
    <div className="settings">
      <div className="settings-head">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle" style={{ margin: 0 }}>{HOSTED ? 'Kept in this browser, like everything else here.' : 'Kept by the Noctorium on the computer serving this page — the terminal player there sees the same.'}</p>
        <SettingsSearchBox />
        <nav className="settings-sections" aria-label="Sections">
          {sections.map((s) => (
            <button key={s} className={cls('chip', page.section === s && 'on')} aria-current={page.section === s ? 'page' : undefined}
              onClick={() => go(`/settings/${pages.find((p) => p.section === s)!.id}`, true)}>
              {sectionIcons[s]} {s}
            </button>
          ))}
        </nav>
        {inSection.length > 1 && (
          <nav className="settings-pages" aria-label={page.section}>
            {inSection.map((p) => (
              <button key={p.id} className={cls(p.id === page.id && 'on')} aria-current={p.id === page.id ? 'page' : undefined} onClick={() => go(`/settings/${p.id}`, true)}>{p.title}</button>
            ))}
          </nav>
        )}
      </div>
      <PageContent page={page} settings={settings} />
    </div>
  );
}

/** The search box, its matches under it as it is typed; Enter or a click goes to the setting. */
function SettingsSearchBox() {
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => searchSettings(text, entriesFor(HOSTED)).slice(0, 8), [text]);
  useEffect(() => setChosen(0), [text]);
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setText(''); };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, []);
  const open = (match: SettingMatch) => {
    const entry = match.entry as Entry;
    setText('');
    go(`/settings/${entry.page}?setting=${encodeURIComponent(entry.id)}`, true);
  };
  return (
    <div className="settings-search" ref={box}>
      <form className="searchbox" role="search" onSubmit={(e) => { e.preventDefault(); if (matches[chosen]) open(matches[chosen]); }}>
        <SearchIcon size={18} />
        <input
          value={text}
          placeholder="Find a setting — “dark mode”, “louder”, “columns”"
          aria-label="Find a setting"
          aria-expanded={!!text.trim()}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setChosen((c) => Math.min(c + 1, matches.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setChosen((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Escape') setText('');
            if (e.key === 'Enter') { e.preventDefault(); if (matches[chosen]) open(matches[chosen]); }
          }}
        />
      </form>
      {text.trim() && (
        <div className="settings-results" role="listbox">
          {matches.length ? matches.map((m, i) => (
            <button key={m.entry.id} role="option" aria-selected={i === chosen} className={cls(i === chosen && 'on')} onMouseEnter={() => setChosen(i)} onClick={() => open(m)}>
              <strong><Marked text={m.entry.title} query={text} /></strong>
              <small>{m.entry.section}{m.keyword ? <> · “<Marked text={m.keyword} query={text} />”</> : m.kind >= 3 && m.entry.description ? <> · {m.entry.description}</> : null}</small>
            </button>
          )) : <div className="none">No setting goes by “{text.trim()}”.</div>}
        </div>
      )}
    </div>
  );
}

/** [text] with the words that begin with what was typed marked, as the search matched them. */
function Marked({ text, query }: { text: string; query: string }) {
  const typed = words(query);
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        const word = words(part)[0];
        return word && typed.some((t) => word.startsWith(t)) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** A page of settings, in a section titled with the page's name, which a Windows skin draws as a group box's. */
function PageContent({ page, settings }: { page: Page; settings: Settings }) {
  return (
    <section>
      <h2 className="legend">{page.title}</h2>
      <PageSettings page={page.id} settings={settings} />
    </section>
  );
}

function PageSettings({ page, settings }: { page: string; settings: Settings }) {
  switch (page) {
    case 'you': return HOSTED ? <HostedListenBrainz settings={settings} /> : <YouSettings settings={settings} />;
    case 'look-theme': return <ThemeSettings settings={settings} />;
    case 'look-player': return <PlayerSettings settings={settings} />;
    case 'look-now-playing': return <NowPlayingSettings />;
    case 'listening-playback': return <PlaybackSettings settings={settings} />;
    case 'listening-sound': return <SoundSettings settings={settings} />;
    case 'listening-search': return <SearchSettings settings={settings} />;
    case 'services': return HOSTED ? <HostedServices /> : <ServicesSettings settings={settings} />;
    case 'device': return HOSTED ? <HostedLibrary /> : <DeviceSettings settings={settings} />;
    case 'about': return HOSTED ? <HostedAbout settings={settings} /> : <AboutSettings settings={settings} />;
    default: return null;
  }
}

// ------------------------------------------------------------------ You

function YouSettings({ settings }: { settings: Settings }) {
  const account = usePart('account');
  return (
    <>
      <Row setting="account" title="Noctorium account" detail={account?.signedIn ? `Signed in as ${account.name || account.email} · ${account.streams.toLocaleString()} listens` : 'Optional: counts your listening, and lets Connect find your devices.'}>
        {account?.signedIn ? <button className="button small danger" onClick={() => send('signOut', { service: 'noctorium' })}>Sign out</button>
          : <button className="button small" onClick={() => openDialog(<NoctoriumLogIn />)}>Sign in</button>}
      </Row>
      <Row setting="lastfm" title="Last.fm" detail={serviceText(settings.lastfm)}>
        {settings.lastfm.status === 'connected' ? <button className="button small danger" onClick={() => send('signOut', { service: 'lastfm' })}>Disconnect</button>
          : settings.lastfm.status === 'awaiting_approval' ? <button className="button small primary" onClick={() => send('lastfmFinish')}>Finish</button>
            : <button className="button small" onClick={() => send('lastfm')}>Connect</button>}
      </Row>
      <Row setting="listenbrainz" title="ListenBrainz" detail={serviceText(settings.listenbrainz)}>
        {settings.listenbrainz.status === 'connected' ? <button className="button small danger" onClick={() => send('signOut', { service: 'listenbrainz' })}>Disconnect</button>
          : <button className="button small" onClick={() => openDialog(<Prompt title="ListenBrainz" hint="Your user token, from listenbrainz.org/settings." secret submit={(token) => send('listenbrainz', { token })} />)}>Connect</button>}
      </Row>
      {settings.scrobbles > 0 && <p className="muted" style={{ fontSize: 13 }}>{settings.scrobbles} scrobbled this session.</p>}
    </>
  );
}

// ------------------------------------------------------------------ Look

/** The theme, the accent, the clock and the animations: the same in every Noctorium, hosted or not. */
function ThemeSettings({ settings }: { settings: Settings }) {
  const skinned = !!skinOf(settings);
  return (
    <>
      <Block setting="theme" title="Theme">
        <div className="themes">
          {settings.themes.map((t) => (
            <button key={t.name} className={cls('theme', settings.theme === t.name && 'on')} style={{ background: t.card, color: t.text }} onClick={() => send('theme', { name: t.name })}>
              <div className="swatch"><i style={{ background: t.background }} /><i style={{ background: t.panel }} /><i style={{ background: t.card }} /><i style={{ background: t.accent }} /></div>
              {t.title}
              <small>{t.family}</small>
            </button>
          ))}
        </div>
      </Block>
      <Row setting="taskbar-clock" title="Show the clock" detail={skinned ? 'The time at the right end of the taskbar, in its tray. Off for a screen whose own taskbar already shows it.' : 'In the tray of the taskbar the 98 and XP themes draw; choose one of them to see it.'}>
        <Switch on={settings.taskbarClock !== false} change={(on) => send('taskbarClock', { on })} label="Show the clock" />
      </Row>
      <Block setting="accent" title="Accent">
        <div className="chips">
          {settings.accents.map((a) => (
            <button key={a} className={cls('chip', settings.accent === a && 'on')} onClick={() => send('accent', { name: a })}>
              {accents[a]?.[1] && <span style={{ width: 12, height: 12, borderRadius: '50%', background: accents[a][1]! }} />}
              {accents[a]?.[0] ?? a}
            </button>
          ))}
        </div>
      </Block>
      <Row setting="animations" title="Animations" detail="Pages ease in and covers lift. Off makes every change instant.">
        <Switch on={settings.animations} change={(on) => send('animations', { on })} label="Animations" />
      </Row>
    </>
  );
}

const iconSamples = [Play, Pause, SkipForward, Shuffle, Heart, ListMusic];

function PlayerSettings({ settings }: { settings: Settings }) {
  const looks = useLooks();
  // Noctorium sends every seek bar it has; a Noctorium from before Slider does not, and this page's list stands in.
  const bars = settings.progressBarStyles?.length ? settings.progressBarStyles.map((c) => [c.name, c.title] as [string, string]) : seekBarStyles;
  const sets = settings.iconSets?.length ? settings.iconSets.map((c) => ({ ...c, description: c.description || ICON_SETS.find((s) => s.name === c.name)?.description })) : ICON_SETS;
  return (
    <>
      <Block setting="player-bar" title="Player bar">
        <Cards choices={PLAYER_BARS} chosen={looks.playerBar} choose={(name) => setLook('playerBar', name)} extra={(c) => <BarPreview name={c.name} />} />
        <p className="setting-note">Kept in this browser, so a phone and a computer can each have their own.</p>
      </Block>
      <Row setting="stop-button" title="Stop button" detail="Stop on the Centred bar too, after Next: pause, and back to the start of the song. The Toolbar always has one.">
        <Switch on={looks.stopButton} change={(on) => setLook('stopButton', on)} label="Stop button" />
      </Row>
      <Block setting="seek-bar" title="Seek bar">
        <Chips choices={bars} chosen={settings.progressBarStyle} choose={(name) => send('seekBar', { name })} />
      </Block>
      <Row setting="time-display" title="The figure on the right of the seek bar">
        <Chips choices={[['TOTAL', 'Total length'], ['REMAINING', 'Time left']]} chosen={settings.timeDisplay} choose={(name) => send('timeDisplay', { name })} />
      </Row>
      <Block setting="icons" title="Icons">
        <Cards
          choices={ICON_SET_NAMES.map((name) => sets.find((s) => s.name === name) ?? { name, title: name })}
          chosen={looks.iconSet}
          choose={(name) => setLook('iconSet', name)}
          extra={(c) => <span className="icon-sample" aria-hidden>{iconSamples.map((Icon, i) => <Icon key={i} size={20} set={c.name} fill={i < 3 ? 'currentColor' : undefined} />)}</span>}
        />
        <p className="setting-note">Standard and Line are Lucide (ISC); the others are Material Icons (Apache 2.0), in the styles the desktop and the phone draw them in.</p>
      </Block>
    </>
  );
}

function NowPlayingSettings() {
  const looks = useLooks();
  const settings = usePart('settings');
  const playing = usePart('playback')?.status === 'playing';
  const styles = settings?.visualiserStyles?.length ? settings.visualiserStyles : VISUALISER_STYLES;
  const chosen = VISUALISER_STYLES.find((s) => s.name === looks.visualiser);
  return (
    <>
      <Block setting="now-playing-layout" title="Now playing layout">
        <Cards choices={NOW_PLAYING_LAYOUTS} chosen={looks.nowPlaying} choose={(name) => setLook('nowPlaying', name)} extra={(c) => <LayoutPreview name={c.name} />} />
        <p className="setting-note">Kept in this browser, as the player bar is.</p>
      </Block>
      <Row setting="visualiser" title="Visualiser" wide detail={`${chosen?.description ?? ''} It shows the real sound, where the page can hear it; it says so where it cannot.`}>
        <Chips choices={styles.map((s) => [s.name, s.title])} chosen={looks.visualiser} choose={(name) => setLook('visualiser', name)} />
        {/* Measured only while it is on the screen, and shown only while there is something to measure. */}
        {looks.visualiser !== 'OFF' && playing && <Visualiser className="preview" />}
      </Row>
      <Row setting="queue-columns" title="Queue columns" wide detail="The Playlist layout’s table: tick the columns it has, and move them into the order you want. The title is always there.">
        <ColumnsEditor />
      </Row>
      <Row setting="status-bar" title="Status bar" detail="Along the foot of the Playlist layout: the stream’s format as far as it is known, and how far into the queue it is, of how long the queue is.">
        <Switch on={looks.statusBar} change={(on) => setLook('statusBar', on)} label="Status bar" />
      </Row>
    </>
  );
}

/** The queue table's columns: each ticked on or off, and moved up or down; the title stays. */
function ColumnsEditor() {
  const looks = useLooks();
  const chosen = looks.queueColumns;
  const all = [...chosen, ...QUEUE_COLUMNS.map((c) => c.name).filter((c) => !chosen.includes(c))];
  const save = (columns: string[]) => setLook('queueColumns', normalisedColumns(columns));
  const move = (column: string, by: number) => {
    const at = chosen.indexOf(column);
    const to = at + by;
    if (at < 0 || to < 0 || to >= chosen.length) return;
    const next = chosen.slice();
    [next[at], next[to]] = [next[to], next[at]];
    save(next);
  };
  return (
    <div className="columns-editor">
      {all.map((column) => {
        const on = chosen.includes(column);
        const meta = QUEUE_COLUMNS.find((c) => c.name === column)!;
        return (
          <div key={column} className={cls('column', !on && 'off')}>
            <input type="checkbox" checked={on} disabled={column === 'TITLE'} aria-label={meta.title}
              onChange={() => save(on ? chosen.filter((c) => c !== column) : [...chosen, column])} />
            <span>{meta.title}{meta.heading !== meta.title ? <small className="faint"> · “{meta.heading}”</small> : null}</span>
            <button className="round-button" aria-label={`Move ${meta.title} up`} disabled={!on || chosen.indexOf(column) === 0} onClick={() => move(column, -1)}><ArrowLeft size={15} style={{ transform: 'rotate(90deg)' }} /></button>
            <button className="round-button" aria-label={`Move ${meta.title} down`} disabled={!on || chosen.indexOf(column) === chosen.length - 1} onClick={() => move(column, 1)}><ArrowRight size={15} style={{ transform: 'rotate(90deg)' }} /></button>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Listening

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const fades: [number, string][] = [[0, 'Off'], [15, '15 s'], [30, '30 s'], [60, '60 s']];

/** How it plays: the speed, carrying on when the queue runs out, a song from Home, the queue, the sleep timer, lyrics. */
function PlaybackSettings({ settings }: { settings: Settings }) {
  const speed = settings.playbackSpeed ?? 1;
  const homePlays = settings.homePlays?.length ? settings.homePlays : HOME_PLAYS;
  return (
    <>
      {!HOSTED && (
        <Row setting="speed" title="Speed" detail="Slower or faster, keeping the pitch.">
          <div className="chips" style={{ margin: 0 }}>
            {speeds.map((s) => <button key={s} className={cls('chip', Math.abs(speed - s) < 0.01 && 'on')} onClick={() => send('speed', { value: s })}>{speedName(s)}</button>)}
          </div>
        </Row>
      )}
      <Row setting="autoplay" title="Keep playing when the queue runs out" detail={HOSTED ? 'Songs like the last one, from the same service, as its own radio would play them.' : 'Songs like the last one, as its own service would carry on.'}>
        <Switch on={settings.autoplay !== false} change={(on) => send('autoplay', { on })} label="Keep playing" />
      </Row>
      {settings.autoplaySources && (
        <Row setting="autoplay-from" title="Autoplay draws from" detail={settings.autoplaySources.find((s) => s.name === settings.autoplayFrom)?.description}>
          <Chips choices={settings.autoplaySources.map((s) => [s.name, s.title])} chosen={settings.autoplayFrom} choose={(source) => send('autoplayFrom', { source })} />
        </Row>
      )}
      {settings.avoidRecent != null && (
        <Row setting="avoid-recent" title="Autoplay skips songs played lately" detail="So it does not bring back what was just heard.">
          <Switch on={settings.avoidRecent} change={(on) => send('avoidRecent', { on })} label="Skip songs played lately" />
        </Row>
      )}
      {(HOSTED || settings.homePlay != null) && (
        <Row setting="home-play" title="Playing a song from Home" wide
          detail={<>{homePlays.find((c) => c.name === (settings.homePlay ?? 'AUTOPLAY'))?.description} {settings.autoplay === false ? <b>With autoplay off, Home plays the rest of the shelf whatever this says.</b> : 'With autoplay off, Home plays the rest of the shelf whatever this says.'}</>}>
          <Chips choices={homePlays.map((c) => [c.name, c.title])} chosen={settings.homePlay ?? 'AUTOPLAY'} choose={(name) => send('homePlay', { name })} />
        </Row>
      )}
      {settings.keepQueue != null && (
        <Row setting="keep-queue" title="Keep the queue between launches" detail="Noctorium on the computer puts it back where it was left when it starts again.">
          <Switch on={settings.keepQueue} change={(on) => send('keepQueue', { on })} label="Keep the queue" />
        </Row>
      )}
      {!HOSTED && (
        <Row setting="sleep-fade" title="The sleep timer fades out" detail="Over its last seconds, rather than stopping at once.">
          <Chips choices={fades.map(([s, label]) => [String(s), label])} chosen={String(settings.sleepFade ?? 0)} choose={(s) => send('sleepFade', { seconds: Number(s) })} />
        </Row>
      )}
      <Row setting="lyrics" title="Lyrics from" detail="Every source is still asked; this one is shown first when it has them.">
        <select className="select" value={settings.lyricsProvider ?? ''} onChange={(e) => send('lyricsProvider', { provider: e.target.value || null })}>
          {(HOSTED ? lyricSources.filter(([id]) => ['', 'LRCLIB', 'KARALYR', 'LYRICS_OVH', 'GENIUS'].includes(id)) : lyricSources).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Row>
    </>
  );
}

function SoundSettings({ settings }: { settings: Settings }) {
  return (
    <>
      <Row setting="booster" title="Volume booster" wide detail="Louder than full, from 100% to 1000% — ten times the sound — always behind a limiter, so it gets loud rather than broken. The volume button shows it while it is on. It works where Noctorium makes the sound: the computer, or this browser; not YouTube’s own player, nor Spotify’s app.">
        <BoostControl />
      </Row>
      {!HOSTED && (
        <Row setting="skip-non-music" title="Skip what is not the music in YouTube videos" detail="Intros, outros, sponsor reads and talking, as marked by SponsorBlock's contributors.">
          <Switch on={settings.skipNonMusic} change={(on) => send('skipNonMusic', { on })} label="Skip non-music" />
        </Row>
      )}
    </>
  );
}

const bangModes: [SearchMode, string][] = HOSTED
  ? [['YOUTUBE_MUSIC', 'YouTube Music'], ['YOUTUBE_VIDEO', 'YouTube videos'], ['SOUNDCLOUD', 'SoundCloud'], ['HYBRID', 'Both']]
  : [['YOUTUBE_MUSIC', 'YouTube Music'], ['YOUTUBE_VIDEO', 'YouTube videos'], ['SOUNDCLOUD', 'SoundCloud'], ['SPOTIFY', 'Spotify'], ['BANDCAMP', 'Bandcamp'], ['VK', 'VK Music'], ['HYBRID', 'Every service']];

function SearchSettings({ settings }: { settings: Settings }) {
  return (
    <>
      {settings.hybridServices && <HybridSearch settings={settings} />}
      <Row setting="bangs" title="Bangs" wide detail="Start or end a search with one of these to search that service alone, whatever the search page is set to: “!sc daft punk”, or “daft punk !sc”. The search box says where it is going as you type.">
        <div className="bangs">
          {bangModes.map(([mode, name]) => (
            <span key={mode} className="bang">
              <code>{[...BANGS].filter(([, m]) => m === mode).map(([b]) => `!${b}`).sort((a, b) => a.length - b.length).join('  ')}</code>
              <span>{name}</span>
            </span>
          ))}
        </div>
        <small className="faint">The shortest of each is {bangModes.map(([m]) => bangFor(m)).join(', ')}.</small>
      </Row>
    </>
  );
}

/** Which services a search of every service asks; ticked here at once, so a quick second click is not undone. */
function HybridSearch({ settings }: { settings: Settings }) {
  const [asked, setAsked] = useState(settings.hybridSearch ?? []);
  useEffect(() => setAsked(settings.hybridSearch ?? []), [(settings.hybridSearch ?? []).join()]);
  const toggle = (provider: string) => {
    const on = !asked.includes(provider);
    // The last one stays: a search has to ask somebody, and Noctorium keeps one at least.
    if (!on && asked.length <= 1) return;
    setAsked(on ? [...asked, provider] : asked.filter((p) => p !== provider));
    send('hybridSearch', { provider, on });
  };
  return (
    <Row setting="hybrid-search" title="A search of every service asks" wide detail="Spotify only while its songs play on Spotify, and VK once signed in.">
      <div className="chips" style={{ margin: 0 }}>
        {(settings.hybridServices ?? []).map((p) => (
          <button key={p} className={cls('chip', asked.includes(p) && 'on')} aria-pressed={asked.includes(p)} onClick={() => toggle(p)}>{providerName[p as Provider] ?? p}</button>
        ))}
      </div>
    </Row>
  );
}

// ------------------------------------------------------------------ Services, this device, about

function ServicesSettings({ settings }: { settings: Settings }) {
  const likes = usePart('likes');
  const yt = settings.youtube;
  const sc = settings.soundcloud;
  return (
    <>
      <Row setting="youtube" title="YouTube Music" detail={<><span className={cls('status', yt.status)}>{statusText(yt)}</span>{settings.youtubeChannel && yt.status === 'connected' ? ` as ${settings.youtubeChannel}` : ''}{yt.hint ? ` · ${yt.hint}` : ''}</>}>
        {settings.desktopYouTube && <button className="button small primary" onClick={() => send('copyDesktop', { service: 'youtube' })}>Use the desktop app’s sign-in</button>}
        <button className="button small" onClick={() => { send('phoneSignIn'); openDialog(<PhoneSignIn />); }}>With your phone</button>
        <button className="button small" onClick={() => openDialog(<CookiesDialog service="youtube" />)}>From cookies</button>
        {yt.status === 'connected' && <button className="button small" onClick={() => { send('channels'); openDialog(<Channels />); }}>Channel</button>}
        {yt.status === 'connected' && <button className="button small danger" onClick={() => openDialog(<Confirm title="Sign out of YouTube Music here?" detail="Your other devices stay signed in." action="Sign out" danger yes={() => send('signOut', { service: 'youtube' })} />)}>Sign out</button>}
      </Row>
      <Row setting="soundcloud" title="SoundCloud" detail={<><span className={cls('status', sc.status)}>{statusText(sc)}</span>{settings.soundCloudUsername ? ` as ${settings.soundCloudUsername}` : ''}{sc.status === 'connected' && !likes?.soundCloudReady ? ' · liking is not ready yet' : ''}</>}>
        {settings.desktopSoundCloud && <button className="button small primary" onClick={() => send('copyDesktop', { service: 'soundcloud' })}>Use the desktop app’s sign-in</button>}
        <button className="button small" onClick={() => openDialog(<CookiesDialog service="soundcloud" />)}>From cookies</button>
        <button className="button small" onClick={() => openDialog(<Prompt title="Your SoundCloud profile" hint="The name in soundcloud.com/<name>, which is how SoundCloud finds your playlists." initial={settings.soundCloudUsername} submit={(name) => send('soundCloudUsername', { name })} />)}>Profile name</button>
        {sc.status === 'connected' && <button className="button small danger" onClick={() => openDialog(<Confirm title="Sign out of SoundCloud here?" action="Sign out" danger yes={() => send('signOut', { service: 'soundcloud' })} />)}>Sign out</button>}
      </Row>
      {settings.spotify ? <SpotifySettings spotify={settings.spotify} /> : (
        <Row setting="spotify" title="Spotify library" detail={settings.spotifyConnected ? `Connected${settings.spotifyAccount ? ` as ${settings.spotifyAccount}` : ''}` : settings.spotifyConnecting ? 'Waiting for Spotify…' : 'Your Spotify playlists, played from YouTube Music and SoundCloud. Approve it in a browser on the computer running Noctorium.'}>
          {settings.spotifyConnected
            ? <button className="button small danger" onClick={() => send('signOut', { service: 'spotify' })}>Disconnect</button>
            : <button className="button small" onClick={() => send('spotify')}>Connect</button>}
        </Row>
      )}
      {settings.bandcamp && <BandcampSettings bandcamp={settings.bandcamp} />}
      {settings.vk && <VkSettings vk={settings.vk} />}
      <Row setting="youtube-history" title="Add what plays here to your YouTube history" detail="So YouTube Music’s own recommendations follow it.">
        <Switch on={settings.youtubeHistory} change={(on) => send('youtubeHistory', { on })} label="YouTube history" />
      </Row>
    </>
  );
}

function DeviceSettings({ settings }: { settings: Settings }) {
  return (
    <>
      <Row setting="downloads-folder" title="Downloads are saved to" detail={settings.exportFolder ?? 'Not set'}>
        <button className="button small" onClick={() => openDialog(<Prompt title="Downloads folder" hint="A folder on the computer running Noctorium." initial={settings.exportFolder ?? ''} submit={(path) => send('exportFolder', { path })} />)}>Change</button>
      </Row>
      <Row setting="discord" title="Show what is playing on Discord" detail="From the computer running Noctorium, when Discord is open there.">
        <Switch on={settings.discord} change={(on) => send('discord', { on })} label="Discord" />
      </Row>
    </>
  );
}

function AboutSettings({ settings }: { settings: Settings }) {
  return (
    <>
      <Row setting="about" title={`Noctorium ${settings.version}`} detail="YouTube Music, SoundCloud, Bandcamp, Spotify and VK in one library. Free software under the GPL-3.0.">
        <button className="button small" onClick={() => send('checkUpdates')}>Check for updates</button>
        <button className="button small" onClick={() => send('diagnostics')}>Diagnostics</button>
        <a className="button small" href="https://github.com/Noctorium/noctorium-web-player" target="_blank" rel="noreferrer">Source <ExternalLink size={13} /></a>
      </Row>
    </>
  );
}

/**
 * Spotify's two sign-ins. Any account gives the library, likes, search and two rows of Home, its songs played
 * matched on YouTube Music; Premium also lets the account's own Spotify app play them, wherever it is open, and
 * then which device does is chosen here. Either sign-in opens Spotify's page in a browser on the computer
 * running Noctorium, because that is where Spotify sends its answer.
 */
function SpotifySettings({ spotify }: { spotify: Spotify }) {
  // Where Spotify is open changes from minute to minute, so it is asked again each time this is shown.
  useEffect(() => { if (spotify.canPlay) send('spotifyDevices'); }, [spotify.canPlay]);
  const device = spotify.devices.find((d) => d.id === spotify.device);
  const status = spotify.connecting ? 'Waiting for Spotify…'
    : spotify.connected ? `Connected${spotify.account ? ` as ${spotify.account}` : ''}${spotify.canPlay ? ' · Premium' : ''}` : 'Not connected';
  const about = spotify.connected
    ? 'Your playlists, likes and search, and two rows on Home.'
    : 'Any account: your playlists, likes and search, its songs played from YouTube Music. Approved in a browser on the computer running Noctorium.';
  return (
    <>
      <Row setting="spotify" title="Spotify" detail={<><span className={cls('status', spotify.connected && 'connected')}>{status}</span> · {spotify.message ?? about}</>}>
        {spotify.connected
          ? <button className="button small danger" onClick={() => openDialog(<Confirm title="Disconnect Spotify?" detail="Your Spotify playlists leave the library, and its songs their hearts." action="Disconnect" danger yes={() => send('signOut', { service: 'spotify' })} />)}>Disconnect</button>
          : <button className="button small" disabled={spotify.connecting} onClick={() => send('spotify')}>Connect</button>}
        <button className="button small" disabled={spotify.connecting} onClick={() => send('spotifyPremium')}>{spotify.canPlay ? 'Sign in with Premium again' : 'Connect with Premium'}</button>
      </Row>
      {spotify.canPlay && (
        <Row setting="spotify-playback" title="Spotify songs play" detail={spotify.playsOnSpotify ? 'In your Spotify app, wherever it is open: Noctorium tells it what to play.' : 'Matched to the same recording on YouTube Music.'}>
          <Switch on={spotify.playsOnSpotify} change={(on) => send('spotifyPlayback', { onSpotify: on })} label="Play Spotify songs on Spotify" />
        </Row>
      )}
      {spotify.canPlay && (
        <Row setting="spotify-device" title="Spotify plays on" detail={device ? `${device.name}${device.active ? ' · playing now' : ''}` : spotify.device ? 'The device chosen before, which Spotify does not list now' : 'Wherever Spotify is active'}>
          <select className="select" value={spotify.device} onChange={(e) => send('spotifyDevice', { id: e.target.value })}>
            <option value="">Wherever Spotify is active</option>
            {spotify.devices.map((d) => <option key={d.id} value={d.id} disabled={d.restricted}>{d.name}{d.type ? ` · ${d.type}` : ''}{d.restricted ? ' · takes no commands' : ''}</option>)}
            {spotify.device && !device && <option value={spotify.device}>The device chosen before</option>}
          </select>
          <button className="button small" onClick={() => send('spotifyDevices')}>Look again</button>
        </Row>
      )}
    </>
  );
}

/**
 * VK, through a browser's vk.ru session: VK offers no music to other apps, so what that means is said before the
 * two cookies are asked for, every time. Core checks them with VK before keeping them.
 */
function VkSettings({ vk }: { vk: Vk }) {
  const status = vk.checking ? 'Checking with VK…' : vk.connected ? `Signed in as ${vk.account}` : 'Not signed in';
  return (
    <Row setting="vk" title="VK Music" detail={<>
      <span className={cls('status', vk.connected && !vk.checking && 'connected')}>{status}</span>
      {vk.message ? ` · ${vk.message}` : !vk.connected ? ' · Through a signed-in browser’s vk.ru session; what that means is said first.' : ''}
    </>}>
      <button className="button small" disabled={vk.checking} onClick={() => openDialog(<VkSignIn notice={vk.notice} />)}>{vk.connected ? 'Sign in again' : 'Sign in'}</button>
      {vk.connected && <button className="button small danger" onClick={() => openDialog(<Confirm title="Sign out of VK here?" detail="The session is forgotten on the computer running Noctorium; nothing changes at VK." action="Sign out" danger yes={() => send('signOut', { service: 'vk' })} />)}>Sign out</button>}
    </Row>
  );
}

function VkSignIn({ notice }: { notice: string[] }) {
  const [text, setText] = useState('');
  const sign = () => { closeDialog(); send('vkSignIn', { text: text.trim() }); };
  return (
    <Dialog title="Signing in to VK" buttons={<><button className="button" onClick={closeDialog}>Cancel</button><button className="button primary" disabled={!text.trim()} onClick={sign}>Sign in</button></>}>
      {notice.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      <textarea className="field" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="p=…; remixsid=…" spellCheck={false} autoComplete="off" />
    </Dialog>
  );
}

/**
 * Bandcamp, which is a name rather than a sign-in: Bandcamp shows a fan's collection and wishlist to anybody, so
 * the name in their address is all it takes. Noctorium checks it with Bandcamp before keeping it, and says so
 * here. Under it, the genres Home has a row of Bandcamp's best-sellers for.
 */
function BandcampSettings({ bandcamp }: { bandcamp: Bandcamp }) {
  // Ticked here at once and sent whole each time, so a second tick before the first has come back is not lost.
  const [genres, setGenres] = useState(bandcamp.genres);
  useEffect(() => setGenres(bandcamp.genres), [bandcamp.genres.join()]);
  const toggle = (name: string) => {
    const next = genres.includes(name) ? genres.filter((g) => g !== name) : [...genres, name];
    setGenres(next);
    send('bandcampGenres', { genres: next });
  };
  const named = bandcamp.username !== '';
  const who = bandcamp.fanName && bandcamp.fanName.toLowerCase() !== bandcamp.username.toLowerCase() ? `${bandcamp.fanName} · ` : '';
  const status = bandcamp.checking ? 'Checking with Bandcamp…' : named ? `${who}bandcamp.com/${bandcamp.username}` : 'Not set';
  const desktop = bandcamp.desktop && bandcamp.desktop.toLowerCase() !== bandcamp.username.toLowerCase() ? bandcamp.desktop : undefined;
  return (
    <>
      <Row setting="bandcamp" title="Bandcamp collection" detail={<>
        <span className={cls('status', named && !bandcamp.checking && 'connected')}>{status}</span>
        {bandcamp.message ? ` · ${bandcamp.message}` : !named ? ' · What you bought there and your wishlist, in the library. Not a sign-in: a collection is public.' : ''}
      </>}>
        {desktop && <button className="button small primary" onClick={() => send('copyDesktop', { service: 'bandcamp' })}>Use “{desktop}” from the desktop app</button>}
        <button className="button small" disabled={bandcamp.checking} onClick={() => openDialog(
          <Prompt title="Your Bandcamp" hint="The name at the end of your Bandcamp address, bandcamp.com/<name> — or the address itself." initial={bandcamp.username} submit={(name) => send('bandcampUsername', { name })} />,
        )}>{named ? 'Change' : 'Your name'}</button>
        {named && <button className="button small danger" onClick={() => openDialog(
          <Confirm title="Take your Bandcamp collection out of the library?" detail="Nothing changes on Bandcamp; the name is forgotten here." action="Take it out" danger yes={() => send('bandcampUsername', { name: '' })} />,
        )}>Remove</button>}
      </Row>
      <Row setting="bandcamp-genres" title="Bandcamp on Home" wide detail="Its best-selling songs and new releases, and a row of best-sellers for each genre picked here.">
        <div className="chips" style={{ margin: 0 }}>
          {bandcamp.allGenres.map((g) => (
            <button key={g.name} className={cls('chip', genres.includes(g.name) && 'on')} aria-pressed={genres.includes(g.name)} onClick={() => toggle(g.name)}>{g.title}</button>
          ))}
        </div>
      </Row>
    </>
  );
}

function Channels() {
  const likes = usePart('likes');
  return (
    <Dialog title="Which channel Noctorium acts as" buttons={<button className="button" onClick={closeDialog}>Done</button>}>
      {!likes?.channels.length ? <Spinner /> : likes.channels.map((c) => (
        <button key={c.pageId} className="setting" style={{ width: '100%', textAlign: 'left' }} onClick={() => { send('channel', { pageId: c.pageId, name: c.name, authUser: c.authUser, photoUrl: c.photoUrl }); closeDialog(); }}>
          {c.photoUrl && <img src={c.photoUrl} alt="" width={36} height={36} style={{ borderRadius: '50%' }} />}
          <div className="label"><strong>{c.name}</strong><small>{c.handle}</small></div>
          {c.selected && <Check size={18} />}
        </button>
      ))}
    </Dialog>
  );
}

function NoctoriumLogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const sign = () => { closeDialog(); send('noctoriumLogIn', { email, password }); };
  return (
    <Dialog title="Your Noctorium account" buttons={<><button className="button" onClick={closeDialog}>Cancel</button><button className="button primary" disabled={!email || !password} onClick={sign}>Sign in</button></>}>
      <p>The optional account that counts your listening and lets Connect find your devices. Not your Google or SoundCloud password.</p>
      <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 10 }} />
      <input className="field" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && email && password) sign(); }} />
    </Dialog>
  );
}
