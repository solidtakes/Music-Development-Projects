// The wire shapes shared with engine/src/contract.ts. A combined type-check
// verifies the copies while the GUI and engine changes are reviewed separately.
export type Operation = ({ type: 'reverse' } | { type: 'gain'; db: number }) & {
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
  renderMs: number;
  lookupMs: number;
  bytes: number;
  cacheKey: string | null;
  format: AudioMetadata;
}

export interface RenderReport {
  steps: RenderStep[];
  sourceBytes: number;
  outputBytes: number;
  outputFormat: AudioMetadata;
  cacheBytes: number;
  projectBytes: number;
}

export interface OperationPlan {
  version: 1;
  operations: Operation[];
}

export interface EditorSession {
  mode: 'mock' | 'preview' | 'live';
  source: SourceInfo;
  waveform: WaveformPeak[];
  operations: Operation[];
  sourceAudio?: string;
  report?: RenderReport;
  theme?: 'dark' | 'light';
}

export type RenderState =
  | { state: 'rendering'; progress: RenderProgress | null }
  | { state: 'complete'; report: RenderReport; outputAudio: string }
  | { state: 'cancelled' }
  | { state: 'error'; message: string };

export type ModalResult =
  | { action: 'render'; plan: OperationPlan; theme: 'dark' | 'light' }
  | { action: 'edit'; theme: 'dark' | 'light' }
  | { action: 'close' | 'cancel' };
