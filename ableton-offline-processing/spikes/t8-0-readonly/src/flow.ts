/**
 * T8-0 READ-ONLY probe. Never imports, creates, or modifies a Live clip/track/Set.
 * Uses canonical AOPX WAV decoding, waveform/DSP, and modal envelope/parser.
 * The sole filesystem side effect is Live's S4 render to its temporary directory.
 */
import { decodeWav, encodeWav } from "./product/engine/src/wav.ts";
import { computePeaks, gain, reverse } from "./product/engine/src/dsp.ts";
import { sha256Hex } from "./product/engine/src/hash.ts";
import { buildHostInitialState, injectInitialState, parseModalResult } from "./product/host/src/modal.ts";
import { CONTRACT_VERSION, type OperationPlan, type WaveformPeak } from "./product/engine/src/contract.ts";

export const MAX_RENDER_BYTES = 32 * 1024 * 1024;
export const MAX_MODAL_URL_CHARS = 1_500_000;
export const MAX_OPERATIONS = 16;
export const WAVEFORM_BINS = 96;

/**
 * Numbers-only summary of the waveform handed to the editor (Fix 2 diagnostics). It separates a
 * genuinely silent render (every peak 0) from a display problem, without logging any audio data.
 */
export function summarizeWaveform(peaks: readonly WaveformPeak[]): {
  bins: number; peakAbs: number; peakDbfs: number | null; nonzeroBins: number; silent: boolean;
} {
  let peakAbs = 0;
  let nonzeroBins = 0;
  for (const p of peaks) {
    const a = Math.max(Math.abs(p.min), Math.abs(p.max));
    if (a > 0) nonzeroBins += 1;
    if (a > peakAbs) peakAbs = a;
  }
  return {
    bins: peaks.length,
    peakAbs: Number(peakAbs.toFixed(6)),
    peakDbfs: peakAbs > 0 ? Number((20 * Math.log10(peakAbs)).toFixed(1)) : null,
    nonzeroBins,
    silent: peakAbs === 0,
  };
}

export interface ResolvedClip<Track> {
  scope: "Arrangement" | "Other";
  track: Track | null;
  trackIndex: number | null;
  startBeat: number;
  endBeat: number;
  overlappingClipCount: number | null;
}
export interface ReadOnlyPort<Track> {
  resolveClip(handle: unknown): Promise<ResolvedClip<Track>>;
  renderPreFx(track: Track, startBeat: number, endBeat: number): Promise<string>;
  /** Only read the path returned by renderPreFx; reject before reading if larger than maxBytes. */
  readRenderedWav(path: string, maxBytes: number): Promise<Uint8Array>;
  showModal(url: string, width: number, height: number): Promise<unknown>;
  log(code: string): void;
}

export type RunResult =
  | { status: "blocked"; reason: string }
  | { status: "cancelled"; reason: string }
  | {
      status: "dry-run-complete";
      operations: number;
      enabledOperations: number;
      sourceFrames: number;
      outputFrames: number;
      sourceBytes: number;
      outputBytes: number;
      sourceFingerprintPrefix: string;
      outputFingerprintPrefix: string;
    };

const DEFAULT_PLAN: OperationPlan = {
  version: CONTRACT_VERSION,
  operations: [
    { id: "reverse-1", type: "reverse", enabled: true },
    { id: "gain-1", type: "gain", enabled: true, db: -3 },
  ],
};

function safeErrorType(error: unknown): string {
  if (error instanceof Error) {
    // Deliberately never include raw error.message, stack, or a filesystem path.
    const name = error.name;
    if (/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name)) return name;
  }
  return "UnknownError";
}
function validateClip<Track>(clip: ResolvedClip<Track>): string | null {
  if (clip.scope !== "Arrangement") return "not-arrangement";
  if (clip.track === null || clip.trackIndex === null || clip.trackIndex < 0) return "track-unresolved";
  if (!Number.isFinite(clip.startBeat) || !Number.isFinite(clip.endBeat) || clip.endBeat <= clip.startBeat) return "invalid-beat-range";
  if (clip.overlappingClipCount === null) return "overlap-unknown";
  if (!Number.isInteger(clip.overlappingClipCount) || clip.overlappingClipCount < 0) return "overlap-invalid";
  if (clip.overlappingClipCount !== 0) return "overlap-detected";
  return null;
}

export async function runReadOnlyFlow<Track>(
  host: ReadOnlyPort<Track>,
  handle: unknown,
  editorHtml: string,
): Promise<RunResult> {
  let stage = "resolve";
  try {
    const clip = await host.resolveClip(handle);
    const problem = validateClip(clip);
    if (problem !== null) {
      host.log("AOPX_T8_0_BLOCKED " + problem);
      return { status: "blocked", reason: problem };
    }
    // Narrowing of clip.track is not preserved by TS through a separate validator.
    const track = clip.track;
    if (track === null) return { status: "blocked", reason: "track-unresolved" };

    stage = "render";
    const path = await host.renderPreFx(track, clip.startBeat, clip.endBeat);
    stage = "read";
    const bytes = await host.readRenderedWav(path, MAX_RENDER_BYTES);
    if (bytes.length > MAX_RENDER_BYTES) return { status: "blocked", reason: "render-too-large" };
    stage = "decode";
    const decoded = decodeWav(bytes);
    const fingerprint = sha256Hex(bytes);
    const source = {
      name: "READ-ONLY TEST — NO AUDIO WILL BE SAVED",
      fingerprint,
      bytes: bytes.byteLength,
      format: decoded.format,
    };
    stage = "modal";
    const waveform = computePeaks(decoded, WAVEFORM_BINS);
    const state = buildHostInitialState({
      source,
      waveform,
      plan: DEFAULT_PLAN,
      diagnostics: null,
    });
    // Safety banner is within the delivered page; users must not confuse Apply with a Set edit.
    const warnedHtml = editorHtml.replace(
      "<body>",
      '<body><div id="aopx-t8-0-warning" style="background:#613f10;color:#fff;padding:10px;text-align:center;font-weight:bold">AOPX T8-0 READ-ONLY TEST — RUN DRY TEST processes audio in memory only; NO clip will be saved or imported.</div>',
    );
    if (warnedHtml === editorHtml) return { status: "blocked", reason: "missing-body-marker" };
    const document = injectInitialState(warnedHtml, state);
    // S3 established this base64 transport on real Live. Do NOT exceed its proven safe range.
    const url = "data:text/html;charset=utf-8;base64," + Buffer.from(document, "utf8").toString("base64");
    if (url.length > MAX_MODAL_URL_CHARS) {
      host.log("AOPX_T8_0_BLOCKED modal-url-too-large");
      return { status: "blocked", reason: "modal-url-too-large" };
    }
    host.log("AOPX_T8_0_WAVEFORM " + JSON.stringify(summarizeWaveform(waveform)));
    host.log("AOPX_T8_0_EDITOR_OPEN read-only");
    const raw = await host.showModal(url, 860, 660);
    if (typeof raw !== "string" || raw.trim() === "") {
      host.log("AOPX_T8_0_CANCELLED modal-closed");
      return { status: "cancelled", reason: "modal-closed" };
    }
    let result;
    try {
      result = parseModalResult(raw);
    } catch {
      host.log("AOPX_T8_0_CANCELLED invalid-modal-result");
      return { status: "cancelled", reason: "invalid-modal-result" };
    }
    if (result.action !== "process") {
      host.log("AOPX_T8_0_CANCELLED user-cancel");
      return { status: "cancelled", reason: "user-cancel" };
    }
    if (result.plan.operations.length > MAX_OPERATIONS) {
      host.log("AOPX_T8_0_BLOCKED too-many-operations");
      return { status: "blocked", reason: "too-many-operations" };
    }

    stage = "dsp";
    let output = decoded;
    let enabled = 0;
    for (const operation of result.plan.operations) {
      if (!operation.enabled) continue;
      enabled += 1;
      if (operation.type === "reverse") output = await reverse(output);
      else if (operation.type === "gain") output = await gain(output, operation.db);
    }
    // Encode in memory only. No output file is written and no Live Set APIs are invoked.
    const rendered = encodeWav(output.format, output.samples);
    const report: RunResult = {
      status: "dry-run-complete",
      operations: result.plan.operations.length,
      enabledOperations: enabled,
      sourceFrames: decoded.format.frames,
      outputFrames: output.format.frames,
      sourceBytes: bytes.byteLength,
      outputBytes: rendered.bytes.byteLength,
      sourceFingerprintPrefix: fingerprint.slice(0, 12),
      outputFingerprintPrefix: sha256Hex(rendered.bytes).slice(0, 12),
    };
    host.log("AOPX_T8_0_DRY_RUN_COMPLETE " + JSON.stringify(report));
    host.log(
      "AOPX_T8_0_DRY_RUN_OK In-memory dry test succeeded: " + enabled + " of " + report.operations +
      " operation(s) ran on " + report.sourceFrames + " frames -> " + report.outputFrames +
      " frames. Nothing was saved, imported or changed in Live.",
    );
    return report;
  } catch (error) {
    const reason = "failed-" + stage + "-" + safeErrorType(error);
    host.log("AOPX_T8_0_BLOCKED " + reason);
    return { status: "blocked", reason };
  }
}
