import type { NoctoriumAccount, Track } from '../types';
import { load, save } from './store';

/*
 * The Noctorium account, in the hosted player: signed in from a browser tab with a code -- Discord, Telegram
 * or email, on the account service's own page -- as the apps sign in. Once signed in it counts what is played here,
 * and says what is playing, for the listener's Discord status and Telegram bio. The token is kept in this browser.
 */

/** Signing in and the account, and listening: two servers since 0.39, chosen by the path asked. */
export const ACCOUNT = 'https://account.noctorium.xyz';
export const STATS = 'https://stats.noctorium.xyz';
const serverFor = (path: string) => (['/api/stats', '/api/plays', '/api/now-playing', '/api/scrobble'].some((p) => path === p || path.startsWith(`${p}?`)) ? STATS : ACCOUNT);
const SETTLE_MS = 3_000;
const RENEW_MS = 5 * 60_000;

interface Kept { token: string; name: string; email: string }

/** What the account page needs of /me, beside the name and email: asked again at each refresh, so not kept. */
type Me = Pick<NoctoriumAccount, 'avatar' | 'hasPassword' | 'twoStep' | 'linked'>;

/** Whether a listen counts, as every Noctorium counts it: half a minute, or half the song if it is shorter. */
export function listenCounts(heardMs: number, durationMs: number): boolean {
  const needed = durationMs > 0 ? Math.min(durationMs / 2, 30_000) : 30_000;
  return heardMs >= needed;
}

export class HostedAccount {
  private kept = load<Kept | null>('account', null);
  private stats = { streams: 0, hours: 0 };
  private waiting?: { code: string; url: string; stop: () => void };
  private message?: string;
  private reported?: { key: string; at: number };
  private nowTimer = 0;
  private me: Me = {};
  private busy = false;
  private problem?: string;

  /**
   * [scrobblesItself]: the sites this page already tells by itself -- its own ListenBrainz connection -- which the
   * service then leaves out when it scrobbles for this page to what the account has linked.
   */
  constructor(private emit: (account: NoctoriumAccount) => void, private scrobblesItself: () => string[] = () => []) {}

  start() {
    this.send();
    if (this.kept) void this.refresh();
  }

  private send() {
    this.emit({
      signedIn: !!this.kept,
      name: this.kept?.name,
      email: this.kept?.email,
      streams: this.stats.streams,
      hours: this.stats.hours,
      message: this.message,
      deviceCode: this.waiting?.code,
      deviceUrl: this.waiting?.url,
      ...(this.kept ? this.me : {}),
      profileBusy: this.busy,
      profileError: this.problem,
    });
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response | null> {
    const headers: Record<string, string> = { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as Record<string, string>) };
    if (this.kept) headers.Authorization = `Bearer ${this.kept.token}`;
    return fetch(serverFor(path) + path, { ...init, headers }).catch(() => null);
  }

  /** Who the token is, and the figures; a token the service refuses signs out. */
  private async refresh() {
    const me = await this.call('/api/auth/me');
    if (me?.status === 401) return this.signOut('Your Noctorium sign-in ran out. Sign in again.');
    const user = me?.ok ? (await me.json().catch(() => ({}))).user : undefined;
    if (user && this.kept) {
      this.kept = { ...this.kept, name: user.displayName ?? this.kept.name, email: user.email ?? this.kept.email };
      save('account', this.kept);
      this.me = { avatar: user.avatarUrl ?? undefined, hasPassword: !!user.hasPassword, twoStep: user.twoStep, linked: user.linked };
      this.send();
    }
    const stats = await this.call('/api/stats?range=all');
    if (stats?.ok) {
      const body = await stats.json().catch(() => ({}));
      this.stats = { streams: Number(body.streams ?? 0), hours: Number(body.hours ?? 0) };
      this.send();
    }
  }

  /**
   * Signing in with a code. Called from the click itself, so the tab for the service's page can be opened at once --
   * a browser blocks one opened after waiting for the code.
   */
  signIn() {
    if (this.kept || this.waiting) return;
    const tab = window.open('about:blank', '_blank');
    void (async () => {
      const reply = await this.call('/api/auth/device', { method: 'POST', body: '{}' });
      const start = reply?.ok ? await reply.json().catch(() => null) : null;
      if (!start?.code || !start.pollToken || !start.url) {
        tab?.close();
        this.message = 'The Noctorium service could not be reached. Try again.';
        return this.send();
      }
      if (tab) tab.location.href = start.url;
      let stopped = false;
      this.waiting = { code: start.code, url: start.url, stop: () => { stopped = true; } };
      this.message = undefined;
      this.send();
      const until = Date.now() + Number(start.expiresIn ?? 600) * 1000;
      const every = Math.min(Math.max(Number(start.interval ?? 3), 1), 30) * 1000;
      while (!stopped && Date.now() < until) {
        await new Promise((r) => setTimeout(r, every));
        if (stopped) return;
        const poll = await this.call(`/api/auth/device/poll?token=${encodeURIComponent(start.pollToken)}`);
        if (!poll || poll.status === 202 || poll.status >= 500) continue;
        const body = await poll.json().catch(() => ({}));
        this.waiting = undefined;
        if (poll.ok && body.token && body.user) {
          this.kept = { token: body.token, name: body.user.displayName ?? '', email: body.user.email ?? '' };
          save('account', this.kept);
          this.message = undefined;
          this.send();
          return this.refresh();
        }
        this.message = body.error ?? 'That sign-in did not go through. Start again.';
        return this.send();
      }
      if (!stopped) {
        this.waiting = undefined;
        this.message = 'The code expired. Start again for a new one.';
        this.send();
      }
    })();
  }

  cancel() {
    this.waiting?.stop();
    this.waiting = undefined;
    this.send();
  }

  signOut(message?: string) {
    this.cancel();
    if (this.kept) void this.call('/api/now-playing', { method: 'POST', body: JSON.stringify({ track: null }) });
    this.kept = null;
    save('account', null);
    this.stats = { streams: 0, hours: 0 };
    this.me = {};
    this.problem = undefined;
    this.message = message;
    this.send();
  }

  /**
   * A change on the account page, as `noctorium web`'s noctoriumProfile: {action, name?, email?, password?, current?,
   * code?, confirm?}. An email or password change signs the other devices out and hands this one a fresh token, kept
   * here; deleting signs out.
   */
  profile(fields: Record<string, unknown>) {
    return this.change('/api/account/profile', JSON.stringify({ ...fields, type: undefined }), {}, (body) => {
      if (fields.action === 'delete') return this.signOut('Your Noctorium account was deleted.');
      if (body.token && this.kept) save('account', (this.kept = { ...this.kept, token: body.token }));
    });
  }

  /** A new picture: a 256×256 JPEG, in base64 as the bridge carries it. */
  avatar(jpegBase64: string) {
    const bytes = Uint8Array.from(atob(jpegBase64), (c) => c.charCodeAt(0));
    return this.change('/api/account/avatar', bytes, { 'Content-Type': 'image/jpeg' });
  }

  /** The login bot sends a code on Telegram, for a change while two-step verification by Telegram is on. */
  telegramCode() {
    return this.change('/api/account/security', JSON.stringify({ action: 'telegram-send' }));
  }

  private async change(path: string, body: BodyInit, headers: Record<string, string> = {}, done?: (body: any) => void) {
    if (!this.kept || this.busy) return;
    this.busy = true;
    this.problem = undefined;
    this.send();
    const reply = await this.call(path, { method: 'POST', body, headers });
    const answer = reply ? await reply.json().catch(() => ({})) : {};
    this.busy = false;
    if (!reply?.ok) {
      this.problem = answer.error ?? 'The Noctorium service could not be reached. Try again.';
      return this.send();
    }
    done?.(answer);
    this.send();
    if (this.kept) await this.refresh();
  }

  /** A listen that counted, as the service keeps it; the next refresh shows it in the figures. */
  played(track: Track, heardMs: number, startedAt: number) {
    if (!this.kept) return;
    const play = {
      clientId: crypto.randomUUID(),
      provider: track.provider,
      trackId: track.id,
      title: track.title,
      artist: track.artists[0]?.name ?? track.artistLine,
      msPlayed: Math.round(heardMs),
      playedAt: new Date(startedAt * 1000).toISOString(),
    };
    void this.call('/api/plays', { method: 'POST', body: JSON.stringify({ plays: [play] }) }).then((r) => {
      if (r?.ok) void this.refresh();
    });
  }

  /** A listen that meets Last.fm's rule, scrobbled by the service to what the account has linked. */
  scrobbled(track: Track, startedAt: number, heardMs: number, durationMs: number) {
    if (!this.kept) return;
    const song = {
      title: track.title,
      artist: track.artists[0]?.name ?? track.artistLine,
      ...(track.album ? { album: track.album.title } : {}),
      url: track.sourceUrl,
      durationMs: Math.round(durationMs),
    };
    void this.call('/api/scrobble', {
      method: 'POST',
      body: JSON.stringify({ track: song, startedAt, heardMs: Math.round(heardMs), skip: this.scrobblesItself() }),
    });
  }

  /**
   * What is playing, or nothing: said once it has settled for a few seconds -- skipping through songs is not worth a
   * status each -- and again every five minutes while it plays, as Discord's status lasts only so long.
   */
  playing(track: Track | undefined, playing: boolean, positionMs: number, durationMs: number) {
    if (!this.kept) return;
    const key = track && playing ? track.key : '';
    if (key === (this.reported?.key ?? '') && (!key || Date.now() - this.reported!.at < RENEW_MS)) return;
    window.clearTimeout(this.nowTimer);
    this.nowTimer = window.setTimeout(() => {
      this.reported = { key, at: Date.now() };
      const now = key && track ? {
        title: track.title,
        artist: track.artists[0]?.name ?? track.artistLine,
        ...(track.album ? { album: track.album.title } : {}),
        ...(track.artworkUrl ? { artworkUrl: track.artworkUrl } : {}),
        url: track.sourceUrl,
        provider: track.provider,
        ...(durationMs > 0 ? { durationMs: Math.round(durationMs) } : {}),
        positionMs: Math.round(positionMs),
      } : null;
      // relay: the service also says it as "now playing" on the Last.fm and ListenBrainz linked to the account.
      void this.call('/api/now-playing', { method: 'POST', body: JSON.stringify({ track: now, relay: true, skip: this.scrobblesItself() }) });
    }, key ? SETTLE_MS : 0);
  }
}
