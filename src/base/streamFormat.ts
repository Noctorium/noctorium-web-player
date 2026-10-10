/*
 * What is playing, as a status bar writes it: Base's StreamFormat, ported, for what the browser knows of the audio
 * it plays itself -- the codec from the stream's MIME type or hls.js, the bitrate hls.js reads from the playlist.
 * Noctorium on a computer sends its own line, already written, in playback.format.
 */

export interface StreamFormat {
  /** The player's own name for it, as given: an FFmpeg codec name, or a MIME type ("audio/webm; codecs=opus"). */
  codec?: string;
  sampleRateHz?: number;
  channels?: number;
  bitsPerSecond?: number;
}

/**
 * "Opus, stereo, 48 kHz, 128 kbit/s": what is known of it, in that order, or undefined when nothing is. The order
 * and the units are the ones a status bar has always used, so it reads at a glance.
 */
export function describe(format?: StreamFormat): string | undefined {
  if (!format) return undefined;
  const parts = [
    format.codec?.trim() ? codecName(format.codec) : undefined,
    format.channels && format.channels > 0 ? channelsName(format.channels) : undefined,
    format.sampleRateHz && format.sampleRateHz > 0 ? sampleRateName(format.sampleRateHz) : undefined,
    format.bitsPerSecond && format.bitsPerSecond > 0 ? bitrateName(format.bitsPerSecond) : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/** The codec as people know it: "Opus", "AAC", "MP3", from either an FFmpeg name or a MIME type. */
export function codecName(codec: string): string {
  const raw = codec.trim().toLowerCase();
  // A MIME type that names its codec in a parameter is about that codec, not the container around it.
  const named = /codecs\s*=\s*"?([^",;]+)/.exec(raw)?.[1]?.trim();
  const id = (named ?? afterFirst(before(raw, ';'), 'audio/')).trim();
  if (id === 'opus') return 'Opus';
  if (id.startsWith('aac') || id.startsWith('mp4a')) return 'AAC';
  if (id.startsWith('mp3') || id === 'mpeg' || id === 'mpga') return 'MP3';
  if (id.startsWith('mp2')) return 'MP2';
  if (id.includes('vorbis')) return 'Vorbis';
  if (id === 'flac' || id === 'x-flac') return 'FLAC';
  if (id === 'alac') return 'ALAC';
  if (id.startsWith('pcm') || id === 'raw' || id === 'wav' || id === 'x-wav') return 'PCM';
  if (id === 'ac3' || id === 'ac-3') return 'AC-3';
  if (id === 'eac3' || id === 'eac-3') return 'E-AC-3';
  if (id.startsWith('wma')) return 'WMA';
  if (id.startsWith('amr')) return 'AMR';
  if (id === 'wavpack') return 'WavPack';
  if (!id) return codec.trim();
  if (id.length <= 4) return id.toUpperCase();
  return id[0].toUpperCase() + id.slice(1);
}

/** "mono", "stereo", "5.1", "7.1", or "3 channels". */
export function channelsName(channels: number): string {
  switch (channels) {
    case 1: return 'mono';
    case 2: return 'stereo';
    case 6: return '5.1';
    case 8: return '7.1';
    default: return `${channels} channels`;
  }
}

/** "48 kHz", "44.1 kHz", "22.05 kHz": kilohertz, with as many decimals as it takes and no more. */
export function sampleRateName(hz: number): string {
  return `${(hz / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} kHz`;
}

/** "128 kbit/s", rounded to the kilobit: the decimals of a measured bitrate are noise. */
export function bitrateName(bitsPerSecond: number): string {
  return `${Math.round(bitsPerSecond / 1000)} kbit/s`;
}

/** Kotlin's substringBefore. */
function before(text: string, separator: string) {
  const at = text.indexOf(separator);
  return at < 0 ? text : text.slice(0, at);
}

/** Kotlin's substringAfter: the whole of [text] when [separator] is not in it. */
function afterFirst(text: string, separator: string) {
  const at = text.indexOf(separator);
  return at < 0 ? text : text.slice(at + separator.length);
}

/** The whole queue's length, of the songs whose length is known, and how far into it [positionMs] is. */
export function queueDurationMs(tracks: { durationMs?: number }[]): number {
  return tracks.reduce((sum, t) => sum + (t.durationMs && t.durationMs > 0 ? t.durationMs : 0), 0);
}

export function queueElapsedMs(tracks: { durationMs?: number }[], currentIndex: number, positionMs: number): number {
  return queueDurationMs(tracks.slice(0, Math.max(0, currentIndex))) + Math.max(0, positionMs);
}
