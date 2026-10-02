import { useSyncExternalStore } from 'react';

/*
 * Where the page is, kept in the address bar so Back works and a page can be bookmarked: /search?q=…,
 * /library, /playlist/<key>, /local/<id>, /queue, /downloads, /devices, /settings. The now playing screen
 * is a layer over whichever page is open, not a page, so it does not go into the history.
 */

export interface Route { page: string; arg?: string; query: URLSearchParams }

function read(): Route {
  const parts = location.pathname.split('/').filter(Boolean);
  return { page: parts[0] ?? 'home', arg: parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : undefined, query: new URLSearchParams(location.search) };
}

let current = read();
const listeners = new Set<() => void>();

window.addEventListener('popstate', () => {
  current = read();
  listeners.forEach((l) => l());
});

export function go(path: string, replace = false) {
  if (path === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  current = read();
  listeners.forEach((l) => l());
  document.querySelector('.content')?.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}
