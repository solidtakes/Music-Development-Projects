/**
 * Native offline DSP kernels. All kernels are pure: they never mutate their input and return a new
 * buffer with the same channel count, sample rate and frame count.
 *
 * Kernels are async and process in fixed-size frame blocks, checking an AbortSignal and yielding to
 * the event loop between blocks so long renders can be cancelled and stay responsive.
 */
import { setImmediate as immediatePromise } from 'node:timers/promises';
import type { WaveformPeak } from './contract.ts';
import type { DecodedAudio } from './wav.ts';

/** Frames per processing block between cancellation checks / event-loop yields. */
export const BLOCK_FRAMES = 1 << 16;

export interface KernelContext {
  signal?: AbortSignal;
  /** Called with completed fraction 0..1 after each block. */
  onProgress?: (fraction: number) => void;
}

// Live's embedded extension environment may not expose Node's setImmediate global.
// Use the builtin module explicitly; retains an actual event-loop yield between blocks.
const yieldToEventLoop = (): Promise<void> => immediatePromise();

async function blocks(
  frames: number,
  ctx: KernelContext,
  body: (start: number, end: number) => void,
): Promise<void> {
  ctx.signal?.throwIfAborted();
  for (let start = 0; start < frames; start += BLOCK_FRAMES) {
    const end = Math.min(frames, start + BLOCK_FRAMES);
    body(start, end);
    ctx.onProgress?.(end / frames);
    if (end < frames) {
      await yieldToEventLoop();
      ctx.signal?.throwIfAborted();
    }
  }
  if (frames === 0) ctx.onProgress?.(1);
}

/** Reverse complete interleaved frames; channel order within each frame is preserved. */
export async function reverse(input: DecodedAudio, ctx: KernelContext = {}): Promise<DecodedAudio> {
  const { channels, frames } = input.format;
  const src = input.samples;
  const out = new Float64Array(src.length);
  await blocks(frames, ctx, (start, end) => {
    for (let f = start; f < end; f++) {
      const from = (frames - 1 - f) * channels;
      const to = f * channels;
      for (let c = 0; c < channels; c++) out[to + c] = src[from + c]!;
    }
  });
  return { format: { ...input.format }, samples: out };
}

/** Linear amplitude factor for a gain in decibels: 10^(dB/20). */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Multiply every sample of every channel by dbToLinear(db), in float64.
 * No clipping happens here; saturation (PCM) happens at encode time and is counted there.
 */
export async function gain(input: DecodedAudio, db: number, ctx: KernelContext = {}): Promise<DecodedAudio> {
  const k = dbToLinear(db);
  const { channels, frames } = input.format;
  const src = input.samples;
  const out = new Float64Array(src.length);
  await blocks(frames, ctx, (start, end) => {
    const a = start * channels;
    const b = end * channels;
    for (let i = a; i < b; i++) out[i] = src[i]! * k;
  });
  return { format: { ...input.format }, samples: out };
}

/** Min/max peaks per bin across all channels, for waveform display. */
export function computePeaks(input: DecodedAudio, bins: number): WaveformPeak[] {
  const { channels, frames } = input.format;
  const n = Math.max(1, Math.min(bins, Math.max(1, frames)));
  const peaks: WaveformPeak[] = [];
  for (let b = 0; b < n; b++) {
    const start = Math.floor((b * frames) / n);
    const end = Math.max(start + 1, Math.floor(((b + 1) * frames) / n));
    let min = 0;
    let max = 0;
    for (let f = start; f < end && f < frames; f++) {
      for (let c = 0; c < channels; c++) {
        const v = input.samples[f * channels + c]!;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    peaks.push({ min, max });
  }
  return peaks;
}
