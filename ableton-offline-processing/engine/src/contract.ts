/** The version of the wire envelope and normalized operation schema. */
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
}

/** Shared by the modal submit flow and the standalone preview transport. */
export interface OperationPlan {
  version: typeof CONTRACT_VERSION;
  operations: Operation[];
}
