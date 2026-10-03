import { useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { live, send, usePart } from '../live';
import { Confirm, Prompt, Spinner, Switch } from '../components/Common';
import { LookSettings, Row, serviceText } from '../pages/Settings';
import { openDialog } from '../ui';
import { lyricSources } from './lyrics';

/*
 * Settings for the hosted player: the look, which is every Noctorium's, and what this player has of its own --
 * no accounts to sign in to, a library kept in this browser that can be saved as a file and opened in another,
 * and ListenBrainz, which a browser can tell what was played by itself.
 */

function saveFile() {
  const text = live.hosted<string>((engine) => engine.exportLibrary());
  if (!text) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = `noctorium-library-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

export function HostedSettings() {
  const settings = usePart('settings');
  const picker = useRef<HTMLInputElement>(null);
  if (!settings) return <div style={{ padding: 60, display: 'grid', placeItems: 'center' }}><Spinner /></div>;

  async function openFile(file?: File) {
    if (!file) return;
    try {
      send('importLibrary', { data: JSON.parse(await file.text()) });
    } catch {
      live.notice('That file is not a saved library', 'bad');
    }
  }

  return (
    <div className="settings">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Kept in this browser, like everything else here.</p>

      <section>
        <h2>Accounts</h2>
        <Row title="YouTube Music and SoundCloud" detail="This player plays both without signing in, and keeps your likes and playlists in this browser. Your own accounts — their likes, playlists and mixes, with every change made on the service — need Noctorium on your computer or phone, where their sign-in pages can be shown.">
          <a className="button small primary" href="https://noctorium.vercel.app" target="_blank" rel="noreferrer">Get Noctorium <ExternalLink size={13} /></a>
        </Row>
        <Row title="ListenBrainz" detail={serviceText(settings.listenbrainz)}>
          {settings.listenbrainz.status === 'connected' ? <button className="button small danger" onClick={() => send('signOut', { service: 'listenbrainz' })}>Disconnect</button>
            : <button className="button small" onClick={() => openDialog(<Prompt title="ListenBrainz" hint="Your user token, from listenbrainz.org/settings. It is kept in this browser and sent only to ListenBrainz." secret submit={(token) => send('listenbrainz', { token })} />)}>Connect</button>}
        </Row>
        {settings.scrobbles > 0 && <p className="muted" style={{ fontSize: 13 }}>{settings.scrobbles} sent to ListenBrainz this visit.</p>}
      </section>

      <LookSettings settings={settings} />

      <section>
        <h2>Playing</h2>
        <Row title="Keep playing when the queue runs out" detail="Songs like the last one, from the same service, as its own radio would play them.">
          <Switch on={settings.autoplay !== false} change={(on) => send('autoplay', { on })} label="Keep playing" />
        </Row>
        <Row title="Lyrics from" detail="Every source is still asked; this one is shown first when it has them.">
          <select className="select" value={settings.lyricsProvider ?? ''} onChange={(e) => send('lyricsProvider', { provider: e.target.value || null })}>
            <option value="">Whichever has them</option>
            {lyricSources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Row>
      </section>

      <section>
        <h2>Your library</h2>
        <Row title="Save it as a file" detail="Your likes, playlists, pins and settings, to keep somewhere safe or to open in another browser.">
          <button className="button small" onClick={saveFile}>Save</button>
        </Row>
        <Row title="Open a saved library" detail="Replaces what is here with what the file holds.">
          <input ref={picker} type="file" accept="application/json,.json" hidden onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="button small" onClick={() => picker.current?.click()}>Open…</button>
        </Row>
        <Row title="Forget everything" detail="Every like, playlist and setting this browser keeps for Noctorium.">
          <button className="button small danger" onClick={() => openDialog(<Confirm title="Forget everything?" detail="Save it as a file first if you might want it back." action="Forget it" danger yes={() => send('forgetEverything')} />)}>Forget</button>
        </Row>
      </section>

      <section>
        <h2>About</h2>
        <Row title={`Noctorium web player ${settings.version}`} detail="Free software under the GPL-3.0. Search and playlists are asked for through this site; the music comes straight from YouTube and SoundCloud to this browser, and YouTube's plays in YouTube's own player.">
          <a className="button small" href="https://github.com/Noctorium/noctorium-web-player" target="_blank" rel="noreferrer">Source <ExternalLink size={13} /></a>
        </Row>
      </section>
    </div>
  );
}
