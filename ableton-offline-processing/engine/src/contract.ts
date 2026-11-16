/**
 * The version of the OperationPlan and normalized operation schema. It is part of every cache key,
 * so it changes only when operation semantics change. The modal message envelope is versioned
 * separately by MODAL_ENVELOPE_VERSION.
 */
export const CONTRACT_VERSION = 1;
export const GAIN_MIN_DB = -60;
export const GAIN_MAX_DB = 24;
export const GAIN_DEFAULT_DB = -3;

export type Operation = ({ type: 'reverse' } | { type: 'gain'; db: number }) & {
  /** Stable across edits to an individual operation. */
  id: string;
  enabled: boolean;
};

export interface AudioMetadata {
  channels: number;
  sampleRate: number;
  bitDepth: number;
  frames: number;
  durationSeconds: number;
  encoding: 'pcm' | 'float';
}

export interface SourceInfo {
  name: string;
  fingerprint: string;
  bytes: number;
  format: AudioMetadata;
}

export interface WaveformPeak {
  min: number;
  max: number;
}

export interface RenderProgress {
  completed: number;
  total: number;
  operationId: string | null;
  fraction: number;
}

export interface RenderStep {
  operationId: string;
  status: 'miss' | 'hit' | 'bypassed';
  /** Total processing and write time for the cache entry, carried forward on hits. */
  renderMs: number;
  /** Time to look up and verify the cache for this request. */
  lookupMs: number;
  bytes: number;
  cacheKey: string | null;
  format: AudioMetadata;
}

/** All byte counts are logical filesystem lengths. */
export interface RenderReport {
  steps: RenderStep[];
  sourceBytes: number;
  outputBytes: number;
  outputFormat: AudioMetadata;
  cacheBytes: number;
  projectBytes: number;
  /**
   * Measured wall-clock time of this render request, in ms, from the start of the request until the
   * report was produced. Unlike RenderStep.renderMs, it is never carried forward from a cache entry,
   * so an all-cache-hit render reports how long it actually took. null only for reports persisted by
   * an engine that predates this field.
   */
  wallMs: number | null;
}

/** Shared by the modal submit flow and the standalone preview transport. */
export interface OperationPlan {
  version: typeof CONTRACT_VERSION;
  operations: Operation[];
}

/** Version of the modal envelope: HostInitialState (host → GUI) and ModalResult (GUI → host). */
export const MODAL_ENVELOPE_VERSION = 1;

/**
 * State the Extension Host gives the modal GUI before it opens, as `window.AOPX_INITIAL_STATE`.
 * The GUI never renders audio; diagnostics are only ever a real engine RenderReport.
 */
export interface HostInitialState {
  envelopeVersion: typeof MODAL_ENVELOPE_VERSION;
  source: SourceInfo;
  waveform: WaveformPeak[];
  plan: OperationPlan;
  /** The last completed render for this source, or null if there is none. */
  diagnostics: RenderReport | null;
  /** Host-provided state is real, never preview data. */
  preview: false;
}

/** The string the modal returns through `close_and_send` is the JSON of one of these. */
export type ModalResult =
  | { envelopeVersion: typeof MODAL_ENVELOPE_VERSION; action: 'cancel' }
  | { envelopeVersion: typeof MODAL_ENVELOPE_VERSION; action: 'process'; plan: OperationPlan };
