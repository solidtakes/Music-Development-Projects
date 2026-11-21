/*
 * Unit tests of the shipped waveform helpers in <script id="aopx-plan-core">: reducePeaks (display
 * downsampling) and previewPeaks (PEAK PREVIEW). previewPeaks is cross-checked against the real
 * engine kernels (engine/src/dsp.ts reverse/gain/computePeaks), so the preview follows the same
 * Reverse/Gain rules as the render instead of an approximation of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { computePeaks, gain, reverse } from '../../engine/src/dsp.ts';

const here = dirname(fileURLToPath(import.meta.url));
const html = await readFile(join(here, '..', 'interface.html'), 'utf8');
const source = html.match(/<script id="aopx-plan-core">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'interface.html must contain <script id="aopx-plan-core">');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const core = sandbox.window.AOPX_PLAN_CORE;
// Objects created inside the vm have a different Object prototype; compare plain copies.
const plain = (v) => JSON.parse(JSON.stringify(v));

const flat = (n, v = 0) => Array.from({ length: n }, () => ({ min: -v, max: v }));
const maxAbsDiff = (a, b) => {
  assert.equal(a.length, b.length);
  let d = 0;
  for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i].min - b[i].min), Math.abs(a[i].max - b[i].max));
  return d;
};

/** Deterministic interleaved test audio (LCG noise times a slow ramp), so bins differ. */
function audio(frames, channels = 2, seed = 7) {
  const samples = new Float64Array(frames * channels);
  let s = seed >>> 0;
  for (let i = 0; i < samples.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    samples[i] = ((s / 2 ** 32) * 2 - 1) * (0.1 + 0.8 * (i / samples.length));
  }
  return { format: { channels, sampleRate: 48000, bitDepth: 32, frames, durationSeconds: frames / 48000, encoding: 'float' }, samples };
}

test('reducePeaks keeps a one-bin transient that point sampling would skip', () => {
  const peaks = flat(900, 0.01);
  peaks[451] = { min: -0.9, max: 0.8 }; // 900 bins / 180 columns: point sampling reads bins 450, 455, ...
  const cols = plain(core.reducePeaks(peaks, 180));
  assert.equal(cols.length, 180);
  assert.deepEqual(cols[90], { min: -0.9, max: 0.8 });
  assert.equal(cols.filter((c) => c.max === 0.8).length, 1);
});

test('reducePeaks covers every bin exactly once when bins do not divide evenly', () => {
  const n = 1000, count = 180;
  const peaks = Array.from({ length: n }, (_, i) => ({ min: -i / n, max: i / n }));
  const cols = plain(core.reducePeaks(peaks, count));
  let covered = 0;
  for (let i = 0; i < count; i++) {
    const a = Math.floor((i * n) / count), b = Math.floor(((i + 1) * n) / count);
    covered += b - a;
    assert.deepEqual(cols[i], { min: -(b - 1) / n, max: (b - 1) / n }, `column ${i}`);
  }
  assert.equal(covered, n);
});

test('reducePeaks stretches fewer bins than columns and handles empty input', () => {
  const cols = plain(core.reducePeaks([{ min: -0.1, max: 0.1 }, { min: -0.5, max: 0.2 }, { min: 0, max: 0.9 }], 180));
  assert.equal(cols.length, 180);
  assert.deepEqual(cols[0], { min: -0.1, max: 0.1 });
  assert.deepEqual(cols[179], { min: 0, max: 0.9 });
  assert.deepEqual(plain(core.reducePeaks([], 180)), []);
});

test('previewPeaks skips bypassed operations and never mutates its input', () => {
  const input = Object.freeze([Object.freeze({ min: -0.2, max: 0.1 }), Object.freeze({ min: -0.4, max: 0.3 })]);
  const ops = [
    { id: 'r', type: 'reverse', enabled: false },
    { id: 'g', type: 'gain', db: 6, enabled: false },
  ];
  const out = plain(core.previewPeaks(input, ops));
  assert.deepEqual(out, { peaks: [{ min: -0.2, max: 0.1 }, { min: -0.4, max: 0.3 }], overFullScale: 0 });
  const r = plain(core.previewPeaks(input, [{ id: 'r', type: 'reverse', enabled: true }]));
  assert.deepEqual(r.peaks, [{ min: -0.4, max: 0.3 }, { min: -0.2, max: 0.1 }]);
  assert.deepEqual(plain(input), [{ min: -0.2, max: 0.1 }, { min: -0.4, max: 0.3 }]);
});

test('previewPeaks equals engine peaks of the rendered chain when bins divide the frames', async () => {
  const x = audio(48000);
  const bins = 480;
  const ops = [
    { id: 'r', type: 'reverse', enabled: true },
    { id: 'g1', type: 'gain', db: -3, enabled: true },
    { id: 'g2', type: 'gain', db: 12, enabled: false }, // bypassed: must not apply
    { id: 'g3', type: 'gain', db: 2.5, enabled: true },
  ];
  const rendered = await gain(await gain(await reverse(x), -3), 2.5);
  const preview = core.previewPeaks(computePeaks(x, bins), ops).peaks;
  assert.ok(maxAbsDiff(preview, computePeaks(rendered, bins)) < 1e-12);
});

test('Gain-only preview is exact for any bin layout; Reverse is an estimate at uneven bin edges', async () => {
  const x = audio(48001); // 48,001 frames / 480 bins: bin edges are not symmetric
  const bins = 480;
  const g = core.previewPeaks(computePeaks(x, bins), [{ id: 'g', type: 'gain', db: -7.5, enabled: true }]).peaks;
  assert.ok(maxAbsDiff(g, computePeaks(await gain(x, -7.5), bins)) < 1e-12);
  // Documented limitation: mirrored bins differ from the reversed audio's own bins here.
  const r = core.previewPeaks(computePeaks(x, bins), [{ id: 'r', type: 'reverse', enabled: true }]).peaks;
  assert.ok(maxAbsDiff(r, computePeaks(await reverse(x), bins)) > 0);
});

test('previewPeaks counts bins beyond full scale without clipping, like the engine kernel', async () => {
  const x = audio(4800);
  const peaks = computePeaks(x, 48);
  const { peaks: out, overFullScale } = core.previewPeaks(peaks, [{ id: 'g', type: 'gain', db: 24, enabled: true }]);
  const engine = computePeaks(await gain(x, 24), 48);
  assert.ok(maxAbsDiff(out, engine) < 1e-12);
  const expected = engine.filter((p) => Math.max(-p.min, p.max) > 1).length;
  assert.ok(expected > 0);
  assert.equal(overFullScale, expected);
  assert.ok(Math.max(...out.map((p) => p.max)) > 1, 'no clipping in the preview data');
});

test('dbToLinear matches 10^(dB/20)', () => {
  assert.equal(core.dbToLinear(0), 1);
  assert.ok(Math.abs(core.dbToLinear(-6) - 0.501187) < 1e-6);
  assert.ok(Math.abs(core.dbToLinear(24) - 15.848932) < 1e-6);
});
