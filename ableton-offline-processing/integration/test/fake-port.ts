/**
 * In-memory LivePort for CI. It records every call, never touches a real Live Set, and lets each
 * test script host behaviour (formats, failures, hangs, drift). It is a test double, not SDK code.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HostInitialState } from '../../engine/src/contract.ts';
import { decodeWav, encodeWav, makeMetadata } from '../../engine/src/wav.ts';
import type { ClipSelection, CreatedClip, LivePort } from '../src/port.ts';
import { beatsToSeconds } from '../src/timing.ts';

export const SAMPLE_RATE = 48_000;

/** Stereo test signal whose channels can never be confused: L is a sine, R a slow ramp. */
export function stereoSignal(frames: number, sampleRate = SAMPLE_RATE, peak = 0.5): Float64Array {
  const s = new Float64Array(frames * 2);
  for (let f = 0; f < frames; f++) {
    s[f * 2] = peak * Math.sin((2 * Math.PI * 440 * f) / sampleRate);
    s[f * 2 + 1] = peak * (f / Math.max(1, frames - 1)) * 2 - peak;
  }
  return s;
}

export function wavBytes(frames: number, opts: { channels?: number; sampleRate?: number; bitDepth?: number; samples?: Float64Array } = {}): Uint8Array {
  const channels = opts.channels ?? 2;
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
  const samples = opts.samples ?? (channels === 2 ? stereoSignal(frames, sampleRate) : new Float64Array(frames).map((_, i) => 0.25 * Math.sin(i / 7)));
  return encodeWav(makeMetadata(channels, sampleRate, opts.bitDepth ?? 24, 'pcm', frames), samples).bytes;
}

export const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

export interface FakeOptions {
  selection?: Partial<ClipSelection>;
  /** Bytes the "pre-FX render" writes; default: the user's source media for the clip range. */
  renderBytes?: (frames: number) => Uint8Array;
  /** Where the render is written; default: inside tempDirectory. */
  renderOutsideTemp?: boolean;
  editor?: (state: HostInitialState) => unknown | Promise<unknown>;
  importBehaviour?: 'ok' | 'throw' | 'hang' | 'empty';
  createBehaviour?: 'ok' | 'throw' | 'hang' | 'wrong-start';
  /** Called before each resolveSelection after the first; may mutate the selection. */
  onResolve?: (n: number, sel: ClipSelection) => void;
  onImport?: () => void;
  onProgress?: (text: string, percent: number) => void;
}

export interface FakePort extends LivePort {
  calls: string[];
  progress: Array<{ text: string; percent: number }>;
  editorStates: HostInitialState[];
  selection: ClipSelection;
  root: string;
  /** The user's original media for the source clip. The flow must never write it. */
  sourceMediaPath: string;
  sourceMediaSha: string;
  projectDir: string;
  logs: Array<Record<string, string | number | boolean>>;
}

export async function makeFakePort(opts: FakeOptions = {}): Promise<FakePort> {
  const root = await mkdtemp(join(tmpdir(), 'aopx-int-'));
  const tempDirectory = join(root, 'temp');
  const storageDirectory = join(root, 'storage');
  const projectDir = join(root, 'live-project');
  const elsewhere = join(root, 'elsewhere');
  for (const d of [tempDirectory, storageDirectory, projectDir, elsewhere]) await mkdir(d, { recursive: true });

  const selection: ClipSelection = {
    clipId: 'clip-1', trackId: 'track-dry', name: 'Dry take', isArrangementAudioClip: true,
    startBeat: 8, endBeat: 12, tempo: 120, warping: false, looping: false, sourceOverlapCount: 0,
    resultTrackMatches: 1, resultTrackId: 'track-result', resultTrackIsAudio: true, resultOverlapCount: 0,
    ...opts.selection,
  };
  // Admission-rejection tests use invalid ranges/tempos; the fake still needs some media for them.
  const valid = selection.tempo > 0 && selection.endBeat > selection.startBeat;
  const frames = valid ? Math.round(beatsToSeconds(selection.endBeat - selection.startBeat, selection.tempo) * SAMPLE_RATE) : SAMPLE_RATE;
  const sourceMediaPath = join(root, 'user-media.wav');
  const media = wavBytes(frames);
  await writeFile(sourceMediaPath, media);

  const calls: string[] = [];
  const progress: Array<{ text: string; percent: number }> = [];
  const editorStates: HostInitialState[] = [];
  const logs: Array<Record<string, string | number | boolean>> = [];
  let resolves = 0;
  let renders = 0;
  const never = () => new Promise<never>(() => undefined);

  const port: FakePort = {
    storageDirectory, tempDirectory, calls, progress, editorStates, selection, root, sourceMediaPath,
    sourceMediaSha: sha256(media), projectDir, logs,
    async resolveSelection() {
      calls.push('resolveSelection');
      if (resolves > 0) opts.onResolve?.(resolves, port.selection);
      resolves++;
      return { ...port.selection };
    },
    async renderPreFx(trackId, startBeat, endBeat) {
      calls.push(`renderPreFx:${trackId}:${startBeat}:${endBeat}`);
      const bytes = opts.renderBytes ? opts.renderBytes(frames) : new Uint8Array(await readFile(sourceMediaPath));
      const out = join(opts.renderOutsideTemp ? elsewhere : tempDirectory, `render-${renders++}.wav`);
      await writeFile(out, bytes);
      return out;
    },
    async showEditor(state) {
      calls.push('showEditor');
      editorStates.push(state);
      return opts.editor ? opts.editor(state) : JSON.stringify({ envelopeVersion: 1, action: 'process', plan: state.plan });
    },
    async reportProgress(text, percent) {
      progress.push({ text, percent });
      opts.onProgress?.(text, percent);
    },
    async importIntoProject(path) {
      calls.push('importIntoProject');
      opts.onImport?.();
      const b = opts.importBehaviour ?? 'ok';
      if (b === 'throw') throw new Error('host import failed');
      if (b === 'hang') return never();
      if (b === 'empty') return '';
      const dest = join(projectDir, `imported-${calls.length}.wav`);
      await copyFile(path, dest);
      return dest;
    },
    async createAudioClip(trackId, spec) {
      calls.push(`createAudioClip:${trackId}:${spec.startBeat}:${spec.isWarped}`);
      const b = opts.createBehaviour ?? 'ok';
      if (b === 'throw') throw new Error('host create failed');
      if (b === 'hang') return never();
      const { format } = decodeWav(new Uint8Array(await readFile(spec.filePath)));
      const lengthBeats = (format.frames / format.sampleRate) * (port.selection.tempo / 60);
      const start = b === 'wrong-start' ? spec.startBeat + 1 : spec.startBeat;
      const created: CreatedClip = { id: 'clip-new', trackId, filePath: spec.filePath, startBeat: start, endBeat: start + lengthBeats, warping: false, looping: false };
      return created;
    },
    log(event) {
      logs.push(event);
    },
  };
  return port;
}

export const processPlan = (plan: unknown) => JSON.stringify({ envelopeVersion: 1, action: 'process', plan });
