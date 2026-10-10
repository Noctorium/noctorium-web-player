import { useSyncExternalStore } from 'react';
import { audio } from './audio';
import { usePart } from './live';
import { HOSTED } from './mode';
import { sound } from './sound';
import * as VolumeBoost from './base/volumeBoost';
import type { AnalysisKind } from './base/visualiser';
import type { Playback, Track } from './types';

/*
 * Where the sound is being made, and so what the booster and a visualiser can do with it:
 * - here, in this tab's audio element: the page boosts and measures it itself, through Web Audio (sound.ts);
 * - on the computer running Noctorium: mpv boosts it, and measures it for a visualiser that asks;
 * - in YouTube's embedded player, in the hosted player: another site's frame, which nothing on a page can reach;
 * - in Spotify's own app, for a Spotify song played on Spotify: out of Noctorium's reach altogether;
 * - in another browser that is the speaker: boosted there, and seen by nobody.
 * Where the sound cannot be reached the booster and the visualiser say so, rather than moving a slider that does
 * nothing or drawing a pattern that pretends to be the music.
 */

export type Where = 'here' | 'computer' | 'youtube' | 'spotify' | 'elsewhere' | 'nothing';

export interface Reach {
  where: Where;
  /** Whether the booster works where the sound is; if not, why. Waiting: until the next tap starts Web Audio. */
  boost: { available: boolean; reason?: string; waiting?: boolean };
  /** The most a visualiser can be given there, and why it is nothing where it is. */
  analysis: AnalysisKind;
  analysisReason?: string;
}

const isYouTube = (t?: Track) => t?.provider === 'YOUTUBE_MUSIC' || t?.provider === 'YOUTUBE_VIDEO';

export function whereOf(playback?: Playback): Where {
  if (!playback?.track) return 'nothing';
  if (HOSTED) return isYouTube(playback.track) ? 'youtube' : 'here';
  if (playback.onSpotify) return 'spotify';
  if (playback.output === 'computer') return 'computer';
  return audio.active ? 'here' : 'elsewhere';
}

export function useReach(): Reach {
  const playback = usePart('playback');
  // The graph's state and this tab's being the speaker both change outside the parts Noctorium sends.
  useSyncExternalStore((l) => sound.subscribe(l), () => sound.version);
  useSyncExternalStore((l) => audio.subscribe(l), () => audio.active);
  return reachOf(playback);
}

export function reachOf(playback?: Playback): Reach {
  const where = whereOf(playback);
  const told = playback?.volumeBoostAvailable;
  switch (where) {
    case 'here':
      if (!sound.supported) return { where, boost: { available: false, reason: 'This browser has no Web Audio, which the booster needs.' }, analysis: 'NONE', analysisReason: 'This browser cannot measure its own sound' };
      if (!sound.reaches) {
        return {
          where,
          boost: { available: false, reason: 'This stream comes from a site that does not let a page work on its sound. The next song may.' },
          analysis: 'NONE',
          analysisReason: 'This stream’s sound is out of the page’s hearing',
        };
      }
      return { where, boost: { available: true, waiting: sound.waiting }, analysis: 'SPECTRUM' };
    case 'computer':
      return {
        where,
        boost: told === false ? { available: false, reason: VolumeBoost.UNAVAILABLE } : { available: true },
        analysis: playback?.analysisKind ?? 'NONE',
        analysisReason: playback?.analysisKind ? 'The computer’s player cannot measure this song' : 'This Noctorium does not send what it measures; update it to see the sound',
      };
    case 'youtube':
      return {
        where,
        boost: { available: false, reason: 'YouTube plays in its own player here, inside a frame from youtube.com, which no page can make louder. Its own volume is all there is.' },
        analysis: 'NONE',
        analysisReason: 'YouTube plays in its own player, where this page cannot hear it',
      };
    case 'spotify':
      return {
        where,
        boost: { available: false, reason: 'Spotify plays this in its own app, out of Noctorium’s reach.' },
        analysis: 'NONE',
        analysisReason: 'Spotify plays this in its own app, out of Noctorium’s hearing',
      };
    case 'elsewhere':
      return {
        where,
        boost: told === false ? { available: false, reason: VolumeBoost.UNAVAILABLE } : { available: true },
        analysis: 'NONE',
        analysisReason: 'The sound is coming out of another browser',
      };
    default:
      return { where, boost: { available: told !== false, reason: told === false ? VolumeBoost.UNAVAILABLE : undefined }, analysis: 'NONE', analysisReason: 'Nothing playing' };
  }
}
