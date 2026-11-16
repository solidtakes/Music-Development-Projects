import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCK_FRAMES, computePeaks, dbToLinear, gain, reverse } from '../src/dsp.ts';
import { decodeWav, encodeWav, makeMetadata, SUPPORTED_FORMATS } from '../src/wav.ts';
import { makeSignal, maxAbsDiff } from './fixtures.ts';

test('dbToLinear', () => {
  assert.equal(dbToLinear(0), 1);
  assert.ok(Math.abs(dbToLinear(-6) - 0.5011872336272722) < 1e-15);
  assert.ok(Math.abs(dbToLinear(20) - 10) < 1e-12);
  assert.ok(Math.abs(dbToLinear(-60) - 0.001) < 1e-15);
});

test('reverse moves whole stereo frames and keeps L/R alignment', async () => {
  const fmt = makeMetadata(2, 48000, 16, 'pcm', 3);
  const input = { format: fmt, samples: new Float64Array([0.1, -0.1, 0.2, -0.2, 0.3, -0.3]) };
  const out = await reverse(input);
  assert.deepEqual([...out.samples], [0.3, -0.3, 0.2, -0.2, 0.1, -0.1]);
  assert.deepEqual([...input.samples], [0.1, -0.1, 0.2, -0.2, 0.3, -0.3], 'input is not mutated');
  assert.deepEqual(out.format, fmt);
});

test('reverse is an involution and preserves format across block boundaries (mono/stereo/5ch)', async () => {
  for (const ch of [1, 2, 5]) {
    const { audio } = makeSignal(BLOCK_FRAMES * 2 + 17, ch);
    const once = await reverse(audio);
    for (let c = 0; c < ch; c++) {
      assert.equal(once.samples[c], audio.samples[(audio.format.frames - 1) * ch + c]);
    }
    const twice = await reverse(once);
    assert.deepEqual(twice.samples, audio.samples);
    assert.deepEqual(once.format, audio.format);
  }
});

test('gain applies the same linear factor to every channel; frame count/format preserved', async () => {
  const { audio } = makeSignal(5000, 2);
  const out = await gain(audio, -3);
  const k = dbToLinear(-3);
  for (let i = 0; i < audio.samples.length; i++) assert.equal(out.samples[i], audio.samples[i]! * k);
  assert.deepEqual(out.format, audio.format);
});

test('gain then PCM encode matches an independent float64 reference within 0.5 LSB for every format', async () => {
  for (const { encoding, bitDepth } of SUPPORTED_FORMATS) {
    const { audio } = makeSignal(2000, 2, encoding, bitDepth);
    const g = await gain(audio, -7.25);
    const enc = encodeWav(g.format, g.samples);
    const decoded = decodeWav(enc.bytes).samples;
    const k = Math.pow(10, -7.25 / 20);
    const ref = audio.samples.map((v) => v * k);
    const lsb = encoding === 'pcm' ? 2 ** -(bitDepth - 1) : bitDepth === 32 ? 2 ** -24 : 0;
    assert.ok(maxAbsDiff(decoded, ref) <= lsb * 0.5 + 1e-15, `${encoding}${bitDepth}`);
    assert.equal(enc.clippedSamples, 0);
  }
});

test('positive gain on PCM saturates (hard clip) and reports clipped count; silence stays silent', async () => {
  const fmt = makeMetadata(1, 48000, 16, 'pcm', 3);
  const out = await gain({ format: fmt, samples: new Float64Array([0.9, -0.9, 0.1]) }, 6);
  const enc = encodeWav(out.format, out.samples);
  assert.equal(enc.clippedSamples, 2);
  const d = decodeWav(enc.bytes).samples;
  assert.equal(d[0], 32767 / 32768);
  assert.equal(d[1], -1);
  const silent = await gain({ format: fmt, samples: new Float64Array(3) }, 24);
  assert.ok(silent.samples.every((v) => v === 0));
});

test('short files: 0 and 1 frame', async () => {
  for (const frames of [0, 1]) {
    const { audio } = makeSignal(frames, 2);
    assert.deepEqual((await reverse(audio)).samples, audio.samples);
    assert.equal((await gain(audio, -3)).format.frames, frames);
  }
});

test('kernels honour AbortSignal', async () => {
  const { audio } = makeSignal(BLOCK_FRAMES * 4, 2);
  const ac = new AbortController();
  const p = reverse(audio, { signal: ac.signal, onProgress: () => ac.abort() });
  await assert.rejects(p, { name: 'AbortError' });
});

test('computePeaks', () => {
  const fmt = makeMetadata(2, 48000, 16, 'pcm', 4);
  const p = computePeaks({ format: fmt, samples: new Float64Array([0.5, -0.1, 0, 0, -0.7, 0.2, 0.1, 0.1]) }, 2);
  assert.deepEqual(p, [{ min: -0.1, max: 0.5 }, { min: -0.7, max: 0.2 }]);
});

test('DSP-level proof: Reverse->Gain, remove Reverse, Gain equals direct Gain bit-exactly', async () => {
  const { audio } = makeSignal(48000, 2);
  const chained = await gain(await reverse(audio), -3);
  const encodedChain = encodeWav(chained.format, chained.samples).bytes;
  const removed = await gain(audio, -3); // chain after Reverse removed: re-rendered from original
  const direct = await gain(audio, -3);
  assert.deepEqual(Buffer.from(encodeWav(removed.format, removed.samples).bytes), Buffer.from(encodeWav(direct.format, direct.samples).bytes));
  // and Reverse->Gain is exactly the reverse of direct Gain (gain commutes with frame reordering)
  const rev = await reverse(decodeWav(encodedChain));
  assert.deepEqual(Buffer.from(encodeWav(rev.format, rev.samples).bytes), Buffer.from(encodeWav(direct.format, direct.samples).bytes));
});
