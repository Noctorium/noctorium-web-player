import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { send, usePart } from '../live';
import { cls } from '../util';
import { Confirm, Dialog, Prompt, QrDialog, Spinner, Switch } from '../components/Common';
import { closeDialog, openDialog } from '../ui';
import type { Account, Bandcamp, Service, Settings } from '../types';
import { HOSTED } from '../mode';
import { HostedSettings } from '../hosted/Settings';

const seekBars = [['MINIMAL', 'Minimal'], ['MATERIAL', 'Material'], ['WAVE', 'Wave'], ['SEGMENTS', 'Segments'], ['CAPSULE', 'Capsule'], ['CLASSIC', 'Classic']];
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

export function Row({ title, detail, children }: { title: string; detail?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="setting">
      <div className="label"><strong>{title}</strong>{detail && <small>{detail}</small>}</div>
      <div className="actions">{children}</div>
    </div>
  );
}

/** The theme, the accent and the seek bar: the same in every Noctorium, hosted or not. */
export function LookSettings({ settings }: { settings: Settings }) {
  return (
      <section>
        <h2>Theme</h2>
        <div className="themes">
          {settings.themes.map((t) => (
            <button key={t.name} className={cls('theme', settings.theme === t.name && 'on')} style={{ background: t.card, color: t.text }} onClick={() => send('theme', { name: t.name })}>
              <div className="swatch"><i style={{ background: t.background }} /><i style={{ background: t.panel }} /><i style={{ background: t.card }} /><i style={{ background: t.accent }} /></div>
              {t.title.startsWith(t.family) ? t.title : t.title}
              <small>{t.family}</small>
            </button>
          ))}
        </div>
        <h2>Accent</h2>
        <div className="chips">
          {settings.accents.map((a) => (
            <button key={a} className={cls('chip', settings.accent === a && 'on')} onClick={() => send('accent', { name: a })}>
              {accents[a]?.[1] && <span style={{ width: 12, height: 12, borderRadius: '50%', background: accents[a][1]! }} />}
              {accents[a]?.[0] ?? a}
            </button>
          ))}
        </div>
        <h2>Seek bar</h2>
        <div className="chips">
          {seekBars.map(([id, label]) => <button key={id} className={cls('chip', settings.progressBarStyle === id && 'on')} onClick={() => send('seekBar', { name: id })}>{label}</button>)}
        </div>
        <Row title="The figure on the right of the seek bar">
          <div className="chips" style={{ margin: 0 }}>
            {[['TOTAL', 'Total length'], ['REMAINING', 'Time left']].map(([id, label]) => <button key={id} className={cls('chip', settings.timeDisplay === id && 'on')} onClick={() => send('timeDisplay', { name: id })}>{label}</button>)}
          </div>
        </Row>
        <Row title="Animations" detail="Pages ease in and covers lift. Off makes every change instant.">
          <Switch on={settings.animations} change={(on) => send('animations', { on })} label="Animations" />
        </Row>
      </section>
  );
}

export function SettingsPage() {
  // A constant of the build, so the hooks below are always either all called or never.
  if (HOSTED) return <HostedSettings />;
  const settings = usePart('settings');
  const likes = usePart('likes');
  const account = usePart('account');
  const playback = usePart('playback');
  if (!settings) return <div style={{ padding: 60, display: 'grid', placeItems: 'center' }}><Spinner /></div>;
  const yt = settings.youtube;
  const sc = settings.soundcloud;
  return (
    <div className="settings">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Kept by the Noctorium on the computer serving this page — the terminal player there sees the same.</p>

      <section>
        <h2>Accounts</h2>
        <Row title="YouTube Music" detail={<><span className={cls('status', yt.status)}>{statusText(yt)}</span>{settings.youtubeChannel && yt.status === 'connected' ? ` as ${settings.youtubeChannel}` : ''}{yt.hint ? ` · ${yt.hint}` : ''}</>}>
          {settings.desktopYouTube && <button className="button small primary" onClick={() => send('copyDesktop', { service: 'youtube' })}>Use the desktop app’s sign-in</button>}
          <button className="button small" onClick={() => { send('phoneSignIn'); openDialog(<PhoneSignIn />); }}>With your phone</button>
          <button className="button small" onClick={() => openDialog(<CookiesDialog service="youtube" />)}>From cookies</button>
          {yt.status === 'connected' && <button className="button small" onClick={() => { send('channels'); openDialog(<Channels />); }}>Channel</button>}
          {yt.status === 'connected' && <button className="button small danger" onClick={() => openDialog(<Confirm title="Sign out of YouTube Music here?" detail="Your other devices stay signed in." action="Sign out" danger yes={() => send('signOut', { service: 'youtube' })} />)}>Sign out</button>}
        </Row>
        <Row title="SoundCloud" detail={<><span className={cls('status', sc.status)}>{statusText(sc)}</span>{settings.soundCloudUsername ? ` as ${settings.soundCloudUsername}` : ''}{sc.status === 'connected' && !likes?.soundCloudReady ? ' · liking is not ready yet' : ''}</>}>
          {settings.desktopSoundCloud && <button className="button small primary" onClick={() => send('copyDesktop', { service: 'soundcloud' })}>Use the desktop app’s sign-in</button>}
          <button className="button small" onClick={() => openDialog(<CookiesDialog service="soundcloud" />)}>From cookies</button>
          <button className="button small" onClick={() => openDialog(<Prompt title="Your SoundCloud profile" hint="The name in soundcloud.com/<name>, which is how SoundCloud finds your playlists." initial={settings.soundCloudUsername} submit={(name) => send('soundCloudUsername', { name })} />)}>Profile name</button>
          {sc.status === 'connected' && <button className="button small danger" onClick={() => openDialog(<Confirm title="Sign out of SoundCloud here?" action="Sign out" danger yes={() => send('signOut', { service: 'soundcloud' })} />)}>Sign out</button>}
        </Row>
        <Row title="Spotify library" detail={settings.spotifyConnected ? `Connected${settings.spotifyAccount ? ` as ${settings.spotifyAccount}` : ''}` : settings.spotifyConnecting ? 'Waiting for Spotify…' : 'Your Spotify playlists, played from YouTube Music and SoundCloud. Approve it in a browser on the computer running Noctorium.'}>
          {settings.spotifyConnected
            ? <button className="button small danger" onClick={() => send('signOut', { service: 'spotify' })}>Disconnect</button>
            : <button className="button small" onClick={() => send('spotify')}>Connect</button>}
        </Row>
        {settings.bandcamp && <BandcampSettings bandcamp={settings.bandcamp} />}
        <Row title="Last.fm" detail={serviceText(settings.lastfm)}>
          {settings.lastfm.status === 'connected' ? <button className="button small danger" onClick={() => send('signOut', { service: 'lastfm' })}>Disconnect</button>
            : settings.lastfm.status === 'awaiting_approval' ? <button className="button small primary" onClick={() => send('lastfmFinish')}>Finish</button>
              : <button className="button small" onClick={() => send('lastfm')}>Connect</button>}
        </Row>
        <Row title="ListenBrainz" detail={serviceText(settings.listenbrainz)}>
          {settings.listenbrainz.status === 'connected' ? <button className="button small danger" onClick={() => send('signOut', { service: 'listenbrainz' })}>Disconnect</button>
            : <button className="button small" onClick={() => openDialog(<Prompt title="ListenBrainz" hint="Your user token, from listenbrainz.org/settings." secret submit={(token) => send('listenbrainz', { token })} />)}>Connect</button>}
        </Row>
        <Row title="Noctorium account" detail={account?.signedIn ? `Signed in as ${account.name || account.email} · ${account.streams.toLocaleString()} listens` : 'Optional: counts your listening, and lets Connect find your devices.'}>
          {account?.signedIn ? <button className="button small danger" onClick={() => send('signOut', { service: 'noctorium' })}>Sign out</button>
            : <button className="button small" onClick={() => openDialog(<NoctoriumLogIn />)}>Sign in</button>}
        </Row>
        {settings.scrobbles > 0 && <p className="muted" style={{ fontSize: 13 }}>{settings.scrobbles} scrobbled this session.</p>}
      </section>

      <LookSettings settings={settings} />

      <section>
        <h2>Playing</h2>
        <Row title="Skip what is not the music in YouTube videos" detail="Intros, outros, sponsor reads and talking, as marked by SponsorBlock's contributors.">
          <Switch on={settings.skipNonMusic} change={(on) => send('skipNonMusic', { on })} label="Skip non-music" />
        </Row>
        <Row title="Add what plays here to your YouTube history" detail="So YouTube Music's own recommendations follow it.">
          <Switch on={settings.youtubeHistory} change={(on) => send('youtubeHistory', { on })} label="YouTube history" />
        </Row>
        <Row title="Volume boost" detail="Above full, on the computer's speakers. A browser's own volume stops at full.">
          <Switch on={!!playback?.boost} change={() => send('boost')} label="Volume boost" />
        </Row>
        <Row title="Lyrics from" detail="Every source is still asked; this one is shown first when it has them.">
          <select className="select" value={settings.lyricsProvider ?? ''} onChange={(e) => send('lyricsProvider', { provider: e.target.value || null })}>
            {lyricSources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Row>
        <Row title="Show what is playing on Discord" detail="From the computer running Noctorium, when Discord is open there.">
          <Switch on={settings.discord} change={(on) => send('discord', { on })} label="Discord" />
        </Row>
        <Row title="Downloads are saved to" detail={settings.exportFolder ?? 'Not set'}>
          <button className="button small" onClick={() => openDialog(<Prompt title="Downloads folder" hint="A folder on the computer running Noctorium." initial={settings.exportFolder ?? ''} submit={(path) => send('exportFolder', { path })} />)}>Change</button>
        </Row>
      </section>

      <section>
        <h2>About</h2>
        <Row title={`Noctorium ${settings.version}`} detail="YouTube Music, SoundCloud and Bandcamp in one library. Free software under the GPL-3.0.">
          <button className="button small" onClick={() => send('checkUpdates')}>Check for updates</button>
          <button className="button small" onClick={() => send('diagnostics')}>Diagnostics</button>
        </Row>
      </section>
    </div>
  );
}

/**
 * Bandcamp, which is a name rather than a sign-in: Bandcamp shows a fan's collection and wishlist to anybody, so
 * the name in their address is all it takes. Noctorium checks it with Bandcamp before keeping it, and says so
 * here. Below it, the genres Home has a row of Bandcamp's best-sellers for.
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
      <Row title="Bandcamp collection" detail={<>
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
      <div className="setting" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="label"><strong>Bandcamp on Home</strong><small>Its best-selling songs and new releases, and a row of best-sellers for each genre picked here.</small></div>
        <div className="chips" style={{ margin: 0 }}>
          {bandcamp.allGenres.map((g) => (
            <button key={g.name} className={cls('chip', genres.includes(g.name) && 'on')} aria-pressed={genres.includes(g.name)} onClick={() => toggle(g.name)}>{g.title}</button>
          ))}
        </div>
      </div>
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
  const go = () => { closeDialog(); send('noctoriumLogIn', { email, password }); };
  return (
    <Dialog title="Your Noctorium account" buttons={<><button className="button" onClick={closeDialog}>Cancel</button><button className="button primary" disabled={!email || !password} onClick={go}>Sign in</button></>}>
      <p>The optional account that counts your listening and lets Connect find your devices. Not your Google or SoundCloud password.</p>
      <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 10 }} />
      <input className="field" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && email && password) go(); }} />
    </Dialog>
  );
}
