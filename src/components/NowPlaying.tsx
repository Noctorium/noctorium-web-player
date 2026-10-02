import { useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ExternalLink, RefreshCw, UserPlus } from 'lucide-react';
import { send, usePart } from '../live';
import { closeNowPlaying, setPanel, useUi } from '../ui';
import { bigArtwork, cls, providerName } from '../util';
import { Badge, Cover, Empty, Spinner } from './Common';
import { Controls, LikeButton, SeekBar, usePosition } from './Player';
import { TrackList } from './Tracks';
import { Mic2 } from 'lucide-react';

/**
 * The record: a large cover over a blur of itself, and beside it what is up next or the lyrics, lit up line by
 * line as they are sung -- the same eight sources the desktop asks, switched right here.
 */
export function NowPlaying() {
  const playback = usePart('playback');
  const queue = usePart('queue');
  const { panel } = useUi();
  const track = playback?.track;

  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeNowPlaying(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  if (!track) {
    return (
      <div className="now-playing" style={{ gridTemplateColumns: '1fr' }}>
        <button className="round-button np-close" aria-label="Close" onClick={closeNowPlaying}><ChevronDown size={24} /></button>
        <Empty icon={<Mic2 size={42} />} title="Nothing playing">Find something on Home or in Search, and it plays here.</Empty>
      </div>
    );
  }

  const big = bigArtwork(track.artworkUrl);
  const upcoming = queue ? queue.tracks : [];
  return (
    <div className="now-playing">
      <div className="backdrop" style={{ backgroundImage: big ? `url("${big}")` : undefined }} />
      <button className="round-button np-close" aria-label="Close" onClick={closeNowPlaying}><ChevronDown size={24} /></button>
      <div className="np-hero">
        <Cover url={big} />
        <div className="words">
          <h1>{track.title}</h1>
          <div className="artist">{track.artistLine}</div>
          <div className="faint" style={{ fontSize: 13, marginTop: 6, display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
            <Badge provider={track.provider} /> {track.album?.title ?? providerName[track.provider]}
          </div>
        </div>
        <SeekBar playback={playback} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LikeButton size={22} />
          <Controls big />
          <button className="round-button" aria-label="Follow the artist" title="Follow the artist" onClick={() => send('follow')}><UserPlus size={20} /></button>
        </div>
        {playback?.status === 'error' && <div className="banner">{playback.error}</div>}
      </div>
      <div className="panel">
        <div className="tabs">
          <button className={cls('chip', panel === 'queue' && 'on')} onClick={() => setPanel('queue')}>Up next</button>
          <button className={cls('chip', panel === 'lyrics' && 'on')} onClick={() => setPanel('lyrics')}>Lyrics</button>
        </div>
        <div className="body">
          {panel === 'queue' ? (
            upcoming.length ? <TrackList tracks={upcoming} context={{ kind: 'queue' }} compact /> : <Empty icon={<Mic2 size={34} />} title="The queue is empty" />
          ) : (
            <LyricsPanel />
          )}
        </div>
      </div>
    </div>
  );
}

function LyricsPanel() {
  const playback = usePart('playback');
  const lyrics = usePart('lyrics');
  const position = usePosition(playback);
  const track = playback?.track;
  const box = useRef<HTMLDivElement>(null);

  // Asked for when the lyrics are shown, as every Noctorium does: eight sources is a lot to ask for nobody.
  useEffect(() => {
    if (track && lyrics?.trackKey !== track.key) send('lyrics', { track });
  }, [track?.key]);

  const source = lyrics?.sources.find((s) => s.provider === lyrics.selected);
  const lines = source?.lines ?? [];
  const active = useMemo(() => {
    if (!source?.synced) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i++) if ((lines[i].startMs ?? Infinity) <= position) index = i;
    return index;
  }, [source, position]);

  useEffect(() => {
    const element = box.current?.querySelector<HTMLElement>(`[data-line="${active}"]`);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [active]);

  return (
    <div>
      <div className="lyrics-sources">
        {lyrics?.sources.map((s) => (
          <button key={s.provider} className={cls('chip', s.provider === lyrics.selected && 'on')}
            disabled={s.status === 'not_found' || s.status === 'searching' || s.status === 'needs_key'}
            title={s.detail ?? s.status}
            onClick={() => send('lyricsProvider', { provider: s.provider })}>
            {s.name}
          </button>
        ))}
        {track && <button className="chip" aria-label="Ask again" onClick={() => send('lyrics', { track, force: true })}><RefreshCw size={13} /></button>}
      </div>
      {lyrics?.loading && !lines.length ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 50 }}><Spinner /></div>
      ) : lines.length ? (
        <div ref={box} className={cls('lyrics', !source?.synced && 'plain')}>
          {lines.map((line, i) => (
            <p key={i} data-line={i} className={cls(i === active && 'active', i < active && 'sung')}
              onClick={() => { if (source?.synced && line.startMs != null) send('seek', { positionMs: line.startMs }); }}>
              {line.text || '♪'}
            </p>
          ))}
          {source?.attribution && <p className="faint" style={{ fontSize: 12, fontWeight: 400 }}>{source.attribution}</p>}
        </div>
      ) : source?.sourceUrl ? (
        <Empty icon={<ExternalLink size={34} />} title={`${source.name} only links to them`}>
          <a href={source.sourceUrl} target="_blank" rel="noreferrer">Open the lyrics on {source.name}</a>
        </Empty>
      ) : (
        <Empty icon={<Mic2 size={34} />} title="No lyrics for this one">{lyrics?.error ?? 'None of the sources has this track.'}</Empty>
      )}
    </div>
  );
}
