/*
 * S3 matrix in a real Chromium (Playwright), with a fake showModalDialog.
 *
 * This proves the harness and the delivery encodings in a Chromium engine (the same engine family
 * as WebView2), NOT Live's modal. It cannot answer what Live's WebView2 host does with file:// vs
 * data: URLs, its close button, Escape, or its DPI scaling: those are what the owner records on
 * Windows. Skipped without Playwright unless AOPX_REQUIRE_BROWSER=1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3_CASES, runS3Matrix } from '../s3-runner.mjs';
import { injectProbeState, makeProbeState, toBase64DataUrl, toNaiveDataUrl } from '../delivery.mjs';
import { parseModalResult } from '../../../host/src/modal.ts';

const here = dirname(fileURLToPath(import.meta.url));
const requireBrowser = process.env.AOPX_REQUIRE_BROWSER === '1';
let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  try { ({ chromium } = await import('playwright')); } catch { /* unavailable */ }
}
if (!chromium && requireBrowser) throw new Error('Playwright is required (AOPX_REQUIRE_BROWSER=1) but was not found');
const skip = chromium ? false : 'SKIPPED: Playwright not installed - S3 browser suite did not run';

/** What the simulated owner does for each case. */
const ACTIONS = {
  'X1-close-button': 'close', 'X2-escape-key': 'close', 'X3-window-close': 'close',
  'R1-return-cancel': '#send-cancel', 'R2-return-large': '#send-large', 'R3-return-object': '#send-object', 'R4-return-twice': '#send-twice',
  'G1-gui-file': 'gui-cancel', 'G2-gui-data-base64': 'gui-cancel',
};

/**
 * A fake showModalDialog: opens the URL in a page with a WebView2-style bridge whose first
 * close_and_send resolves the dialog (later sends are recorded but ignored), and "close" resolves
 * undefined, the way an unknown host might.
 */
function fakeShowModalDialog(browser, { deviceScaleFactor = 1, seen }) {
  let current = null;
  return async (url, width, height) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor });
    const page = await context.newPage();
    const caseId = S3_CASES[seen.length].id;
    seen.push({ caseId, urlLength: url.length });
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    await page.exposeFunction('__aopxBridge', (m) => resolve(m?.params?.[0]));
    await page.addInitScript(() => {
      window.chrome = Object.assign(window.chrome || {}, { webview: { postMessage: (m) => window.__aopxBridge(m) } });
    });
    try {
      await page.goto(url);
    } catch (e) {
      // A refused navigation (e.g. a data URL over Chromium's ~2 MB limit) leaves a blank dialog;
      // the owner would close it, so the fake returns what a closed dialog returns.
      seen.at(-1).navigationError = String(e.message).split('\n')[0];
      await context.close();
      return undefined;
    }
    const action = ACTIONS[caseId] ?? '#send-report';
    if (action === 'close') {
      await context.close();
      return undefined;
    }
    if (action === 'gui-cancel') {
      seen.at(-1).guiSource = await page.textContent('#source-name');
      await page.getByRole('button', { name: /cancel/i }).click();
    } else {
      await page.click(action);
    }
    const value = await done;
    if (action === 'gui-cancel') seen.at(-1).raw = value; // checked with the product parser below
    current = context;
    await current.close();
    return value;
  };
}

test('S3 matrix against a Chromium fake of showModalDialog', { skip }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const tempDirectory = await mkdtemp(join(tmpdir(), 'aopx-s3-temp-'));
  const outDir = await mkdtemp(join(tmpdir(), 'aopx-s3-out-'));
  const seen = [];
  const { report, outPath } = await runS3Matrix({
    showModalDialog: fakeShowModalDialog(browser, { deviceScaleFactor: 1.5, seen }),
    tempDirectory,
    outDir,
    environment: { host: 'playwright-chromium-fake', note: 'not Ableton Live' },
  });
  const byId = Object.fromEntries(report.results.map((r) => [r.id, r]));
  assert.equal(report.results.length, S3_CASES.length);
  assert.ok(JSON.parse(await readFile(outPath, 'utf8')).results.length === S3_CASES.length);

  await t.test('state arrives intact for every probe delivery method, up to 1 MB', () => {
    for (const id of ['A1-file-inline-1k', 'A2-file-inline-1m', 'D1-file-hash', 'D2-file-query', 'B1-data-base64-1k', 'B2-data-base64-512k', 'C1-data-percent-1k']) {
      assert.equal(byId[id].returned.treatAs, 'process', id);
      assert.equal(byId[id].stateIntact, true, `${id} state intact`);
    }
    assert.equal(byId['A1-file-inline-1k'].facts.stateVia, 'inline-script');
    assert.equal(byId['D1-file-hash'].facts.stateVia, 'url-query-or-hash');
    assert.equal(byId['A1-file-inline-1k'].facts.protocol, 'file:');
    assert.equal(byId['B1-data-base64-1k'].facts.protocol, 'data:');
    assert.equal(byId['A1-file-inline-1k'].facts.bridge, 'chrome.webview');
  });

  await t.test('a ~1 MB state does not fit in a data URL (Chromium ~2 MB URL limit); the temp file does', () => {
    assert.ok(byId['B3-data-base64-1m'].urlLength > 2 * 1024 * 1024);
    assert.equal(byId['B3-data-base64-1m'].returned.kind, 'undefined');
    assert.match(seen.find((s) => s.caseId === 'B3-data-base64-1m').navigationError, /ERR_ABORTED|Invalid url|ERR_INVALID_URL/);
    assert.equal(byId['A2-file-inline-1m'].stateIntact, true);
  });

  await t.test('return-value edge cases are classified, never thrown', () => {
    assert.equal(byId['R1-return-cancel'].returned.action, 'cancel');
    assert.ok(byId['R2-return-large'].returned.length > 1024 * 1024);
    assert.equal(byId['R3-return-object'].returned.kind, 'non-string:object');
    assert.equal(byId['R4-return-twice'].returned.parsed, undefined, 'parsed body is not stored in the report');
    for (const id of ['X1-close-button', 'X2-escape-key', 'X3-window-close']) {
      assert.equal(byId[id].returned.kind, 'undefined');
      assert.equal(byId[id].returned.treatAs, 'cancel');
    }
  });

  await t.test('DPI and size facts are reported by the probe', () => {
    assert.equal(byId['Z1-size-860x660'].facts.innerSize, '860x660');
    assert.equal(byId['Z1-size-860x660'].facts.devicePixelRatio, 1.5);
    assert.equal(byId['Z1-size-860x660'].facts.cssPxAtDpr, '1290x990');
    assert.equal(byId['Z2-size-1200x800'].facts.innerSize, '1200x800');
  });

  await t.test('the real product GUI opens from a temp file and from a base64 data URL', () => {
    for (const id of ['G1-gui-file', 'G2-gui-data-base64']) {
      assert.equal(byId[id].returned.action, 'cancel', id);
    }
    assert.deepEqual(seen.filter((s) => s.guiSource).map((s) => s.guiSource), ['S3 probe.wav', 'S3 probe.wav']);
    // The real GUI's Cancel is a valid product ModalResult (host/src/modal.ts), end to end.
    for (const s of seen.filter((x) => x.guiSource)) assert.deepEqual(parseModalResult(s.raw), { envelopeVersion: 1, action: 'cancel' });
  });

  await t.test('generated documents stay inside tempDirectory', () => {
    for (const r of report.results) if (r.generatedFile) assert.ok(r.generatedFile.startsWith(tempDirectory), r.id);
  });
});

test('a naive data:text/html,<raw> URL truncates the probe at the first "#" (review R1)', { skip }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const html = injectProbeState(await readFile(join(here, '..', 'probe.html'), 'utf8'), makeProbeState());
  const page = await browser.newPage();
  await page.goto(toNaiveDataUrl(html));
  assert.equal(await page.evaluate(() => typeof window.AOPX_PROBE_FACTS), 'undefined', 'probe script never ran');
});

test('data URL size boundary: just under 2 MiB loads intact, just over is refused (Chromium)', { skip }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const probeHtml = await readFile(join(here, '..', 'probe.html'), 'utf8');
  const LIMIT = 2 * 1024 * 1024; // 2,097,152 characters
  const urlFor = (n) => toBase64DataUrl(injectProbeState(probeHtml, makeProbeState({ payloadBytes: n })));
  // Size the payload so the whole URL lands 64 Ki characters either side of the limit.
  const base = urlFor(0).length;
  const perByte = (urlFor(100_000).length - base) / 100_000;
  const sized = (target) => urlFor(Math.max(0, Math.floor((target - base) / perByte)));
  const under = sized(LIMIT - 64 * 1024);
  const over = sized(LIMIT + 64 * 1024);
  assert.ok(under.length < LIMIT && over.length > LIMIT, `sizes ${under.length} / ${over.length}`);

  const ok = await browser.newPage();
  await ok.goto(under);
  assert.equal(await ok.evaluate(() => window.AOPX_PROBE_FACTS && window.AOPX_PROBE_FACTS.stateIntact), true, `${under.length}-char data URL loads intact`);

  const refused = await browser.newPage();
  let error = null;
  try { await refused.goto(over); } catch (e) { error = String(e.message).split('\n')[0].slice(0, 80); }
  assert.match(String(error), /ERR_ABORTED|ERR_INVALID_URL|Invalid url/, `${over.length}-char data URL is refused`);
});
