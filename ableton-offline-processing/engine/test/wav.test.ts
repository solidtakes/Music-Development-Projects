import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_FORMATS, WavError, decodeWav, encodeWav, makeMetadata, readWavMetadata } from '../src/wav.ts';
import { makeSignal } from './fixtures.ts';

for (const { encoding, bitDepth } of SUPPORTED_FORMATS) {
  for (const channels of [1, 2]) {
    test(`round-trip ${encoding}${bitDepth} ${channels}ch is lossless and byte-stable`, () => {
      const { audio, bytes } = makeSignal(1000, channels, encoding, bitDepth, 44100);
      const meta = readWavMetadata(bytes);
      assert.deepEqual(meta, makeMetadata(channels, 44100, bitDepth, encoding, 1000));
      assert.equal(meta.durationSeconds, 1000 / 44100);
      const again = encodeWav(audio.format, audio.samples);
      assert.equal(again.clippedSamples, 0);
      assert.deepEqual(Buffer.from(again.bytes), Buffer.from(bytes), 'decode->encode must reproduce identical bytes');
    });
  }
}

test('PCM peak values: full-scale negative and max positive survive; overs saturate and are counted', () => {
  for (const bits of [8, 16, 24, 32]) {
    const scale = 2 ** (bits - 1);
    const fmt = makeMetadata(1, 48000, bits, 'pcm', 4);
    const src = new Float64Array([-1, (scale - 1) / scale, 1.5, -1.5]);
    const enc = encodeWav(fmt, src);
    assert.equal(enc.clippedSamples, 2, `bits=${bits}`);
    const dec = decodeWav(enc.bytes).samples;
    assert.equal(dec[0], -1);
    assert.equal(dec[1], (scale - 1) / scale);
    assert.equal(dec[2], (scale - 1) / scale);
    assert.equal(dec[3], -1);
  }
});

test('float output preserves values beyond full scale (no clipping)', () => {
  const fmt = makeMetadata(1, 48000, 32, 'float', 2);
  const enc = encodeWav(fmt, new Float64Array([2, -3]));
  assert.equal(enc.clippedSamples, 0);
  assert.deepEqual([...decodeWav(enc.bytes).samples], [2, -3]);
});

test('silence and zero-length files', () => {
  const silent = encodeWav(makeMetadata(2, 48000, 16, 'pcm', 10), new Float64Array(20));
  assert.ok(decodeWav(silent.bytes).samples.every((v) => v === 0));
  const empty = encodeWav(makeMetadata(2, 48000, 16, 'pcm', 0), new Float64Array(0));
  const d = decodeWav(empty.bytes);
  assert.equal(d.format.frames, 0);
  assert.equal(d.format.durationSeconds, 0);
});

test('parses WAVE_FORMAT_EXTENSIBLE and skips unknown/odd-sized chunks', () => {
  const { bytes } = makeSignal(8, 2, 'pcm', 16);
  const orig = decodeWav(bytes);
  // Build: RIFF, odd 'junk' chunk (3 bytes + pad), extensible fmt (40 bytes), data.
  const data = bytes.subarray(44);
  const parts: number[] = [];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const id = (s: string) => [...s].map((c) => c.charCodeAt(0));
  parts.push(...id('junk'), ...u32(3), 1, 2, 3, 0);
  parts.push(...id('fmt '), ...u32(40), ...u16(0xfffe), ...u16(2), ...u32(48000), ...u32(48000 * 4), ...u16(4), ...u16(16));
  parts.push(...u16(22), ...u16(16), ...u32(3), ...u16(1), 0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71);
  parts.push(...id('data'), ...u32(data.length));
  const body = new Uint8Array([...id('WAVE'), ...parts, ...data]);
  const file = new Uint8Array([...id('RIFF'), ...u32(body.length), ...body]);
  const d = decodeWav(file);
  assert.equal(d.format.channels, 2);
  assert.deepEqual([...d.samples], [...orig.samples]);
});

test('corrupt and truncated inputs are rejected with typed errors', () => {
  const { bytes } = makeSignal(100, 2, 'pcm', 16);
  const expectCode = (b: Uint8Array, code: string) =>
    assert.throws(() => decodeWav(b), (e: unknown) => e instanceof WavError && e.code === code, code);
  expectCode(bytes.subarray(0, 8), 'truncated');
  expectCode(bytes.subarray(0, bytes.length - 10), 'truncated');
  expectCode(bytes.subarray(0, 40), 'missing-data');
  const notRiff = bytes.slice(); notRiff[0] = 0x58; expectCode(notRiff, 'not-riff');
  const notWave = bytes.slice(); notWave[8] = 0x58; expectCode(notWave, 'not-wave');
  const adpcm = bytes.slice(); adpcm[20] = 2; expectCode(adpcm, 'unsupported-format');
  const rf64 = bytes.slice(); rf64.set([0x52, 0x46, 0x36, 0x34], 0); expectCode(rf64, 'unsupported-format');
  const badAlign = bytes.slice(); badAlign[32] = 3; expectCode(badAlign, 'invalid-format');
  const nan = encodeWav(makeMetadata(1, 48000, 32, 'float', 1), new Float64Array([NaN])).bytes;
  expectCode(nan, 'non-finite-sample');
});
