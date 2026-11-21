import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Project } from '../src/project.ts';
import { encodeWav, makeMetadata } from '../src/wav.ts';

test('importSourceBytes stores exactly the given bytes and matches importSource', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx-bytes-'));
  const samples = new Float64Array(2000).map((_, i) => Math.sin(i / 9) * 0.4);
  const bytes = encodeWav(makeMetadata(2, 48_000, 24, 'pcm', 1000), samples).bytes;
  const file = join(dir, 'in.wav');
  await writeFile(file, bytes);

  const a = await Project.create({ storageRoot: join(dir, 'a'), tempRoot: join(dir, 'ta') });
  const fromPath = await a.importSource(file);
  const b = await Project.create({ storageRoot: join(dir, 'b'), tempRoot: join(dir, 'tb') });
  const fromBytes = await b.importSourceBytes(bytes, 'in.wav', file);

  assert.equal(fromBytes.fingerprint, fromPath.fingerprint);
  assert.deepEqual(fromBytes.format, fromPath.format);
  assert.deepEqual(new Uint8Array(await readFile(b.sourcePath(fromBytes.fingerprint))), bytes);
  // Changing the file after the bytes were read cannot affect what was imported.
  await writeFile(file, new Uint8Array(bytes.byteLength));
  assert.equal(await b.verifySource(fromBytes.fingerprint), true);
});

test('importSourceBytes validates the whole WAV like importSource', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aopx-bytes-'));
  const p = await Project.create({ storageRoot: join(dir, 's'), tempRoot: join(dir, 't') });
  await assert.rejects(p.importSourceBytes(new Uint8Array(40), 'bad.wav'), { name: 'WavError' });
});
