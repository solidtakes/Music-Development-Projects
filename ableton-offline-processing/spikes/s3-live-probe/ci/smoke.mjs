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
import { mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [buildDir, aopDir] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { parseModalResult, injectInitialState } = await import(pathToFileURL(join(aopDir, 'host', 'src', 'modal.ts')).href);
const core = await import(pathToFileURL(join(buildDir, 'src', 'probe-core.mjs')).href);

const browser = await chromium.launch();
let currentLines = [];
const pageChecks = []; // { caseId, visible, allow }

/** The case the probe is currently showing (from its last "[AOPX S3] <id>: <ask>" log line). */
const currentCase = () => {
  for (let i = currentLines.length - 1; i >= 0; i--) {
    const m = /^\[AOPX S3\] ([A-Z][A-Z0-9]*-[^:\s]+): /.exec(currentLines[i]);
    if (m) return m[1];
  }
  return '';
};

/**
 * A WebView2-like modal: the first close_and_send resolves it; closing resolves undefined.
 * The simulated owner follows the build-2 rules: press the ONLY visible probe button, or close the
 * window if there is none; in the AOPX editor press Cancel or Apply as the case's instruction says.
 */
let throwForCase = null; // failure-path test: the modal throws an error that mentions profile paths
async function fakeShowModalDialog(url, width, height) {
  if (throwForCase && currentCase() === throwForCase) {
    throw new Error('WebView2 failed for C:\\Users\\Jane Doe\\AppData\\Local\\Temp\\x.html via file:///C:/Users/Jane%20Doe/AppData/x.html');
  }
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.25 });
  const page = await context.newPage();
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  await page.exposeFunction('__aopxBridge', (m) => resolve(m?.params?.[0]));
  await page.addInitScript(() => {
    window.chrome = Object.assign(window.chrome || {}, { webview: { postMessage: (m) => window.__aopxBridge(m) } });
  });
  const close = async () => { await context.close(); return undefined; };
  try {
    await page.goto(url);
  } catch {
    return close(); // refused navigation: the owner closes the blank dialog
  }
  const caseId = currentCase();
  if (!(await page.locator('#ask').count())) {
    // The product GUI (no #ask banner): follow the instruction printed in the console.
    seenGui.push(await page.textContent('#source-name'));
    if (/apply/.test(caseId)) await page.click('#apply');
    else await page.getByRole('button', { name: /cancel/i }).click();
  } else {
    const ask = await page.textContent('#ask');
    assert.ok(ask.startsWith(`${caseId}: `), `banner names the case (${ask})`);
    const visible = await page.locator('.buttons button:visible').evaluateAll((bs) => bs.map((b) => b.id));
    const enabled = await page.locator('.buttons button:enabled').evaluateAll((bs) => bs.map((b) => b.id));
    pageChecks.push({ caseId, visible, enabled });
    if (visible.length === 0) {
      if (caseId.startsWith('X2')) await page.keyboard.press('Escape'); // Chromium ignores it; the owner then closes
      return close();
    }
    assert.equal(visible.length, 1, `${caseId}: exactly one button is offered`);
    await page.click(`#${visible[0]}`);
    if (visible[0] === 'close-window') { await page.waitForTimeout(200); return close(); }
  }
  const value = await done;
  await context.close();
  return value;
}

/** An SDK-like environment whose paths are accessors filled in only after activation (the build-1 host observation). */
function lazyEnvironment(temp) {
  let ready = false;
  class Environment {
    get tempDirectory() { return ready ? temp : undefined; }
    get storageDirectory() { return ready ? temp : undefined; }
    get language() { return 'en'; }
  }
  return { env: new Environment(), becomeReady: () => { ready = temp !== undefined; } };
}

const seenGui = [];
async function runCommand(id, temp) {
  const registered = { commands: new Map(), menu: [] };
  const lines = [];
  currentLines = lines;
  const { env, becomeReady } = lazyEnvironment(temp);
  globalThis.__AOPX_FAKE_CONTEXT__ = {
    commands: { registerCommand: (cid, cb) => registered.commands.set(cid, cb) },
    ui: { showModalDialog: fakeShowModalDialog, registerContextMenuAction: (loc, label, cid) => registered.menu.push({ loc, label, cid }) },
    getObjectFromHandle: () => { throw new Error('the probe must not resolve handles'); },
    environment: env,
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
    m.exports.activate({ fake: true });
    becomeReady();
    await registered.commands.get(id)({ fakeHandle: true });
  } finally {
    console.log = origLog;
  }
  const begin = lines.indexOf('AOPX_S3_RESULTS_BEGIN');
  assert.ok(begin >= 0, 'results block printed');
  assert.equal(lines[begin + 2], 'AOPX_S3_RESULTS_END');
  const sBegin = lines.indexOf('AOPX_S3_SUMMARY_BEGIN');
  const sEnd = lines.indexOf('AOPX_S3_SUMMARY_END');
  assert.ok(sBegin >= 0 && sEnd === begin - 1, 'summary printed immediately before the JSON block');
  return { report: JSON.parse(lines[begin + 1]), summary: lines.slice(sBegin + 2, sEnd), lines, registered };
}

const parseJsonAfter = (lines, marker) => JSON.parse(lines.find((l) => l.includes(marker)).split(marker)[1]);
const CORE_IDS = ['P1-stock-data-1k', 'B1-data-base64-1k', 'X1-close-button', 'X2-escape-key', 'G2-gui-stock-cancel', 'G2-gui-stock-apply', 'Z1-size-860x660', 'B2-data-stock-512k', 'T1-os-tmpdir-file-1k', 'A1-file-inline-1k', 'A2-file-inline-1m', 'G1-gui-file'];
const REPORT_IDS = ['P1-stock-data-1k', 'B1-data-base64-1k', 'Z1-size-860x660', 'B2-data-stock-512k', 'T1-os-tmpdir-file-1k', 'A1-file-inline-1k', 'A2-file-inline-1m'];

// 1. Registration matches the verified example: initialize(activation, "1.0.0"), two commands,
//    context-menu actions on MidiClip and AudioClip.
// Fixtures (H1): on EVERY OS, the SDK temp directory and os.tmpdir() sit under a profile folder
// "Users/Jane Doe", so paths, file:// URLs (hrefHead) and error messages all carry a user name that must
// never be emitted. On Windows the runner's own profile segment (C:\Users\<name>) is checked as well.
const base = await mkdtemp(join(tmpdir(), 'aopx s3 smoke-'));
const RAW_NAME = 'Jane Doe';
const osTemp = join(base, 'Users', RAW_NAME, 'AppData', 'Local', 'Temp');
const temp = join(osTemp, 'aopx sdk temp');
await mkdir(temp, { recursive: true });
for (const k of ['TMPDIR', 'TEMP', 'TMP']) process.env[k] = osTemp;
assert.equal(tmpdir(), osTemp, 'os.tmpdir() points into the fixture profile');
const runnerProfile = /[\\/]Users[\\/]([^\\/]+)/i.exec(base)?.[1];
const FORBIDDEN = [RAW_NAME, 'Jane', encodeURIComponent(RAW_NAME), ...(runnerProfile ? [runnerProfile] : [])];
function assertNoRawName(run, label) {
  const text = `${run.lines.join('\n')}\n${JSON.stringify(run.report)}`;
  for (const w of FORBIDDEN) assert.ok(!text.includes(w), `${label}: raw user name ${JSON.stringify(w)} was emitted`);
}

const withTemp = await runCommand('aopx.s3probe.core', temp);
assert.equal(globalThis.__AOPX_FAKE_CONTEXT__.__initializedWith.apiVersion, '1.0.0');
assert.deepEqual([...withTemp.registered.commands.keys()].sort(), ['aopx.s3probe.core', 'aopx.s3probe.full']);
assert.deepEqual(withTemp.registered.menu.map((m) => m.loc).sort(), ['AudioClip', 'AudioClip', 'MidiClip', 'MidiClip']);

// 2. Build 2 item 1: the environment is read at activation AND at command time, with descriptors.
const atActivation = parseJsonAfter(withTemp.lines, 'Context description at activation: ');
const atCommand = parseJsonAfter(withTemp.lines, 'Context description at command time: ');
assert.equal(atActivation.tempDirectoryType, 'undefined', 'lazy env: undefined at activation (as on the host)');
assert.equal(atCommand.tempDirectoryType, 'string', 'lazy env: a string at command time');
assert.equal(atCommand.storageDirectoryType, 'string');
// The probe redacts the user name in logged paths (build 2 item 1), so compare against the redacted path:
// on Windows the runner temp is C:\Users\<name>\..., which the unredacted value would never match.
assert.deepEqual(atCommand.environmentMembers.tempDirectory, { where: 'proto1', kind: 'accessor', hasGet: true, hasSet: false, type: 'string', value: core.redactPath(temp), length: temp.length });
assert.equal(atCommand.environmentMembers.language.value, 'en');
assert.equal(core.redactPath('C:\\Users\\Some One\\AppData\\Local\\Temp\\x.html'), 'C:\\Users\\<user>\\AppData\\Local\\Temp\\x.html');
assert.equal(atCommand.tempDirectory, core.redactPath(temp), 'describeContext logs the redacted temp path');
assert.ok(atCommand.tempDirectory.includes('<user>'));
// redactPath: every occurrence, file URLs, JSON-escaped paths, 8.3 names, apostrophes, /home.
assert.equal(core.redactPath('C:\\Users\\A B\\x and C:\\Users\\A B\\y'), 'C:\\Users\\<user>\\x and C:\\Users\\<user>\\y');
assert.equal(core.redactPath('file:///C:/Users/Jane%20Doe/AppData/a.html'), 'file:///C:/Users/<user>/AppData/a.html');
assert.equal(core.redactPath(JSON.stringify({ p: 'C:\\Users\\Jane Doe\\AppData' })), JSON.stringify({ p: 'C:\\Users\\<user>\\AppData' }));
assert.equal(core.redactPath('C:\\Users\\JANEDO~1\\x'), 'C:\\Users\\<user>\\x');
assert.equal(core.redactPath("C:\\Users\\Pat O'Brien\\x"), 'C:\\Users\\<user>\\x');
assert.equal(core.redactPath('/home/jane/x /Users/jane/y'), '/home/<user>/x /Users/<user>/y');
assert.deepEqual(core.redactDeep({ a: ['C:\\Users\\J\\x', 1, null], b: { c: '/Users/j/z' } }), { a: ['C:\\Users\\<user>\\x', 1, null], b: { c: '/Users/<user>/z' } });

// 3. Core run: 12 cases, every one returns what its instruction asked for.
const r = Object.fromEntries(withTemp.report.results.map((x) => [x.id, x]));
assert.deepEqual(Object.keys(r), CORE_IDS);
for (const id of CORE_IDS) assert.equal(r[id].asExpected, true, `${id} as asked`);
for (const id of REPORT_IDS) {
  assert.equal(r[id].returned.treatAs, 'process', id);
  assert.equal(r[id].button, 'send-report', id);
  assert.equal(r[id].stateIntact, true, `${id} stateIntact`);
  assert.equal(r[id].facts.bridge, 'chrome.webview', id);
}
assert.ok(r['P1-stock-data-1k'].facts.hrefHead.startsWith('data:text/html,'), 'P1 uses the stock data:text/html,<encoded> form');
assert.ok(r['B2-data-stock-512k'].urlLength > 1024 * 1024 && r['B2-data-stock-512k'].urlLength < 2 * 1024 * 1024, 'B2 stock URL size');
for (const id of ['T1-os-tmpdir-file-1k', 'A1-file-inline-1k', 'A2-file-inline-1m', 'G1-gui-file']) {
  assert.equal(r[id].urlScheme, 'file:', id);
  assert.equal(r[id].cleanedUp, true, `${id} generated file deleted`);
}
assert.match(r['T1-os-tmpdir-file-1k'].facts.hrefHead, /^file:\/\/\/.*Users\/<user>/, 'T1 hrefHead (a file:// URL under the profile) is redacted');
assertNoRawName(withTemp, 'core run');
for (const id of ['X1-close-button', 'X2-escape-key']) assert.deepEqual([r[id].rawEmpty, r[id].returned.treatAs], [true, 'cancel'], id);
for (const id of ['G2-gui-stock-cancel', 'G1-gui-file']) assert.deepEqual(r[id].product, { accepted: true, action: 'cancel', operations: null, operationTypes: null }, id);
assert.deepEqual(r['G2-gui-stock-apply'].product, { accepted: true, action: 'process', operations: 2, operationTypes: ['reverse', 'gain'] }, 'Apply parsed by the product parser');
assert.deepEqual(seenGui.splice(0), ['S3 probe.wav', 'S3 probe.wav', 'S3 probe.wav']);
assert.deepEqual((await readdir(temp)).filter((f) => f.startsWith('aopx-s3-')), [], 'no generated file left in the SDK temp directory');
assert.equal((await readdir(tmpdir())).filter((f) => f.startsWith('aopx-s3-T1-')).length, 0, 'no generated file left in os.tmpdir()');
assert.equal(withTemp.summary.length, CORE_IDS.length);
assert.ok(withTemp.summary.every((l) => / OK /.test(l)), withTemp.summary.join('\n'));
// Build 2 item 2: every probe page offered exactly the buttons its case allows.
for (const p of pageChecks.splice(0)) {
  const c = core.CASES.find((x) => x.id === p.caseId);
  assert.deepEqual(p.visible, c.allow, `${p.caseId} visible buttons`);
  assert.deepEqual(p.enabled, c.allow, `${p.caseId} enabled buttons`);
}

// 4. Core run where the SDK never provides a temp directory: SDK-temp cases are skipped, not guessed; T1 still runs.
const noTemp = await runCommand('aopx.s3probe.core', undefined);
const n = Object.fromEntries(noTemp.report.results.map((x) => [x.id, x]));
for (const id of ['A1-file-inline-1k', 'A2-file-inline-1m', 'G1-gui-file']) assert.match(n[id].skipped, /not a string at command time/, id);
assert.equal(n['T1-os-tmpdir-file-1k'].asExpected, true);
assert.equal(n['P1-stock-data-1k'].stateIntact, true);
assert.ok(noTemp.summary.filter((l) => / SKIP /.test(l)).length === 3);
assertNoRawName(noTemp, 'core run without SDK temp');
seenGui.splice(0);
pageChecks.splice(0);

// 4b. Failure paths are redacted too: an SDK temp directory that does not exist (the ENOENT message
//     carries the path) and a modal that throws an error naming profile paths.
throwForCase = 'P1-stock-data-1k';
const failing = await runCommand('aopx.s3probe.core', join(osTemp, 'missing dir'));
throwForCase = null;
const fl = Object.fromEntries(failing.report.results.map((x) => [x.id, x]));
for (const id of ['A1-file-inline-1k', 'A2-file-inline-1m', 'G1-gui-file']) {
  assert.match(fl[id].buildError, /ENOENT/, id);
  assert.match(fl[id].buildError, /Users[\\/]+<user>/, `${id} buildError redacted`);
}
assert.equal(fl['P1-stock-data-1k'].threw.message, 'WebView2 failed for C:\\Users\\<user>\\AppData\\Local\\Temp\\x.html via file:///C:/Users/<user>/AppData/x.html');
assert.ok(failing.lines.some((l) => l.includes('could not build the URL: ENOENT') && l.includes('<user>')));
assert.equal(fl['T1-os-tmpdir-file-1k'].asExpected, true);
assertNoRawName(failing, 'failure paths');
seenGui.splice(0);
pageChecks.splice(0);

// 5. Full matrix: every case returns a classified result as asked; B3 (~2.8 MB URL) is refused.
const full = await runCommand('aopx.s3probe.full', temp);
const f = Object.fromEntries(full.report.results.map((x) => [x.id, x]));
assert.equal(full.report.results.length, core.CASES.length);
for (const x of full.report.results) assert.equal(x.asExpected, true, `${x.id} as asked`);
assert.ok(f['B3-data-base64-1m'].urlLength > 2 * 1024 * 1024);
assert.equal(f['B3-data-base64-1m'].rawEmpty, true);
assert.equal(f['R1-return-cancel'].stateIntact, true, 'cancel envelopes now carry facts');
assert.ok(f['R2-return-large'].returned.length > 1024 * 1024);
assert.deepEqual([f['R3-return-object'].returned.kind, f['R3-return-object'].button], ['non-string:object', 'send-object']);
assert.equal(f['Z2-size-1200x800'].facts.innerSize, '1200x800');
assert.equal(f['Z1-size-860x660'].facts.devicePixelRatio, 1.25);
for (const id of ['D1-file-hash', 'D2-file-query']) assert.equal(f[id].facts.stateVia, 'url-query-or-hash', id);
for (const p of pageChecks.splice(0)) assert.deepEqual(p.visible, core.CASES.find((x) => x.id === p.caseId).allow, `${p.caseId} visible buttons`);
for (const id of ['D1-file-hash', 'D2-file-query']) assert.match(f[id].facts.hrefHead, /Users\/<user>/, `${id} hrefHead redacted`);
assertNoRawName(full, 'full matrix');

// 6. The packaged core agrees with the product host contract.
const html = await readFile(join(buildDir, 'src', 'interface.html'), 'utf8');
assert.equal(core.injectGuiState(html, core.guiState()), injectInitialState(html, core.guiState()), 'GUI injection identical to host/src/modal.ts');
assert.equal(await readFile(join(buildDir, 'src', 'product', 'host', 'src', 'modal.ts'), 'utf8'), await readFile(join(aopDir, 'host', 'src', 'modal.ts'), 'utf8'), 'bundled parser is the repo parser');
assert.deepEqual(parseModalResult(JSON.stringify({ envelopeVersion: 1, action: 'cancel' })), { envelopeVersion: 1, action: 'cancel' });

await browser.close();
console.log(`SMOKE PASS: build 2 core ${CORE_IDS.length}/${CORE_IDS.length} as asked (lazy SDK temp read at command time), SDK-temp cases skipped when absent, full ${full.report.results.length}/${core.CASES.length} as asked, no raw user name in any log line or report (incl. failure paths)`);
