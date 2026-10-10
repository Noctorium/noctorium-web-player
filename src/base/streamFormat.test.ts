import { describe, expect, it } from 'vitest';
import { bitrateName, channelsName, codecName, describe as describeFormat, queueDurationMs, queueElapsedMs, sampleRateName } from './streamFormat';

/** Base's StreamFormatTest: the status bar's line about what is playing, written as a desktop player writes it. */
describe('the stream format', () => {
  it('reads everything known as a status bar reads', () => {
    expect(describeFormat({ codec: 'opus', sampleRateHz: 48000, channels: 2, bitsPerSecond: 128000 })).toBe('Opus, stereo, 48 kHz, 128 kbit/s');
    expect(describeFormat({ codec: 'mp3float', sampleRateHz: 44100, channels: 2, bitsPerSecond: 320412 })).toBe('MP3, stereo, 44.1 kHz, 320 kbit/s');
    expect(describeFormat({ codec: 'aac', sampleRateHz: 22050, channels: 1, bitsPerSecond: 64000 })).toBe('AAC, mono, 22.05 kHz, 64 kbit/s');
  });

  it('leaves out what is not known rather than guessing', () => {
    expect(describeFormat({ codec: 'opus' })).toBe('Opus');
    expect(describeFormat({ sampleRateHz: 48000, channels: 2 })).toBe('stereo, 48 kHz');
    expect(describeFormat({})).toBeUndefined();
    expect(describeFormat({ sampleRateHz: 0, bitsPerSecond: -1 })).toBeUndefined();
    expect(describeFormat(undefined)).toBeUndefined();
  });

  it('names a codec the way people know it, from mpv or from a MIME type', () => {
    const names: Record<string, string> = {
      opus: 'Opus', aac: 'AAC', aac_latm: 'AAC', mp3: 'MP3', mp3float: 'MP3', vorbis: 'Vorbis', flac: 'FLAC', alac: 'ALAC',
      pcm_s16le: 'PCM', pcm_f32le: 'PCM', eac3: 'E-AC-3', ac3: 'AC-3', wmav2: 'WMA', 'audio/opus': 'Opus',
      'audio/mp4a-latm': 'AAC', 'audio/mpeg': 'MP3', 'audio/flac': 'FLAC', 'audio/raw': 'PCM', 'audio/webm; codecs=opus': 'Opus',
      'audio/mp4; codecs="mp4a.40.2"': 'AAC', dts: 'DTS', speex: 'Speex', 'mp4a.40.2': 'AAC',
    };
    for (const [given, named] of Object.entries(names)) expect(codecName(given), given).toBe(named);
  });

  it('writes channels, rates and bitrates', () => {
    expect([1, 2, 6, 8, 3].map(channelsName)).toEqual(['mono', 'stereo', '5.1', '7.1', '3 channels']);
    expect([48000, 44100, 22050, 11025, 96000].map(sampleRateName)).toEqual(['48 kHz', '44.1 kHz', '22.05 kHz', '11.025 kHz', '96 kHz']);
    expect([128000, 96500, 1411200].map(bitrateName)).toEqual(['128 kbit/s', '97 kbit/s', '1411 kbit/s']);
  });

  it("adds up the queue's length and how far into it", () => {
    const tracks = [{ durationMs: 151000 }, {}, { durationMs: 200000 }];
    expect(queueDurationMs(tracks), 'a song with no length adds nothing').toBe(351000);
    expect(queueElapsedMs(tracks, 2, 58000)).toBe(151000 + 58000);
    expect(queueDurationMs([])).toBe(0);
  });
});
