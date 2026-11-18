import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { startPreview } from '../preview.mjs';

const browserExecutable = process.env.AOPX_CHROMIUM_EXECUTABLE;

async function openPreview(t, options) {
  const { server, url } = await startPreview(options);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  return url;
}

test('preview serves typed mock data and only the listed static assets', async (t) => {
  const url = await openPreview(t);
  const response = await fetch(`${url}/api/session`);
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.mode, 'mock');
  assert.equal(session.report, undefined);
  assert.match(session.source.name, /^Mock/);
  assert.ok(session.waveform.length > 100);
  assert.equal((await fetch(`${url}/package.json`)).status, 404);
  assert.equal((await fetch(`${url}/editor.css`)).status, 200);
  assert.equal((await fetch(`${url}/editor.js`)).status, 200);
});

test('mock Webview supports parameter editing, bypass, theme, and removal', {
  skip: browserExecutable ? false : 'Set AOPX_CHROMIUM_EXECUTABLE to a Chromium executable for browser coverage.',
}, async (t) => {
  const url = await openPreview(t);
  const browser = await chromium.launch({ executablePath: browserExecutable });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 790, height: 480 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator('#mode-label').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#mode-label').textContent(), 'Mock data');
  assert.equal(await page.getByRole('button', { name: 'Play' }).isDisabled(), true);
  assert.equal(await page.locator('.device').count(), 2);
  assert.equal(await page.locator('#gain-value').textContent(), '−3.00 dB');
  const screenshotDirectory = process.env.AOPX_SCREENSHOT_DIRECTORY;
  if (screenshotDirectory) {
    await page.screenshot({ path: join(screenshotDirectory, 'aopx-webview-mock-dark.png'), fullPage: true });
  }
  const main = await page.locator('main').boundingBox();
  assert.ok(main.height <= 480, `Editor height ${main.height} exceeds the modal viewport`);

  await page.locator('#gain').fill('-6');
  assert.equal(await page.locator('#gain-value').textContent(), '−6.00 dB');
  await page.getByRole('button', { name: 'Enable Gain' }).click();
  assert.equal(await page.getByRole('button', { name: 'Enable Gain' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#gain').isDisabled(), true);
  await page.getByRole('button', { name: 'Enable Gain' }).click();
  await page.getByRole('button', { name: 'Remove Reverse' }).click();
  assert.equal(await page.locator('.device').count(), 1);
  assert.equal(await page.locator('#gain-value').textContent(), '−6.00 dB');
  await page.getByRole('button', { name: 'Submit plan' }).click();
  assert.equal(await page.locator('#status').textContent(), 'Mock plan ready · 1 operation');
  assert.equal(await page.locator('#output-bytes').textContent(), '—');
  await page.getByRole('button', { name: '+ Reverse' }).click();
  assert.equal(await page.locator('.device').count(), 2);
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('light');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  if (screenshotDirectory) {
    await page.screenshot({ path: join(screenshotDirectory, 'aopx-webview-mock-light.png') });
  }
  assert.deepEqual(errors, []);
});
