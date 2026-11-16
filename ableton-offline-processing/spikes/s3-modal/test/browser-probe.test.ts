/*
 * The S3 probe in real Chromium (Playwright). Chromium is the engine under WebView2, so this checks
 * the probe and the delivery variants themselves; it does NOT prove how Live's modal behaves.
 * Skipped without Playwright unless AOPX_REQUIRE_BROWSER=1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseModalResult } from '../../../host/src/modal.ts';
import { injectProbe, toBase64DataUrl, toPercentDataUrl, toRawDataUrl, writeModalFile } from '../src/modal-transport.ts';

const here = dirname(fileURLToPath(import.meta.url));
const probeHtml = await readFile(join(here, '..', 'probe', 'probe.html'), 'utf8');
const requireBrowser = process.env['AOPX_REQUIRE_BROWSER'] === '1';

let chromium: any = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch { /* unavailable */ }
if (!chromium && requireBrowser) throw new Error('Playwright is required (AOPX_REQUIRE_BROWSER=1) but was not found');
const skip = chromium ? false : 'SKIPPED: Playwright not installed - S3 probe browser suite did not run';

async function openProbe(browser: any, url: string, opts: { deviceScaleFactor?: number } = {}) {
  const page = await browser.newPage({ viewport: { width: 860, height: 660 }, deviceScaleFactor: opts.deviceScaleFactor ?? 1 });
  await page.addInitScript(() => {
    (window as any).__sent = [];
    (window as any).chrome = Object.assign((window as any).chrome || {}, { webview: { postMessage: (m: unknown) => (window as any).__sent.push(m) } });
  });
  await page.goto(url);
  return page;
}
async function clickAndRead(page: any, selector: string) {
  await page.click(selector);
  const sent = await page.evaluate(() => (window as any).__sent);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, 'close_and_send');
  assert.equal(typeof sent[0].params[0], 'string', 'params[0] is a string');
  return sent[0].params[0] as string;
}

test('S3 probe in Chromium', { skip }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const dir = await mkdtemp(join(tmpdir(), 'aopx-s3-browser '));

  const variants: Array<[string, () => Promise<string>, string]> = [
    ['base64 data URL', async () => toBase64DataUrl(injectProbe(probeHtml, 'A', 0)), 'data:'],
    ['percent data URL', async () => toPercentDataUrl(injectProbe(probeHtml, 'A2', 0)), 'data:'],
    ['temp file URL', async () => (await writeModalFile(dir, injectProbe(probeHtml, 'B', 0), 'probe B.html')).url, 'file:'],
    ['base64 data URL, 256 KB state', async () => toBase64DataUrl(injectProbe(probeHtml, 'D', 256 * 1024)), 'data:'],
    ['temp file URL, 2 MB state', async () => (await writeModalFile(dir, injectProbe(probeHtml, 'F', 2 * 1024 * 1024), 'probe F.html')).url, 'file:'],
  ];
  for (const [name, build, protocol] of variants) {
    await t.test(`${name}: loads intact and returns diagnostics through chrome.webview`, async () => {
      const page = await openProbe(browser, await build());
      const result = JSON.parse(await clickAndRead(page, '#return'));
      const d = result.diagnostics;
      assert.equal(result.action, 'probe');
      assert.equal(d.protocol, protocol);
      assert.equal(d.injected, true);
      assert.equal(d.injectedIntact, true, 'injected state arrived byte-for-byte');
      assert.equal(d.sentinelPresent, true, 'document was not truncated');
      assert.deepEqual(d.bridge, { webkitLive: false, chromeWebview: true, chromeWebviewPostMessage: true });
      assert.deepEqual(d.inner, [860, 660]);
      await page.close();
    });
  }

  await t.test('Chromium refuses a data URL over about 2 MiB; a temp file has no such limit', async () => {
    // Size the injected state so the whole URL lands just under / just over 2 MiB (2,097,152 chars).
    const urlFor = (n: number) => toBase64DataUrl(injectProbe(probeHtml, 'LIMIT', n));
    const base = urlFor(0).length;
    const perChar = (urlFor(100_000).length - base) / 100_000;
    const sized = (target: number) => urlFor(Math.max(0, Math.floor((target - base) / perChar)));
    const under = sized(2 * 1024 * 1024 - 64 * 1024);
    const over = sized(2 * 1024 * 1024 + 64 * 1024);
    assert.ok(under.length < 2 * 1024 * 1024 && over.length > 2 * 1024 * 1024, `sizes ${under.length} / ${over.length}`);

    const ok = await openProbe(browser, under);
    assert.equal(JSON.parse(await clickAndRead(ok, '#return')).diagnostics.injectedIntact, true, `a ${under.length}-char data URL loads`);
    await ok.close();

    const page = await browser.newPage();
    let error: string | null = null;
    try { await page.goto(over); } catch (e) { error = String((e as Error).message).slice(0, 60); }
    assert.match(String(error), /ERR_ABORTED|ERR_INVALID_URL/, `a ${over.length}-char data URL is refused`);
    await page.close();
  });

  await t.test('raw (unencoded) data URL is truncated at the first # and the probe never runs', async () => {
    const page = await openProbe(browser, toRawDataUrl(injectProbe(probeHtml, 'C', 0)));
    assert.equal(await page.evaluate(() => typeof (window as any).__aopxProbe), 'undefined');
    assert.equal(await page.locator('#end-sentinel').count(), 0);
    await page.close();
  });

  await t.test('a 1 MB string survives the bridge', async () => {
    const page = await openProbe(browser, toBase64DataUrl(injectProbe(probeHtml, 'L', 0)));
    const raw = await clickAndRead(page, '#return-large');
    const r = JSON.parse(raw);
    assert.equal(r.bytes, 1024 * 1024);
    assert.equal(r.big.length, 1024 * 1024);
    await page.close();
  });

  await t.test('the cancel button sends an envelope the host parser accepts', async () => {
    const page = await openProbe(browser, toBase64DataUrl(injectProbe(probeHtml, 'X', 0)));
    assert.deepEqual(parseModalResult(await clickAndRead(page, '#cancel')), { envelopeVersion: 1, action: 'cancel' });
    await page.close();
  });

  await t.test('diagnostics report display scaling (devicePixelRatio) in CSS pixels', async () => {
    const page = await openProbe(browser, toBase64DataUrl(injectProbe(probeHtml, 'DPI', 0)), { deviceScaleFactor: 1.5 });
    const d = JSON.parse(await clickAndRead(page, '#return')).diagnostics;
    assert.equal(d.devicePixelRatio, 1.5);
    assert.deepEqual(d.inner, [860, 660], 'inner size stays in CSS pixels');
    await page.close();
  });

  await t.test('without any host bridge the probe says so and sends nothing', async () => {
    const page = await browser.newPage();
    await page.goto(toBase64DataUrl(injectProbe(probeHtml, 'N', 0)));
    await page.click('#return');
    assert.match(await page.textContent('#log'), /No host bridge found/);
    await page.close();
  });
});
