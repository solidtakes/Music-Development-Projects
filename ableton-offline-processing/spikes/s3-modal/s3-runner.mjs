/*
 * Spike S3 matrix runner (AOPX-01). SDK-independent: the only host call it needs is passed in as
 * `showModalDialog(url, width, height)`, so the same runner is exercised in CI against a
 * Playwright-backed fake and, on Windows, against the real `context.ui.showModalDialog` inside a
 * throwaway spike extension (see S3_EXTENSION_GLUE.md). Nothing here imports the Ableton SDK.
 *
 * Each case opens the probe (or the product GUI) with one delivery method, waits for the modal to
 * return, classifies the returned value and records timing. The owner presses one probe button per
 * case, as the case's `ask` text says. Results are written as JSON to a NEW file in `outDir`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  classifyModalReturn,
  injectProbeState,
  scriptSafeJson,
  makeProbeState,
  toBase64DataUrl,
  toPercentDataUrl,
  withUrlState,
  writeModalDocument,
} from './delivery.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const PROBE_PATH = join(here, 'probe.html');
export const GUI_PATH = join(here, '..', '..', 'editor', 'interface.html');

/** The S3 matrix, in the order the review recommends: temp file first, then URL state, then data URLs. */
export const S3_CASES = [
  { id: 'A1-file-inline-1k', method: 'file', payloadBytes: 1024, ask: 'Press "Send report (process)".' },
  { id: 'A2-file-inline-1m', method: 'file', payloadBytes: 1024 * 1024, ask: 'Check stateIntact=true, then press "Send report (process)".' },
  { id: 'D1-file-hash', method: 'file+hash', payloadBytes: 1024, ask: 'Check stateVia=url-query-or-hash, then press "Send report (process)".' },
  { id: 'D2-file-query', method: 'file+query', payloadBytes: 1024, ask: 'Check stateVia=url-query-or-hash, then press "Send report (process)".' },
  { id: 'B1-data-base64-1k', method: 'data-base64', payloadBytes: 1024, ask: 'Press "Send report (process)". If the dialog is blank, close it with X.' },
  { id: 'B2-data-base64-512k', method: 'data-base64', payloadBytes: 512 * 1024, ask: 'Press "Send report (process)". If blank, close with X.' },
  // Expected to exceed Chromium's ~2 MB (2,097,152-char) URL limit: measured blank/aborted in Chromium 2026-11-16.
  { id: 'B3-data-base64-1m', method: 'data-base64', payloadBytes: 1024 * 1024, ask: 'Expected blank (URL over ~2 MB). Close with X; record what you saw.' },
  { id: 'C1-data-percent-1k', method: 'data-percent', payloadBytes: 1024, ask: 'Press "Send report (process)". If blank, close with X.' },
  { id: 'R1-return-cancel', method: 'file', payloadBytes: 1024, ask: 'Press "Send cancel".' },
  { id: 'R2-return-large', method: 'file', payloadBytes: 1024, ask: 'Press "Send 1 MB result".' },
  { id: 'R3-return-object', method: 'file', payloadBytes: 1024, ask: 'Press "Send non-string params".' },
  { id: 'R4-return-twice', method: 'file', payloadBytes: 1024, ask: 'Press "Send twice".' },
  { id: 'X1-close-button', method: 'file', payloadBytes: 1024, ask: 'Close the dialog with the window X button. Do not press any probe button.' },
  { id: 'X2-escape-key', method: 'file', payloadBytes: 1024, ask: 'Click inside the dialog, then press Esc once. If it stays open, close it with X.' },
  { id: 'X3-window-close', method: 'file', payloadBytes: 1024, ask: 'Press "window.close()". If it stays open, close it with X.' },
  { id: 'Z1-size-860x660', method: 'file', payloadBytes: 1024, width: 860, height: 660, ask: 'Note innerSize/devicePixelRatio, then press "Send report (process)".' },
  { id: 'Z2-size-1200x800', method: 'file', payloadBytes: 1024, width: 1200, height: 800, ask: 'Note innerSize/devicePixelRatio, then press "Send report (process)".' },
  { id: 'G1-gui-file', method: 'gui-file', ask: 'The real AOPX editor should open with source "S3 probe.wav". Press Cancel.' },
  { id: 'G2-gui-data-base64', method: 'gui-data-base64', ask: 'If the AOPX editor appears, press Cancel; if blank, close with X.' },
];

/**
 * The HostInitialState the G1/G2 cases inject into the real GUI. Type-checked (`npm run typecheck`)
 * against the product contract in engine/src/contract.ts.
 * @returns {import('../../engine/src/contract.ts').HostInitialState}
 */
export function guiState() {
  /** @type {import('../../engine/src/contract.ts').AudioMetadata} */
  const format = { channels: 2, sampleRate: 48000, bitDepth: 24, frames: 48000, durationSeconds: 1, encoding: 'pcm' };
  return {
    envelopeVersion: 1,
    source: { name: 'S3 probe.wav', fingerprint: '0'.repeat(64), bytes: 288044, format },
    waveform: Array.from({ length: 64 }, (_, i) => ({ min: -Math.abs(Math.sin(i / 5)), max: Math.abs(Math.sin(i / 5)) })),
    plan: { version: 1, operations: [{ id: 'reverse-1', type: 'reverse', enabled: true }, { id: 'gain-1', type: 'gain', db: -3, enabled: true }] },
    diagnostics: null,
    preview: false,
  };
}

/**
 * Same injection as host/src/modal.ts injectInitialState, kept local so the runner can be copied into
 * a spike extension as plain JS. test/host-crosscheck.test.mjs asserts the output is byte-identical
 * to the host function's, so the two cannot drift.
 */
export function injectGuiState(html, state) {
  const marker = '<script id="aopx-plan-core">';
  const at = html.indexOf(marker);
  if (at < 0 || html.indexOf(marker, at + 1) >= 0) {
    throw new Error('GUI document must contain exactly one <script id="aopx-plan-core">.');
  }
  return `${html.slice(0, at)}<script>window.AOPX_INITIAL_STATE=${scriptSafeJson(state)};</script>\n${html.slice(at)}`;
}

/** Build the URL for one case. Files go to `tempDirectory` with unique names (never overwritten). */
export async function buildCaseUrl(c, { tempDirectory, probeHtml, guiHtml }) {
  const state = makeProbeState({ payloadBytes: c.payloadBytes ?? 1024 });
  switch (c.method) {
    case 'file': {
      const { url, path } = await writeModalDocument(tempDirectory, injectProbeState(probeHtml, state), `s3-${c.id}`);
      return { url, path, state };
    }
    case 'file+hash':
    case 'file+query': {
      const { url, path } = await writeModalDocument(tempDirectory, probeHtml, `s3-${c.id}`);
      return { url: withUrlState(url, state, c.method === 'file+hash' ? 'hash' : 'query'), path, state };
    }
    case 'data-base64':
      return { url: toBase64DataUrl(injectProbeState(probeHtml, state)), state };
    case 'data-percent':
      return { url: toPercentDataUrl(injectProbeState(probeHtml, state)), state };
    case 'gui-file': {
      const { url, path } = await writeModalDocument(tempDirectory, injectGuiState(guiHtml, guiState()), `s3-${c.id}`);
      return { url, path, state: null };
    }
    case 'gui-data-base64':
      return { url: toBase64DataUrl(injectGuiState(guiHtml, guiState())), state: null };
    default:
      throw new Error(`unknown method ${c.method}`);
  }
}

/**
 * Run the selected cases one after another.
 * @param {object} o
 * @param {(url: string, w: number, h: number) => Promise<unknown>} o.showModalDialog host call (real or fake)
 * @param {string} o.tempDirectory absolute directory for generated documents
 * @param {string} o.outDir absolute directory for the results JSON (a new file per run)
 * @param {string[]} [o.only] case ids to run; default all
 * @param {(line: string) => void} [o.log]
 * @param {object} [o.environment] free-form facts to record (Live/SDK/Node/Windows versions)
 * @param {string} [o.probePath] override when bundled (default: probe.html next to this file)
 * @param {string} [o.guiPath] override when bundled (default: ../../editor/interface.html)
 */
export async function runS3Matrix({ showModalDialog, tempDirectory, outDir, only, log = () => {}, environment = {}, probePath = PROBE_PATH, guiPath = GUI_PATH }) {
  const probeHtml = await readFile(probePath, 'utf8');
  const guiHtml = await readFile(guiPath, 'utf8');
  const cases = only ? S3_CASES.filter((c) => only.includes(c.id)) : S3_CASES;
  const results = [];
  for (const c of cases) {
    const width = c.width ?? 860;
    const height = c.height ?? 660;
    const built = await buildCaseUrl(c, { tempDirectory, probeHtml, guiHtml });
    log(`[${c.id}] ${c.ask} (url ${built.url.length} chars)`);
    const t0 = performance.now();
    let returned;
    let threw = null;
    try {
      returned = await showModalDialog(built.url, width, height);
    } catch (e) {
      const err = /** @type {{ name?: unknown, message?: unknown } | undefined} */ (e);
      threw = { name: err?.name ?? null, message: String(err?.message ?? e) };
    }
    const ms = Math.round(performance.now() - t0);
    const classification = threw ? { kind: 'threw', treatAs: 'cancel' } : classifyModalReturn(returned);
    const facts = classification.parsed?.facts ?? null;
    const stateIntact = built.state && facts ? facts.payloadFnv1a === built.state.expectFnv1a : null;
    const { parsed, ...cls } = classification;
    results.push({ id: c.id, method: c.method, width, height, urlLength: built.url.length, generatedFile: built.path ?? null, ms, threw, returned: cls, stateIntact, facts });
    log(`[${c.id}] -> ${cls.kind} (${cls.treatAs}) in ${ms} ms${stateIntact === null ? '' : `, stateIntact=${stateIntact}`}`);
  }
  const report = { spike: 'S3', runner: 1, startedFor: cases.map((c) => c.id), environment, results };
  const outPath = join(outDir, `s3-results-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2), { flag: 'wx' });
  log(`results written to ${outPath}`);
  return { report, outPath };
}
