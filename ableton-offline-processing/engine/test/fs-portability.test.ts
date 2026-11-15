/**
 * Filesystem portability tests (T4 / audit finding M3).
 *
 * These exercise the engine's read-only (0444) cache objects and sources, rename-into-place, eviction,
 * source re-import and save/reopen. They run on every platform, but exist mainly for Windows, where
 * chmod 0444 sets the read-only attribute and renaming over, or deleting, a read-only file can behave
 * differently from POSIX. Each scenario is a separate test so one failure cannot hide another.
 * These tests only use temp directories; they never touch user or Live project files.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256File } from '../src/hash.ts';
import { Project } from '../src/project.ts';
import { gn, newProject, plan, rev, statuses } from './helpers.ts';

const exists = (p: string) => stat(p).then(() => true, () => false);
const isReadOnly = async (p: string) => ((await stat(p)).mode & 0o222) === 0;

test(`fs[${process.platform}]: published cache objects and stored sources are read-only`, async () => {
  const { project, fp } = await newProject(2000);
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const r = await project.render('main');
  assert.equal(r.status, 'completed');
  for (const s of r.report!.steps) assert.ok(await isReadOnly(project.cache.objectPath(s.cacheKey!)), `object ${s.operationId} read-only`);
  assert.ok(await isReadOnly(project.sourcePath(fp)), 'stored source read-only');
});

test(`fs[${process.platform}]: evict removes a read-only object and its metadata`, async () => {
  const { project, fp } = await newProject(2000);
  project.setPlan('main', fp, plan(gn(-3)));
  const r = await project.render('main');
  const key = r.outputKey!;
  await project.cache.evict(key);
  assert.equal(await exists(project.cache.objectPath(key)), false, 'object removed');
  assert.equal(await exists(project.cache.metaPath(key)), false, 'metadata removed');
  const again = await project.render('main');
  assert.deepEqual(statuses(again), ['miss']);
  assert.ok(await isReadOnly(project.cache.objectPath(key)));
});

test(`fs[${process.platform}]: corrupt metadata evicts the read-only object and the entry is re-published`, async () => {
  const { project, fp } = await newProject(2000);
  project.setPlan('main', fp, plan(gn(-3)));
  const r1 = await project.render('main');
  const key = r1.outputKey!;
  const before = await sha256File(r1.outputPath!);
  await writeFile(project.cache.metaPath(key), '{corrupt');
  const r2 = await project.render('main');
  assert.equal(r2.status, 'completed');
  assert.deepEqual(statuses(r2), ['miss']);
  assert.equal(await sha256File(r2.outputPath!), before, 'identical bytes re-published');
  const r3 = await project.render('main');
  assert.deepEqual(statuses(r3), ['hit']);
});

test(`fs[${process.platform}]: publish over an orphaned read-only object (crash before metadata commit)`, async () => {
  const { project, fp } = await newProject(2000);
  project.setPlan('main', fp, plan(gn(-3)));
  const r1 = await project.render('main');
  const key = r1.outputKey!;
  const before = await sha256File(project.cache.objectPath(key));
  // Simulate a crash between the object rename and the metadata rename: object present, no .json.
  await rm(project.cache.metaPath(key));
  assert.ok(await isReadOnly(project.cache.objectPath(key)));
  const r2 = await project.render('main');
  assert.equal(r2.status, 'completed');
  assert.deepEqual(statuses(r2), ['miss']);
  assert.equal(await sha256File(project.cache.objectPath(key)), before, 'identical bytes re-published');
  assert.ok(await exists(project.cache.metaPath(key)), 'metadata committed');
  assert.deepEqual(statuses(await project.render('main')), ['hit']);
});

test(`fs[${process.platform}]: garbage collection deletes read-only entries and staging`, async () => {
  const { project, fp } = await newProject(2000);
  project.setPlan('main', fp, plan(gn(-3)));
  const old = (await project.render('main')).outputKey!;
  project.setPlan('main', fp, plan(gn(-6)));
  const kept = (await project.render('main')).outputKey!;
  const freed = await project.collectGarbage();
  assert.ok(freed > 0);
  assert.deepEqual(await project.cache.keys(), [kept]);
  assert.equal(await exists(project.cache.objectPath(old)), false);
});

test(`fs[${process.platform}]: re-importing the same source in the same and in a reopened project`, async () => {
  const { project, fp, userPath, opts } = await newProject(2000);
  const again = await project.importSource(userPath);
  assert.equal(again.fingerprint, fp);
  await project.save();
  const reopened = await Project.open(opts);
  const third = await reopened.importSource(userPath);
  assert.equal(third.fingerprint, fp);
  assert.ok(await reopened.verifySource(fp));
  assert.equal(await sha256File(userPath), fp, 'user file untouched');
});

test(`fs[${process.platform}]: re-import when the read-only stored source exists but is not in the manifest`, async () => {
  // Simulates a crash after the source rename but before save, or a project re-created on existing storage.
  const { fp, userPath, opts } = await newProject(2000);
  const fresh = await Project.create(opts); // overwrites the manifest with an empty one; sources/<fp>.wav remains
  assert.ok(await isReadOnly(join(opts.storageRoot, 'sources', `${fp}.wav`)));
  const info = await fresh.importSource(userPath);
  assert.equal(info.fingerprint, fp);
  assert.ok(await fresh.verifySource(fp));
  assert.ok(await isReadOnly(fresh.sourcePath(fp)));
});

test(`fs[${process.platform}]: repeated save and reopen round-trips, then renders all hits`, async () => {
  const { project, fp, opts } = await newProject(2000);
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const r1 = await project.render('main');
  await project.save();
  await project.save(); // rename over an existing manifest
  const a = await Project.open(opts);
  await a.save();
  const b = await Project.open(opts);
  assert.deepEqual(b.graphSnapshot(), project.graphSnapshot());
  const r2 = await b.render('main');
  assert.deepEqual(statuses(r2), ['hit', 'hit']);
  assert.equal(r2.outputKey, r1.outputKey);
  assert.equal((await b.validateCacheReferences()).invalid.length, 0);
  assert.ok(JSON.parse(await readFile(b.manifestPath, 'utf8')).sources[fp]);
});

test(`fs[${process.platform}]: exporting the same output twice to the same file name`, async () => {
  const { project, fp } = await newProject(2000);
  project.setPlan('main', fp, plan(gn(-3)));
  const r = await project.render('main');
  const first = await project.exportOutput('main', 'out.wav');
  const second = await project.exportOutput('main', 'out.wav');
  assert.equal(first, second);
  assert.equal(await isReadOnly(second), false, 'export is writable');
  assert.equal(await sha256File(second), await sha256File(r.outputPath!));
});
