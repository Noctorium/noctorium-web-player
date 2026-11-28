import { useEffect, useState } from 'react';
import { HOSTED } from '../mode';
import { STATS } from '../hosted/account';
import { load } from '../hosted/store';
import { go } from '../router';
import { usePart } from '../live';

/** The stats service's answer: the same figures and charts as Noctorium Stats and stats.noctorium.xyz. */
export interface AccountStats {
  streams: number;
  uniqueTracks: number;
  artists: number;
  msPlayed: number;
  byProvider: { provider: string; streams: number }[];
  topTracks: { title: string; artist: string; streams: number }[];
  topArtists: { artist: string; streams: number; minutes: number; tracks: number }[];
  timeline: { bucket: string; points: { start: string; streams: number; minutes: number }[] };
  hourly: { hour: number; minutes: number }[];
  weekdays: { day: number; minutes: number }[];
  recent: { title: string; artist: string; provider: string; playedAt: string }[];
  streak: { current: number; longest: number };
}

const RANGES = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['365d', 'Year'], ['all', 'All time']] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SERVICES: Record<string, [string, string]> = {
  YOUTUBE_MUSIC: ['YouTube Music', '#ff4e45'],
  YOUTUBE_VIDEO: ['YouTube Music', '#ff4e45'],
  SOUNDCLOUD: ['SoundCloud', '#ff7a1a'],
  SPOTIFY: ['Spotify', '#1ed760'],
  BANDCAMP: ['Bandcamp', '#629aa9'],
  VK: ['VK', '#4c9bff'],
  LOCAL: ['Your files', '#b47cff'],
};
const service = (code: string): [string, string] => SERVICES[code] ?? [code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, ' '), '#9a8fad'];
const plays = (n: number) => (n === 1 ? '1 play' : `${n} plays`);
const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);
const listened = (ms: number) => {
  const minutes = Math.floor(ms / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

/**
 * The account's statistics over a span: from the stats service with this browser's sign-in when hosted, or through
 * `noctorium web`, which holds the computer's sign-in, when served by it. Null when signed out or out of reach.
 */
export async function fetchStats(range: string): Promise<AccountStats | null> {
  const tz = -new Date().getTimezoneOffset();
  const query = `range=${range}&tz=${tz}&limit=10`;
  const token = HOSTED ? load<{ token: string } | null>('account', null)?.token : undefined;
  if (HOSTED && !token) return null;
  const reply = await fetch(HOSTED ? `${STATS}/api/stats?${query}` : `/api/stats?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
    credentials: HOSTED ? 'omit' : 'same-origin',
  }).catch(() => null);
  return reply?.ok ? reply.json().catch(() => null) : null;
}

function Bars({ values, labels, height = 100 }: { values: number[]; labels?: string[]; height?: number }) {
  const most = Math.max(1, ...values);
  return (
    <div className="stats-bars" style={{ height: height + (labels ? 20 : 0) }}>
      {values.map((v, i) => (
        <div className="stats-bar" key={i}>
          <div className="fill" style={{ height: Math.max(2, (v / most) * height) }} />
          {labels && <div className="k">{labels[i]}</div>}
        </div>
      ))}
    </div>
  );
}

export function StatsPage() {
  const signedIn = !!usePart('account')?.signedIn;
  const [range, setRange] = useState('30d');
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    let live = true;
    setStats(null);
    setAsked(false);
    if (signedIn) fetchStats(range).then((s) => { if (live) { setStats(s); setAsked(true); } });
    return () => { live = false; };
  }, [range, signedIn]);

  if (!signedIn) {
    return (
      <div className="settings stats-page">
        <div className="settings-head"><h1 className="page-title">Stats</h1></div>
        <p className="muted">Your stats come from your Noctorium account: every song played on any device signed in to it, with your streaks and charts.</p>
        <button className="button primary" onClick={() => go('/account')}>Sign in</button>
      </div>
    );
  }

  const total = stats?.streams ?? 0;
  const services = Object.entries(
    (stats?.byProvider ?? []).reduce<Record<string, number>>((all, p) => {
      const name = service(p.provider)[0];
      all[name] = (all[name] ?? 0) + p.streams;
      return all;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="settings stats-page">
      <div className="settings-head"><h1 className="page-title">Stats</h1></div>
      <div className="chips">
        {RANGES.map(([code, label]) => (
          <button key={code} className={code === range ? 'chip on' : 'chip'} onClick={() => setRange(code)}>{label}</button>
        ))}
      </div>
      {!stats && <p className="muted">{asked ? 'Your stats could not be reached. Try again in a moment.' : 'Loading…'}</p>}
      {stats && (
        <>
          <div className="stats-tiles">
            {[
              ['Listens', String(stats.streams)],
              ['Listened', listened(stats.msPlayed)],
              ['Songs', String(stats.uniqueTracks)],
              ['Artists', String(stats.artists)],
              ['Current streak', days(stats.streak.current)],
              ['Longest streak', days(stats.streak.longest)],
            ].map(([k, n]) => (
              <div className="stats-tile" key={k}><div className="n">{n}</div><div className="k">{k}</div></div>
            ))}
          </div>
          {total === 0 ? (
            <p className="muted">Nothing played in this span yet.</p>
          ) : (
            <>
              <h2>{stats.timeline.bucket === 'month' ? 'Month by month' : 'Day by day'}</h2>
              <Bars values={stats.timeline.points.map((p) => p.minutes)} height={130} />
              <div className="stats-two">
                <div>
                  <h2>Hour of the day</h2>
                  <Bars values={stats.hourly.map((h) => h.minutes)} labels={stats.hourly.map((h) => (h.hour % 6 === 0 ? String(h.hour) : ''))} />
                </div>
                <div>
                  <h2>Day of the week</h2>
                  <Bars values={stats.weekdays.map((d) => d.minutes)} labels={stats.weekdays.map((d) => WEEKDAYS[d.day - 1] ?? '')} />
                </div>
              </div>
              <div className="stats-two">
                <div>
                  <h2>Top songs</h2>
                  {stats.topTracks.map((t, i) => (
                    <div className="stats-row" key={i}><span className="rank">{i + 1}</span><span className="what">{t.title}<small>{t.artist}</small></span><span className="muted">{plays(t.streams)}</span></div>
                  ))}
                </div>
                <div>
                  <h2>Top artists</h2>
                  {stats.topArtists.map((a, i) => (
                    <div className="stats-row" key={i}><span className="rank">{i + 1}</span><span className="what">{a.artist}<small>{a.tracks} {a.tracks === 1 ? 'song' : 'songs'} · {a.minutes} min</small></span><span className="muted">{plays(a.streams)}</span></div>
                  ))}
                </div>
              </div>
              <h2>By service</h2>
              {services.map(([name, n]) => (
                <div className="stats-share" key={name}>
                  <div className="row"><span>{name}</span><span className="muted">{Math.round((n * 100) / total)}%</span></div>
                  <div className="track"><div style={{ width: `${(n * 100) / total}%`, background: Object.values(SERVICES).find(([s]) => s === name)?.[1] ?? '#9a8fad' }} /></div>
                </div>
              ))}
              {stats.recent.length > 0 && <h2>Recently played</h2>}
              {stats.recent.map((p, i) => (
                <div className="stats-row" key={i}>
                  <span className="what">{p.title}<small>{p.artist} · {service(p.provider)[0]}</small></span>
                  <span className="muted">{new Date(p.playedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
