/**
 * The Alpha 0.1 Offline Process flow, written only against LivePort (no SDK import):
 *
 *   journal check → resolve clip → admit → renderPreFx → admit WAV (one bounded read) →
 *   engine importSourceBytes → editor (modal) → setPlan → engine render (history + cache) →
 *   export unique WAV → recheck → re-verify export → journal intent → importIntoProject (once) →
 *   validate receipt + imported content → journal ack → recheck → journal intent →
 *   createAudioClip on the existing AOPX RESULT track (once) → journal ack → verify → close journal
 *
 * Invariants:
 * - The source clip and its track are only ever read. The port has no method that could change them.
 * - No host effect happens before the user submits a valid `process` result from the editor.
 * - Each of importIntoProject and createAudioClip is requested at most once per invocation, and
 *   nothing is ever retried or undone (beta.1 documents no rollback).
 * - Every effect request is preceded by a durable journal intent. Until every effect it describes is
 *   known, the record stays open and every later invocation (this controller, another one, or after
 *   a restart) returns 'reconciliation-required' without calling Live.
 * - Cancellation is checked again immediately before every effect request, after all awaits. It
 *   cannot interrupt a host call already in flight (beta.1 passes no signal to render/import/create).
 * - `setChanged` is honest: 'no' only when no effect was requested; 'unknown' when one was
 *   requested without a valid answer; otherwise 'yes', with `effects` listing what is known.
 */
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { CONTRACT_VERSION, GAIN_DEFAULT_DB, type AudioMetadata, type OperationPlan, type RenderReport } from '../../engine/src/contract.ts';
import { computePeaks } from '../../engine/src/dsp.ts';
import { sha256File } from '../../engine/src/hash.ts';
import { Project } from '../../engine/src/project.ts';
import { decodeWav } from '../../engine/src/wav.ts';
import { buildHostInitialState, ModalResultError, parseModalResult } from '../../host/src/modal.ts';
import { BoundedReadError, readFileBounded } from './bounded-read.ts';
import { HostTimeoutError, IntegrationError } from './errors.ts';
import { pendingReconciliation, writeRecord, journalDir, type JournalRecord, type JournalState } from './journal.ts';
import type { ClipSelection, CreatedClip, LivePort } from './port.ts';
import { DEFAULT_RENDER_ADMISSION, admitRenderedFile, type RenderAdmissionOptions } from './render-input.ts';
import { ProgressForwarder, STAGE_BANDS, inBand } from './progress.ts';
import { expectedFrames, frameToleranceInBeats } from './timing.ts';
import { validateWavContainer } from './wav-container.ts';

export const RESULT_TRACK_NAME = 'AOPX RESULT';

export type FlowStage = 'admission' | 'preflight' | 'render' | 'engine' | 'editor' | 'export' | 'import' | 'create' | 'verify' | 'complete';

/**
 * - completed: imported once, one new clip on AOPX RESULT, verified.
 * - partial: stopped after at least one known effect; `effects` lists them (nothing undone).
 * - cancelled / rejected / failed: stopped before any effect was requested; the Set is unchanged.
 * - unknown-outcome: an effect was requested and Live gave no valid answer; check the Set.
 * - reconciliation-required: an earlier invocation's effects are not all known; nothing was done.
 * - busy: another invocation is running in this process; nothing was done.
 */
export type FlowStatus = 'completed' | 'partial' | 'cancelled' | 'rejected' | 'failed' | 'unknown-outcome' | 'reconciliation-required' | 'busy';

/** Host effects known to have happened. Reported on every outcome; never undone automatically. */
export interface FlowEffect {
  kind: 'imported' | 'clip-created';
  detail: string;
}

export interface FlowResult {
  status: FlowStatus;
  stage: FlowStage;
  /** Whether this invocation may have changed the Set. */
  setChanged: 'no' | 'yes' | 'unknown';
  invocation?: string;
  /** Machine-readable reason, e.g. an IntegrationErrorCode, 'user-cancel' or 'host-timeout'. */
  reason?: string;
  message?: string;
  effects: FlowEffect[];
  /** Invocations awaiting reconciliation (status 'reconciliation-required', or this one if it left a record open). */
  pending?: string[];
  report?: RenderReport | null;
  created?: CreatedClip;
  outputSha256?: string;
}

export interface FlowOptions {
  /** Plan shown when this audio has no saved history. Default: Reverse → Gain(−3 dB). */
  defaultPlan?: OperationPlan;
  /** Bound on each host effect call (import/create). A timeout is reported as unknown-outcome. */
  hostCallTimeoutMs?: number;
  /** Render admission limits (frame tolerance, size and memory caps). */
  admission?: Partial<Omit<RenderAdmissionOptions, 'tempRoot' | 'expectedFramesFor'>>;
  peakBins?: number;
  /** Minimum interval between progress updates sent to Live (default 100 ms). */
  progressIntervalMs?: number;
  /** Longest the flow waits for pending progress updates before returning its outcome (default 1000 ms). */
  progressDrainMs?: number;
  /**
   * Whether the imported copy must be read back and hash-checked before a clip is created.
   * 'required' (default) stops if it cannot be read; whether the Extension may read the project
   * folder is a native uncertainty (U9).
   */
  verifyImportedContent?: 'required' | 'if-readable';
  /** Test seam: replaces the durable journal writer (default writeRecord). */
  journalWriter?: (storageDirectory: string, record: JournalRecord) => Promise<void>;
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

const inside = (root: string, p: string): boolean => {
  const rel = relative(resolve(root), resolve(p));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** Problems with the path importIntoProject returned, or null if it looks like a project-managed copy. */
export function importReceiptProblem(imported: unknown, exported: string, roots: { temp: string; storage: string }): string | null {
  if (typeof imported !== 'string' || imported.length === 0) return 'no path';
  if (imported.length > 32_768 || imported.includes('\0')) return 'malformed path';
  if (!isAbsolute(imported)) return 'relative path';
  if (resolve(imported) === resolve(exported)) return 'the export path itself, not a project copy';
  if (inside(roots.temp, imported) || inside(roots.storage, imported)) return 'a path inside Extension storage, not the project';
  return null;
}

/** Only one invocation at a time in this process, across all controllers (working-set budget, H5). */
let activeInvocations = 0;

/**
 * Returns the function the context-menu action calls. A second call while one is running returns
 * 'busy' without touching anything.
 */
export function createOfflineProcess(port: LivePort, options: FlowOptions = {}) {
  const timeoutMs = options.hostCallTimeoutMs ?? 60_000;
  const admission = { ...DEFAULT_RENDER_ADMISSION, ...options.admission };
  /** Belt and braces next to the journal: an invocation of this controller that left effects unknown. */
  let latched: string | null = null;

  return async function offlineProcess(signal: AbortSignal = new AbortController().signal): Promise<FlowResult> {
    if (activeInvocations > 0) return { status: 'busy', stage: 'admission', setChanged: 'no', reason: 'busy', effects: [] };
    activeInvocations++;
    try {
      return await runOnce(signal);
    } finally {
      activeInvocations--;
    }
  };

  async function runOnce(signal: AbortSignal): Promise<FlowResult> {
    const invocation = randomUUID();
    let stage: FlowStage = 'admission';
    const effects: FlowEffect[] = [];
    /** An effect request is outstanding or was answered invalidly: it may or may not have happened. */
    let uncertain = false;
    /** Leave the journal record open (effects not all known, or the journal itself failed). */
    let needsReconcile = false;
    let record: JournalRecord | null = null;
    let storage = '';
    let report: RenderReport | null = null;
    let created: CreatedClip | undefined;
    let outputSha256: string | undefined;
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
    const journal = async (state: JournalState, extra: Partial<JournalRecord> = {}) => {
      record = { ...(record ?? { schema: 1, invocation, updatedAt: '' }), ...extra, state };
      await (options.journalWriter ?? writeRecord)(storage, record);
    };

    let status: FlowStatus = 'completed';
    let reason: string | undefined;
    let message: string | undefined;
    let pending: string[] | undefined;
    try {
      // ---- admission and preflight (no host effects)
      const temp = port.tempDirectory;
      if (!port.storageDirectory || !temp) throw new IntegrationError('no-storage', 'The Extension has no storage or temp directory.');
      storage = port.storageDirectory;
      let open: string[];
      try {
        open = await pendingReconciliation(storage);
      } catch (e) {
        throw new IntegrationError('journal-failed', `The effect journal cannot be read, so nothing was done: ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}`);
      }
      if (latched && !open.includes(latched)) {
        // The latch clears only once its journal record is closed (acknowledged), not merely missing.
        const rec = await readFile(join(journalDir(storage), `${latched}.json`), 'utf8').then((t) => JSON.parse(t) as JournalRecord).catch(() => null);
        if (rec?.state === 'closed') latched = null;
      }
      if (open.length || latched) {
        pending = [...new Set([...open, ...(latched ? [latched] : [])])];
        throw new Stop('reconciliation-required', 'reconciliation-required', 'An earlier Offline Process did not confirm its result. Check the Set, then acknowledge it before running again.');
      }
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
      const roots = { temp, storage };
      const selectionRef = { clipId: selection.clipId, trackId: selection.trackId, resultTrackId: selection.resultTrackId, startBeat: selection.startBeat, endBeat: selection.endBeat };

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

      // ---- engine: open existing state or create it only when it is genuinely absent (H1)
      stage = 'engine';
      const projectOpts = { storageRoot: join(storage, 'aopx-project'), tempRoot: join(temp, 'aopx-engine') };
      let manifestExists: boolean;
      try {
        await lstat(join(projectOpts.storageRoot, 'project.json'));
        manifestExists = true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new IntegrationError('project-unreadable', `The saved AOPX project cannot be checked (${(e as NodeJS.ErrnoException).code}); it was left untouched.`);
        }
        manifestExists = false;
      }
      let project: Project;
      if (manifestExists) {
        try {
          project = await Project.open(projectOpts);
        } catch (e) {
          throw new IntegrationError('project-unreadable', `The saved AOPX project could not be opened and was left untouched: ${(e as Error).message}`);
        }
      } else {
        project = await Project.create(projectOpts);
      }
      // The verified bytes go to the engine directly: the render path is not read again (H5).
      const source = await project.importSourceBytes(admitted.bytes, selection.name, admitted.path);
      if (source.fingerprint !== admitted.sha256) throw new IntegrationError('render-changed', 'The rendered audio changed between admission and import.');
      const branch = `clip:${source.fingerprint}`;
      const hasHistory = project.branches().includes(branch);
      const initialPlan = hasHistory ? project.plan(branch) : (options.defaultPlan ?? DEFAULT_PLAN);
      const waveform = computePeaks(decodeWav(admitted.bytes), options.peakBins ?? 512);
      const state = buildHostInitialState({
        source,
        waveform,
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
      report = rendered.report;

      // ---- export a uniquely named copy; verify it is exactly the cached output, strictly valid
      stage = 'export';
      checkCancel();
      const expectedSha = await sha256File(rendered.outputPath);
      const exported = await project.exportOutput(branch, `aopx-${source.fingerprint.slice(0, 12)}-${invocation}.wav`);
      let exportSize: number;
      {
        const { bytes } = await readFileBounded(exported, admission.maxFileBytes);
        outputSha256 = sha256(bytes);
        if (outputSha256 !== expectedSha) throw new IntegrationError('output-changed', 'The exported file does not match the rendered output.');
        const c = validateWavContainer(bytes);
        const out: AudioMetadata = { channels: c.channels, sampleRate: c.sampleRate, bitDepth: c.bitDepth, frames: c.frames, encoding: c.encoding, durationSeconds: c.frames / c.sampleRate };
        if (!sameFormat(out, report.outputFormat) || !sameFormat(out, source.format)) {
          throw new IntegrationError('output-format-mismatch', 'The output does not preserve the source sample rate, channels, length and format.');
        }
        exportSize = bytes.byteLength;
      }
      const outFormat = source.format;
      /** Re-read the owned export immediately before it is handed to Live (H4). */
      const reverifyExport = async () => {
        try {
          const { bytes } = await readFileBounded(exported, exportSize);
          if (bytes.byteLength !== exportSize || sha256(bytes) !== outputSha256) throw new Error('hash');
        } catch {
          throw new IntegrationError('output-changed', 'The exported file changed before import; nothing was imported.');
        }
      };
      progress.update('Ready to import', inBand(STAGE_BANDS.export, 1));

      // ---- import once (first host effect)
      stage = 'import';
      checkCancel();
      await recheck();
      await reverifyExport();
      try {
        await journal('import-intent', { exportSha256: outputSha256, selection: selectionRef });
      } catch (e) {
        throw new IntegrationError('journal-failed', `Could not record the import intent, so nothing was imported: ${(e as Error).message}`);
      }
      if (signal.aborted) throw new Stop('cancelled', 'user-cancel', 'Cancelled before import.'); // last check, no await after it
      uncertain = true;
      const imported = await bounded('importIntoProject', timeoutMs, () => port.importIntoProject(exported));
      const receiptProblem = importReceiptProblem(imported, exported, roots);
      if (receiptProblem) throw new Stop('unknown-outcome', 'invalid-import-receipt', `Live's import receipt is unusable (${receiptProblem}); check the project before trying again.`);
      uncertain = false;
      effects.push({ kind: 'imported', detail: imported });
      try {
        await journal('import-acked', { importedPath: imported });
      } catch {
        needsReconcile = true;
        throw new Stop('partial', 'journal-failed', 'The import happened but could not be recorded; stopped before creating a clip.');
      }
      try {
        const { bytes } = await readFileBounded(imported, exportSize);
        if (sha256(bytes) !== outputSha256) {
          needsReconcile = true;
          throw new Stop('partial', 'imported-content-mismatch', 'The imported copy does not match the processed audio; no clip was created.');
        }
      } catch (e) {
        if (e instanceof Stop) throw e;
        if ((options.verifyImportedContent ?? 'required') === 'required') {
          needsReconcile = true;
          throw new Stop('partial', 'imported-content-unverified', `The imported copy could not be read back (${e instanceof BoundedReadError ? e.kind : (e as NodeJS.ErrnoException).code ?? 'error'}); no clip was created.`);
        }
        log('imported-content-unverified');
      }
      progress.update('Imported', inBand(STAGE_BANDS.import, 1));

      // ---- create once on the existing result track (second host effect)
      stage = 'create';
      checkCancel();
      await recheck();
      try {
        await journal('create-intent');
      } catch {
        needsReconcile = true;
        throw new Stop('partial', 'journal-failed', 'Could not record the clip intent; stopped after the import, before creating a clip.');
      }
      if (signal.aborted) throw new Stop('cancelled', 'user-cancel', 'Cancelled after import, before creating a clip.');
      uncertain = true;
      created = await bounded('createAudioClip', timeoutMs, () =>
        port.createAudioClip(selection.resultTrackId, { filePath: imported, startBeat: selection.startBeat, isWarped: false }),
      );
      if (!created || typeof created.id !== 'string' || created.id.length === 0) {
        created = undefined;
        throw new Stop('unknown-outcome', 'invalid-create-receipt', 'Live returned no usable clip; check the AOPX RESULT track before trying again.');
      }
      uncertain = false;
      effects.push({ kind: 'clip-created', detail: created.id });
      try {
        await journal('create-acked', { clipId: created.id });
      } catch {
        needsReconcile = true;
        throw new Stop('partial', 'journal-failed', 'The clip was created but could not be recorded.');
      }

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
    } catch (e) {
      if (e instanceof Stop) {
        status = e.status;
        reason = e.reason;
        message = e.message;
      } else if (uncertain) {
        reason = e instanceof HostTimeoutError ? 'host-timeout' : 'host-error';
        message = 'Live did not confirm the result. Check the Set before trying again.';
      } else if (e instanceof IntegrationError) {
        status = e.code === 'no-storage' || e.code.startsWith('render-') || e.code === 'selection-changed' ? 'rejected' : 'failed';
        reason = e.code;
        message = e.message;
      } else if ((e as Error)?.name === 'AbortError') {
        status = 'cancelled';
        reason = 'user-cancel';
        message = 'Cancelled.';
      } else {
        status = 'failed';
        reason = 'error';
        message = (e as Error)?.message ?? String(e);
      }
    }

    // ---- honest outcome (M2): uncertainty and known effects override the stop reason
    let setChanged: FlowResult['setChanged'];
    if (uncertain) {
      status = 'unknown-outcome';
      setChanged = 'unknown';
      needsReconcile = true;
    } else if (effects.length > 0) {
      if (status !== 'completed') status = 'partial';
      setChanged = 'yes';
    } else {
      setChanged = 'no';
    }
    if (record && !needsReconcile) {
      try {
        await journal('closed', { outcome: `${status}${reason ? `:${reason}` : ''}` });
      } catch {
        needsReconcile = true; // the record stays open, which blocks re-runs: safe
      }
    }
    if (needsReconcile) {
      latched = invocation;
      pending = [invocation];
    }
    // A hung progress dialog must not delay the outcome (M1).
    await progress.drain(options.progressDrainMs ?? 1000);
    log(status, { reason: reason ?? '', effects: effects.length, setChanged });
    const out: FlowResult = { status, stage, setChanged, invocation, effects };
    if (reason) out.reason = reason;
    if (message) out.message = message;
    if (pending) out.pending = pending;
    if (report) out.report = report;
    if (created) out.created = created;
    if (outputSha256) out.outputSha256 = outputSha256;
    return out;
  }
}
