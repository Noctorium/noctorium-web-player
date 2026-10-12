import * as VolumeBoost from './base/volumeBoost';
import { BOOST_PROCESSOR, Limiter, limitAndClip } from './limiter';

/*
 * The volume booster's limiter and soft clip on the audio thread, as an AudioWorklet: limiter.ts's, run on every
 * block of 128 frames the browser asks for. sound.ts loads it, and stands the browser's own compressor in for it
 * where a page cannot have one (a page that is not a secure context, which is `noctorium web` opened from another
 * device on the house's network).
 *
 * The gain in front of it is a GainNode's; the one thing it is told is its ceiling, CEILING × drive, as an
 * AudioParam, so that a new level glides there as the gain does. The browser mixes whatever comes in to two
 * channels for it (sound.ts asks for that), and an input with nothing connected is silence, which still runs
 * through so that what is held back in the look-ahead drains away rather than waiting for the next song.
 *
 * TypeScript's libraries describe a page and a worker, not a worklet, so the three things this file uses of an
 * AudioWorkletGlobalScope are declared here.
 */

declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

class BoostProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ceiling', defaultValue: VolumeBoost.CEILING, minValue: 0.01, maxValue: 100, automationRate: 'k-rate' }];
  }

  private readonly limiter = new Limiter(sampleRate, 2);

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const output = outputs[0];
    if (!output?.length) return true;
    limitAndClip(this.limiter, inputs[0] ?? [], output, output[0].length, parameters.ceiling[0]);
    // Kept running while it is silent too: sound.ts holds on to it, and it is cheap.
    return true;
  }
}

registerProcessor(BOOST_PROCESSOR, BoostProcessor);
