/*
 * End-to-end smoke test of the BUILT probe bundle (dist/extension.js from `npm run build`), with
 * the CI SDK stub providing a fake context. showModalDialog is backed by real Chromium (Playwright,
 * the engine under WebView2) with a WebView2-style chrome.webview bridge, and a simulated owner
 * follows each case's instruction. This checks the package and the probe pages; it is NOT Live.
 *
 *   node ci/smoke.mjs <ci-build dir> <repo ableton-offline-processing dir>
 * Requires Playwright on NODE_PATH (CI installs it outside the repo).
 */
import assert from 'node:assert/strict';
import Module, { createRequire } from 'node:module';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [buildDir, aopDir] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { parseModalResult, injectInitialState } = await import(pathToFileURL(join(aopDir, 'host', 'src', 'modal.ts')).href);
const core = await import(pathToFileURL(join(buildDir, 'src', 'probe-core.mjs')).href);

const browser = await chromium.launch();
const ACTIONS = {
  'X1-close-button': 'close', 'X2-escape-key': 'close', 'X3-window-close': 'close', 'B3-data-base64-1m': 'close',
  'R1-return-cancel': '#send-cancel', 'R2-return-large': '#send-large', 'R3-return-object': '#send-object', 'R4-return-twice': '#send-twice',
};

/** A WebView2-like modal: first close_and_send resolves it; "close" resolves undefined. */
async function fakeShowModalDialog(url, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.25 });
  const page = await context.newPage();
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  await page.exposeFunction('__aopxBridge', (m) => resolve(m?.params?.[0]));
  await page.addInitScript(() => {
    window.chrome = Object.assign(window.chrome || {}, { webview: { postMessage: (m) => window.__aopxBridge(m) } });
  });
  try {
    await page.goto(url);
  } catch {
    await context.close();
    return undefined; // refused navigation: the owner closes the blank dialog
  }
  const ask = (await page.locator('#ask').count()) ? await page.textContent('#ask') : '';
  const caseId = ask.split(':')[0];
  if (!caseId) {
    // The product GUI (no #ask banner): follow the printed instruction, press CANCEL.
    seenGui.push(await page.textContent('#source-name'));
    await page.getByRole('button', { name: /cancel/i }).click();
  } else {
    const action = ACTIONS[caseId] ?? '#send-report';
    if (action === 'close') { await context.close(); return undefined; }
    await page.click(action);
  }
  const value = await done;
  await context.close();
  return value;
}

const seenGui = [];
async function runCommand(id, environment) {
  const registered = { commands: new Map(), menu: [] };
  const lines = [];
  globalThis.__AOPX_FAKE_CONTEXT__ = {
    commands: { registerCommand: (cid, cb) => registered.commands.set(cid, cb) },
    ui: { showModalDialog: fakeShowModalDialog, registerContextMenuAction: (loc, label, cid) => registered.menu.push({ loc, label, cid }) },
    getObjectFromHandle: () => { throw new Error('the probe must not resolve handles'); },
    ...(environment ? { environment } : {}),
  };
  const origLog = console.log;
  console.log = (...a) => { lines.push(a.join(' ')); };
  try {
    // The verified example layout pairs "type": "module" with a CJS bundle (esbuild format "cjs"),
    // which the SDK CLI loads. Plain require() would treat it as ESM, so compile it as CommonJS here.
    const bundlePath = join(buildDir, 'dist', 'extension.js');
    const m = new Module(bundlePath);
    m.filename = bundlePath;
    m.paths = Module._nodeModulePaths(join(buildDir, 'dist'));
    m._compile(await readFile(bundlePath, 'utf8'), bundlePath);
    const ext = m.exports;
    ext.activate({ fake: true });
    await registered.commands.get(id)({ fakeHandle: true });
  } finally {
    console.log = origLog;
  }
  const begin = lines.indexOf('AOPX_S3_RESULTS_BEGIN');
  assert.ok(begin >= 0, 'results block printed');
  assert.equal(lines[begin + 2], 'AOPX_S3_RESULTS_END');
  return { report: JSON.parse(lines[begin + 1]), lines, registered };
}

// 1. Registration matches the verified example: initialize(activation, "1.0.0"), two commands,
//    context-menu actions on MidiClip and AudioClip.
const temp = await mkdtemp(join(tmpdir(), 'aopx s3 smoke-'));
const withTemp = await runCommand('aopx.s3probe.core', { tempDirectory: temp });
assert.equal(globalThis.__AOPX_FAKE_CONTEXT__.__initializedWith.apiVersion, '1.0.0');
assert.deepEqual([...withTemp.registered.commands.keys()].sort(), ['aopx.s3probe.core', 'aopx.s3probe.full']);
assert.deepEqual(withTemp.registered.menu.map((m) => m.loc).sort(), ['AudioClip', 'AudioClip', 'MidiClip', 'MidiClip']);
assert.ok(withTemp.lines.some((l) => l.includes('Context description') && l.includes('"tempDirectoryType":"string"')));

// 2. Core run with a temp directory: all 7 cases, nothing skipped.
const r = Object.fromEntries(withTemp.report.results.map((x) => [x.id, x]));
assert.deepEqual(Object.keys(r), ['P1-stock-data-1k', 'B1-data-base64-1k', 'X1-close-button', 'G2-gui-stock-data', 'A1-file-inline-1k', 'A2-file-inline-1m', 'G1-gui-file']);
for (const id of ['P1-stock-data-1k', 'B1-data-base64-1k', 'A1-file-inline-1k', 'A2-file-inline-1m']) {
  assert.equal(r[id].returned.treatAs, 'process', id);
  assert.equal(r[id].stateIntact, true, `${id} stateIntact`);
  assert.equal(r[id].facts.bridge, 'chrome.webview', id);
}
assert.equal(r['P1-stock-data-1k'].urlScheme, 'data:');
assert.ok(r['P1-stock-data-1k'].facts.hrefHead.startsWith('data:text/html,'), 'P1 uses the stock data:text/html,<encoded> form');
assert.equal(r['A1-file-inline-1k'].facts.protocol, 'file:');
assert.deepEqual([r['X1-close-button'].rawEmpty, r['X1-close-button'].returned.kind, r['X1-close-button'].returned.treatAs], [true, 'undefined', 'cancel']);
for (const id of ['G2-gui-stock-data', 'G1-gui-file']) assert.equal(r[id].returned.action, 'cancel', id);
assert.deepEqual(seenGui.splice(0), ['S3 probe.wav', 'S3 probe.wav']);
const files = (await readdir(temp)).filter((f) => f.startsWith('aopx-s3-results-core-'));
assert.equal(files.length, 1, 'results JSON written to the temp directory');
assert.equal(JSON.parse(await readFile(join(temp, files[0]), 'utf8')).results.length, 7);

// 3. Core run WITHOUT a temp directory (the API is unverified): file cases are skipped, not guessed.
const noTemp = await runCommand('aopx.s3probe.core', undefined);
const n = Object.fromEntries(noTemp.report.results.map((x) => [x.id, x]));
for (const id of ['A1-file-inline-1k', 'A2-file-inline-1m', 'G1-gui-file']) assert.match(n[id].skipped, /no tempDirectory/, id);
assert.equal(n['P1-stock-data-1k'].stateIntact, true);
seenGui.splice(0);

// 4. Full matrix: every case returns a classified result; B3 (~2.8 MB URL) is refused and recorded.
const full = await runCommand('aopx.s3probe.full', { tempDirectory: temp });
const f = Object.fromEntries(full.report.results.map((x) => [x.id, x]));
assert.equal(full.report.results.length, core.CASES.length);
assert.ok(f['B3-data-base64-1m'].urlLength > 2 * 1024 * 1024);
assert.equal(f['B3-data-base64-1m'].returned.treatAs, 'cancel');
assert.equal(f['R1-return-cancel'].returned.action, 'cancel');
assert.ok(f['R2-return-large'].returned.length > 1024 * 1024);
assert.equal(f['R3-return-object'].returned.kind, 'non-string:object');
assert.equal(f['Z2-size-1200x800'].facts.innerSize, '1200x800');
assert.equal(f['Z1-size-860x660'].facts.devicePixelRatio, 1.25);
for (const id of ['D1-file-hash', 'D2-file-query']) assert.equal(f[id].facts.stateVia, 'url-query-or-hash', id);

// 5. The packaged core agrees with the product host contract.
const html = await readFile(join(buildDir, 'src', 'interface.html'), 'utf8');
assert.equal(core.injectGuiState(html, core.guiState()), injectInitialState(html, core.guiState()), 'GUI injection identical to host/src/modal.ts');
assert.deepEqual(parseModalResult(JSON.stringify({ envelopeVersion: 1, action: 'cancel' })), { envelopeVersion: 1, action: 'cancel' });

await browser.close();
console.log(`SMOKE PASS: core 7/7 with temp, core file cases skipped without temp, full ${full.report.results.length}/${core.CASES.length}`);
