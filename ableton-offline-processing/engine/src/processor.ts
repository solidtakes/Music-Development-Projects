/**
 * Processor adapter seam (design for future native, VST3 and AU offline processors).
 *
 * Alpha 0.1 implements only native processors (Reverse, Gain). Plugin hosting is NOT implemented.
 * The point of this file is that every output-affecting fact about a processor has a defined place
 * in the cache identity, so adding a plugin host later does not require redesigning the cache.
 */
import type { AudioMetadata } from './contract.ts';
import type { KernelContext } from './dsp.ts';
import type { DecodedAudio } from './wav.ts';

export type ProcessorFormat = 'native' | 'vst3' | 'au';

/** Everything about *which code* produced the audio. Part of every cache key. */
export interface ProcessorIdentity {
  format: ProcessorFormat;
  /** native: 'aopx.<type>'; vst3: processor class UID; au: 'type:subtype:manufacturer'. */
  uniqueId: string;
  /** Implementation version. Bump for any change that can alter output samples. */
  version: string;
  /** Hash of the plugin binary/bundle. null for native processors (covered by engine version). */
  binaryHash: string | null;
  /** Hash of serialized processor state (plugin chunk / preset). null when params fully describe it. */
  stateHash: string | null;
}

/** Output-affecting render settings, also part of every cache key. */
export interface RenderSettings {
  sampleRate: number;
  channels: number;
  /** Sample representation of the stored output. Alpha 0.1: identical to the source format. */
  outputEncoding: AudioMetadata['encoding'];
  outputBitDepth: number;
  /** PCM out-of-range behaviour. Alpha 0.1 supports only hard saturation. */
  clipMode: 'saturate';
  /** Offline quality / oversampling setting for processors that expose one. */
  quality: 'standard';
  /** Dither applied at quantisation. Alpha 0.1: none. */
  dither: 'none';
}

export interface ProcessorAdapter<P> {
  readonly type: string;
  /** Version of the normalized parameter schema for this operation type. */
  readonly schemaVersion: number;
  /**
   * Whether identical (input, identity, params, settings) always produce identical output.
   * Non-deterministic processors must not be cached unless given a deterministic seed/state contract.
   */
  readonly deterministic: boolean;
  /** Validate and canonicalize raw parameters. Throws on invalid input; never silently clamps. */
  normalize(raw: Record<string, unknown>): P;
  identity(params: P): ProcessorIdentity;
  /** Output format given input format. Alpha 0.1 operations preserve the format. */
  outputFormat(input: AudioMetadata, params: P): AudioMetadata;
  process(input: DecodedAudio, params: P, ctx: KernelContext): Promise<DecodedAudio>;
}
