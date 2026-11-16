/*
 * Host ↔ GUI contract in a real browser (T1 + T2).
 * The host module builds and injects HostInitialState into interface.html exactly as the Extension
 * Host will, and every payload the GUI sends through close_and_send is validated with the host's
 * parseModalResult. Uses Playwright + Chromium if available; otherwise skipped, unless
 * AOPX_REQUIRE_BROWSER=1 (`npm run test:browser`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { buildHostInitialState, injectInitialState, parseModalResult } from '../../host/src/modal.ts';

const here = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(here, '..', 'interface.html'), 'utf8');
const requireBrowser = process.env.AOPX_REQUIRE_BROWSER === '1';

let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  try { ({ chromium } = await import('playwright')); } catch { /* unavailable */ }
}
if (!chromium && requireBrowser) throw new Error('Playwright is required (AOPX_REQUIRE_BROWSER=1) but was not found');
const skip = chromium ? false : 'SKIPPED: Playwright not installed - host contract browser suite did not run';

const format = { channels: 2, sampleRate: 48000, bitDepth: 24, frames: 1440000, durationSeconds: 30, encoding: 'pcm' };
const source = { name: 'Clip.wav', fingerprint: 'e'.repeat(64), bytes: 8640044, format };
const plan = { version: 1, operations: [
  { id: 'reverse-1', type: 'reverse', enabled: true },
  { id: 'gain-1', type: 'gain', db: -6, enabled: true },
] };
// An all-cache-hit report, as the demo's "reopen and render" step produces: each step carries its
// entry's original renderMs forward, while the request itself took 17.39 ms.
const allHits = {
  steps: [
    { operationId: 'reverse-1', status: 'hit', renderMs: 67.0, lookupMs: 7.82, bytes: 8640044, cacheKey: 'f83d1840cfb3', format },
    { operationId: 'gain-1', status: 'hit', renderMs: 51.36, lookupMs: 7.97, bytes: 8640044, cacheKey: '9b12181f822c', format },
  ],
  sourceBytes: 8640044, outputBytes: 8640044, outputFormat: format, cacheBytes: 43201000, projectBytes: 51850000,
  wallMs: 17.39,
};

const dir = await mkdtemp(join(tmpdir(), 'aopx-host-contract-'));
let n = 0;
async function open(browser, state) {
  const file = join(dir, `modal-${n++}.html`);
  await writeFile(file, typeof state === 'string' ? state : injectInitialState(html, state));
  const page = await browser.newPage({ viewport: { width: 860, height: 660 } });
  await page.addInitScript(() => {
    window.__sent = [];
    // The Windows (WebView2) bridge variant of close_and_send.
    window.chrome = Object.assign(window.chrome || {}, { webview: { postMessage: (m) => window.__sent.push(m) } });
  });
  await page.goto(pathToFileURL(file).href);
  return page;
}
async function sentResult(page) {
  const sent = await page.evaluate(() => window.__sent);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, 'close_and_send');
  return parseModalResult(sent[0].params[0]);
}

test('host contract in a real browser', { skip }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());

  await t.test('injected HostInitialState renders as real (non-preview) state', async () => {
    const page = await open(browser, buildHostInitialState({ source, waveform: [{ min: -0.5, max: 0.5 }], plan, diagnostics: allHits }));
    assert.equal(await page.textContent('#source-name'), 'Clip.wav');
    assert.equal(await page.locator('#demo-flag.hidden').count(), 1, 'no PREVIEW DATA badge');
    assert.equal(await page.textContent('#mode-label'), 'EDITOR');
    assert.deepEqual(await page.$$eval('#device-list .device', (r) => r.map((e) => e.dataset.opId)), ['reverse-1', 'gain-1']);
  });

  await t.test('T1: LAST RENDER shows the measured wall time of an all-hit render', async () => {
    const page = await open(browser, buildHostInitialState({ source, waveform: [], plan, diagnostics: allHits }));
    assert.equal(await page.textContent('#render-time'), '17.4 ms', 'not 118.4 ms, the sum of carried-forward renderMs');
    assert.equal(await page.textContent('#cache-state'), '2 hit / 0 miss');
    const cells = await page.$$eval('#step-rows .step-row', (rows) => rows.map((r) => [...r.children].map((c) => c.textContent)));
    assert.deepEqual(cells.map((c) => c[2]), ['67.0 ms', '51.4 ms'], 'per-step renderMs stays in the step table');
  });

  await t.test('T1: a report without a measured wall time shows no number', async () => {
    const page = await open(browser, buildHostInitialState({ source, waveform: [], plan, diagnostics: { ...allHits, wallMs: null } }));
    assert.equal(await page.textContent('#render-time'), '—');
  });

  await t.test('T2: Apply and Cancel return valid ModalResult envelopes', async () => {
    let page = await open(browser, buildHostInitialState({ source, waveform: [], plan }));
    await page.click('#apply');
    assert.deepEqual(await sentResult(page), { envelopeVersion: 1, action: 'process', plan });

    page = await open(browser, buildHostInitialState({ source, waveform: [], plan }));
    await page.click('.device[data-op-id="reverse-1"] .device-activator'); // bypass Reverse
    await page.click('#apply');
    const bypassed = await sentResult(page);
    assert.equal(bypassed.action, 'process');
    assert.deepEqual(bypassed.action === 'process' && bypassed.plan.operations.map((o) => o.enabled), [false, true]);

    page = await open(browser, buildHostInitialState({ source, waveform: [], plan }));
    await page.click('#cancel');
    assert.deepEqual(await sentResult(page), { envelopeVersion: 1, action: 'cancel' });
  });

  await t.test('T2: a hostile source name cannot inject script', async () => {
    const evil = { ...source, name: '</script><script>window.__pwned=1</script>' };
    const page = await open(browser, buildHostInitialState({ source: evil, waveform: [], plan }));
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    assert.equal(await page.textContent('#source-name'), evil.name);
  });

  await t.test('T2: an unsupported envelope version disables Apply but still allows Cancel', async () => {
    const future = { ...buildHostInitialState({ source, waveform: [], plan }), envelopeVersion: 2 };
    const doc = html.replace('<script id="aopx-plan-core">', `<script>window.AOPX_INITIAL_STATE=${JSON.stringify(future)};</script>\n<script id="aopx-plan-core">`);
    const page = await open(browser, doc);
    assert.equal(await page.isDisabled('#apply'), true);
    assert.match(await page.textContent('#status'), /Unsupported host state version 2/);
    await page.click('#cancel');
    assert.deepEqual(await sentResult(page), { envelopeVersion: 1, action: 'cancel' });
  });
});
