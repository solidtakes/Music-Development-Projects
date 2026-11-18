/*
 * Canonical editor regression for Issue #40. Based on the independently reviewed
 * T8-0 Fix 2 at 1ccaed1, using the canonical WAV engine and host state injector.
 * Compare screenshots with/without the path to prove actual paint, not just SVG
 * markup. No SDK, Live, files containing user audio, or audio import is involved.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { decodeWav, encodeWav, makeMetadata } from '../../engine/src/wav.ts';
import { computePeaks } from '../../engine/src/dsp.ts';
import { buildHostInitialState, injectInitialState, parseModalResult } from '../../host/src/modal.ts';

const html = await readFile(new URL('../interface.html', import.meta.url), 'utf8');
let chromium = null;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { try { ({ chromium } = await import('playwright')); } catch { /* unavailable */ } }
if (!chromium && process.env.AOPX_REQUIRE_BROWSER === '1') {
  throw new Error('Playwright is required (AOPX_REQUIRE_BROWSER=1) but was not found');
}
const skip = chromium ? false : 'SKIPPED: Playwright not installed - waveform pixel suite did not run';
const plan = { version: 1, operations: [
  { id: 'reverse-1', type: 'reverse', enabled: true },
  { id: 'gain-1', type: 'gain', enabled: false, db: -3 },
] };

function fixture(amplitude) {
  const frames = 48000;
  const samples = Float64Array.from({ length: frames }, (_, i) => amplitude * Math.sin(2 * Math.PI * i / 400));
  const bytes = encodeWav(makeMetadata(1, 48000, 32, 'float', frames), samples).bytes;
  const decoded = decodeWav(bytes);
  const waveform = computePeaks(decoded, 96);
  assert.equal(waveform.length, 96);
  return buildHostInitialState({
    source: { name: 'Synthetic waveform', fingerprint: 'e'.repeat(64), bytes: bytes.length, format: decoded.format },
    waveform, plan,
  });
}

async function open(browser, viewport, state) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    window.__sent = [];
    window.chrome = Object.assign(window.chrome || {}, { webview: { postMessage: m => window.__sent.push(m) } });
  });
  const document = injectInitialState(html, state);
  await page.goto('data:text/html;charset=utf-8;base64,' + Buffer.from(document).toString('base64'));
  return page;
}

async function measure(page) {
  const area = page.locator('.wave-area');
  const visible = (await area.screenshot()).toString('base64');
  await page.locator('#wave-path').evaluate(path => { path.style.visibility = 'hidden'; });
  const hidden = (await area.screenshot()).toString('base64');
  await page.locator('#wave-path').evaluate(path => { path.style.visibility = ''; });
  return page.evaluate(async ([visible, hidden]) => {
    async function pixels(b64) {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const g = canvas.getContext('2d'); g.drawImage(img, 0, 0);
      return { data: g.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
    }
    const a = await pixels(visible), b = await pixels(hidden);
    let lit = 0, top = a.height, bottom = -1;
    for (let i = 0; i < a.data.length; i += 4) {
      if ([0, 1, 2].some(c => Math.abs(a.data[i + c] - b.data[i + c]) > 8)) {
        lit++; const y = Math.floor(i / 4 / a.width); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    return { lit, height: a.height, span: lit ? bottom - top + 1 : 0 };
  }, [visible, hidden]);
}

test('canonical waveform paints loud, quiet and silent PCM distinctly', { skip }, async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const viewport of [{ width: 860, height: 660 }, { width: 640, height: 660 }, { width: 1281, height: 1032 }]) {
    await t.test(`${viewport.width}x${viewport.height}: PCM -> peaks -> injected modal -> painted pixels`, async () => {
      const results = {};
      for (const [name, amplitude, caption] of [
        ['loud', 0.8, 'PEAK -1.9 dBFS'],
        ['quiet', 0.02, 'PEAK -34.0 dBFS'],
        ['silent', 0, 'SILENT SOURCE · ALL PEAKS 0'],
      ]) {
        const state = fixture(amplitude);
        const original = structuredClone(state);
        const page = await open(browser, viewport, state);
        try {
          assert.equal(await page.textContent('#wave-level'), caption);
          assert.equal(await page.textContent('#apply'), 'APPLY TO CLIP ↗');
          assert.equal(await page.locator('#demo-flag.hidden').count(), 1);
          results[name] = await measure(page);
          // The display change must not alter the canonical modal protocol or plan.
          await page.click(name === 'silent' ? '#cancel' : '#apply');
          const sent = await page.evaluate(() => window.__sent);
          assert.equal(sent.length, 1);
          assert.equal(sent[0].method, 'close_and_send');
          assert.deepEqual(parseModalResult(sent[0].params[0]), name === 'silent'
            ? { envelopeVersion: 1, action: 'cancel' }
            : { envelopeVersion: 1, action: 'process', plan });
          assert.deepEqual(state, original, 'input state is unchanged');
        } finally { await page.close(); }
      }
      console.log(JSON.stringify({ viewport, ...results }));
      assert.ok(results.loud.lit > 5000, `loud source must paint clearly: ${JSON.stringify(results)}`);
      assert.ok(results.loud.span >= results.loud.height * 0.7);
      assert.ok(results.quiet.lit > 0 && results.quiet.lit < results.loud.lit / 5);
      assert.ok(results.quiet.span > 0 && results.quiet.span <= 4);
      assert.equal(results.silent.lit, 0, 'silence must paint no bars, leaving the midline');
    });
  }
  await t.test('missing waveform has its own caption; existing design preview remains available', async () => {
    const state = fixture(0);
    const page = await open(browser, { width: 860, height: 660 }, { ...state, waveform: [] });
    try { assert.equal(await page.textContent('#wave-level'), 'NO WAVEFORM DATA'); }
    finally { await page.close(); }
    const preview = await browser.newPage();
    try {
      await preview.setContent(html);
      assert.equal(await preview.textContent('#mode-label'), 'DESIGN PREVIEW');
      assert.equal(await preview.textContent('#demo-flag'), 'PREVIEW DATA');
      assert.ok((await measure(preview)).lit > 0);
    } finally { await preview.close(); }
  });
});
