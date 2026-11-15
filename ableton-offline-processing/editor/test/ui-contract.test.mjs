import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(here, '..', 'interface.html'), 'utf8');

test('UI returns the documented Ableton close_and_send envelope', () => {
  assert.match(html, /method:"close_and_send"/);
  assert.match(html, /window\.webkit\?\.messageHandlers\?\.live/);
  assert.match(html, /window\.chrome\?\.webview/);
  assert.match(html, /JSON\.stringify\(payload\)/);
});

test('UI emits the shared Alpha 0.1 OperationPlan envelope', () => {
  assert.match(html, /const plan=\{version:1,operations:/);
  assert.match(html, /action:"process",plan/);
  assert.match(html, /type:"gain",db:-3,enabled:true/);
  assert.match(html, /type:"reverse",enabled:true/);
});

test('UI exposes non-destructive operation editing controls', () => {
  assert.match(html, /Bypass operation/);
  assert.match(html, /Remove operation/);
  assert.match(html, /Move earlier/);
  assert.match(html, /Move later/);
  assert.match(html, /Gain in decibels/);
});

test('diagnostics distinguish render time, lookup time, cache status and bytes', () => {
  for (const token of ['renderMs', 'lookupMs', 'cacheBytes', 'projectBytes', 'outputBytes', 'step.bytes']) {
    assert.ok(html.includes(token), `missing diagnostics field: ${token}`);
  }
  assert.match(html, /Awaiting render/);
});

test('UI does not claim to render audio or use an undocumented persistent bridge', () => {
  assert.match(html, /Rendering and cache diagnostics are produced by the Extension Host/);
  assert.match(html, /Preview only · host message bridge is not available/);
  assert.doesNotMatch(html, /window\.AOPX_HOST\.render/);
});
