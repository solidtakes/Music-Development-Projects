export interface Snapshot {
  song: string; source: string; sourceTrack: string; target: string;
  sourcePath: string; tempo: number; start: number; end: number;
  sourceDuration: number; sourceAudio: boolean; sourceMember: boolean; targetAudio: boolean;
  targetName: string; targetMatches: number; originalState: string;
  sourceClips: number; sourceSlots: number; sourceLanes: number; sourceDevices: number;
  targetClips: number; targetSlots: number; targetLanes: number; targetDevices: number;
  grouped: boolean; warped: boolean; looping: boolean; muted: boolean;
}
export interface Receipt {
  schema: 1; id: string; stage: string; state: 'intent' | 'ack';
  details?: Record<string, string | number>;
}
export interface Created {
  id: string; parent: string; path: string; start: number; end: number;
  warped: boolean; looping: boolean;
}
export interface Port {
  snapshot(): Snapshot;
  render(snapshot: Snapshot): Promise<Uint8Array>;
  confirm(preview: { nonce: string; frames: number; channels: number; hash: string }): Promise<unknown>;
  journal(record: Receipt): Promise<void>;
  hasPriorOperation(): Promise<boolean>;
  exportOwned(id: string, bytes: Uint8Array, digest: string): Promise<string>;
  verifyOwned(path: string, digest: string): Promise<void>;
  importCopy(path: string): Promise<string>;
  createClip(target: string, path: string, start: number): Promise<Created>;
  verifyResult(baseline: Snapshot, created: Created): void;
  log(event: { event: string; id: string; stage: string; status: string }): void;
}
export interface Result {
  status: 'locked' | 'busy' | 'cancelled' | 'rejected' | 'unknown-outcome' | 'verified';
  stage: string; id?: string;
}
