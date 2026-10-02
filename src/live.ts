import { useSyncExternalStore } from 'react';
import type { Command, State } from './types';
import { audio } from './audio';

/*
 * The one connection to `noctorium web`.
 *
 * A WebSocket carries everything both ways: the parts of the state as they change, the passing notices, the
 * audio instructions for when this tab is the speaker, and the commands this page sends, each answered by
 * id so a button can show that what it asked for went wrong. When the socket drops -- a laptop lid closed,
 * the program restarted -- the page says so and keeps trying, and picks the state up whole when it is back.
 */

export type Connection = 'connecting' | 'open' | 'closed' | 'unauthorised';

export interface Notice { id: number; text: string; tone: 'normal' | 'good' | 'bad' }

type Listener = () => void;

class Live {
  state: State = {};
  connection: Connection = 'connecting';
  notices: Notice[] = [];
  /** When the playback part last arrived, so the position can be carried forward between updates. */
  playbackAt = performance.now();
  private socket?: WebSocket;
  private listeners = new Set<Listener>();
  private pending = new Map<number, (error?: string) => void>();
  private nextId = 1;
  private retry = 500;
  private noticeId = 1;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    // A new object each time, so React sees a change; the parts inside are shared.
    this.state = { ...this.state };
    this.listeners.forEach((l) => l());
  }

  async start() {
    const session = await fetch('/api/session', { credentials: 'same-origin' }).catch(() => undefined);
    if (session && session.status === 401) {
      this.connection = 'unauthorised';
      this.emit();
      return;
    }
    this.open();
  }

  private open() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/api/live`);
    this.socket = socket;
    this.connection = 'connecting';
    this.emit();
    socket.onopen = () => {
      this.connection = 'open';
      this.retry = 500;
      this.emit();
    };
    socket.onmessage = (event) => this.received(JSON.parse(event.data));
    socket.onclose = (event) => {
      this.socket = undefined;
      this.pending.forEach((reply) => reply('The connection to Noctorium dropped'));
      this.pending.clear();
      if (event.code === 1008) {
        this.connection = 'unauthorised';
        this.emit();
        return;
      }
      this.connection = 'closed';
      this.emit();
      setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 8000);
    };
  }

  private received(message: any) {
    switch (message.kind) {
      case 'part':
        (this.state as any)[message.name] = message.data;
        if (message.name === 'playback') this.playbackAt = performance.now();
        this.emit();
        break;
      case 'reply': {
        const reply = this.pending.get(message.id);
        this.pending.delete(message.id);
        reply?.(message.error);
        if (message.error) this.notice(message.error, 'bad');
        break;
      }
      case 'notice':
        this.notice(message.text, message.tone === 'bad' ? 'bad' : 'normal');
        break;
      case 'open':
        // Core wanted a link opened -- Spotify's or Last.fm's approval page. It opens here, in a new tab.
        window.open(message.url, '_blank', 'noopener');
        break;
      case 'copy':
        navigator.clipboard?.writeText(message.text).then(
          () => this.notice('Copied to the clipboard', 'good'),
          () => undefined,
        );
        break;
      case 'audio':
        audio.command(message);
        break;
    }
  }

  notice(text: string, tone: Notice['tone'] = 'normal') {
    const id = this.noticeId++;
    this.notices = [...this.notices.filter((n) => n.text !== text), { id, text, tone }].slice(-3);
    this.emit();
    setTimeout(() => {
      this.notices = this.notices.filter((n) => n.id !== id);
      this.emit();
    }, tone === 'bad' ? 7000 : 4200);
  }

  /** Sends [command]; resolves with the problem, if there was one. */
  send(command: Command): Promise<string | undefined> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.notice('Not connected to Noctorium', 'bad');
      return Promise.resolve('Not connected');
    }
    const id = this.nextId++;
    socket.send(JSON.stringify({ kind: 'command', id, command }));
    return new Promise((resolve) => this.pending.set(id, resolve));
  }

  /** For the audio element: what it is doing. */
  report(event: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ kind: 'audio', ...event }));
  }

  claim() {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ kind: 'claim' }));
  }
}

export const live = new Live();

/** Shorthand for live.send. */
export const send = (type: string, fields: Record<string, unknown> = {}) => live.send({ type, ...fields });

export function useLive<T>(select: (live: Live) => T): T {
  return useSyncExternalStore(live.subscribe, () => select(live));
}

export function useState_<K extends keyof State>(key: K): State[K] {
  return useSyncExternalStore(live.subscribe, () => live.state[key]);
}

export { useState_ as usePart };
