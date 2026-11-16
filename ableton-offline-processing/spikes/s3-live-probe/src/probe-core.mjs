/*
 * AOPX S3 live probe: SDK-free core (Issue #40). Read-only: it only opens modal dialogs and reports
 * what comes back. It never edits the Live Set, renders or imports.
 *
 * extension.ts passes in the verified SDK call `context.ui.showModalDialog(url, width, height)`.
 * Delivery helpers come from spikes/s3-modal/delivery.mjs, copied next to this file when the ZIP
 * is packaged.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  classifyModalReturn,
  injectProbeState,
  makeProbeState,
  scriptSafeJson,
  toBase64DataUrl,
  toPercentDataUrl,
  withUrlState,
  writeModalDocument,
} from './delivery.mjs';

export const PROBE_CORE_VERSION = 1;

/** The exact URL form of the owner-verified SDK `modal-dialog` example. */
export const stockDataUrl = (html) => `data:text/html,${encodeURIComponent(html)}`;

const SEND = 'Press "Send report (process)".';

/**
 * Cases. `core` is the short run (A1/A2/B1/X1/G1 as requested, plus the proven stock form first).
 * `needsTemp` cases write a page to a temp directory and open it as file://. They run only if the
 * SDK context exposes one; that API is unverified, so its absence is recorded, never guessed around.
 */
export const CASES = [
  { id: 'P1-stock-data-1k', sets: ['core', 'full'], method: 'stock', payloadBytes: 1024, ask: SEND },
  { id: 'B1-data-base64-1k', sets: ['core', 'full'], method: 'data-base64', payloadBytes: 1024, ask: SEND },
  { id: 'X1-close-button', sets: ['core', 'full'], method: 'stock', payloadBytes: 1024, ask: 'Close this dialog with the window X button. Do not press any probe button.' },
  { id: 'G2-gui-stock-data', sets: ['core', 'full'], method: 'gui-stock', ask: 'The AOPX editor should open with source "S3 probe.wav". Press CANCEL.' },
  { id: 'A1-file-inline-1k', sets: ['core', 'full'], method: 'file', needsTemp: true, payloadBytes: 1024, ask: SEND },
  { id: 'A2-file-inline-1m', sets: ['core', 'full'], method: 'file', needsTemp: true, payloadBytes: 1024 * 1024, ask: `Check stateIntact=true, then ${SEND.toLowerCase()}` },
  { id: 'G1-gui-file', sets: ['core', 'full'], method: 'gui-file', needsTemp: true, ask: 'The AOPX editor should open with source "S3 probe.wav". Press CANCEL.' },
  { id: 'C1-data-percent-charset-1k', sets: ['full'], method: 'data-percent', payloadBytes: 1024, ask: SEND },
  { id: 'B2-data-base64-512k', sets: ['full'], method: 'data-base64', payloadBytes: 512 * 1024, ask: `${SEND} If the dialog is blank, close it with X.` },
  { id: 'B3-data-base64-1m', sets: ['full'], method: 'data-base64', payloadBytes: 1024 * 1024, ask: 'Expected to be blank (URL over ~2 MB). Close with X and note what you saw.' },
  { id: 'D1-file-hash', sets: ['full'], method: 'file+hash', needsTemp: true, payloadBytes: 1024, ask: `Check stateVia=url-query-or-hash, then ${SEND.toLowerCase()}` },
  { id: 'D2-file-query', sets: ['full'], method: 'file+query', needsTemp: true, payloadBytes: 1024, ask: `Check stateVia=url-query-or-hash, then ${SEND.toLowerCase()}` },
  { id: 'R1-return-cancel', sets: ['full'], method: 'stock', payloadBytes: 1024, ask: 'Press "Send cancel".' },
  { id: 'R2-return-large', sets: ['full'], method: 'stock', payloadBytes: 1024, ask: 'Press "Send 1 MB result".' },
  { id: 'R3-return-object', sets: ['full'], method: 'stock', payloadBytes: 1024, ask: 'Press "Send non-string params".' },
  { id: 'R4-return-twice', sets: ['full'], method: 'stock', payloadBytes: 1024, ask: 'Press "Send twice".' },
  { id: 'X2-escape-key', sets: ['full'], method: 'stock', payloadBytes: 1024, ask: 'Click inside this dialog, then press Esc once. If it stays open, close it with X.' },
  { id: 'X3-window-close', sets: ['full'], method: 'stock', payloadBytes: 1024, ask: 'Press "window.close()". If it stays open, close it with X.' },
  { id: 'Z1-size-860x660', sets: ['full'], method: 'stock', payloadBytes: 1024, width: 860, height: 660, ask: `Note innerSize and devicePixelRatio, then ${SEND.toLowerCase()}` },
  { id: 'Z2-size-1200x800', sets: ['full'], method: 'stock', payloadBytes: 1024, width: 1200, height: 800, ask: `Note innerSize and devicePixelRatio, then ${SEND.toLowerCase()}` },
  { id: 'G3-gui-data-base64', sets: ['full'], method: 'gui-data-base64', ask: 'If the AOPX editor appears, press CANCEL; if blank, close with X.' },
];

/** HostInitialState for the GUI cases (same shape the spike runner uses; checked by CI). */
export function guiState() {
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

/** Same as host/src/modal.ts injectInitialState (CI checks they are byte-identical). */
export function injectGuiState(html, state) {
  const marker = '<script id="aopx-plan-core">';
  const at = html.indexOf(marker);
  if (at < 0 || html.indexOf(marker, at + 1) >= 0) throw new Error('GUI document must contain exactly one <script id="aopx-plan-core">.');
  return `${html.slice(0, at)}<script>window.AOPX_INITIAL_STATE=${scriptSafeJson(state)};</script>\n${html.slice(at)}`;
}

async function buildUrl(c, { tempDirectory, probeHtml, guiHtml }) {
  const state = { ...makeProbeState({ payloadBytes: c.payloadBytes ?? 1024 }), caseId: c.id, ask: c.ask };
  const probe = () => injectProbeState(probeHtml, state);
  switch (c.method) {
    case 'stock': return { url: stockDataUrl(probe()), state };
    case 'data-base64': return { url: toBase64DataUrl(probe()), state };
    case 'data-percent': return { url: toPercentDataUrl(probe()), state };
    case 'file': {
      const { url, path } = await writeModalDocument(tempDirectory, probe(), `aopx-s3-${c.id}`);
      return { url, path, state };
    }
    case 'file+hash':
    case 'file+query': {
      const { url, path } = await writeModalDocument(tempDirectory, probeHtml, `aopx-s3-${c.id}`);
      return { url: withUrlState(url, state, c.method === 'file+hash' ? 'hash' : 'query'), path, state };
    }
    case 'gui-stock': return { url: stockDataUrl(injectGuiState(guiHtml, guiState())), state: null };
    case 'gui-data-base64': return { url: toBase64DataUrl(injectGuiState(guiHtml, guiState())), state: null };
    case 'gui-file': {
      const { url, path } = await writeModalDocument(tempDirectory, injectGuiState(guiHtml, guiState()), `aopx-s3-${c.id}`);
      return { url, path, state: null };
    }
    default: throw new Error(`unknown method ${c.method}`);
  }
}

/**
 * Describe the SDK context without assuming its shape: own keys, prototype method names, and
 * whether an `environment.tempDirectory` string exists. Read-only.
 */
export function describeContext(context) {
  const keysOf = (o) => {
    if (!o || (typeof o !== 'object' && typeof o !== 'function')) return null;
    const own = Object.keys(o);
    const proto = Object.getPrototypeOf(o);
    const protoNames = proto && proto !== Object.prototype ? Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor') : [];
    return { own, proto: protoNames };
  };
  const env = context && context.environment;
  const temp = env && typeof env.tempDirectory === 'string' ? env.tempDirectory : null;
  return {
    context: keysOf(context),
    ui: keysOf(context && context.ui),
    commands: keysOf(context && context.commands),
    environment: keysOf(env),
    tempDirectory: temp,
    tempDirectoryType: env ? typeof env.tempDirectory : 'no environment',
  };
}

/**
 * Run the cases in `mode` ('core' | 'full') one dialog at a time.
 * Every result is classified before any JSON.parse (empty, undefined, non-string and invalid JSON
 * all become a recorded cancel), so Cancel/Esc/X can never crash the run.
 */
export async function runProbe({ mode = 'core', showModalDialog, tempDirectory = null, log = console.log, probeHtml, guiHtml, environment = {} }) {
  const cases = CASES.filter((c) => c.sets.includes(mode));
  const results = [];
  log(`[AOPX S3] ${mode}: ${cases.length} case(s). One dialog at a time; follow the orange instruction in each probe dialog.`);
  for (const c of cases) {
    const width = c.width ?? 860;
    const height = c.height ?? 660;
    if (c.needsTemp && !tempDirectory) {
      results.push({ id: c.id, method: c.method, skipped: 'no tempDirectory exposed by the SDK context (unverified API); see contextDescription' });
      log(`[AOPX S3] ${c.id}: SKIPPED (no temp directory exposed)`);
      continue;
    }
    let built;
    try {
      built = await buildUrl(c, { tempDirectory, probeHtml, guiHtml });
    } catch (e) {
      results.push({ id: c.id, method: c.method, buildError: String(e && e.message ? e.message : e) });
      log(`[AOPX S3] ${c.id}: could not build the URL: ${String(e && e.message ? e.message : e)}`);
      continue;
    }
    log(`[AOPX S3] ${c.id}: ${c.ask} (url ${built.url.length} chars)`);
    const t0 = Date.now();
    let raw;
    let threw = null;
    try {
      raw = await showModalDialog(built.url, width, height);
    } catch (e) {
      const err = /** @type {{ name?: unknown, message?: unknown } | undefined} */ (e);
      threw = { name: err && typeof err.name === 'string' ? err.name : null, message: String(err && err.message !== undefined ? err.message : e) };
    }
    const ms = Date.now() - t0;
    // Guard first, exactly as the verified example needed: never JSON.parse an empty result.
    const rawEmpty = !raw;
    const classification = threw ? { kind: 'threw', treatAs: 'cancel' } : classifyModalReturn(raw);
    const { parsed, ...returned } = /** @type {any} */ (classification);
    const facts = parsed && parsed.facts ? parsed.facts : null;
    const stateIntact = built.state && facts ? facts.payloadFnv1a === built.state.expectFnv1a : null;
    results.push({
      id: c.id, method: c.method, width, height,
      urlScheme: built.url.slice(0, built.url.indexOf(':') + 1), urlLength: built.url.length,
      generatedFile: built.path ?? null, ms, threw, rawType: typeof raw, rawEmpty, returned, stateIntact, facts,
    });
    log(`[AOPX S3] ${c.id} -> ${returned.kind} (${returned.treatAs}) in ${ms} ms${stateIntact === null ? '' : `, stateIntact=${stateIntact}`}`);
  }
  const report = { probe: 'aopx-s3-live', coreVersion: PROBE_CORE_VERSION, mode, finishedAt: new Date().toISOString(), environment, results };
  log('AOPX_S3_RESULTS_BEGIN');
  log(JSON.stringify(report));
  log('AOPX_S3_RESULTS_END');
  if (tempDirectory) {
    try {
      const out = join(tempDirectory, `aopx-s3-results-${mode}-${Date.now()}.json`);
      await writeFile(out, JSON.stringify(report, null, 2), { flag: 'wx' });
      log(`[AOPX S3] results also written to ${out}`);
    } catch (e) {
      log(`[AOPX S3] could not write the results file: ${String(e && e.message ? e.message : e)}`);
    }
  }
  log('[AOPX S3] done. Copy everything between AOPX_S3_RESULTS_BEGIN and AOPX_S3_RESULTS_END into Issue #40.');
  return report;
}
