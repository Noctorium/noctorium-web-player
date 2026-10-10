import { useRef } from 'react';
import { ExternalLink } from '../icons';
import { live, send } from '../live';
import { Confirm, Prompt } from '../components/Common';
import { Row, serviceText } from '../pages/Settings';
import { openDialog } from '../ui';
import type { Settings } from '../types';

/*
 * What the hosted player's settings have of their own, in Settings' sections like every other setting: no
 * accounts to sign in to, ListenBrainz -- which a browser can tell what was played by itself -- and a library kept
 * in this browser that can be saved as a file and opened in another.
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

export function HostedListenBrainz({ settings }: { settings: Settings }) {
  return (
    <>
      <Row setting="listenbrainz" title="ListenBrainz" detail={serviceText(settings.listenbrainz)}>
        {settings.listenbrainz.status === 'connected' ? <button className="button small danger" onClick={() => send('signOut', { service: 'listenbrainz' })}>Disconnect</button>
          : <button className="button small" onClick={() => openDialog(<Prompt title="ListenBrainz" hint="Your user token, from listenbrainz.org/settings. It is kept in this browser and sent only to ListenBrainz." secret submit={(token) => send('listenbrainz', { token })} />)}>Connect</button>}
      </Row>
      {settings.scrobbles > 0 && <p className="muted" style={{ fontSize: 13 }}>{settings.scrobbles} sent to ListenBrainz this visit.</p>}
    </>
  );
}

export function HostedServices() {
  return (
    <Row setting="services-hosted" title="YouTube Music and SoundCloud" detail="This player plays both without signing in, and keeps your likes and playlists in this browser. Your own accounts — their likes, playlists and mixes, with every change made on the service — need Noctorium on your computer or phone, where their sign-in pages can be shown.">
      <a className="button small primary" href="https://noctorium.vercel.app" target="_blank" rel="noreferrer">Get Noctorium <ExternalLink size={13} /></a>
    </Row>
  );
}

export function HostedLibrary() {
  const picker = useRef<HTMLInputElement>(null);
  async function openFile(file?: File) {
    if (!file) return;
    try {
      send('importLibrary', { data: JSON.parse(await file.text()) });
    } catch {
      live.notice('That file is not a saved library', 'bad');
    }
  }
  return (
    <>
      <Row setting="library-save" title="Save your library as a file" detail="Your likes, playlists, pins and settings, to keep somewhere safe or to open in another browser.">
        <button className="button small" onClick={saveFile}>Save</button>
      </Row>
      <Row setting="library-open" title="Open a saved library" detail="Replaces what is here with what the file holds.">
        <input ref={picker} type="file" accept="application/json,.json" hidden onChange={(e) => { openFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="button small" onClick={() => picker.current?.click()}>Open…</button>
      </Row>
      <Row setting="forget" title="Forget everything" detail="Every like, playlist and setting this browser keeps for Noctorium.">
        <button className="button small danger" onClick={() => openDialog(<Confirm title="Forget everything?" detail="Save it as a file first if you might want it back." action="Forget it" danger yes={() => send('forgetEverything')} />)}>Forget</button>
      </Row>
    </>
  );
}

export function HostedAbout({ settings }: { settings: Settings }) {
  return (
    <Row setting="about" title={`Noctorium web player ${settings.version}`} detail="Free software under the GPL-3.0. Search and playlists are asked for through this site; the music comes straight from YouTube and SoundCloud to this browser, and YouTube's plays in YouTube's own player.">
      <a className="button small" href="https://github.com/Noctorium/noctorium-web-player" target="_blank" rel="noreferrer">Source <ExternalLink size={13} /></a>
    </Row>
  );
}
