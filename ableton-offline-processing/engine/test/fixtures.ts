import type { AudioMetadata } from '../src/contract.ts';
import { decodeWav, encodeWav, makeMetadata, type DecodedAudio } from '../src/wav.ts';

/**
 * Deterministic test signal. Channel 0: 440 Hz sine at 0.5. Channel 1: 0.25 * linear ramp -1..1
 * (deliberately different so any channel swap or per-sample reverse is detectable).
 * Further channels: distinct DC offsets. Encoded then decoded so samples are exactly representable.
 */
export function makeSignal(
  frames: number,
  channels = 2,
  encoding: AudioMetadata['encoding'] = 'pcm',
  bitDepth = 24,
  sampleRate = 48000,
): { audio: DecodedAudio; bytes: Uint8Array } {
  const samples = new Float64Array(frames * channels);
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      let v: number;
      if (c === 0) v = 0.5 * Math.sin((2 * Math.PI * 440 * f) / sampleRate);
      else if (c === 1) v = 0.25 * (frames > 1 ? (2 * f) / (frames - 1) - 1 : 0);
      else v = 0.1 * c - 0.3;
      samples[f * channels + c] = v;
    }
  }
  const format = makeMetadata(channels, sampleRate, bitDepth, encoding, frames);
  const { bytes } = encodeWav(format, samples);
  return { audio: decodeWav(bytes), bytes };
}

export function maxAbsDiff(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return Infinity;
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}
