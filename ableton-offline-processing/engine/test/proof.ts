import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { release, tmpdir, version } from 'node:os';
import { join } from 'node:path';
import { AudioProject } from '../src/index.ts';
import type { Operation } from '../src/index.ts';
import { digest } from '../src/history.ts';
import { parseWav, readSample } from '../src/wav.ts';
import { writeSignalFixture } from './fixtures.ts';

const workspace = await mkdtemp(join(tmpdir(), 'aopx-proof-'));
try {
  const root = join(workspace, 'project');
  const source = join(workspace, 'proof.wav');
  await writeSignalFixture(source, 8);
  const sourceFile = await readFile(source);
  const original = parseWav(sourceFile);
  const sourceHash = digest(sourceFile);
  const reverse: Operation = { id: 'reverse', type: 'reverse', enabled: true };
  const gain: Operation = { id: 'gain', type: 'gain', enabled: true, db: -3 };
  const project = await AudioProject.create(root, source);
  await project.setHistory([reverse, gain]);
  const initial = await project.render();
  assert.deepEqual(initial.report.steps.map(({ status }) => status), ['miss', 'miss']);
  await project.setHistory([gain]);
  const edited = await project.render();
  assert.deepEqual(edited.report.steps.map(({ status }) => status), ['miss']);

  const output = parseWav(await readFile(edited.outputPath));
  const referenceGain = 10 ** (-3 / 20);
  let maxSampleError = 0;
  for (let offset = 0; offset < output.data.length; offset += output.sampleBytes) {
    const expected = referenceGain * readSample(original, offset);
    maxSampleError = Math.max(maxSampleError, Math.abs(readSample(output, offset) - expected));
  }
  const sampleTolerance = 2 ** -24;
  assert.ok(maxSampleError <= sampleTolerance);
  assert.equal(digest(await readFile(source)), sourceHash);
  assert.equal(digest(await readFile(project.sourcePath)), sourceHash);

  const reopened = await AudioProject.open(root);
  assert.equal((await reopened.lastRender())?.outputPath, edited.outputPath);
  const repeat = await reopened.render();
  assert.deepEqual(repeat.report.steps.map(({ status }) => status), ['hit']);
  await reopened.setHistory([reverse, gain]);
  const recalled = await reopened.render();
  assert.deepEqual(recalled.report.steps.map(({ status }) => status), ['hit', 'hit']);
  assert.equal(recalled.outputPath, initial.outputPath);

  const summarize = ({ report }: typeof initial) => ({
    sourceBytes: report.sourceBytes,
    outputBytes: report.outputBytes,
    cacheBytes: report.cacheBytes,
    projectBytes: report.projectBytes,
    steps: report.steps.map(({ operationId, status, renderMs, lookupMs, bytes }) => ({
      operationId, status, renderMs, lookupMs, bytes,
    })),
  });
  process.stdout.write(JSON.stringify({
    environment: { node: process.version, platform: process.platform, release: release(), os: version() },
    input: original.format,
    sourceHash,
    maxSampleError,
    sampleTolerance,
    initial: summarize(initial),
    afterRemovingReverse: summarize(edited),
    afterReopen: summarize(repeat),
    afterRecallingOriginalChain: summarize(recalled),
  }, null, 2) + '\n');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
