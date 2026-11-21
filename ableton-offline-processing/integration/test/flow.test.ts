import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gain, reverse } from '../../engine/src/dsp.ts';
import { decodeWav, encodeWav } from '../../engine/src/wav.ts';
import { createOfflineProcess, DEFAULT_PLAN, type FlowResult } from '../src/flow.ts';
import { makeFakePort, processPlan, sha256, wavBytes, type FakePort } from './fake-port.ts';

const EFFECT_CALLS = /^(importIntoProject|createAudioClip)/;
const effectCalls = (p: FakePort) => p.calls.filter((c) => EFFECT_CALLS.test(c));

async function assertSourceUntouched(p: FakePort): Promise<void> {
  assert.equal(sha256(new Uint8Array(await readFile(p.sourceMediaPath))), p.sourceMediaSha, 'user media must be unchanged');
}

function noEffects(r: FlowResult, p: FakePort): void {
  assert.deepEqual(r.effects, []);
  assert.equal(r.setChanged, 'no');
  assert.deepEqual(effectCalls(p), [], `no import/create may be requested, got ${p.calls.join(', ')}`);
}

test('happy path: Reverse → Gain(−3) lands once on AOPX RESULT and equals the direct computation', async () => {
  const p = await makeFakePort();
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'completed', r.message);
  assert.deepEqual(r.effects.map((e) => e.kind), ['imported', 'clip-created']);
  assert.deepEqual(p.calls, [
    'resolveSelection',
    'renderPreFx:track-dry:8:12',
    'resolveSelection',
    'showEditor',
    'resolveSelection',
    'importIntoProject',
    'resolveSelection',
    'createAudioClip:track-result:8:false',
    'resolveSelection',
  ]);

  // The imported file is bit-identical to Gain(Reverse(source)) computed directly with the kernels.
  const imported = new Uint8Array(await readFile(r.effects[0]!.detail));
  const src = decodeWav(new Uint8Array(await readFile(p.sourceMediaPath)));
  const direct = await gain(decodeWav(encodeWav(src.format, (await reverse(src)).samples).bytes), -3);
  assert.equal(sha256(imported), sha256(encodeWav(direct.format, direct.samples).bytes));
  assert.equal(r.outputSha256, sha256(imported));

  // Sample rate, channel count, length and channel order are preserved (L sine, R ramp).
  const out = decodeWav(imported);
  assert.deepEqual(
    [out.format.sampleRate, out.format.channels, out.format.frames, out.format.bitDepth],
    [src.format.sampleRate, src.format.channels, src.format.frames, src.format.bitDepth],
  );
  const n = src.format.frames;
  const g = 10 ** (-3 / 20);
  const lsb = 1 / 2 ** 23;
  assert.ok(Math.abs(out.samples[0]! - src.samples[(n - 1) * 2]! * g) <= lsb, 'L[0] is gain * L[last]');
  assert.ok(Math.abs(out.samples[1]! - src.samples[(n - 1) * 2 + 1]! * g) <= lsb, 'R[0] is gain * R[last]');
  assert.ok(out.samples[1]! > 0.3 && out.samples[(n - 1) * 2 + 1]! < -0.3, 'the ramp channel was reversed, not swapped');

  assert.equal(r.created?.trackId, 'track-result');
  assert.equal(r.created?.startBeat, 8);
  assert.ok(r.report && typeof r.report.wallMs === 'number');
  assert.deepEqual(r.report!.steps.map((s) => s.status), ['miss', 'miss']);
  await assertSourceUntouched(p);

  // Progress is 0..100, never decreases and finishes at 100.
  const pcts = p.progress.map((x) => x.percent);
  assert.ok(pcts.every((x, i) => x >= 0 && x <= 100 && (i === 0 || x >= pcts[i - 1]!)), pcts.join(','));
  assert.equal(pcts.at(-1), 100);
});

test('second invocation on the same audio restores the saved plan and hits the cache', async () => {
  const edited = { version: 1, operations: [{ id: 'op-reverse', type: 'reverse', enabled: false }, { id: 'op-gain', type: 'gain', enabled: true, db: -6 }] };
  const p = await makeFakePort({ editor: (s) => (p.editorStates.length === 1 ? processPlan(edited) : processPlan(s.plan)) });
  const run = createOfflineProcess(p);
  assert.equal((await run()).status, 'completed');
  p.selection.resultOverlapCount = 0; // the user moved the first result out of the way
  const second = await run();
  assert.equal(second.status, 'completed', second.message);
  assert.deepEqual(p.editorStates[0]!.plan, DEFAULT_PLAN);
  assert.deepEqual(p.editorStates[1]!.plan, edited, 'history restored from the fingerprint branch');
  assert.ok(p.editorStates[1]!.diagnostics, 'last real RenderReport is shown');
  assert.deepEqual(second.report!.steps.map((s) => s.status), ['bypassed', 'hit']);
  assert.equal(effectCalls(p).length, 4, 'each run imports and creates exactly once');
});

test('admission refuses unsupported selections before rendering anything', async (t) => {
  const cases = {
    warped: { warping: true },
    looped: { looping: true },
    'no result track': { resultTrackMatches: 0 },
    'two result tracks': { resultTrackMatches: 2 },
    'result is the source track': { resultTrackId: 'track-dry' },
    'result track not audio': { resultTrackIsAudio: false },
    'result range occupied': { resultOverlapCount: 1 },
    'overlapping source clips': { sourceOverlapCount: 1 },
    'not an audio clip': { isArrangementAudioClip: false },
    'zero length': { endBeat: 8 },
    'bad tempo': { tempo: 0 },
  };
  for (const [name, selection] of Object.entries(cases)) {
    await t.test(name, async () => {
      const p = await makeFakePort({ selection });
      const r = await createOfflineProcess(p)();
      assert.equal(r.status, 'rejected');
      assert.equal(r.reason, 'not-admitted');
      assert.deepEqual(p.calls, ['resolveSelection']);
      noEffects(r, p);
    });
  }
});

test('render admission: AIFF, RF64, empty, wrong length, too large, outside temp, corrupt', async (t) => {
  const aiff = () => new TextEncoder().encode('FORM\0\0\0\x20AIFFCOMM' + '\0'.repeat(26));
  const rf64 = () => {
    const b = new Uint8Array(48);
    b.set(new TextEncoder().encode('RF64'), 0);
    b.fill(0xff, 4, 8);
    b.set(new TextEncoder().encode('WAVEds64'), 8);
    return b;
  };
  const cases: Record<string, [Parameters<typeof makeFakePort>[0], string]> = {
    aiff: [{ renderBytes: aiff }, 'render-aiff'],
    rf64: [{ renderBytes: rf64 }, 'render-rf64'],
    empty: [{ renderBytes: () => wavBytes(0) }, 'render-empty'],
    'frame mismatch': [{ renderBytes: (f) => wavBytes(f + 100) }, 'render-frame-mismatch'],
    'three channels': [{ renderBytes: (f) => wavBytes(f, { channels: 3, samples: new Float64Array(f * 3) }) }, 'render-channels'],
    'outside temp': [{ renderOutsideTemp: true }, 'render-outside-temp'],
    corrupt: [{ renderBytes: (f) => wavBytes(f).slice(0, 100) }, 'render-invalid-wav'],
  };
  for (const [name, [opts, reason]] of Object.entries(cases)) {
    await t.test(name, async () => {
      const p = await makeFakePort(opts);
      const r = await createOfflineProcess(p)();
      assert.equal(r.status, 'rejected', r.message);
      assert.equal(r.reason, reason);
      assert.ok(!p.calls.includes('showEditor'), 'editor never opens on a bad render');
      noEffects(r, p);
      await assertSourceUntouched(p);
    });
  }
  await t.test('size cap', async () => {
    const p = await makeFakePort();
    const r = await createOfflineProcess(p, { admission: { maxFileBytes: 1024 } })();
    assert.equal(r.reason, 'render-too-large');
    noEffects(r, p);
  });
  await t.test('working-set memory cap', async () => {
    const p = await makeFakePort();
    const r = await createOfflineProcess(p, { admission: { maxWorkingSetBytes: 1024 } })();
    assert.equal(r.reason, 'render-too-large');
    noEffects(r, p);
  });
  await t.test('other sample rates are preserved, not assumed to be 48 kHz', async () => {
    const p = await makeFakePort({ renderBytes: () => wavBytes(88_200, { sampleRate: 44_100 }) });
    const r = await createOfflineProcess(p)();
    assert.equal(r.status, 'completed', r.message);
    assert.equal(decodeWav(new Uint8Array(await readFile(r.effects[0]!.detail))).format.sampleRate, 44_100);
  });
});

test('editor: cancel, closed, non-string, invalid JSON and invalid plans all stop with no change', async (t) => {
  const returns: Record<string, unknown> = {
    cancel: JSON.stringify({ envelopeVersion: 1, action: 'cancel' }),
    'closed (undefined)': undefined,
    'empty string': '',
    'non-string': { action: 'process' },
    'invalid json': '{',
    'wrong version': JSON.stringify({ envelopeVersion: 2, action: 'process', plan: DEFAULT_PLAN }),
    'gain out of range': processPlan({ version: 1, operations: [{ id: 'g', type: 'gain', enabled: true, db: 99 }] }),
    'unknown op': processPlan({ version: 1, operations: [{ id: 'x', type: 'normalize', enabled: true }] }),
  };
  for (const [name, value] of Object.entries(returns)) {
    await t.test(name, async () => {
      const p = await makeFakePort({ editor: () => value });
      const r = await createOfflineProcess(p)();
      assert.equal(r.status, 'cancelled', `${name}: ${r.message}`);
      noEffects(r, p);
    });
  }
});

test('cancellation before import: nothing is imported', async (t) => {
  await t.test('during the editor', async () => {
    const ac = new AbortController();
    const p = await makeFakePort({ editor: (s) => (ac.abort(), processPlan(s.plan)) });
    const r = await createOfflineProcess(p)(ac.signal);
    assert.equal(r.status, 'cancelled');
    noEffects(r, p);
  });
  await t.test('during the engine render', async () => {
    const ac = new AbortController();
    const p = await makeFakePort({ onProgress: (text) => text === 'Processing' && ac.abort() });
    const r = await createOfflineProcess(p, { progressIntervalMs: 0 })(ac.signal);
    assert.ok(p.progress.some((x) => x.text === 'Processing'), 'the abort fired inside the engine render');
    assert.equal(r.status, 'cancelled');
    noEffects(r, p);
  });
});

test('cancellation after import: reports the known import, does not create', async () => {
  const ac = new AbortController();
  const p = await makeFakePort({ onImport: () => ac.abort() });
  const r = await createOfflineProcess(p)(ac.signal);
  assert.equal(r.status, 'partial');
  assert.equal(r.reason, 'user-cancel');
  assert.equal(r.setChanged, 'yes');
  assert.deepEqual(r.effects.map((e) => e.kind), ['imported']);
  assert.deepEqual(effectCalls(p), ['importIntoProject']);
});

test('unknown outcomes are never reported as "no change" and are never retried', async (t) => {
  for (const b of ['throw', 'hang', 'empty'] as const) {
    await t.test(`import ${b}`, async () => {
      const p = await makeFakePort({ importBehaviour: b });
      const r = await createOfflineProcess(p, { hostCallTimeoutMs: 50 })();
      assert.equal(r.status, 'unknown-outcome', r.message);
      assert.equal(r.stage, 'import');
      assert.deepEqual(effectCalls(p), ['importIntoProject'], 'one request, no retry, no create');
    });
  }
  for (const b of ['throw', 'hang'] as const) {
    await t.test(`create ${b}`, async () => {
      const p = await makeFakePort({ createBehaviour: b });
      const r = await createOfflineProcess(p, { hostCallTimeoutMs: 50 })();
      assert.equal(r.status, 'unknown-outcome');
      assert.equal(r.stage, 'create');
      assert.deepEqual(r.effects.map((e) => e.kind), ['imported']);
      assert.equal(effectCalls(p).length, 2);
    });
  }
});

test('drift between render and import stops before any host effect', async () => {
  const p = await makeFakePort({ onResolve: (n, s) => void (n === 2 && (s.resultOverlapCount = 1)) });
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'rejected');
  assert.equal(r.reason, 'selection-changed');
  noEffects(r, p);
});

test('a misplaced result clip is reported, left in place, not "fixed"', async () => {
  const p = await makeFakePort({ createBehaviour: 'wrong-start' });
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'partial');
  assert.equal(r.setChanged, 'yes');
  assert.equal(r.reason, 'result-geometry-mismatch');
  assert.deepEqual(r.effects.map((e) => e.kind), ['imported', 'clip-created']);
  assert.equal(effectCalls(p).length, 2);
});

test('single flight: a concurrent invocation is refused without side effects', async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const p = await makeFakePort({ editor: async (s) => (await gate, processPlan(s.plan)) });
  const run = createOfflineProcess(p);
  const first = run();
  await new Promise((r) => setTimeout(r, 20));
  const second = await run();
  assert.equal(second.status, 'busy');
  release();
  assert.equal((await first).status, 'completed');
  assert.equal(effectCalls(p).length, 2);
});

test('PCM bounds: +24 dB saturates to full scale instead of wrapping', async () => {
  const loud = (f: number) => wavBytes(f, { bitDepth: 16, samples: new Float64Array(f * 2).map((_, i) => (i % 2 ? -0.9 : 0.9)) });
  const plan = { version: 1, operations: [{ id: 'g', type: 'gain', enabled: true, db: 24 }] };
  const p = await makeFakePort({ renderBytes: loud, editor: () => processPlan(plan) });
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'completed', r.message);
  const out = decodeWav(new Uint8Array(await readFile(r.effects[0]!.detail)));
  assert.equal(out.format.bitDepth, 16);
  assert.ok(out.samples.every((v) => Number.isFinite(v) && v >= -1 && v <= 1));
  assert.ok(Math.abs(out.samples[0]! - 32767 / 32768) < 1e-12, 'L saturates at +full scale');
  assert.equal(out.samples[1], -1, 'R saturates at −full scale');
});

test('missing storage or temp directory is refused before touching Live', async () => {
  const p = await makeFakePort();
  const r = await createOfflineProcess({ ...p, storageDirectory: undefined })();
  assert.equal(r.status, 'rejected');
  assert.equal(r.reason, 'no-storage');
  assert.deepEqual(p.calls, []);
});
