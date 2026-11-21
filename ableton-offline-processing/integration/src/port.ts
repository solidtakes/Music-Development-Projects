/**
 * The only boundary between the Offline Process flow and Live. A real adapter (the single file that
 * imports `@ableton-extensions/sdk`) implements this; tests use an in-memory fake. Nothing here
 * mutates the source clip or its track: the port has no such method by design.
 *
 * Beta.1 evidence for each call is in reviews/ALPHA01_OFFLINE_INTEGRATION_PLAN_2026-11-21.md §2.
 */
import type { HostInitialState } from '../../engine/src/contract.ts';

/** Everything admission needs about the context-menu clip and the user-created result track. */
export interface ClipSelection {
  clipId: string;
  trackId: string;
  name: string;
  /** The handle resolved to an AudioClip whose parent is an Arrangement AudioTrack. */
  isArrangementAudioClip: boolean;
  /** Arrangement beats. */
  startBeat: number;
  endBeat: number;
  /** Song tempo in BPM. Alpha 0.1 assumes a constant tempo over the clip (native uncertainty U4). */
  tempo: number;
  warping: boolean;
  looping: boolean;
  /** Other clips on the source track that overlap [startBeat, endBeat). A pre-FX track render would mix them in. */
  sourceOverlapCount: number;
  /** Number of tracks named RESULT_TRACK_NAME. Must be exactly 1. */
  resultTrackMatches: number;
  resultTrackId: string;
  resultTrackIsAudio: boolean;
  /** Clips on the result track that overlap [startBeat, endBeat). Must be 0, so nothing is covered. */
  resultOverlapCount: number;
}

/** What createAudioClip returned, re-read from the host. */
export interface CreatedClip {
  id: string;
  trackId: string;
  filePath: string;
  startBeat: number;
  endBeat: number;
  warping: boolean;
  looping: boolean;
}

export interface LivePort {
  /** `context.environment.storageDirectory` (persistent). beta.1 types it as possibly undefined. */
  readonly storageDirectory: string | undefined;
  /** `context.environment.tempDirectory` (disposable). beta.1 types it as possibly undefined. */
  readonly tempDirectory: string | undefined;
  /** Read-only snapshot of the selection. Called again before every host effect to detect drift. */
  resolveSelection(): Promise<ClipSelection>;
  /** `resources.renderPreFxAudio(track, startBeat, endBeat)`: path of a file in tempDirectory. */
  renderPreFx(trackId: string, startBeat: number, endBeat: number): Promise<string>;
  /** Deliver the editor and return whatever `showModalDialog` resolved with (validated by the flow). */
  showEditor(state: HostInitialState): Promise<unknown>;
  /** `withinProgressDialog` update; percent is 0..100 as beta.1 declares. */
  reportProgress(text: string, percent: number): Promise<void>;
  /** `resources.importIntoProject(path)`: the project-managed path to use from now on. */
  importIntoProject(path: string): Promise<string>;
  /** `AudioTrack.createAudioClip({ filePath, startTime, isWarped: false })` on the result track. */
  createAudioClip(trackId: string, spec: { filePath: string; startBeat: number; isWarped: false }): Promise<CreatedClip>;
  /** Structured event only: no raw SDK errors or file contents. */
  log(event: Record<string, string | number | boolean>): void;
}
