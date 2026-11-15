/*
 * Real-browser interaction check for drag-and-drop reordering.
 * Uses Playwright + Chromium if available; otherwise the suite is skipped.
 * `npm run test:browser` (scripts/run-browser-tests.mjs) sets AOPX_REQUIRE_BROWSER=1
 * so the suite fails instead of skipping when Playwright is unavailable.
 * Set AOPX_SCREENSHOT_DIR=<dir> to save screenshots of the three-operation demo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(join(here, '..', 'interface.html')).href;
const requireBrowser = process.env.AOPX_REQUIRE_BROWSER === '1';
const shots = process.env.AOPX_SCREENSHOT_DIR;

let chromium = null;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  try { ({ chromium } = await import('playwright')); } catch { /* unavailable */ }
}
if (!chromium && requireBrowser) throw new Error('Playwright is required (AOPX_REQUIRE_BROWSER=1) but was not found');
const skip = chromium ? false : 'SKIPPED: Playwright not installed - browser interaction suite did not run (use "npm run test:browser" to require it)';
if (skip) console.warn(`[aopx-editor] ${skip}`);

// SDK modal size from the README (showModalDialog(dataUrl, 860, 660)) plus the
// narrow single-column layout (<=650px) and a short-height modal.
const VIEWPORTS = [
  { width: 860, height: 660 },
  { width: 640, height: 660 },
  { width: 860, height: 480 },
];

const INITIAL = {
  preview: true,
  source: { name: 'Three Op Demo.wav', bytes: 1000, fingerprint: 'demo', format: { channels: 2, sampleRate: 48000, bitDepth: 24, frames: 480000, durationSeconds: 10, encoding: 'pcm' } },
  waveform: [],
  plan: { version: 1, operations: [
    { id: 'op-reverse-1', type: 'reverse', enabled: true },
    { id: 'op-gain-1', type: 'gain', db: -3, enabled: false },
    { id: 'op-gain-2', type: 'gain', db: 6.25, enabled: true },
  ] },
};

async function openEditor(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(initial => {
    window.AOPX_INITIAL_STATE = initial;
    window.__sent = [];
    // Mock the macOS SDK bridge so Apply's emitted payload can be inspected.
    window.webkit = { messageHandlers: { live: { postMessage: m => window.__sent.push(m) } } };
  }, INITIAL);
  await page.goto(pageUrl);
  return page;
}
const rowIds = page => page.$$eval('#device-list .device', rows => rows.map(r => r.dataset.opId));
const selectedId = page => page.$eval('#device-list .device.selected', r => r.dataset.opId);

// Drag a row's handle so the pointer ends `fraction` of the way down a target row.
// Returns the state observed just before release: pointer travel (dy), whether the
// dragged row is in its active `.dragging` state, and whether an indicator is shown.
async function dragHandle(page, fromId, toId, fraction, { release = true, pressEscape = false } = {}) {
  const h = await page.locator(`.drag-handle[data-op-id="${fromId}"]`).boundingBox();
  const t = await page.locator(`.device[data-op-id="${toId}"]`).boundingBox();
  const startY = h.y + h.height / 2, endY = t.y + t.height * fraction;
  await page.mouse.move(h.x + h.width / 2, startY);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, endY, { steps: 8 });
  const before = {
    dy: endY - startY,
    dragging: await page.locator(`.device.dragging[data-op-id="${fromId}"]`).count(),
    indicatorVisible: await page.locator('#drop-indicator:not(.hidden)').count(),
  };
  if (pressEscape) await page.keyboard.press('Escape');
  if (release) await page.mouse.up();
  return before;
}
async function applyPlan(page) {
  await page.click('#apply');
  const sent = await page.evaluate(() => window.__sent);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, 'close_and_send');
  return JSON.parse(sent[0].params[0]);
}

test('drag-and-drop reorder in a real browser', { skip }, async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());

  for (const viewport of VIEWPORTS) {
    await t.test(`${viewport.width}x${viewport.height}: three-operation drag reorder emits the new plan order`, async () => {
      const page = await openEditor(browser, viewport);
      assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);
      assert.equal(await selectedId(page), 'op-reverse-1');
      if (shots && viewport.width === 860 && viewport.height === 660) await page.screenshot({ path: join(shots, '1-before.png') });

      // Drag step 3 (Gain +6.25) above step 1.
      const during = await dragHandle(page, 'op-gain-2', 'op-reverse-1', 0.2, { release: false });
      assert.equal(during.dragging, 1, 'row is in its active dragging state');
      assert.equal(during.indicatorVisible, 1, 'insertion indicator is visible during drag');
      if (shots && viewport.width === 860 && viewport.height === 660) await page.screenshot({ path: join(shots, '2-dragging.png') });
      await page.mouse.up();

      assert.deepEqual(await rowIds(page), ['op-gain-2', 'op-reverse-1', 'op-gain-1']);
      assert.equal(await selectedId(page), 'op-reverse-1', 'selection follows the selected operation, not the slot');
      assert.equal(await page.locator('#drop-indicator').count(), 0, 'indicator removed after drop');
      assert.equal(await page.locator('.device[data-op-id="op-gain-1"].bypassed').count(), 1, 'bypass preserved');
      assert.equal(await page.locator('#device-list .device').count(), 3, 'nothing removed');
      if (shots && viewport.width === 860 && viewport.height === 660) await page.screenshot({ path: join(shots, '3-after.png') });

      // Drag the new first operation to after the last.
      await dragHandle(page, 'op-gain-2', 'op-gain-1', 0.85);
      assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);
      await dragHandle(page, 'op-reverse-1', 'op-gain-2', 0.9);
      assert.deepEqual(await rowIds(page), ['op-gain-1', 'op-gain-2', 'op-reverse-1']);

      const payload = await applyPlan(page);
      assert.deepEqual(payload, { action: 'process', plan: { version: 1, operations: [
        { id: 'op-gain-1', type: 'gain', db: -3, enabled: false },
        { id: 'op-gain-2', type: 'gain', db: 6.25, enabled: true },
        { id: 'op-reverse-1', type: 'reverse', enabled: true },
      ] } });
      await page.close();
    });
  }

  await t.test('row body drag, handle click and no-op drop do not reorder or change state', async () => {
    const page = await openEditor(browser, VIEWPORTS[0]);
    // Drag on the row body (title area) - must not reorder.
    const body = await page.locator('.device[data-op-id="op-gain-2"] .device-main').boundingBox();
    const top = await page.locator('.device[data-op-id="op-reverse-1"]').boundingBox();
    await page.mouse.move(body.x + 20, body.y + 10);
    await page.mouse.down();
    await page.mouse.move(body.x + 20, top.y + 5, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);

    // Plain click on a handle: no selection change, no reorder.
    await page.click('#device-list .device[data-op-id="op-reverse-1"] .device-main');
    await page.click('.drag-handle[data-op-id="op-gain-1"]');
    assert.equal(await selectedId(page), 'op-reverse-1');
    assert.equal(await page.locator('.device[data-op-id="op-gain-1"].bypassed').count(), 1);

    // Active drag that stays within its own insertion slot: no-op, no indicator.
    // The handle starts at the row centre; 0.15 / 0.85 of a ~56px row is ~19px of travel,
    // well past DRAG_THRESHOLD_PX (4) yet short of the neighbouring rows' midpoints.
    for (const fraction of [0.85, 0.15]) {
      const before = await dragHandle(page, 'op-gain-1', 'op-gain-1', fraction);
      assert.ok(Math.abs(before.dy) >= 10, `pointer moved ${before.dy.toFixed(1)}px, enough to activate a drag`);
      assert.equal(before.dragging, 1, 'drag became active before release');
      assert.equal(before.indicatorVisible, 0, 'no indicator for a no-op position');
      assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);
      assert.equal(await page.locator('#drop-indicator').count(), 0, 'indicator removed after release');
      assert.equal(await page.locator('.device.dragging').count(), 0, 'dragging state cleared after release');
      assert.equal(await selectedId(page), 'op-reverse-1');
      assert.equal(await page.locator('.device[data-op-id="op-gain-1"].bypassed').count(), 1);
    }
    await page.close();
  });

  await t.test('releasing a drag over activator/remove controls does not trigger them', async () => {
    const page = await openEditor(browser, VIEWPORTS[0]);
    // End the drag precisely over the remove (x) button of step 1, then over its activator.
    for (const sel of ['.device-actions button', '.device-activator']) {
      const h = await page.locator('.drag-handle[data-op-id="op-gain-2"]').boundingBox();
      const target = await page.locator(`.device[data-op-id="op-reverse-1"] ${sel}`).boundingBox();
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + 4, { steps: 8 });
      await page.mouse.up();
      assert.equal(await page.locator('#device-list .device').count(), 3, 'nothing removed');
      assert.equal(await page.locator('#device-list .device.bypassed').count(), 1, 'only the original bypass');
      assert.equal(await page.locator('.device[data-op-id="op-gain-1"].bypassed').count(), 1);
      assert.equal(await selectedId(page), 'op-reverse-1');
      // Move it back for the next iteration.
      await page.click('.drag-handle[data-op-id="op-gain-2"]');
      for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown');
    }
    await page.close();
  });

  await t.test('Escape cancels an in-progress drag', async () => {
    const page = await openEditor(browser, VIEWPORTS[0]);
    const before = await dragHandle(page, 'op-gain-2', 'op-reverse-1', 0.2, { pressEscape: true });
    assert.equal(before.dragging, 1, 'drag was active before Escape');
    assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);
    assert.match(await page.textContent('#status'), /cancelled/);
    assert.equal(await page.locator('.device.dragging').count(), 0);
    await page.close();
  });

  await t.test('pointercancel cancels an active drag without changing the order', async () => {
    const page = await openEditor(browser, VIEWPORTS[0]);
    // Record the real pointerId of the gesture so the cancel targets the same pointer.
    await page.evaluate(() => document.addEventListener('pointerdown', e => { window.__pointerId = e.pointerId; }, true));
    const before = await dragHandle(page, 'op-gain-2', 'op-reverse-1', 0.2, { release: false });
    assert.equal(before.dragging, 1, 'drag was active before pointercancel');
    assert.equal(before.indicatorVisible, 1, 'indicator shown before pointercancel');
    // Mouse input cannot produce pointercancel (the browser sends it when, e.g., a touch
    // gesture is taken over), so dispatch it on the capturing handle with the live pointerId.
    await page.evaluate(() => {
      const handle = document.querySelector('.drag-handle[data-op-id="op-gain-2"]');
      handle.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pointerId, bubbles: true }));
    });
    assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);
    assert.match(await page.textContent('#status'), /cancelled/);
    assert.equal(await page.locator('.device.dragging').count(), 0, 'dragging state cleared');
    assert.equal(await page.locator('#drop-indicator').count(), 0, 'indicator removed');
    // Releasing the button afterwards must not drop, select, bypass or remove anything.
    await page.mouse.up();
    assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-1', 'op-gain-2']);
    assert.equal(await selectedId(page), 'op-reverse-1');
    assert.equal(await page.locator('#device-list .device').count(), 3);
    assert.equal(await page.locator('#device-list .device.bypassed').count(), 1);
    assert.equal(await page.locator('.device[data-op-id="op-gain-1"].bypassed').count(), 1);
    await page.close();
  });

  await t.test('keyboard: handle arrows and Move earlier/later keep focus and selection', async () => {
    const page = await openEditor(browser, VIEWPORTS[0]);
    await page.focus('.drag-handle[data-op-id="op-gain-2"]');
    await page.keyboard.press('ArrowUp');
    assert.deepEqual(await rowIds(page), ['op-reverse-1', 'op-gain-2', 'op-gain-1']);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.opId), 'op-gain-2', 'focus stays on moved handle');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp'); // boundary: no-op
    assert.deepEqual(await rowIds(page), ['op-gain-2', 'op-reverse-1', 'op-gain-1']);
    assert.equal(await selectedId(page), 'op-reverse-1');
    assert.match(await page.textContent('#status'), /Moved GAIN to step 1 of 3/);

    // Inspector buttons for the selected operation (reverse, now step 2).
    await page.click('#inspector-controls button[data-move="1"]');
    assert.deepEqual(await rowIds(page), ['op-gain-2', 'op-gain-1', 'op-reverse-1']);
    assert.equal(await page.evaluate(() => document.activeElement.textContent), '↑ Move earlier', 'focus moves to the remaining enabled control at the boundary');
    assert.equal(await page.locator('#inspector-controls button[data-move="1"]').isDisabled(), true);
    await page.keyboard.press('Enter');
    assert.deepEqual(await rowIds(page), ['op-gain-2', 'op-reverse-1', 'op-gain-1']);
    assert.equal(await selectedId(page), 'op-reverse-1');

    // Enter on a row's activator toggles bypass (and does not just select the row).
    await page.focus('.device[data-op-id="op-gain-1"] .device-activator');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.device[data-op-id="op-gain-1"].bypassed').count(), 0);
    await page.close();
  });

  await t.test('layout: handle column fits without horizontal overflow', async () => {
    for (const viewport of VIEWPORTS) {
      const page = await openEditor(browser, viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `no horizontal scroll at ${viewport.width}x${viewport.height}`);
      const w = await page.locator('.drag-handle').first().boundingBox();
      assert.ok(w.width >= 14 && w.height >= 40, 'handle has a usable hit area');
      await page.close();
    }
  });
});
