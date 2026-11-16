import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import type { SourceInfo } from '../../engine/src/contract.ts';
import { ModalResultError, buildHostInitialState, injectInitialState, parseModalResult, serializeInitialState } from '../src/modal.ts';

const here = dirname(fileURLToPath(import.meta.url));
const source: SourceInfo = {
  name: 'Clip.wav',
  fingerprint: 'f'.repeat(64),
  bytes: 1044,
  format: { channels: 2, sampleRate: 48000, bitDepth: 24, frames: 170, durationSeconds: 170 / 48000, encoding: 'pcm' },
};
const plan = { version: 1 as const, operations: [{ id: 'r', type: 'reverse' as const, enabled: true }, { id: 'g', type: 'gain' as const, db: -3, enabled: false }] };
const ok = (v: unknown) => parseModalResult(JSON.stringify(v));
const bad = (v: unknown, re: RegExp) => assert.throws(() => (typeof v === 'string' ? parseModalResult(v) : ok(v)), (e: unknown) => e instanceof ModalResultError && re.test((e as Error).message));

test('parses process and cancel results and keeps only known fields', () => {
  assert.deepEqual(ok({ envelopeVersion: 1, action: 'cancel' }), { envelopeVersion: 1, action: 'cancel' });
  const r = ok({ envelopeVersion: 1, action: 'process', plan });
  assert.deepEqual(r, { envelopeVersion: 1, action: 'process', plan });
  assert.deepEqual(ok({ envelopeVersion: 1, action: 'process', plan: { version: 1, operations: [] } }), { envelopeVersion: 1, action: 'process', plan: { version: 1, operations: [] } });
  for (const db of [-60, 24, 0, -2.5]) ok({ envelopeVersion: 1, action: 'process', plan: { version: 1, operations: [{ id: 'g', type: 'gain', db, enabled: true }] } });
});

test('rejects malformed envelopes', () => {
  bad('not json', /not valid JSON/);
  bad('[1]', /JSON object/);
  bad('null', /JSON object/);
  bad({ action: 'cancel' }, /envelopeVersion/);
  bad({ envelopeVersion: 2, action: 'cancel' }, /envelopeVersion 2/);
  bad({ envelopeVersion: '1', action: 'cancel' }, /envelopeVersion/);
  bad({ envelopeVersion: 1, action: 'render' }, /Unknown modal action/);
  bad({ envelopeVersion: 1, action: 'cancel', plan }, /unexpected field 'plan'/);
  bad({ envelopeVersion: 1, action: 'process' }, /plan must be an object/);
  bad({ envelopeVersion: 1, action: 'process', plan, extra: 1 }, /unexpected field 'extra'/);
});

test('rejects invalid plans and operations', () => {
  const p = (plan: unknown) => ({ envelopeVersion: 1, action: 'process', plan });
  const op = (o: unknown) => p({ version: 1, operations: [o] });
  bad(p({ version: 2, operations: [] }), /plan.version must be 1/);
  bad(p({ version: 1 }), /operations must be an array/);
  bad(p({ version: 1, operations: [], note: 'x' }), /unexpected field 'note'/);
  bad(op({ id: '', type: 'reverse', enabled: true }), /id must be a non-empty string/);
  bad(op({ id: 'a', type: 'reverse', enabled: 'yes' }), /enabled must be a boolean/);
  bad(op({ id: 'a', type: 'normalize', enabled: true }), /not a supported operation/);
  bad(op({ id: 'a', type: 'reverse', enabled: true, db: 3 }), /unexpected field 'db'/);
  bad(op({ id: 'a', type: 'gain', enabled: true }), /db must be a finite number/);
  bad(op({ id: 'a', type: 'gain', enabled: true, db: '3' }), /db must be a finite number/);
  bad(op({ id: 'a', type: 'gain', enabled: true, db: 24.5 }), /outside \[-60, 24\]/);
  bad(op({ id: 'a', type: 'gain', enabled: true, db: -61 }), /outside/);
  bad(p({ version: 1, operations: [{ id: 'a', type: 'reverse', enabled: true }, { id: 'a', type: 'reverse', enabled: false }] }), /unique/);
  // JSON cannot carry NaN/Infinity; they arrive as null and are rejected.
  bad(op({ id: 'a', type: 'gain', enabled: true, db: Number.NaN }), /db must be a finite number/);
});

test('builds a non-preview HostInitialState', () => {
  const s = buildHostInitialState({ source, waveform: [{ min: -1, max: 1 }], plan });
  assert.deepEqual(s, { envelopeVersion: 1, source, waveform: [{ min: -1, max: 1 }], plan, diagnostics: null, preview: false });
});

test('serialized state cannot break out of an inline script', () => {
  const evil = { ...source, name: '</script><script>window.pwned=1</script>\u2028&' };
  const json = serializeInitialState(buildHostInitialState({ source: evil, waveform: [], plan }));
  assert.ok(!json.includes('<') && !json.includes('>') && !json.includes('\u2028'));
  assert.equal(JSON.parse(json).source.name, evil.name, 'round-trips exactly');
});

test('injects the state before the GUI scripts, and the GUI script sees it', async () => {
  const html = await readFile(join(here, '..', '..', 'editor', 'interface.html'), 'utf8');
  const state = buildHostInitialState({ source, waveform: [], plan });
  const out = injectInitialState(html, state);
  const inject = out.indexOf('window.AOPX_INITIAL_STATE=');
  assert.ok(inject > 0 && inject < out.indexOf('<script id="aopx-plan-core">'));
  const script = out.slice(inject, out.indexOf('</script>', inject));
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.runInNewContext(script, sandbox);
  // The object comes from another realm (vm context), so compare its structure through JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window['AOPX_INITIAL_STATE'])), state);
  assert.throws(() => injectInitialState('<html></html>', state), /exactly one/);
});
