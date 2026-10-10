import type { Analysis } from './base/visualiser';

/*
 * What Noctorium on the computer measures of the sound mpv is making, for a visualiser on this page: the latest
 * frame, and when it came. Sent only while the page has asked for it (see Visualiser.tsx), up to thirty a second;
 * kept outside React, since a visualiser reads it in its own animation frames rather than re-rendering on each.
 */

export const feed: { frame?: Analysis; at: number } = { at: 0 };

export function received(message: { bands?: number[]; peaks?: number[]; rms?: number[] }) {
  feed.frame = { bands: message.bands ?? [], peaks: message.peaks ?? [], rms: message.rms ?? [] };
  feed.at = performance.now();
}
