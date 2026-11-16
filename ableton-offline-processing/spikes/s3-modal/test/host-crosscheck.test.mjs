/*
 * Cross-checks between this spike and the product's host contract (host/src/modal.ts).
 * The runner keeps its own copies so it can be dropped into a spike extension as plain JS; these
 * tests make sure those copies produce exactly what the product code does.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHostInitialState, injectInitialState, parseModalResult, serializeInitialState } from '../../../host/src/modal.ts';
import { classifyModalReturn, scriptSafeJson } from '../delivery.mjs';
import { guiState, injectGuiState } from '../s3-runner.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const guiHtml = await readFile(join(here, '..', '..', '..', 'editor', 'interface.html'), 'utf8');

test('scriptSafeJson equals the host serializeInitialState byte-for-byte, including U+2028/U+2029', () => {
  const state = { ...guiState(), source: { ...guiState().source, name: '</script>\u2028\u2029&<>é漢' } };
  assert.equal(scriptSafeJson(state), serializeInitialState(state));
});

test('the runner injects the GUI exactly as the host injectInitialState does', () => {
  const state = { ...guiState(), source: { ...guiState().source, name: 'Hostile </script> \u2028 name.wav' } };
  assert.equal(injectGuiState(guiHtml, state), injectInitialState(guiHtml, state));
  assert.throws(() => injectGuiState('<html></html>', state), /exactly one/);
});

test('the G1/G2 GUI state is a valid HostInitialState', () => {
  const s = guiState();
  assert.deepEqual(buildHostInitialState({ source: s.source, waveform: s.waveform, plan: s.plan, diagnostics: s.diagnostics }), s);
});

test('product-valid results are classified process/cancel the same way parseModalResult reads them', () => {
  const process = JSON.stringify({ envelopeVersion: 1, action: 'process', plan: { version: 1, operations: [{ id: 'g', type: 'gain', db: -3, enabled: true }] } });
  const cancel = JSON.stringify({ envelopeVersion: 1, action: 'cancel' });
  assert.equal(classifyModalReturn(process).treatAs, 'process');
  assert.equal(parseModalResult(process).action, 'process');
  assert.equal(classifyModalReturn(cancel).treatAs, 'cancel');
  assert.equal(parseModalResult(cancel).action, 'cancel');
});

test('every value the classifier treats as cancel is also rejected or a cancel for the product parser', () => {
  // So a T8 adapter that uses parseModalResult (and treats a ModalResultError as cancel, per R2)
  // agrees with what the spike records.
  const nonResults = [undefined, null, 42, '', '   ', 'not json', '[1]', '"x"', '{}', JSON.stringify({ envelopeVersion: 2, action: 'process' })];
  for (const v of nonResults) {
    assert.equal(classifyModalReturn(v).treatAs, 'cancel', String(v));
    let productAction = 'rejected';
    try { productAction = parseModalResult(/** @type {string} */ (v)).action; } catch { /* rejected */ }
    assert.ok(productAction === 'rejected' || productAction === 'cancel', `${String(v)} -> ${productAction}`);
  }
});

test('the probe envelope is deliberately NOT a product ModalResult (it carries probe/facts fields)', () => {
  // The S3 probe reports diagnostics in extra fields, so only G1/G2 exercise the product contract
  // end to end. This test documents that boundary.
  const probeCancel = JSON.stringify({ envelopeVersion: 1, probe: 2, action: 'cancel' });
  assert.equal(classifyModalReturn(probeCancel).treatAs, 'cancel');
  assert.throws(() => parseModalResult(probeCancel), /unexpected field 'probe'/);
});
