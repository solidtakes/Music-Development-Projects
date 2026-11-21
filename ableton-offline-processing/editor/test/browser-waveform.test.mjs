/*
 * Waveform, PEAK PREVIEW and dialog keys in a real browser (P3/P4, Issue #40).
 * State is built and injected with ../host/src/modal.ts as the Extension Host will do it, and every
 * payload sent through close_and_send is validated with parseModalResult.
 * Uses Playwright + Chromium if available; otherwise skipped, unless AOPX_REQUIRE_BROWSER=1.
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
const skip = chromium ? false : 'SKIPPED: Playwright not installed - waveform browser suite did not run';

const format = { channels: 2, sampleRate: 48000, bitDepth: 24, frames: 1440000, durationSeconds: 30, encoding: 'pcm' };
const source = { name: 'Clip.wav', fingerprint: 'f'.repeat(64), bytes: 8640044, format };
const plan = (ops) => ({ version: 1, operations: ops });
const flat = (n, v) => Array.from({ length: n }, () => ({ min: -v, max: v }));

const dir = await mkdtemp(join(tmpdir(), 'aopx-waveform-'));
let n = 0;
async function open(browser, state) {
  const file = join(dir, `modal-${n++}.html`);
  await writeFile(file, injectInitialState(html, buildHostInitialState(state)));
  const page = await browser.newPage({ viewport: { width: 860, height: 660 } });
  await page.addInitScript(() => {
    window.__sent = [];
    window.chrome = Object.assign(window.chrome || {}, { webview: { postMessage: (m) => window.__sent.push(m) } });
  });
  await page.goto(pathToFileURL(file).href);
  return page;
}
const sent = (page) => page.evaluate(() => window.__sent.map((m) => m.params[0]));
/** Column heights (0..46) drawn in a waveform path, in order of x. */
async function heights(page, id = 'wave-path') {
  const d = await page.getAttribute(`#${id}`, 'd');
  return [...d.matchAll(/M[\d.]+ 50 L[\d.]+ ([\d.]+) M/g)].map((m) => 50 - Number(m[1]));
}

test('waveform: browser suite', { skip }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());

  await t.test('real host state without peaks shows no waveform and says so (M5)', async () => {
    const page = await open(browser, { source, waveform: [], plan: plan([{ id: 'g', type: 'gain', db: -3, enabled: true }]) });
    assert.equal(await page.getAttribute('#wave-path', 'd'), '');
    assert.match(await page.textContent('#wave-note'), /NO WAVEFORM DATA/);
    assert.equal(await page.isVisible('#demo-flag'), false);
    assert.equal(await page.textContent('#mode-label'), 'EDITOR');
    assert.equal(await page.isDisabled('#view-preview'), true);
    await page.close();
  });

  await t.test('waveform is visible (stroked) and keeps a one-bin transient (L3)', async () => {
    const peaks = flat(900, 0.05);
    peaks[451] = { min: -1, max: 1 };
    const page = await open(browser, { source, waveform: peaks, plan: plan([{ id: 'r', type: 'reverse', enabled: true }]) });
    const style = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('wave-path')); return { stroke: cs.stroke, width: cs.strokeWidth }; });
    assert.notEqual(style.stroke, 'none', 'a fill-only path of zero-area lines draws nothing');
    assert.notEqual(style.width, '0px');
    const h = await heights(page);
    assert.equal(h.length, 180);
    assert.equal(h.filter((v) => v === 46).length, 1, 'the transient column is drawn at full height');
    await page.close();
  });

  await t.test('PEAK PREVIEW is labelled, follows the plan live, and never changes the returned plan', async () => {
    const ramp = Array.from({ length: 360 }, (_, i) => ({ min: -(0.05 + 0.75 * i / 359), max: 0.05 + 0.75 * i / 359 }));
    const page = await open(browser, { source, waveform: ramp, plan: plan([
      { id: 'reverse-1', type: 'reverse', enabled: true },
      { id: 'gain-1', type: 'gain', db: -6, enabled: true },
    ]) });
    const src = await heights(page);
    assert.ok(src[0] < src[179], 'source ramp rises');
    await page.click('#view-preview');
    assert.equal(await page.getAttribute('#view-preview', 'aria-pressed'), 'true');
    assert.match(await page.textContent('#wave-label'), /PEAK PREVIEW.*NOT A RENDER/);
    assert.match(await page.textContent('#wave-note'), /ESTIMATE ONLY/);
    const pre = await heights(page);
    assert.ok(pre[0] > pre[179], 'reversed in the preview');
    assert.ok(pre[0] < src[179], 'attenuated by -6 dB in the preview');

    // Gain to +6 dB through the real slider: 0.8 * 2.0 > full scale, so the preview warns live.
    await page.click('.device:nth-child(2)');
    await page.evaluate(() => { const r = document.querySelector('#inspector-controls input[type=range]'); r.value = '6'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await page.textContent('#wave-note'), /PEAKS EXCEED 0 dBFS/);
    assert.ok((await heights(page, 'wave-over')).length > 0, 'over-full-scale columns drawn separately');

    // Bypass the gain: the preview follows the activator.
    await page.click('.device:nth-child(2) .device-activator');
    assert.match(await page.textContent('#wave-note'), /ESTIMATE ONLY/);
    assert.equal(await page.getAttribute('#wave-over', 'd'), '');

    await page.click('#view-source');
    assert.deepEqual(await heights(page), src, 'SOURCE view is unchanged by the plan');
    await page.click('#apply');
    const [payload] = await sent(page);
    const result = parseModalResult(payload); // strict: only known fields are accepted
    assert.deepEqual(result.plan.operations, [
      { id: 'reverse-1', type: 'reverse', enabled: true },
      { id: 'gain-1', type: 'gain', db: 6, enabled: false },
    ]);
    await page.close();
  });

  await t.test('Esc returns an explicit cancel envelope', async () => {
    const page = await open(browser, { source, waveform: flat(10, 0.3), plan: plan([{ id: 'r', type: 'reverse', enabled: true }]) });
    await page.keyboard.press('Escape');
    const all = await sent(page);
    assert.equal(all.length, 1);
    assert.deepEqual(parseModalResult(all[0]), { envelopeVersion: 1, action: 'cancel' });
    await page.close();
  });

  await t.test('Esc closes the + ADD OP menu first and sends nothing', async () => {
    const page = await open(browser, { source, waveform: flat(10, 0.3), plan: plan([{ id: 'r', type: 'reverse', enabled: true }]) });
    await page.click('#add-menu');
    assert.equal(await page.isVisible('#add-pop'), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.$('#add-pop'), null);
    assert.deepEqual(await sent(page), []);
    await page.close();
  });

  await t.test('Esc during a drag cancels the drag only, not the dialog', async () => {
    const page = await open(browser, { source, waveform: flat(10, 0.3), plan: plan([
      { id: 'a', type: 'reverse', enabled: true },
      { id: 'b', type: 'gain', db: -3, enabled: true },
    ]) });
    const box = await page.locator('.drag-handle').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.deepEqual(await sent(page), []);
    assert.match(await page.textContent('#status'), /Reorder cancelled/);
    await page.close();
  });

  await t.test('plain Enter never applies; Ctrl+Enter applies; Enter on a row still selects it', async () => {
    const page = await open(browser, { source, waveform: flat(10, 0.3), plan: plan([
      { id: 'a', type: 'reverse', enabled: true },
      { id: 'b', type: 'gain', db: -3, enabled: true },
    ]) });
    await page.locator('body').focus();
    await page.keyboard.press('Enter');
    await page.focus('.device:nth-child(2)');
    await page.keyboard.press('Enter');
    assert.equal(await page.getAttribute('.device:nth-child(2)', 'aria-pressed'), 'true');
    assert.deepEqual(await sent(page), []);
    await page.keyboard.press('Control+Enter');
    const all = await sent(page);
    assert.equal(all.length, 1);
    const result = parseModalResult(all[0]);
    assert.equal(result.action, 'process');
    assert.deepEqual(result.plan.operations.map((o) => o.id), ['a', 'b']);
    await page.keyboard.press('Control+Enter'); // busy after Apply: no second send
    await page.keyboard.press('Escape');
    assert.equal((await sent(page)).length, 1);
    await page.close();
  });

  await t.test('browser design preview keeps its labelled sample waveform', async () => {
    const page = await browser.newPage({ viewport: { width: 860, height: 660 } });
    await page.goto(pathToFileURL(join(here, '..', 'interface.html')).href);
    assert.equal(await page.isVisible('#demo-flag'), true);
    assert.equal((await heights(page)).length, 180);
    assert.equal(await page.isDisabled('#view-preview'), false);
    await page.close();
  });
});
