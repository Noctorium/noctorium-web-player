import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { send, usePart } from '../live';
import { cls, providerName, speedName } from '../util';
import { Confirm, Dialog, Prompt, QrDialog, Spinner, Switch } from '../components/Common';
import { closeDialog, openDialog } from '../ui';
import type { Account, Bandcamp, Provider, Service, Settings, Spotify, Vk } from '../types';
import { HOSTED } from '../mode';
import { HostedSettings } from '../hosted/Settings';
import { seekBarStyles } from '../seekbar';

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
          {seekBarStyles.map(([id, label]) => <button key={id} className={cls('chip', settings.progressBarStyle === id && 'on')} onClick={() => send('seekBar', { name: id })}>{label}</button>)}
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
        {settings.spotify ? <SpotifySettings spotify={settings.spotify} /> : (
          <Row title="Spotify library" detail={settings.spotifyConnected ? `Connected${settings.spotifyAccount ? ` as ${settings.spotifyAccount}` : ''}` : settings.spotifyConnecting ? 'Waiting for Spotify…' : 'Your Spotify playlists, played from YouTube Music and SoundCloud. Approve it in a browser on the computer running Noctorium.'}>
            {settings.spotifyConnected
              ? <button className="button small danger" onClick={() => send('signOut', { service: 'spotify' })}>Disconnect</button>
              : <button className="button small" onClick={() => send('spotify')}>Connect</button>}
          </Row>
        )}
        {settings.bandcamp && <BandcampSettings bandcamp={settings.bandcamp} />}
        {settings.vk && <VkSettings vk={settings.vk} />}
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
        <ListeningSettings settings={settings} />
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
        <Row title={`Noctorium ${settings.version}`} detail="YouTube Music, SoundCloud, Bandcamp, Spotify and VK in one library. Free software under the GPL-3.0.">
          <button className="button small" onClick={() => send('checkUpdates')}>Check for updates</button>
          <button className="button small" onClick={() => send('diagnostics')}>Diagnostics</button>
        </Row>
      </section>
    </div>
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
      <Row title="Spotify" detail={<><span className={cls('status', spotify.connected && 'connected')}>{status}</span> · {spotify.message ?? about}</>}>
        {spotify.connected
          ? <button className="button small danger" onClick={() => openDialog(<Confirm title="Disconnect Spotify?" detail="Your Spotify playlists leave the library, and its songs their hearts." action="Disconnect" danger yes={() => send('signOut', { service: 'spotify' })} />)}>Disconnect</button>
          : <button className="button small" disabled={spotify.connecting} onClick={() => send('spotify')}>Connect</button>}
        <button className="button small" disabled={spotify.connecting} onClick={() => send('spotifyPremium')}>{spotify.canPlay ? 'Sign in with Premium again' : 'Connect with Premium'}</button>
      </Row>
      {spotify.canPlay && (
        <Row title="Spotify songs play" detail={spotify.playsOnSpotify ? 'In your Spotify app, wherever it is open: Noctorium tells it what to play.' : 'Matched to the same recording on YouTube Music.'}>
          <Switch on={spotify.playsOnSpotify} change={(on) => send('spotifyPlayback', { onSpotify: on })} label="Play Spotify songs on Spotify" />
        </Row>
      )}
      {spotify.canPlay && (
        <Row title="Spotify plays on" detail={device ? `${device.name}${device.active ? ' · playing now' : ''}` : spotify.device ? 'The device chosen before, which Spotify does not list now' : 'Wherever Spotify is active'}>
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
    <Row title="VK Music" detail={<>
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
  const go = () => { closeDialog(); send('vkSignIn', { text: text.trim() }); };
  return (
    <Dialog title="Signing in to VK" buttons={<><button className="button" onClick={closeDialog}>Cancel</button><button className="button primary" disabled={!text.trim()} onClick={go}>Sign in</button></>}>
      {notice.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      <textarea className="field" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="p=…; remixsid=…" spellCheck={false} autoComplete="off" />
    </Dialog>
  );
}

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const fades: [number, string][] = [[0, 'Off'], [15, '15 s'], [30, '30 s'], [60, '60 s']];

/**
 * How it plays, kept by Noctorium on the computer: the speed, carrying on when the queue runs out, the sleep
 * timer's fade, and which services a search of every service asks.
 */
function ListeningSettings({ settings }: { settings: Settings }) {
  // Ticked here at once, so a second click before the first has come back is not undone by the stale list.
  const [asked, setAsked] = useState(settings.hybridSearch ?? []);
  useEffect(() => setAsked(settings.hybridSearch ?? []), [(settings.hybridSearch ?? []).join()]);
  const toggle = (provider: string) => {
    const on = !asked.includes(provider);
    // The last one stays: a search has to ask somebody, and Noctorium keeps one at least.
    if (!on && asked.length <= 1) return;
    setAsked(on ? [...asked, provider] : asked.filter((p) => p !== provider));
    send('hybridSearch', { provider, on });
  };
  const speed = settings.playbackSpeed ?? 1;
  return (
    <>
      <Row title="Speed" detail="Slower or faster, keeping the pitch.">
        <div className="chips" style={{ margin: 0 }}>
          {speeds.map((s) => <button key={s} className={cls('chip', Math.abs(speed - s) < 0.01 && 'on')} onClick={() => send('speed', { value: s })}>{speedName(s)}</button>)}
        </div>
      </Row>
      <Row title="Keep playing when the queue runs out" detail="Songs like the last one, as its own service would carry on.">
        <Switch on={settings.autoplay !== false} change={(on) => send('autoplay', { on })} label="Keep playing" />
      </Row>
      {settings.autoplaySources && (
        <Row title="Autoplay draws from" detail={settings.autoplaySources.find((s) => s.name === settings.autoplayFrom)?.description}>
          <div className="chips" style={{ margin: 0 }}>
            {settings.autoplaySources.map((s) => (
              <button key={s.name} className={cls('chip', settings.autoplayFrom === s.name && 'on')} onClick={() => send('autoplayFrom', { source: s.name })}>{s.title}</button>
            ))}
          </div>
        </Row>
      )}
      {settings.avoidRecent != null && (
        <Row title="Autoplay skips songs played lately" detail="So it does not bring back what was just heard.">
          <Switch on={settings.avoidRecent} change={(on) => send('avoidRecent', { on })} label="Skip songs played lately" />
        </Row>
      )}
      {settings.keepQueue != null && (
        <Row title="Keep the queue between launches" detail="Noctorium on the computer puts it back where it was left when it starts again.">
          <Switch on={settings.keepQueue} change={(on) => send('keepQueue', { on })} label="Keep the queue" />
        </Row>
      )}
      <Row title="The sleep timer fades out" detail="Over its last seconds, rather than stopping at once.">
        <div className="chips" style={{ margin: 0 }}>
          {fades.map(([seconds, label]) => <button key={seconds} className={cls('chip', (settings.sleepFade ?? 0) === seconds && 'on')} onClick={() => send('sleepFade', { seconds })}>{label}</button>)}
        </div>
      </Row>
      {settings.hybridServices && (
        <div className="setting" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="label"><strong>A search of every service asks</strong><small>Spotify only while its songs play on Spotify, and VK once signed in.</small></div>
          <div className="chips" style={{ margin: 0 }}>
            {settings.hybridServices.map((p) => (
              <button key={p} className={cls('chip', asked.includes(p) && 'on')} aria-pressed={asked.includes(p)} onClick={() => toggle(p)}>{providerName[p as Provider] ?? p}</button>
            ))}
          </div>
        </div>
      )}
    </>
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
