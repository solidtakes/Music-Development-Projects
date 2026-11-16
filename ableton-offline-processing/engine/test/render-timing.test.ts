/**
 * T1: RenderReport.wallMs is the measured wall-clock time of the render request. It must not be
 * derived from RenderStep.renderMs, which carries a cache entry's original processing time forward.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Project } from '../src/project.ts';
import { gn, newProject, plan, rev, statuses } from './helpers.ts';

test('wallMs is measured on every completed render and is within the request wall time', async () => {
  const { project, fp } = await newProject(4000);
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const miss = await project.render('main');
  assert.deepEqual(statuses(miss), ['miss', 'miss']);
  const wall = miss.report!.wallMs!;
  assert.equal(typeof wall, 'number');
  assert.ok(Number.isFinite(wall) && wall > 0);
  assert.ok(wall <= miss.wallMs, 'report is produced before the request finishes');
  const lookups = miss.report!.steps.reduce((n, s) => n + s.lookupMs, 0);
  assert.ok(wall >= lookups, 'every lookup happens inside the measured request');
});

test('an all-cache-hit render reports its own wall time, not the carried-forward renderMs', async () => {
  const { project, fp } = await newProject(4000);
  project.setPlan('main', fp, plan(rev(), gn(-3)));
  const first = await project.render('main');
  // Make each entry's recorded processing time enormous. renderMs is not part of the cache key or
  // of lookup verification, so the entries stay valid hits and carry this value forward.
  const HUGE = 1e7;
  for (const s of first.report!.steps) {
    const metaPath = project.cache.metaPath(s.cacheKey!);
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    meta.renderMs = HUGE;
    await writeFile(metaPath, JSON.stringify(meta));
  }
  const hit = await project.render('main');
  assert.deepEqual(statuses(hit), ['hit', 'hit']);
  const carried = hit.report!.steps.reduce((n, s) => n + s.renderMs, 0);
  assert.equal(carried, 2 * HUGE, 'renderMs is carried forward from the cache entries');
  assert.ok(hit.report!.wallMs! < HUGE, 'wallMs is the measured request time');
  assert.ok(hit.report!.wallMs! <= hit.wallMs);
});

test('pass-through and superseded or cancelled renders', async () => {
  const { project, fp } = await newProject(1000);
  project.setPlan('main', fp, plan());
  const through = await project.render('main');
  assert.equal(through.status, 'completed');
  assert.ok(Number.isFinite(through.report!.wallMs!));
  project.setPlan('main', fp, plan(gn(-3)));
  const ac = new AbortController();
  ac.abort();
  const cancelled = await project.render('main', { signal: ac.signal });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.report, null, 'no report, and therefore no wallMs, for an unpublished render');
});

test('wallMs survives save/reopen; reports from before the field reopen as null', async () => {
  const { project, fp, opts } = await newProject(1000);
  project.setPlan('main', fp, plan(gn(-3)));
  const r = await project.render('main');
  await project.save();
  const reopened = await Project.open(opts);
  assert.equal(reopened.lastOutput('main')!.report.wallMs, r.report!.wallMs);

  // A manifest written by an engine without RenderReport.wallMs.
  const m = JSON.parse(await readFile(project.manifestPath, 'utf8'));
  delete m.outputs.main.report.wallMs;
  await writeFile(project.manifestPath, JSON.stringify(m));
  const legacy = await Project.open(opts);
  assert.equal(legacy.lastOutput('main')!.report.wallMs, null, 'unknown, not invented');
  const fresh = await legacy.render('main');
  assert.ok(Number.isFinite(fresh.report!.wallMs!), 'the next render measures it again');
});
