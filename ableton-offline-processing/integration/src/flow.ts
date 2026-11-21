/**
 * The Alpha 0.1 Offline Process flow, written only against LivePort (no SDK import):
 *
 *   resolve clip → admit → renderPreFx → admit WAV → engine importSource → editor (modal) →
 *   setPlan → engine render (history + cache) → export unique WAV → recheck →
 *   importIntoProject (once) → createAudioClip on the existing AOPX RESULT track (once) → verify
 *
 * Invariants:
 * - The source clip and its track are only ever read. The port has no method that could change them.
 * - No host effect happens before the user submits a valid `process` result from the editor.
 * - Each of importIntoProject and createAudioClip is requested at most once per invocation, and
 *   nothing is ever retried. A controller runs one invocation at a time.
 * - Once a host effect has been requested, a throw or timeout is reported as 'unknown-outcome',
 *   never as "nothing changed". There is no automatic rollback (beta.1 documents none).
 * - Cancellation is checked before every host call and every write. It cannot interrupt a host
 *   call already in flight (beta.1 passes no signal to render/import/create).
 */
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONTRACT_VERSION, GAIN_DEFAULT_DB, type AudioMetadata, type OperationPlan, type RenderReport } from '../../engine/src/contract.ts';
import { computePeaks } from '../../engine/src/dsp.ts';
import { Project } from '../../engine/src/project.ts';
import { decodeWav } from '../../engine/src/wav.ts';
import { buildHostInitialState, ModalResultError, parseModalResult } from '../../host/src/modal.ts';
import { HostTimeoutError, IntegrationError } from './errors.ts';
import type { ClipSelection, CreatedClip, LivePort } from './port.ts';
import { DEFAULT_RENDER_ADMISSION, admitRenderedFile, type RenderAdmissionOptions } from './render-input.ts';
import { ProgressForwarder, STAGE_BANDS, inBand } from './progress.ts';
import { expectedFrames, frameToleranceInBeats } from './timing.ts';

export const RESULT_TRACK_NAME = 'AOPX RESULT';

export type FlowStage = 'admission' | 'preflight' | 'render' | 'engine' | 'editor' | 'export' | 'import' | 'create' | 'verify' | 'complete';
export type FlowStatus = 'completed' | 'cancelled' | 'rejected' | 'failed' | 'unknown-outcome' | 'busy';

/** Host effects known to have happened. Reported on every outcome; never undone automatically. */
export interface FlowEffect {
  kind: 'imported' | 'clip-created';
  detail: string;
}

export interface FlowResult {
  status: FlowStatus;
  stage: FlowStage;
  /** Machine-readable reason, e.g. an IntegrationErrorCode, 'user-cancel' or 'host-timeout'. */
  reason?: string;
  message?: string;
  effects: FlowEffect[];
  report?: RenderReport | null;
  created?: CreatedClip;
  outputSha256?: string;
}

export interface FlowOptions {
  /** Plan shown when this audio has no saved history. Default: Reverse → Gain(−3 dB). */
  defaultPlan?: OperationPlan;
  /** Bound on each host effect call (import/create). A timeout is reported as unknown-outcome. */
  hostCallTimeoutMs?: number;
  /** Render admission limits (frame tolerance, size caps). */
  admission?: Partial<Omit<RenderAdmissionOptions, 'tempRoot' | 'expectedFramesFor'>>;
  peakBins?: number;
  /** Minimum interval between progress updates sent to Live (default 100 ms). */
  progressIntervalMs?: number;
}

export const DEFAULT_PLAN: OperationPlan = {
  version: CONTRACT_VERSION,
  operations: [
    { id: 'op-reverse', type: 'reverse', enabled: true },
    { id: 'op-gain', type: 'gain', enabled: true, db: GAIN_DEFAULT_DB },
  ],
};

/** Fail closed unless the selection is exactly the narrow Alpha 0.1 case. Returns refusal reasons. */
export function admissionProblems(s: ClipSelection): string[] {
  const p: string[] = [];
  if (!s.isArrangementAudioClip) p.push('The selection is not an Arrangement audio clip.');
  if (!Number.isFinite(s.tempo) || s.tempo <= 0) p.push('The song tempo is not a positive number.');
  if (!Number.isFinite(s.startBeat) || s.startBeat < 0) p.push('The clip start is invalid.');
  if (!Number.isFinite(s.endBeat) || !(s.endBeat > s.startBeat)) p.push('The clip is empty or its end is invalid.');
  if (s.warping) p.push('Warped clips are not supported in Alpha 0.1; turn Warp off.');
  if (s.looping) p.push('Looped clips are not supported in Alpha 0.1; turn Loop off.');
  if (s.sourceOverlapCount !== 0) p.push('Other clips overlap this clip on its track; the track render would mix them in.');
  if (s.resultTrackMatches !== 1) p.push(`Create exactly one audio track named "${RESULT_TRACK_NAME}" (found ${s.resultTrackMatches}).`);
  else {
    if (!s.resultTrackIsAudio) p.push(`"${RESULT_TRACK_NAME}" must be an audio track.`);
    if (s.resultTrackId === s.trackId) p.push(`"${RESULT_TRACK_NAME}" must not be the clip's own track.`);
    if (s.resultOverlapCount !== 0) p.push(`"${RESULT_TRACK_NAME}" already has a clip over this range; nothing will be covered or replaced.`);
  }
  return p;
}

/** The fields that must not change between preflight and every later host call. */
function stableKey(s: ClipSelection): string {
  return JSON.stringify([
    s.clipId, s.trackId, s.startBeat, s.endBeat, s.tempo, s.warping, s.looping,
    s.sourceOverlapCount, s.resultTrackMatches, s.resultTrackId, s.resultTrackIsAudio, s.resultOverlapCount,
  ]);
}

const sha256 = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex');

function sameFormat(a: AudioMetadata, b: AudioMetadata): boolean {
  return a.sampleRate === b.sampleRate && a.channels === b.channels && a.frames === b.frames && a.encoding === b.encoding && a.bitDepth === b.bitDepth;
}

/** Outcome-carrying stop. Thrown inside the flow, turned into a FlowResult at the top. */
class Stop extends Error {
  readonly status: FlowStatus;
  readonly reason: string;
  constructor(status: FlowStatus, reason: string, message: string) {
    super(message);
    this.name = 'Stop';
    this.status = status;
    this.reason = reason;
  }
}

function bounded<T>(call: string, ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve().then(fn),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new HostTimeoutError(call, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Returns the function the context-menu action calls. One invocation at a time; a second concurrent
 * call returns 'busy' without touching anything.
 */
export function createOfflineProcess(port: LivePort, options: FlowOptions = {}) {
  let busy = false;
  const timeoutMs = options.hostCallTimeoutMs ?? 60_000;
  const admission = { ...DEFAULT_RENDER_ADMISSION, ...options.admission };

  return async function offlineProcess(signal: AbortSignal = new AbortController().signal): Promise<FlowResult> {
    if (busy) return { status: 'busy', stage: 'admission', reason: 'busy', effects: [] };
    busy = true;
    const invocation = randomUUID();
    let stage: FlowStage = 'admission';
    const effects: FlowEffect[] = [];
    /** True while a host effect call (import/create) is outstanding or has been requested without a valid answer. */
    let effectRequested = false;
    const progress = new ProgressForwarder((text, pct) => port.reportProgress(text, pct), { minIntervalMs: options.progressIntervalMs ?? 100 });
    const log = (status: string, extra: Record<string, string | number | boolean> = {}) => {
      try {
        port.log({ event: 'AOPX_OFFLINE_PROCESS', invocation, stage, status, ...extra });
      } catch {
        /* logging never changes the outcome */
      }
    };
    const checkCancel = () => {
      if (signal.aborted) throw new Stop('cancelled', 'user-cancel', 'Cancelled.');
    };

    try {
      // ---- admission and preflight (no host effects)
      const storage = port.storageDirectory;
      const temp = port.tempDirectory;
      if (!storage || !temp) throw new IntegrationError('no-storage', 'The Extension has no storage or temp directory.');
      const selection = await port.resolveSelection();
      const problems = admissionProblems(selection);
      if (problems.length) throw new Stop('rejected', 'not-admitted', problems.join(' '));
      const baseline = stableKey(selection);
      const recheck = async () => {
        const now = await port.resolveSelection();
        if (stableKey(now) !== baseline || admissionProblems(now).length) {
          throw new IntegrationError('selection-changed', 'The clip or the result track changed; nothing further was done.');
        }
      };

      // ---- render (pre-FX, read-only for the Set)
      stage = 'render';
      checkCancel();
      progress.update('Rendering the clip', inBand(STAGE_BANDS.render, 0));
      const renderPath = await port.renderPreFx(selection.trackId, selection.startBeat, selection.endBeat);
      checkCancel();
      await recheck();
      const admitted = await admitRenderedFile(renderPath, {
        ...admission,
        tempRoot: temp,
        expectedFramesFor: (sr) => expectedFrames(selection.startBeat, selection.endBeat, selection.tempo, sr),
      });
      progress.update('Rendered', inBand(STAGE_BANDS.render, 1));

      // ---- engine: import as an immutable source; history is keyed by the audio fingerprint
      stage = 'engine';
      const projectOpts = { storageRoot: join(storage, 'aopx-project'), tempRoot: join(temp, 'aopx-engine') };
      let project: Project;
      try {
        project = await Project.open(projectOpts);
      } catch {
        project = await Project.create(projectOpts);
      }
      const source = await project.importSource(admitted.path, selection.name);
      if (source.fingerprint !== admitted.sha256) {
        throw new IntegrationError('render-changed', 'The rendered file changed between admission and import.');
      }
      const branch = `clip:${source.fingerprint}`;
      const hasHistory = project.branches().includes(branch);
      const initialPlan = hasHistory ? project.plan(branch) : (options.defaultPlan ?? DEFAULT_PLAN);
      const decoded = decodeWav(admitted.bytes);
      const state = buildHostInitialState({
        source,
        waveform: computePeaks(decoded, options.peakBins ?? 512),
        plan: initialPlan,
        diagnostics: hasHistory ? (project.lastOutput(branch)?.report ?? null) : null,
      });

      // ---- editor: anything other than a valid 'process' result is a cancel with no change
      stage = 'editor';
      checkCancel();
      const raw = await port.showEditor(state);
      checkCancel();
      if (typeof raw !== 'string' || raw.length === 0) throw new Stop('cancelled', 'modal-no-result', 'The editor closed without a result.');
      let result;
      try {
        result = parseModalResult(raw);
      } catch (e) {
        if (e instanceof ModalResultError) throw new Stop('cancelled', 'invalid-modal-result', e.message);
        throw e;
      }
      if (result.action === 'cancel') throw new Stop('cancelled', 'user-cancel', 'Cancelled in the editor.');

      // ---- engine render through history + cache
      stage = 'engine';
      project.setPlan(branch, source.fingerprint, result.plan);
      const rendered = await project.render(branch, {
        signal,
        onProgress: (p) => progress.update('Processing', inBand(STAGE_BANDS.engine, p.fraction)),
      });
      await project.save();
      if (rendered.status === 'cancelled' || rendered.status === 'superseded') {
        throw new Stop('cancelled', rendered.status === 'cancelled' ? 'user-cancel' : 'superseded', 'The render was cancelled.');
      }
      if (rendered.status !== 'completed' || !rendered.report || !rendered.outputPath) {
        throw new Stop('failed', 'engine-failed', rendered.error ?? 'The engine render failed.');
      }
      const report = rendered.report;

      // ---- export a uniquely named copy and verify it is exactly the cached output
      stage = 'export';
      checkCancel();
      const expectedSha = sha256(new Uint8Array(await readFile(rendered.outputPath)));
      const exported = await project.exportOutput(branch, `aopx-${source.fingerprint.slice(0, 12)}-${invocation}.wav`);
      const exportedBytes = new Uint8Array(await readFile(exported));
      const outputSha256 = sha256(exportedBytes);
      if (outputSha256 !== expectedSha) throw new IntegrationError('output-changed', 'The exported file does not match the rendered output.');
      const outFormat = decodeWav(exportedBytes).format;
      if (!sameFormat(outFormat, report.outputFormat) || outFormat.sampleRate !== source.format.sampleRate ||
          outFormat.channels !== source.format.channels || outFormat.frames !== source.format.frames) {
        throw new IntegrationError('output-format-mismatch', 'The output does not preserve the source sample rate, channels and length.');
      }
      progress.update('Ready to import', inBand(STAGE_BANDS.export, 1));

      // ---- import once (first host effect)
      stage = 'import';
      checkCancel();
      await recheck();
      checkCancel();
      effectRequested = true;
      const imported = await bounded('importIntoProject', timeoutMs, () => port.importIntoProject(exported));
      if (typeof imported !== 'string' || imported.length === 0 || imported.includes('\0')) {
        throw new Stop('unknown-outcome', 'invalid-import-receipt', 'Live returned no usable path for the imported file.');
      }
      effects.push({ kind: 'imported', detail: imported });
      effectRequested = false;
      progress.update('Imported', inBand(STAGE_BANDS.import, 1));

      // ---- create once on the existing result track (second host effect)
      stage = 'create';
      checkCancel();
      await recheck();
      effectRequested = true;
      const created = await bounded('createAudioClip', timeoutMs, () =>
        port.createAudioClip(selection.resultTrackId, { filePath: imported, startBeat: selection.startBeat, isWarped: false }),
      );
      effects.push({ kind: 'clip-created', detail: created.id });
      effectRequested = false;

      // ---- verify the result and that the source was not changed
      stage = 'verify';
      const tol = frameToleranceInBeats(admission.frameTolerance, outFormat.sampleRate, selection.tempo) + 1e-9;
      const geometryOk =
        created.trackId === selection.resultTrackId && created.filePath === imported && !created.warping && !created.looping &&
        Math.abs(created.startBeat - selection.startBeat) <= tol && Math.abs(created.endBeat - selection.endBeat) <= tol;
      const after = await port.resolveSelection();
      const sourceOk = after.clipId === selection.clipId && after.trackId === selection.trackId &&
        after.startBeat === selection.startBeat && after.endBeat === selection.endBeat &&
        after.warping === selection.warping && after.looping === selection.looping;
      if (!geometryOk) throw new Stop('failed', 'result-geometry-mismatch', 'The new clip is not where or what was requested; it was left in place.');
      if (!sourceOk) throw new Stop('failed', 'source-changed', 'The source clip changed during the operation.');

      stage = 'complete';
      progress.update('Done', 1);
      await progress.flush();
      log('completed', { outputSha256 });
      return { status: 'completed', stage, effects, report, created, outputSha256 };
    } catch (e) {
      await progress.flush().catch(() => undefined);
      let out: FlowResult;
      if (e instanceof Stop) {
        out = { status: e.status, stage, reason: e.reason, message: e.message, effects };
      } else if (effectRequested) {
        // A host effect was requested and did not return a valid answer: it may or may not have happened.
        const reason = e instanceof HostTimeoutError ? 'host-timeout' : 'host-error';
        out = { status: 'unknown-outcome', stage, reason, message: 'Live did not confirm the result. Check the Set before trying again.', effects };
      } else if (e instanceof IntegrationError) {
        out = { status: e.code === 'no-storage' || e.code.startsWith('render-') || e.code === 'selection-changed' ? 'rejected' : 'failed', stage, reason: e.code, message: e.message, effects };
      } else if ((e as Error)?.name === 'AbortError') {
        out = { status: 'cancelled', stage, reason: 'user-cancel', message: 'Cancelled.', effects };
      } else {
        out = { status: 'failed', stage, reason: 'error', message: (e as Error)?.message ?? String(e), effects };
      }
      log(out.status, { reason: out.reason ?? '' , effects: effects.length });
      return out;
    } finally {
      busy = false;
    }
  };
}
