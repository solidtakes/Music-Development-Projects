import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { gain } from '../src/dsp.ts';
import { sha256File, sha256Hex } from '../src/hash.ts';
import { ManifestError, Project, migrateManifest } from '../src/project.ts';
import { decodeWav, encodeWav } from '../src/wav.ts';
import { BLOCK_FRAMES } from '../src/dsp.ts';
import { gn, newProject, plan, rev, statuses } from './helpers.ts';

/** Direct Gain on the original, computed independently of the project/cache machinery. */
async function directGain(sourcePath: string, db: number): Promise<Uint8Array> {
  const src = decodeWav(await readFile(sourcePath));
  const g = await gain(src, db);
  return encodeWav(g.format, g.samples).bytes;
}

test('ACCEPTANCE: Original -> Reverse -> Gain; remove Reverse; Gain matches direct Gain bit-exactly', async () => {
  const { project, fp, userPath } = await newProject(48000 * 2, 2);
  const userHash = await sha256File(userPath);
  assert.equal(userHash, fp, 'fingerprint is the sha256 of the original file');

  // 1. Original -> Reverse -> Gain(-3)
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const r1 = await project.render('main');
  assert.equal(r1.status, 'completed');
  assert.deepEqual(statuses(r1), ['miss', 'miss']);
  const [revStep, gainStep1] = r1.report!.steps;
  assert.notEqual(revStep!.cacheKey, gainStep1!.cacheKey);
  // Reverse output and Gain output are separate immutable files
  const revPath = project.cache.objectPath(revStep!.cacheKey!);
  assert.equal((await stat(revPath)).mode & 0o222, 0, 'intermediate is read-only');
  // Reverse->Gain is correct: reversing it gives direct Gain
  const chained = decodeWav(await readFile(r1.outputPath!));
  const direct = decodeWav(await directGain(project.sourcePath(fp), -3));
  const frames = direct.format.frames;
  const ch = direct.format.channels;
  for (const f of [0, 1, 1234, frames - 1]) {
    for (let c = 0; c < ch; c++) assert.equal(chained.samples[f * ch + c], direct.samples[(frames - 1 - f) * ch + c]);
  }

  // 2. Remove Reverse, keep Gain (same stable op id), re-render from the original
  project.setPlan('main', fp, plan(gn(-3)));
  const r2 = await project.render('main');
  assert.equal(r2.status, 'completed');
  assert.deepEqual(statuses(r2), ['miss'], 'only the affected Gain node is recomputed');
  assert.notEqual(r2.report!.steps[0]!.cacheKey, gainStep1!.cacheKey, 'Gain identity changed because its upstream changed');

  // 3. Output matches direct Gain on Original: tolerance 0 (bit-exact bytes)
  const out = await readFile(r2.outputPath!);
  assert.equal(sha256Hex(out), sha256Hex(await directGain(project.sourcePath(fp), -3)));
  const outMeta = decodeWav(out).format;
  assert.deepEqual(outMeta, project.sourceInfo(fp).format, 'sample rate / channels / frames / format preserved');

  // 4. Original file and stored source are unchanged
  assert.equal(await sha256File(userPath), userHash);
  assert.ok(await project.verifySource(fp));

  // 5. The previous Reverse render is still cached (not invalidated by the edit)
  const restore = project.setPlan('main', fp, plan(rev(), gn(-3)));
  assert.ok(restore.revision > 0);
  const r3 = await project.render('main');
  assert.deepEqual(statuses(r3), ['hit', 'hit'], 're-entering the exact prior configuration reuses its cache');

  // 6. Identical chain again -> hits, report bytes come from the filesystem
  project.setPlan('main', fp, plan(gn(-3)));
  const r4 = await project.render('main');
  assert.deepEqual(statuses(r4), ['hit']);
  assert.equal(r4.report!.outputBytes, (await stat(r4.outputPath!)).size);
  assert.equal(r4.report!.sourceBytes, (await stat(project.sourcePath(fp))).size);
  assert.equal(r4.report!.steps[0]!.renderMs, r2.report!.steps[0]!.renderMs, 'renderMs carried forward on hits');
});

test('disabled (bypassed) operation is identical to removal and passes identity through', async () => {
  const { project, fp } = await newProject();
  project.setPlan('main', fp, plan(gn(-3)));
  const a = await project.render('main');
  project.setPlan('main', fp, plan(rev('rev', false), gn(-3)));
  const b = await project.render('main');
  assert.deepEqual(statuses(b), ['bypassed', 'hit']);
  assert.equal(b.outputKey, a.outputKey);
  assert.equal(b.report!.steps[0]!.cacheKey, null);
});

test('changing an early operation invalidates it and downstream only; upstream stays cached', async () => {
  const { project, fp } = await newProject();
  project.setPlan('main', fp, plan(gn(-1, 'g1'), rev(), gn(-6, 'g2')));
  assert.deepEqual(statuses(await project.render('main')), ['miss', 'miss', 'miss']);
  // change the middle operation's successor only
  project.setPlan('main', fp, plan(gn(-1, 'g1'), rev(), gn(-9, 'g2')));
  assert.deepEqual(statuses(await project.render('main')), ['hit', 'hit', 'miss']);
  // change the first operation: everything downstream recomputes
  project.setPlan('main', fp, plan(gn(-2, 'g1'), rev(), gn(-9, 'g2')));
  assert.deepEqual(statuses(await project.render('main')), ['miss', 'miss', 'miss']);
  // planned keys show the same: prefix keys are stable
  const k = project.plannedKeys('main');
  project.setPlan('main', fp, plan(gn(-2, 'g1'), rev(), gn(-12, 'g2')));
  const k2 = project.plannedKeys('main');
  assert.equal(k[0]!.cacheKey, k2[0]!.cacheKey);
  assert.equal(k[1]!.cacheKey, k2[1]!.cacheKey);
  assert.notEqual(k[2]!.cacheKey, k2[2]!.cacheKey);
});

test('branch isolation and alternate-version recall', async () => {
  const { project, fp } = await newProject();
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const main1 = await project.render('main');
  const reverseNode = project.history('main')[0]!.nodeId;

  // branch from the Reverse node and take a different path
  project.createBranch('alt', { node: reverseNode });
  project.extendBranch('alt', [gn(-12, 'alt-gain')]);
  const alt1 = await project.render('alt');
  assert.deepEqual(statuses(alt1), ['hit', 'miss'], 'shared prefix reused, new branch work rendered');

  // edit main heavily; alt must be untouched and still fully cached
  project.setPlan('main', fp, plan(gn(6)));
  await project.render('main');
  assert.deepEqual(project.history('alt').map((h) => h.operation), [rev(), gn(-12, 'alt-gain')]);
  const alt2 = await project.render('alt');
  assert.deepEqual(statuses(alt2), ['hit', 'hit']);
  assert.equal(alt2.outputKey, alt1.outputKey);

  // recall main's earlier version exactly
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const main2 = await project.render('main');
  assert.deepEqual(statuses(main2), ['hit', 'hit']);
  assert.equal(main2.outputKey, main1.outputKey);
  assert.deepEqual(project.branches(), ['alt', 'main']);
});

test('save, close and reopen restores graph, history, parameters and valid cache references', async () => {
  const { project, fp, opts } = await newProject();
  project.setPlan('main', fp, plan(rev(), gn(-4.5)));
  const r1 = await project.render('main');
  project.createBranch('alt', { branch: 'main' });
  project.extendBranch('alt', [gn(-1, 'g2')]);
  await project.render('alt');
  await project.save();
  const historyBefore = project.history('main');
  const graphBefore = project.graphSnapshot();

  const reopened = await Project.open(opts);
  assert.deepEqual(reopened.graphSnapshot(), graphBefore);
  assert.deepEqual(reopened.history('main'), historyBefore);
  assert.deepEqual(reopened.plan('main'), plan(rev(), gn(-4.5)));
  assert.equal(reopened.branchRef('main').revision, project.branchRef('main').revision);
  const refs = await reopened.validateCacheReferences();
  assert.equal(refs.invalid.length, 0);
  assert.equal(refs.valid.length, 5);
  const r2 = await reopened.render('main');
  assert.deepEqual(statuses(r2), ['hit', 'hit']);
  assert.equal(r2.outputKey, r1.outputKey);
  assert.ok(await reopened.verifySource(fp));
  assert.deepEqual(reopened.lastOutput('main')!.outputKey, r1.outputKey);
});

test('manifest: newer schema refused, corrupt JSON refused, tampered graph refused', async () => {
  const { opts, project, fp } = await newProject(100);
  project.setPlan('main', fp, plan(gn(-3)));
  await project.save();
  const m = JSON.parse(await readFile(project.manifestPath, 'utf8'));
  assert.throws(() => migrateManifest({ ...m, schemaVersion: 99 }), /newer/);
  assert.throws(() => migrateManifest({ ...m, schemaVersion: undefined }), ManifestError);
  assert.equal(migrateManifest(m).schemaVersion, 1);
  const tampered = structuredClone(m);
  tampered.graph.nodes.find((n: { kind: string }) => n.kind === 'source').sourceFingerprint = '0'.repeat(64);
  await writeFile(project.manifestPath, JSON.stringify(tampered));
  await assert.rejects(Project.open(opts), /Corrupt root node/);
  await writeFile(project.manifestPath, '{oops');
  await assert.rejects(Project.open(opts), ManifestError);
});

test('cancellation: an aborted render returns cancelled and publishes nothing to the branch', async () => {
  const { project, fp } = await newProject(BLOCK_FRAMES * 4);
  project.setPlan('main', fp, plan(gn(-3)));
  const ok = await project.render('main');
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const ac = new AbortController();
  const r = await project.render('main', { signal: ac.signal, onProgress: (p) => { if (p.fraction > 0.1) ac.abort(); } });
  assert.equal(r.status, 'cancelled');
  assert.equal(r.report, null);
  assert.equal(project.lastOutput('main')!.outputKey, ok.outputKey, 'last completed output unchanged');
  const keys = await project.cache.keys();
  assert.equal(keys.length, 1, 'cancelled Reverse never committed a cache entry');
});

test('stale render protection: a commit during render supersedes it; a newer request wins', async () => {
  const { project, fp } = await newProject(BLOCK_FRAMES * 2);
  // (a) plan changes mid-render
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  let edited = false;
  const stale = await project.render('main', {
    beforeStep: (id) => {
      if (id === 'gain' && !edited) { edited = true; project.setPlan('main', fp, plan(gn(-6))); }
    },
  });
  assert.equal(stale.status, 'superseded');
  assert.equal(project.lastOutput('main'), null, 'stale result was not published');
  const fresh = await project.render('main');
  assert.equal(fresh.status, 'completed');
  assert.equal(project.lastOutput('main')!.revision, project.branchRef('main').revision);

  // (b) two concurrent requests for the same branch: the first is aborted and superseded
  project.setPlan('main', fp, plan(gn(-7), rev('rev2')));
  const first = project.render('main');
  const second = project.render('main');
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.status, 'superseded');
  assert.equal(b.status, 'completed');
  assert.equal(project.lastOutput('main')!.outputKey, b.outputKey);
});

test('project render recovers from a corrupted cache entry by re-rendering', async () => {
  const { project, fp } = await newProject();
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const r1 = await project.render('main');
  const revKey = r1.report!.steps[0]!.cacheKey!;
  const p = project.cache.objectPath(revKey);
  await chmod(p, 0o644);
  const b = await readFile(p);
  b[100] = b[100]! ^ 0x55;
  await writeFile(p, b);
  const r2 = await project.render('main');
  assert.deepEqual(statuses(r2), ['miss', 'hit'], 'corrupt Reverse re-rendered; downstream key unchanged so Gain hits');
  const meta = JSON.parse(await readFile(project.cache.metaPath(revKey), 'utf8'));
  assert.equal(sha256Hex(await readFile(p)), meta.contentSha256, 'repaired object matches its recorded hash');
  assert.ok((await project.cache.lookup(revKey, meta.inputs, r1.report!.steps[0]!.format)).hit);
  assert.equal(r2.outputKey, r1.outputKey);
});

test('pass-through, plan validation, export to temp and garbage collection', async () => {
  const { project, fp, opts } = await newProject(1000);
  project.setPlan('main', fp, plan());
  const r = await project.render('main');
  assert.equal(r.status, 'completed');
  assert.equal(r.outputKey, null);
  assert.equal(r.outputPath, project.sourcePath(fp));
  assert.throws(() => project.setPlan('main', fp, plan(gn(99))), /outside/);
  assert.throws(() => project.setPlan('main', fp, { version: 2 as 1, operations: [] }), /plan version/);

  project.setPlan('main', fp, plan(gn(-3)));
  const r2 = await project.render('main');
  const exported = await project.exportOutput('main');
  assert.ok(exported.startsWith(opts.tempRoot!));
  assert.equal(await sha256File(exported), await sha256File(r2.outputPath!));

  project.setPlan('main', fp, plan(gn(-5)));
  await project.render('main');
  assert.equal((await project.cache.keys()).length, 2);
  const freed = await project.collectGarbage();
  assert.ok(freed > 0);
  assert.equal((await project.cache.keys()).length, 1);
  const fpBytes = await project.footprint();
  assert.equal(fpBytes.projectBytes >= fpBytes.sourceBytes + fpBytes.cacheBytes + fpBytes.manifestBytes, true);
  void join;
});

test('stereo and mono sources through the full project pipeline keep channel alignment', async () => {
  for (const channels of [1, 2]) {
    const { project, fp } = await newProject(777, channels);
    project.setPlan('main', fp, plan(rev(), gn(0)));
    const r = await project.render('main');
    const src = decodeWav(await readFile(project.sourcePath(fp)));
    const out = decodeWav(await readFile(r.outputPath!));
    for (let f = 0; f < 777; f++) {
      for (let c = 0; c < channels; c++) assert.equal(out.samples[f * channels + c], src.samples[(776 - f) * channels + c]);
    }
  }
});

test('a node output is byte-identical whether its upstream was a cache hit or a fresh render', async () => {
  const ops = [gn(-3.3, 'g1'), gn(-2.7, 'g2')];
  const a = await newProject(20000);
  a.project.setPlan('main', a.fp, plan(ops[0]!));
  await a.project.render('main'); // g1 cached
  a.project.setPlan('main', a.fp, plan(...ops));
  const ra = await a.project.render('main');
  assert.deepEqual(statuses(ra), ['hit', 'miss']);

  const b = await newProject(20000);
  b.project.setPlan('main', b.fp, plan(...ops));
  const rb = await b.project.render('main');
  assert.deepEqual(statuses(rb), ['miss', 'miss']);
  assert.equal(ra.outputKey, rb.outputKey);
  assert.equal(await sha256File(ra.outputPath!), await sha256File(rb.outputPath!));

  // reference: quantize to the stored format between steps
  const src = decodeWav(await readFile(b.project.sourcePath(b.fp)));
  const g1 = await gain(src, -3.3);
  const q1 = decodeWav(encodeWav(g1.format, g1.samples).bytes);
  const g2 = await gain(q1, -2.7);
  assert.equal(sha256Hex(encodeWav(g2.format, g2.samples).bytes), await sha256File(rb.outputPath!));
});
