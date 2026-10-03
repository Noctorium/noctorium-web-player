/*
 * What the hosted player keeps, kept in this browser: the likes, the playlists, the pins, the look. Nothing of it
 * leaves the browser; a private window or cleared site data starts afresh, and the player works without it.
 */

const PREFIX = 'noctorium:';

export function load<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(name: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(value));
  } catch {
    // Full, or turned off: the player carries on with what it has in memory.
  }
}

/** Everything this player kept, as one object, for Settings' export. */
export function everything(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) out[key.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(key) ?? 'null');
    }
  } catch {
    // Nothing readable is the same as nothing kept.
  }
  return out;
}

export function forget() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Already as forgotten as it can be.
  }
}
