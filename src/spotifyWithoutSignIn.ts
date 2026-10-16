import type { SpotifyPublicPlaylist } from './types';

/*
 * Spotify with nobody signed in, as Settings shows it: the public playlists followed, and Spotify's data download.
 *
 * The download -- my_spotify_data.zip, or a .json from inside it -- is sent to the Noctorium serving this page, which
 * imports it as playlists of its own: the file as the listener chose it, its name in the address, over the same key
 * as everything else. Noctorium takes a file of its limit at most, far more than any download Spotify sends; the
 * page says so before sending a larger one rather than sending it to be turned away, in Noctorium's words. How the
 * import goes from then on is in the settings part's spotify.dataImport.
 */

/** "Sample Listener · 42 songs · first 100 songs", or that it has not been read yet; nothing when its read failed. */
export function followedAbout(playlist: SpotifyPublicPlaylist): string {
  const count = playlist.songCount == null ? undefined : `${playlist.songCount} ${playlist.songCount === 1 ? 'song' : 'songs'}`;
  const said = [playlist.owner || undefined, count, playlist.mayBeLonger ? 'first 100 songs' : undefined].filter(Boolean).join(' · ');
  return said || (playlist.lastError ? '' : 'Not read yet');
}

/** What Noctorium takes when it does not say: 50 MB, as in WebCommands.kt. */
export const IMPORT_LIMIT_BYTES = 50 * 1024 * 1024;

const MB = 1024 * 1024;

/** Where the file goes. */
export function importAddress(name: string): string {
  return `/api/spotify/import?name=${encodeURIComponent(name)}`;
}

/** "50 MB", "1.5 MB", "300 KB": what a size is called, near enough, as Noctorium says it. */
export function sizeName(bytes: number): string {
  if (bytes >= 10 * MB) return `${Math.floor(bytes / MB)} MB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

/** Why [file] is not sent, when it is not: nothing in it, or far more than any download Spotify sends. */
export function refused(file: { name: string; size: number }, limit = IMPORT_LIMIT_BYTES): string | undefined {
  if (file.size === 0) return `${file.name} is empty. Choose my_spotify_data.zip, the file Spotify emailed you a link to.`;
  if (file.size > limit) {
    return `${file.name} is ${sizeName(file.size)}, and the import takes ${sizeName(limit)} at most. Spotify's data download is a few megabytes: ` +
      'choose my_spotify_data.zip, the file Spotify emailed you a link to.';
  }
  return undefined;
}

/**
 * Sends [file] to be imported, telling [sent] how much of it has gone, from 0 to 1. Resolves with the problem when
 * there was one -- Noctorium's reason, or that the file never reached it -- and with nothing once the import has begun.
 */
export function sendSpotifyData(file: File, sent: (part: number) => void, limit?: number): Promise<string | undefined> {
  const problem = refused(file, limit ?? IMPORT_LIMIT_BYTES);
  if (problem) return Promise.resolve(problem);
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open('POST', importAddress(file.name));
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.onprogress = (event) => { if (event.lengthComputable && event.total > 0) sent(event.loaded / event.total); };
    request.onload = () => {
      if (request.status === 200) return resolve(undefined);
      let reason: string | undefined;
      try { reason = JSON.parse(request.responseText).error; } catch { reason = undefined; }
      resolve(reason ?? `Noctorium did not take the file (${request.status}).`);
    };
    request.onerror = () => resolve('The file did not reach Noctorium. Is noctorium web still running?');
    request.send(file);
  });
}
