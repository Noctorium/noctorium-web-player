import { useEffect, useState } from 'react';
import { Download, ListMusic, ListX, Monitor, MonitorSpeaker, QrCode, RefreshCw, Save, Shuffle, Smartphone, Trash2, Repeat } from 'lucide-react';
import { live, send, usePart } from '../live';
import { audio } from '../audio';
import { cls, plural, totalTime } from '../util';
import { Confirm, Empty, Prompt, QrDialog, Spinner, Switch } from '../components/Common';
import { TrackList } from '../components/Tracks';
import { openDialog } from '../ui';
import { HOSTED } from '../mode';
import type { AutoplayState, Queue } from '../types';

export function QueuePage() {
  const queue = usePart('queue');
  if (!queue?.tracks.length) return <Empty icon={<ListMusic size={44} />} title="The queue is empty">Play something and it fills up; the ⋯ menu adds to it.</Empty>;
  const next = queue.tracks.length - queue.currentIndex - 1;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="page-title">Queue</h1>
        <span className="muted" style={{ marginTop: 14 }}>{plural(queue.tracks.length, 'track')} · {totalTime(queue.tracks)}</span>
        <span style={{ flex: 1 }} />
        <button className={cls('button small', queue.shuffle && 'primary')} onClick={() => send('shuffle')}><Shuffle size={15} /> Shuffle</button>
        <button className={cls('button small', queue.repeat !== 'off' && 'primary')} onClick={() => send('repeat')}><Repeat size={15} /> {queue.repeat === 'one' ? 'This track' : queue.repeat === 'all' ? 'The queue' : 'Repeat'}</button>
        <button className="button small danger" onClick={() => openDialog(<Confirm title="Clear the queue?" detail="Playback stops too." action="Clear" danger yes={() => send('clearQueue')} />)}><Trash2 size={15} /> Clear</button>
      </div>
      {HOSTED ? <p className="page-subtitle">Drag to reorder.</p> : (
        // What Noctorium on the computer does to the queue as a whole; the hosted player's queue is its own.
        <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Drag to reorder.</span>
          <span style={{ flex: 1 }} />
          <button className="button small" disabled={next < 2} onClick={() => send('shuffleUpcoming')}><Shuffle size={15} /> Shuffle what’s next</button>
          <button className="button small" disabled={next < 1} onClick={() => openDialog(
            <Confirm title="Clear what’s next?" detail={next === 1 ? 'The song after this one leaves the queue.' : `The ${next} songs after this one leave the queue.`} action="Clear" danger yes={() => send('clearUpcoming')} />,
          )}><ListX size={15} /> Clear what’s next</button>
          <button className="button small" onClick={() => openDialog(
            <Prompt title="Save the queue as a playlist" hint="Kept in Noctorium on the computer, every song once, in the queue’s order." action="Save" submit={(title) => send('saveQueue', { title })} />,
          )}><Save size={15} /> Save as a playlist…</button>
        </div>
      )}
      <TrackList tracks={queue.tracks} context={{ kind: 'queue' }} />
      {!HOSTED && queue.autoplay && <Autoplay queue={queue} />}
    </>
  );
}

/** What autoplay says it is doing when it has no songs to show. */
const autoplaySays: Record<AutoplayState, string> = {
  off: 'Off: the queue stops when it runs out. Turn it on here, or under Settings › Playing.',
  repeating: 'The queue repeats, so it never runs out and autoplay has nothing to add.',
  ready: 'Lined up after the queue, and not in it until they play or are kept: play one now, keep it, or drop it.',
  spotify: 'Spotify chooses what comes next, in your Spotify app; next asks it to move on.',
  waiting: 'Looking for songs like the last one…',
  nothing: 'Nothing lined up. Look again for more.',
  later: 'When the queue is nearly over, songs like its last one are lined up here.',
};

/**
 * Autoplay, under the queue: the songs it has lined up, drawn dimmer than the queue's own, or what it is doing
 * instead. Noctorium on the computer finds them, from the last song's own service or YouTube Music's radio.
 */
function Autoplay({ queue }: { queue: Queue }) {
  const state = queue.autoplay ?? 'later';
  const suggestions = queue.suggestions ?? [];
  const ready = state === 'ready' && suggestions.length > 0;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="shelf-title">Autoplay{ready && queue.suggestionsFrom ? ` · ${queue.suggestionsFrom}` : ''}</h2>
        <span style={{ flex: 1 }} />
        {state === 'off' && <button className="button small primary" style={{ marginTop: 30 }} onClick={() => send('autoplay', { on: true })}>Turn it on</button>}
        {(ready || state === 'nothing') && <button className="button small" style={{ marginTop: 30 }} onClick={() => send('refreshSuggestions')}><RefreshCw size={15} /> Look again</button>}
      </div>
      <p className="shelf-subtitle">{autoplaySays[state]}</p>
      {ready && <TrackList tracks={suggestions} context={{ kind: 'suggestions' }} numbered={false} />}
    </>
  );
}

export function DownloadsPage() {
  const downloads = usePart('downloads');
  const tracks = downloads?.entries.map((e) => e.track) ?? [];
  const size = (downloads?.entries ?? []).reduce((sum, e) => sum + e.bytes, 0);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 className="page-title">Downloads</h1>
        <span style={{ flex: 1 }} />
        {tracks.length > 0 && <button className="button small danger" onClick={() => openDialog(<Confirm title="Delete every download?" detail="They can be downloaded again any time." action="Delete them" danger yes={() => send('deleteAllDownloads')} />)}><Trash2 size={15} /> Delete all</button>}
      </div>
      <p className="page-subtitle">Kept on the computer running Noctorium, to play without a connection · {(size / 1048576).toFixed(0)} MB</p>
      {downloads?.active.map((job) => (
        <div key={job.track.key} className="setting">
          <div className="label"><strong className="ellipsis">{job.track.title}</strong><small>{job.stage === 'failed' ? job.detail ?? 'It failed' : job.stage === 'queued' ? 'Waiting…' : `${Math.round(job.progress * 100)}%`}</small></div>
          <div style={{ width: 160, height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${job.progress * 100}%`, height: '100%', background: 'var(--accent)' }} /></div>
          <button className="button small" onClick={() => send('cancelDownload', { key: job.track.key })}>Cancel</button>
        </div>
      ))}
      {tracks.length ? <TrackList tracks={tracks} context={{ kind: 'downloads' }} /> : !downloads?.active.length && <Empty icon={<Download size={44} />} title="Nothing kept yet">“Download to keep” in any track’s menu saves it here.</Empty>}
    </>
  );
}

export function DevicesPage() {
  const playback = usePart('playback');
  const connect = usePart('connect');
  const [address, setAddress] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/address').then((r) => r.json()).then((a) => setAddress(a.address)).catch(() => undefined);
  }, []);
  const here = playback?.output === 'browser' && audio.active;
  return (
    <div className="settings">
      <h1 className="page-title">Devices</h1>
      <p className="page-subtitle">Where the music comes out, and the other Noctoriums on your network.</p>
      <section>
        <h2>Play on</h2>
        <div className="setting">
          <Smartphone />
          <div className="label"><strong>This browser</strong><small>The sound comes out of whatever this page is open on — a phone, a tablet, another computer.</small></div>
          <button className={cls('button', here && 'primary')} onClick={() => { live.claim(); send('output', { to: 'browser' }); }}>{here ? 'Playing here' : 'Play here'}</button>
        </div>
        <div className="setting">
          <Monitor />
          <div className="label"><strong>The computer running Noctorium</strong><small>Through its speakers, with mpv, as the terminal player plays. The page becomes a remote.</small></div>
          <button className={cls('button', playback?.output === 'computer' && 'primary')} onClick={() => send('output', { to: 'computer' })}>{playback?.output === 'computer' ? 'Playing there' : 'Play there'}</button>
        </div>
        {address && (
          <div className="setting">
            <QrCode />
            <div className="label"><strong>Open this on your phone</strong><small>{address.replace(/\?key=.*/, '')}</small></div>
            <button className="button" onClick={() => openDialog(<QrDialog title="Scan to open the web player" text={address}><p>The code carries the key, so treat it like a password.</p></QrDialog>)}>Show the code</button>
          </div>
        )}
      </section>
      <section>
        <h2>Noctorium Connect</h2>
        <div className="setting">
          <div className="label"><strong>Connect</strong><small>Move the music between this and your other devices, mid-song.</small></div>
          <Switch on={!!connect?.enabled} change={(on) => send('connect', { on })} label="Connect" />
        </div>
        {connect?.enabled && !connect.available && <div className="banner">Connect needs your Noctorium account, on every device. Sign in under Settings.</div>}
        {connect?.target && (
          <div className="setting">
            <MonitorSpeaker />
            <div className="label"><strong>Playing on {connect.target.name}</strong></div>
            <button className="button primary" onClick={() => send('bringBack')}>Bring it back</button>
          </div>
        )}
        {connect?.controlledBy && <div className="banner">{connect.controlledBy} is playing music on this Noctorium.</div>}
        {connect?.devices.map((device) => (
          <div key={device.id} className="setting">
            <MonitorSpeaker />
            <div className="label"><strong>{device.name}</strong><small>{device.kind}</small></div>
            <button className="button" disabled={connect.busy} onClick={() => send('playOn', { id: device.id })}>{connect.busy ? <Spinner /> : 'Play there'}</button>
          </div>
        ))}
        {connect?.available && !connect.devices.length && <p className="muted">No other device found on this network yet.</p>}
      </section>
    </div>
  );
}
