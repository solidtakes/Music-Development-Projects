/*
 * Smoke test for spikes/s4-wav-check.mts (the read-only S4 checker), run the way the owner will run
 * it: as a separate Node process given a file path. Runs on the Windows and Linux CI legs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSignal } from '../../../engine/test/fixtures.ts';

const here = dirname(fileURLToPath(import.meta.url));
const checker = join(here, '..', '..', 's4-wav-check.mts');
const run = (...args) => spawnSync(process.execPath, [checker, ...args], { encoding: 'utf8' });

test('a valid WAV in a path with spaces decodes and reports a zero duration delta', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx s4 check-'));
  const file = join(dir, 'render copy.wav');
  await writeFile(file, makeSignal(48000 * 2, 2).bytes); // 2 s, stereo, 24-bit PCM
  const r = run(file, '2');
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.first12Ascii.slice(0, 4), 'RIFF');
  assert.equal(out.first12Ascii.slice(8, 12), 'WAVE');
  assert.equal(out.decodedOk, true);
  assert.deepEqual([out.format.channels, out.format.sampleRate, out.format.bitDepth, out.format.frames], [2, 48000, 24, 96000]);
  assert.equal(out.durationDeltaSeconds, 0);
  assert.deepEqual(await readFile(file), Buffer.from(makeSignal(48000 * 2, 2).bytes), 'the checker never modifies the file');
});

test('a non-WAVE file (e.g. AIFF from the wrong Record File Type) fails with a clear error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx-s4-check-'));
  const file = join(dir, 'render.aif');
  await writeFile(file, Buffer.concat([Buffer.from('FORM'), Buffer.alloc(4), Buffer.from('AIFF'), Buffer.alloc(32)]));
  const r = run(file);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.decodedOk, false);
  assert.match(out.error, /WavError/);
});

test('no argument prints usage and exits 2', () => {
  const r = run();
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage/);
});
