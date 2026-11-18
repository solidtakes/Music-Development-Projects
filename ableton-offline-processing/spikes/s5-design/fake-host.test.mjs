import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, makeMetadata } from '../../engine/src/wav.ts';
import { FakeHost, STAGES, hash, investigate, recoveryReport, validateOutput } from './fake-host.mjs';

function fixture(channels = 1, sampleRate = 48000) {
  const format = makeMetadata(channels, sampleRate, 32, 'float', sampleRate);
  return { bytes: encodeWav(format, new Float64Array(sampleRate * channels).fill(0.25)).bytes,
    expected: format };
}
function originalsUnchanged(result) {
  assert.deepEqual(result.host.original, result.before.original);
  assert.equal(result.before.tracks.length, 0);
  assert.equal(result.before.files.length, 0);
}

test('model success preserves original, uses imported copy, retains redo/recovery media', () => {
  const input = fixture(2); const sourceBytes = hash(input.bytes);
  const result = investigate(input);
  assert.equal(result.status, 'model-complete'); originalsUnchanged(result);
  assert.equal(hash(input.bytes), sourceBytes);
  assert.deepEqual(result.host.calls, ['import', 'track', 'clip']);
  const clip = result.host.tracks[0].clips[0];
  assert.equal(clip.file, result.receipt.path);
  assert.equal(clip.warped, false);
  assert.equal(result.host.files.get(clip.file).owner, 'host');
  assert.equal(result.host.files.size, 2);
});

for (const stage of STAGES) {
  for (const edge of ['before', 'after']) {
    test(`fault ${edge}:${stage}: no automatic rollback or retry; restart retains evidence`, () => {
      const result = investigate({ ...fixture(), fault: `${edge}:${stage}` });
      assert.equal(result.status, 'stopped-reconcile'); originalsUnchanged(result);
      const restarted = FakeHost.restart(result.host.snapshot());
      const beforeReport = restarted.snapshot(); const report = recoveryReport(restarted);
      assert.equal(report.replayAllowed, false);
      assert.equal(report.uncertain, true);
      assert.deepEqual(restarted.snapshot(), beforeReport);
      // Check effects independently of the model's reported status.
      const passed = name => STAGES.indexOf(name) < STAGES.indexOf(stage) ||
        (stage === name && edge === 'after');
      assert.equal(restarted.files.has('project-copy:trial-1'), passed('import'));
      assert.equal(restarted.tracks.length, passed('track') ? 1 : 0);
      assert.equal(restarted.tracks[0]?.clips.length ?? 0, passed('clip') ? 1 : 0);
      assert.deepEqual(restarted.calls, ['import', 'track', 'clip'].filter(passed));
    });
  }
  test(`cancellation after ${stage} settles that stage and starts no later request`, () => {
    const result = investigate({ ...fixture(), cancelAt: stage });
    assert.equal(result.status, 'stopped-reconcile'); originalsUnchanged(result);
    assert.deepEqual(result.host.calls, ['import', 'track', 'clip'].filter(s =>
      STAGES.indexOf(s) <= STAGES.indexOf(stage)));
    assert.equal(recoveryReport(result.host).replayAllowed, false);
  });
}

test('no opt-in and invalid audio leave no modeled files/objects', () => {
  for (const options of [{ optIn: false }, { bytes: new Uint8Array(12) }]) {
    const result = investigate({ ...fixture(), ...options });
    originalsUnchanged(result);
    assert.equal(result.status, 'stopped-reconcile');
    assert.equal(result.host.files.size, 0); assert.equal(result.host.tracks.length, 0);
  }
});

test('bounded validation rejects size, allocation, format, metadata mismatch, and non-finite samples', () => {
  const { bytes, expected } = fixture();
  assert.throws(() => validateOutput(new Uint8Array(32 * 1024 * 1024 + 1), expected), /byte limit/);
  for (const change of [{ channels: 2 }, { sampleRate: 44100 }, { frames: 129 }])
    assert.throws(() => validateOutput(bytes, { ...expected, ...change }), /WAV changed/);
  const nan = bytes.slice(); new DataView(nan.buffer).setFloat32(nan.length - 4, NaN, true);
  assert.throws(() => validateOutput(nan, expected), /finite/);
  assert.throws(() => validateOutput(bytes.slice(0, -1), expected));
  const manyChannels = fixture(3);
  assert.throws(() => validateOutput(manyChannels.bytes, manyChannels.expected), /allocation/);
  const highRate = fixture(1, 384000);
  assert.throws(() => validateOutput(highRate.bytes, highRate.expected), /allocation/);
  // Header-only claim is bounded before full decode/allocation.
  const largeClaim = bytes.slice(); const view = new DataView(largeClaim.buffer);
  view.setUint32(largeClaim.length - expected.frames * 4 - 4, 0x7ffffffc, true);
  assert.throws(() => validateOutput(largeClaim, expected));
});

test('source drift stops before a new request and never reports Set unchanged', () => {
  for (const stage of ['import', 'track', 'clip', 'verify']) {
    const result = investigate({ ...fixture(), driftAt: stage });
    assert.equal(result.status, 'stopped-reconcile'); assert.match(result.reason, /source changed/);
    assert.equal(result.host.original.generation, 2);
    assert.deepEqual(result.host.calls, ['import', 'track', 'clip'].filter(s =>
      STAGES.indexOf(s) < STAGES.indexOf(stage)));
  }
});

test('strict output admission rejects inconsistent outer RIFF lengths before host effects', () => {
  const input = fixture();
  for (const declared of [0, 4, input.bytes.length - 9, 0xffffffff]) {
    const bytes = input.bytes.slice(); new DataView(bytes.buffer).setUint32(4, declared, true);
    assert.throws(() => validateOutput(bytes, input.expected), /RIFF length/);
    const result = investigate({ ...input, bytes });
    assert.equal(result.status, 'stopped-reconcile');
    assert.deepEqual(result.host.calls, []); assert.equal(result.host.files.size, 0);
    originalsUnchanged(result);
  }
});

test('strict output admission checks chunks after data and rejects duplicate data chunks', () => {
  const { bytes, expected } = fixture();
  for (const suffix of [Buffer.from('short'), Buffer.from('JUNK\x04\0\0\0xx'),
    Buffer.from('data\0\0\0\0')]) {
    const joined = new Uint8Array(bytes.length + suffix.length);
    joined.set(bytes); joined.set(suffix, bytes.length);
    new DataView(joined.buffer).setUint32(4, joined.length - 8, true);
    assert.throws(() => validateOutput(joined, expected), /chunk|ambiguous/);
  }
});

test('strict output admission rejects inconsistent byte rate and unsupported extensible output', () => {
  const { bytes, expected } = fixture();
  const badRate = bytes.slice(); new DataView(badRate.buffer).setUint32(28, 0, true);
  assert.throws(() => validateOutput(badRate, expected), /byteRate/);
  // Build a valid extensible PCM header that the shared engine supports. S5's narrow
  // generated-output policy rejects extensible variants instead of guessing layout/valid bits.
  const pcm = encodeWav(makeMetadata(1, 48000, 16, 'pcm', 48000), new Float64Array(48000)).bytes;
  const ext = new Uint8Array(pcm.length + 24); ext.set(pcm.subarray(0, 36));
  const v = new DataView(ext.buffer); v.setUint32(4, ext.length - 8, true);
  v.setUint32(16, 40, true); v.setUint16(20, 0xfffe, true);
  v.setUint16(36, 22, true); v.setUint16(38, 16, true); v.setUint32(40, 4, true);
  ext.set([1, 0, 0, 0, 0, 0, 16, 0, 128, 0, 0, 170, 0, 56, 155, 113], 44);
  ext.set(pcm.subarray(36), 60);
  assert.throws(() => validateOutput(ext, { channels: 1, sampleRate: 48000, frames: 48000 }), /extensible/);
});

test('verification mismatch preserves partial effects without publishing success', () => {
  for (const corruptAtVerify of ['path', 'timing', 'media-hash', 'extra-clip']) {
    const result = investigate({ ...fixture(), corruptAtVerify });
    assert.equal(result.status, 'stopped-reconcile'); assert.match(result.reason, /verification/);
    originalsUnchanged(result);
    assert.equal(result.host.tracks.length, 1); assert.equal(result.host.files.size, 2);
    assert.equal(recoveryReport(result.host).modelReceiptComplete, false);
  }
});

test('allocation and duration policies reject valid large PCM headers before decoding', () => {
  function pcm8(frames, rate) {
    const bytes = new Uint8Array(44 + frames); const v = new DataView(bytes.buffer);
    bytes.set(Buffer.from('RIFF')); v.setUint32(4, bytes.length - 8, true);
    bytes.set(Buffer.from('WAVEfmt '), 8); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
    v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    bytes.set(Buffer.from('data'), 36); v.setUint32(40, frames, true);
    return bytes;
  }
  assert.throws(() => validateOutput(pcm8(16_000_002, 192000), {}), /allocation\/duration/);
  assert.throws(() => validateOutput(pcm8(4_800_002, 8000), {}), /allocation\/duration/);
});

test('restart after complete receipt is read-only and cannot authorize a new import', () => {
  const result = investigate(fixture());
  const restarted = FakeHost.restart(result.host.snapshot());
  const report = recoveryReport(restarted);
  assert.equal(report.modelReceiptComplete, true);
  assert.equal(report.replayAllowed, false);
  assert.equal(report.retainedFiles.length, 2);
});

test('sync transaction scope closes before a dependent Promise continuation (illustration only)', async () => {
  const groups = []; let group = 0; let active = false;
  const scope = fn => { active = true; group++; try { return fn(); } finally { active = false; } };
  const record = () => { groups.push(active ? group : ++group); return Promise.resolve({}); };
  await scope(async () => { await record(); await record(); });
  assert.deepEqual(groups, [1, 2]); // Fake counterexample to an async atomicity assumption.
});
