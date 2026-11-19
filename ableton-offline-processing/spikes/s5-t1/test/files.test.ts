import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ownedFiles, readOwned, inspectReceipt } from '../src/files.ts';
import { digest } from '../src/flow.ts';
import { randomUUID } from 'node:crypto';

test('owned temp export and journal: exclusive claim, bounded reads, checksum and restart lock', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aopx-t1-owned-'));
  const temp = path.join(root, 'temp'), storage = path.join(root, 'storage');
  await mkdir(temp); await mkdir(storage);
  const files = ownedFiles(() => temp, () => storage);
  assert.equal(await files.hasPriorOperation(), false);
  const id = randomUUID();
  await files.journal({ schema: 1, id, stage: 'prepare', state: 'intent' });
  const bytes = new Uint8Array(64).fill(10);
  const file = await files.exportOwned(id, bytes, digest(bytes));
  await files.verifyOwned(file, digest(bytes));
  await assert.rejects(files.exportOwned(id, bytes, digest(bytes))); // never overwrite
  const restart = ownedFiles(() => temp, () => storage);
  assert.equal(await restart.hasPriorOperation(), true);
  await assert.rejects(restart.journal({ schema: 1, id: randomUUID(), stage: 'prepare', state: 'intent' }));
  const receipt = path.join(storage, 'aopx-s5-t1-receipts', '000-prepare-intent.json');
  assert.equal(await inspectReceipt(receipt), 'reconcile-only');
  const original = await readFile(receipt, 'utf8'); const tampered = JSON.parse(original); tampered.body.stage = 'bad';
  await writeFile(receipt, JSON.stringify(tampered)); await assert.rejects(inspectReceipt(receipt));
  assert.ok((await readdir(temp)).includes(path.basename(file))); // retained, no cleanup of media
  await assert.rejects(readOwned(temp, path.join(root, 'outside.wav')));
  await assert.rejects(readOwned(temp, file, 12));
  await writeFile(file, 'changed'); await assert.rejects(files.verifyOwned(file, digest(bytes)));
  // Scratch directories contain only synthetic bytes; intentionally retained for diagnostics.
});
test('missing roots and oversized exports fail closed', async () => {
  const f = ownedFiles(() => undefined, () => undefined);
  await assert.rejects(f.hasPriorOperation());
  await assert.rejects(f.exportOwned(randomUUID(), new Uint8Array(32 * 1024 * 1024 + 1), 'bad'));
});
test('symlink/junction under owned temp is refused when supported by the OS', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aopx-t1-link-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'aopx-t1-outside-'));
  await writeFile(path.join(outside, 'fake.wav'), new Uint8Array(64));
  try { await symlink(outside, path.join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'EPERM') { t.skip('OS disallows symlink creation'); return; } throw e; }
  await assert.rejects(readOwned(root, path.join(root, 'link', 'fake.wav')));
});
