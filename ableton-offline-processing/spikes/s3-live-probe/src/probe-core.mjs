/*
 * AOPX S3 live probe: SDK-free core (Issue #40). Read-only: it only opens modal dialogs and reports
 * what comes back. It never edits the Live Set, renders or imports.
 *
 * extension.ts passes in the verified SDK call `context.ui.showModalDialog(url, width, height)`.
 * Delivery helpers come from spikes/s3-modal/delivery.mjs, copied next to this file when the ZIP
 * is packaged.
 */
import { unlink } from 'node:fs/promises';
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

export const PROBE_CORE_VERSION = 2;

/** The exact URL form of the owner-verified SDK `modal-dialog` example. */
export const stockDataUrl = (html) => `data:text/html,${encodeURIComponent(html)}`;

// Build 2: each probe case shows ONLY the button(s) it asks for (`allow`), so a mis-click cannot
// record another action; `expect` is what a correct run returns, checked in the summary table.
const REPORT = { allow: ['send-report'], expect: { button: 'send-report', treatAs: 'process' }, ask: 'Press "Send report (process)" (the only button).' };
const CLOSE_X = { allow: [], expect: { empty: true }, ask: 'Close this dialog with the window X button (there are no probe buttons).' };
const GUI_CANCEL = { expect: { action: 'cancel' }, ask: 'The AOPX editor should open with source "S3 probe.wav". Press CANCEL.' };
const GUI_APPLY = { expect: { action: 'process', product: true }, ask: 'The AOPX editor should open with source "S3 probe.wav". Press APPLY TO CLIP. (The probe only logs the result: nothing is applied, the clip and Set are not changed.)' };

/**
 * Cases. `core` is the one-session build-2 run (owner approval, Issue #40 comment 6911243610).
 * `sdkTemp` cases write into the SDK's environment.tempDirectory and run only if that is a string
 * when the command runs. `osTemp` cases write one small disposable file to os.tmpdir() (approved
 * item 5) and delete it afterwards. File names are unique and written with flag 'wx' (no overwrite).
 */
export const CASES = [
  { id: 'P1-stock-data-1k', sets: ['core', 'full'], method: 'stock', payloadBytes: 1024, ...REPORT },
  { id: 'B1-data-base64-1k', sets: ['core', 'full'], method: 'data-base64', payloadBytes: 1024, ...REPORT },
  { id: 'X1-close-button', sets: ['core', 'full'], method: 'stock', payloadBytes: 1024, ...CLOSE_X },
  { id: 'X2-escape-key', sets: ['core', 'full'], method: 'stock', payloadBytes: 1024, allow: [], expect: { empty: true }, ask: 'Click inside this dialog, then press Esc ONCE. If it stays open after 2 seconds, close it with X and say so in the issue.' },
  { id: 'G2-gui-stock-cancel', sets: ['core', 'full'], method: 'gui-stock', ...GUI_CANCEL },
  { id: 'G2-gui-stock-apply', sets: ['core', 'full'], method: 'gui-stock', ...GUI_APPLY },
  { id: 'Z1-size-860x660', sets: ['core', 'full'], method: 'stock', payloadBytes: 1024, width: 860, height: 660, ...REPORT, ask: 'Check that the whole page fits without being cut off, then press "Send report (process)".' },
  { id: 'B2-data-stock-512k', sets: ['core', 'full'], method: 'stock', payloadBytes: 512 * 1024, ...REPORT, ask: 'Check stateIntact=true, then press "Send report (process)". If the dialog is blank, close it with X.' },
  { id: 'T1-os-tmpdir-file-1k', sets: ['core', 'full'], method: 'file', osTemp: true, payloadBytes: 1024, ...REPORT, ask: 'Opened from a temp FILE. Press "Send report (process)". If the dialog is blank, close it with X.' },
  { id: 'A1-file-inline-1k', sets: ['core', 'full'], method: 'file', sdkTemp: true, payloadBytes: 1024, ...REPORT },
  { id: 'A2-file-inline-1m', sets: ['core', 'full'], method: 'file', sdkTemp: true, payloadBytes: 1024 * 1024, ...REPORT, ask: 'Check stateIntact=true, then press "Send report (process)".' },
  { id: 'G1-gui-file', sets: ['core', 'full'], method: 'gui-file', sdkTemp: true, ...GUI_CANCEL },
  { id: 'C1-data-percent-charset-1k', sets: ['full'], method: 'data-percent', payloadBytes: 1024, ...REPORT },
  { id: 'B3-data-base64-1m', sets: ['full'], method: 'data-base64', payloadBytes: 1024 * 1024, ...CLOSE_X, ask: 'Expected to be blank (URL over ~2 MB). Close with X and note what you saw.' },
  { id: 'D1-file-hash', sets: ['full'], method: 'file+hash', sdkTemp: true, payloadBytes: 1024, ...REPORT, ask: 'Check stateVia=url-query-or-hash, then press "Send report (process)".' },
  { id: 'D2-file-query', sets: ['full'], method: 'file+query', sdkTemp: true, payloadBytes: 1024, ...REPORT, ask: 'Check stateVia=url-query-or-hash, then press "Send report (process)".' },
  { id: 'R1-return-cancel', sets: ['full'], method: 'stock', payloadBytes: 1024, allow: ['send-cancel'], expect: { button: 'send-cancel', treatAs: 'cancel' }, ask: 'Press "Send cancel" (the only button).' },
  { id: 'R2-return-large', sets: ['full'], method: 'stock', payloadBytes: 1024, allow: ['send-large'], expect: { button: 'send-large', treatAs: 'cancel' }, ask: 'Press "Send 1 MB result" (the only button).' },
  { id: 'R3-return-object', sets: ['full'], method: 'stock', payloadBytes: 1024, allow: ['send-object'], expect: { button: 'send-object', treatAs: 'cancel' }, ask: 'Press "Send non-string params" (the only button).' },
  { id: 'R4-return-twice', sets: ['full'], method: 'stock', payloadBytes: 1024, allow: ['send-twice'], expect: { button: 'send-twice', treatAs: 'cancel' }, ask: 'Press "Send twice" (the only button).' },
  { id: 'X3-window-close', sets: ['full'], method: 'stock', payloadBytes: 1024, allow: ['close-window'], expect: { empty: true }, ask: 'Press "window.close()" (the only button). If it stays open, close it with X.' },
  { id: 'Z2-size-1200x800', sets: ['full'], method: 'stock', payloadBytes: 1024, width: 1200, height: 800, ...REPORT, ask: 'Note innerSize and devicePixelRatio, then press "Send report (process)".' },
  { id: 'G3-gui-data-base64', sets: ['full'], method: 'gui-data-base64', ...GUI_CANCEL, ask: 'If the AOPX editor appears, press CANCEL; if blank, close with X.' },
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

async function buildUrl(c, { dir, probeHtml, guiHtml }) {
  const state = { ...makeProbeState({ payloadBytes: c.payloadBytes ?? 1024 }), caseId: c.id, ask: c.ask, ...(c.allow ? { allow: c.allow } : {}) };
  const probe = () => injectProbeState(probeHtml, state);
  switch (c.method) {
    case 'stock': return { url: stockDataUrl(probe()), state };
    case 'data-base64': return { url: toBase64DataUrl(probe()), state };
    case 'data-percent': return { url: toPercentDataUrl(probe()), state };
    case 'file': {
      const { url, path } = await writeModalDocument(dir, probe(), `aopx-s3-${c.id}`);
      return { url, path, state };
    }
    case 'file+hash':
    case 'file+query': {
      const { url, path } = await writeModalDocument(dir, probeHtml, `aopx-s3-${c.id}`);
      return { url: withUrlState(url, state, c.method === 'file+hash' ? 'hash' : 'query'), path, state };
    }
    case 'gui-stock': return { url: stockDataUrl(injectGuiState(guiHtml, guiState())), state: null };
    case 'gui-data-base64': return { url: toBase64DataUrl(injectGuiState(guiHtml, guiState())), state: null };
    case 'gui-file': {
      const { url, path } = await writeModalDocument(dir, injectGuiState(guiHtml, guiState()), `aopx-s3-${c.id}`);
      return { url, path, state: null };
    }
    default: throw new Error(`unknown method ${c.method}`);
  }
}

/**
 * Hide the user name in every Windows/macOS/Linux profile path in `p` (the log is pasted into a public
 * issue). Every occurrence; plain paths (C:\\Users\\Jane Doe\\..., /Users/jane/...), file URLs
 * (file:///C:/Users/Jane%20Doe/...) and JSON-escaped paths (C:\\\\Users\\\\Jane Doe). The name ends at
 * the next path separator, double quote or line break (an apostrophe, as in O'Brien, is part of it). Non-strings are returned unchanged.
 */
export function redactPath(p) {
  return typeof p === 'string' ? p.replace(/([\\/]+(?:Users|home)[\\/]+)[^\\/"\r\n]+/gi, '$1<user>') : p;
}

/** redactPath applied to every string inside a JSON-like value (objects, arrays), returning a copy. */
export function redactDeep(v) {
  if (typeof v === 'string') return redactPath(v);
  if (Array.isArray(v)) return v.map(redactDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactDeep(x)]));
  return v;
}

/**
 * Describe one object's members without assuming its shape: for every own and prototype property,
 * where it lives, whether it is a data value or an accessor, and the type of its current value.
 * String values are reported only for path-like members, with the user name redacted. Read-only.
 */
export function describeMembers(o) {
  if (!o || (typeof o !== 'object' && typeof o !== 'function')) return null;
  const out = {};
  const seen = new Set();
  for (let obj = o, level = 0; obj && obj !== Object.prototype && obj !== Function.prototype && level < 4; obj = Object.getPrototypeOf(obj), level++) {
    for (const name of Object.getOwnPropertyNames(obj)) {
      if (name === 'constructor' || seen.has(name)) continue;
      seen.add(name);
      const d = Object.getOwnPropertyDescriptor(obj, name);
      const entry = { where: level === 0 ? 'own' : `proto${level}`, kind: d && ('value' in d) ? 'value' : 'accessor', hasGet: !!(d && d.get), hasSet: !!(d && d.set) };
      try {
        const v = o[name];
        entry.type = v === null ? 'null' : typeof v;
        if (typeof v === 'string' && /directory|path|dir$/i.test(name)) { entry.value = redactPath(v); entry.length = v.length; }
        else if (typeof v === 'string' && v.length <= 32) entry.value = v;
      } catch (e) {
        entry.type = 'throws';
        entry.error = String(e && e.message ? e.message : e);
      }
      out[name] = entry;
    }
  }
  return out;
}

/**
 * Describe the SDK context (build 2: called at activation AND again when the command runs, to see
 * whether environment paths are filled in late). Read-only.
 */
export function describeContext(context) {
  const keysOf = (o) => {
    if (!o || (typeof o !== 'object' && typeof o !== 'function')) return null;
    const proto = Object.getPrototypeOf(o);
    return { own: Object.keys(o), proto: proto && proto !== Object.prototype ? Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor') : [] };
  };
  let env;
  try { env = context && context.environment; } catch (e) { env = undefined; }
  const read = (k) => { try { return env ? env[k] : undefined; } catch { return undefined; } };
  const temp = read('tempDirectory');
  const storage = read('storageDirectory');
  const description = {
    context: keysOf(context),
    ui: keysOf(context && context.ui),
    commands: keysOf(context && context.commands),
    environment: keysOf(env),
    environmentMembers: describeMembers(env),
    tempDirectory: typeof temp === 'string' && temp ? redactPath(temp) : null, // logged: user name redacted
    tempDirectoryType: env ? (temp === null ? 'null' : typeof temp) : 'no environment',
    storageDirectoryType: env ? (storage === null ? 'null' : typeof storage) : 'no environment',
  };
  // The real path is needed to write the file cases, but is never serialized (non-enumerable).
  Object.defineProperty(description, 'rawTempDirectory', { value: typeof temp === 'string' && temp ? temp : null, enumerable: false });
  return description;
}

/** Did the case return what its instruction asked for? (true / false / null = no expectation) */
function checkExpectation(c, r) {
  const e = c.expect;
  if (!e || r.skipped || r.buildError) return null;
  if (e.empty) return r.rawEmpty === true || r.returned.kind === 'undefined' || r.returned.kind === 'empty-string';
  if (e.product) return r.product?.accepted === true && r.product.action === e.action;
  if (e.action) return r.returned.action === e.action;
  return r.button === e.button && r.returned.treatAs === e.treatAs;
}

const pad = (v, n) => { const t = String(v); return t.length >= n ? t.slice(0, n) : t + ' '.repeat(n - t.length); };

/** One-screen summary printed before the JSON block (approved item 6). */
export function summaryLines(results) {
  const lines = [
    'AOPX_S3_SUMMARY_BEGIN',
    `${pad('case', 28)} ${pad('as asked', 9)} ${pad('returned', 26)} ${pad('treat as', 9)} ${pad('button', 13)} ${pad('state', 6)} note`,
  ];
  for (const r of results) {
    const asAsked = r.skipped ? 'SKIP' : r.buildError ? 'ERROR' : r.asExpected === null ? '-' : r.asExpected ? 'OK' : 'NO';
    const returned = r.skipped || r.buildError ? '' : `${r.returned.kind}${r.returned.action ? `:${r.returned.action}` : ''}`;
    const treatAs = r.skipped || r.buildError ? '' : r.returned.treatAs;
    const note = r.skipped ? r.skipped : r.buildError ? r.buildError
      : r.product ? (r.product.accepted ? `parseModalResult OK: ${r.product.action}, ${r.product.operations ?? 0} op(s)` : `parseModalResult rejected: ${r.product.error}`)
      : r.facts ? `inner ${r.facts.innerSize} dpr ${r.facts.devicePixelRatio} ${r.urlLength} chars` : `${r.urlLength} chars`;
    lines.push(`${pad(r.id, 28)} ${pad(asAsked, 9)} ${pad(returned, 26)} ${pad(treatAs, 9)} ${pad(r.button ?? '', 13)} ${pad(r.stateIntact === null || r.stateIntact === undefined ? '' : r.stateIntact, 6)} ${note}`);
  }
  lines.push('AOPX_S3_SUMMARY_END');
  return lines;
}

/**
 * Run the cases in `mode` ('core' | 'full') one dialog at a time. Read-only.
 * Every result is classified before any JSON.parse (empty, undefined, non-string and invalid JSON
 * all become a recorded cancel), so Cancel/Esc/X can never crash the run. GUI results are also
 * handed to the PRODUCT parser (`parseModalResult`, host/src/modal.ts) and only logged: nothing is
 * ever applied. `readEnvironment` re-reads the SDK context at command time (build 2);
 * `osTempDirectory` is os.tmpdir() for the approved T1 case; `parseModalResult` is the product parser.
 */
export async function runProbe(/** @type {any} */ options) {
  const { mode = 'core', showModalDialog, readEnvironment = () => null, osTempDirectory = null, parseModalResult = null, probeHtml, guiHtml, environment = {} } = options;
  // Output boundary: every emitted line has user names in profile paths redacted (H1), including
  // paths inside facts (hrefHead), error messages and the JSON report.
  const rawLog = options.log ?? console.log;
  const log = (/** @type {string} */ line) => rawLog(redactPath(line));
  const cases = CASES.filter((c) => c.sets.includes(mode));
  const atCommand = readEnvironment();
  const sdkTemp = atCommand && atCommand.rawTempDirectory ? atCommand.rawTempDirectory : null;
  log(`[AOPX S3] Context description at command time: ${JSON.stringify(redactDeep(atCommand))}`);
  log(`[AOPX S3] ${mode}: ${cases.length} case(s), probe build ${PROBE_CORE_VERSION}. One dialog at a time; follow the orange instruction in each probe dialog.`);
  const results = [];
  for (const c of cases) {
    const width = c.width ?? 860;
    const height = c.height ?? 660;
    const dir = c.osTemp ? osTempDirectory : c.sdkTemp ? sdkTemp : null;
    if ((c.osTemp || c.sdkTemp) && !dir) {
      const r = { id: c.id, method: c.method, skipped: c.osTemp ? 'no os.tmpdir()' : 'SDK environment.tempDirectory is not a string at command time' };
      results.push({ ...r, asExpected: null });
      log(`[AOPX S3] ${c.id}: SKIPPED (${r.skipped})`);
      continue;
    }
    let built;
    try {
      built = await buildUrl(c, { dir, probeHtml, guiHtml });
    } catch (e) {
      const buildError = redactPath(String(e && e.message ? e.message : e));
      results.push({ id: c.id, method: c.method, buildError, asExpected: null });
      log(`[AOPX S3] ${c.id}: could not build the URL: ${buildError}`);
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
      threw = { name: err && typeof err.name === 'string' ? err.name : null, message: redactPath(String(err && err.message !== undefined ? err.message : e)) };
    }
    const ms = Date.now() - t0;
    let cleanedUp = null;
    if (built.path) {
      try { await unlink(built.path); cleanedUp = true; } catch { cleanedUp = false; }
    }
    // Guard first, exactly as the verified example needed: never JSON.parse an empty result.
    const rawEmpty = !raw;
    const classification = threw ? { kind: 'threw', treatAs: 'cancel' } : classifyModalReturn(raw);
    const { parsed, ...returned } = /** @type {any} */ (classification);
    const source = parsed ?? (raw && typeof raw === 'object' ? raw : null); // R3 sends an object
    const facts = source && source.facts ? redactDeep(source.facts) : null; // hrefHead can be a file:// path under the profile
    const button = source && typeof source.button === 'string' ? source.button : null;
    const stateIntact = built.state && facts ? facts.payloadFnv1a === built.state.expectFnv1a : null;
    let product = null;
    if (c.method.startsWith('gui') && parseModalResult && typeof raw === 'string' && raw.trim() !== '') {
      try {
        const m = parseModalResult(raw);
        product = { accepted: true, action: m.action, operations: m.plan && Array.isArray(m.plan.operations) ? m.plan.operations.length : null, operationTypes: m.plan && Array.isArray(m.plan.operations) ? m.plan.operations.map((o) => /** @type {any} */ (o).type) : null };
      } catch (e) {
        product = { accepted: false, error: String(e && e.message ? e.message : e) };
      }
    }
    const r = {
      id: c.id, method: c.method, width, height,
      urlScheme: built.url.slice(0, built.url.indexOf(':') + 1), urlLength: built.url.length,
      generatedFile: built.path ? redactPath(built.path) : null, cleanedUp, ms, threw, rawType: typeof raw, rawEmpty,
      returned, button, allowed: c.allow ?? null, stateIntact, product, facts,
    };
    r.asExpected = checkExpectation(c, r);
    results.push(r);
    log(`[AOPX S3] ${c.id} -> ${returned.kind} (${returned.treatAs})${button ? ` via ${button}` : ''} in ${ms} ms${stateIntact === null ? '' : `, stateIntact=${stateIntact}`}${product ? `, product parser: ${product.accepted ? product.action : 'rejected'}` : ''}${r.asExpected === false ? '  << NOT AS ASKED' : ''}`);
  }
  const report = redactDeep({ probe: 'aopx-s3-live', coreVersion: PROBE_CORE_VERSION, mode, finishedAt: new Date().toISOString(), environment: { ...environment, contextAtCommand: atCommand }, results });
  for (const line of summaryLines(results)) log(line);
  log('AOPX_S3_RESULTS_BEGIN');
  log(JSON.stringify(report));
  log('AOPX_S3_RESULTS_END');
  log('[AOPX S3] done. Copy everything from AOPX_S3_SUMMARY_BEGIN through AOPX_S3_RESULTS_END into Issue #40. Nothing was applied to Live.');
  return report;
}
