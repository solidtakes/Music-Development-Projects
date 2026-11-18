import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { AudioProject } from '../src/index.ts';
import type { Operation, RenderProgress } from '../src/index.ts';
import { digest } from '../src/history.ts';
import { parseWav } from '../src/wav.ts';
import { fixtureWav, readFixture, writeSignalFixture } from './fixtures.ts';

const reverse: Operation = { type: 'reverse', id: 'reverse', enabled: true };
const gain: Operation = { type: 'gain', id: 'gain', db: -3, enabled: true };

async function isolated(t: TestContext, file = fixtureWav([[0.5, -0.25], [-0.75, 0], [0.125, 0.875]])) {
  const root = await mkdtemp(join(tmpdir(), 'aopx-engine-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'input.wav');
  const storage = join(root, 'project');
  await writeFile(source, file);
  return { root, source, storage, project: await AudioProject.create(storage, source) };
}

test('Reverse preserves stereo frames and removing it renders direct Gain without mutating source', async (t) => {
  const { project, source, storage } = await isolated(t);
  const fingerprint = digest(await readFile(source));
  assert.equal(project.source.fingerprint, fingerprint);
  await project.setHistory([reverse, gain]);
  const chain = await project.render();
  assert.deepEqual(chain.report.steps.map(({ status }) => status), ['miss', 'miss']);
  const [reverseStep, gainStep] = chain.report.steps;
  assert.notEqual(reverseStep.cacheKey, gainStep.cacheKey);
  const first = await readFixture(source);
  const reversed = await readFixture(join(storage, 'cache', reverseStep.cacheKey!, 'output.wav'));
  assert.deepEqual(reversed.frames, first.frames.toReversed());
  const chained = await readFixture(chain.outputPath);
  assert.deepEqual(chained.format, first.format);
  await project.setHistory([gain]);
  assert.equal(await project.lastRender(), null);
  const edited = await project.render();
  assert.deepEqual(edited.report.steps.map(({ status }) => status), ['miss']);
  const direct = await readFixture(edited.outputPath);
  const lsb = 2 ** -15;
  const factor = 10 ** (-3 / 20);
  direct.frames.forEach((frame, i) => frame.forEach((sample, channel) => {
    assert.ok(Math.abs(sample - first.frames[i][channel] * factor) <= lsb / 2);
    assert.equal(sample, chained.frames.at(-i - 1)![channel]);
  }));
  assert.equal(digest(await readFile(source)), fingerprint);
  assert.equal(digest(await readFile(project.sourcePath)), fingerprint);
  assert.equal(edited.report.sourceBytes, (await stat(source)).size);
  assert.equal(edited.report.outputBytes, (await stat(edited.outputPath)).size);
  assert.ok(edited.report.steps[0].renderMs > 0);
  const cache = await readdir(join(storage, 'cache'));
  assert.equal(cache.length, 3);
  let actualCache = 0;
  for (const key of cache) {
    actualCache += (await stat(join(storage, 'cache', key, 'output.wav'))).size;
    actualCache += (await stat(join(storage, 'cache', key, 'metadata.json'))).size;
  }
  assert.equal(edited.report.cacheBytes, actualCache);
  assert.equal(edited.report.projectBytes, edited.report.sourceBytes + actualCache +
    (await stat(join(storage, 'project.json'))).size);
});

test('editing parameters invalidates the affected suffix and identical historical configurations hit', async (t) => {
  const { project } = await isolated(t);
  const trailing = { ...reverse, id: 'final' };
  await project.setHistory([reverse, gain, trailing]);
  const first = await project.render();
  await project.setHistory([reverse, { ...gain, db: -6.124 }, trailing]);
  assert.equal((project.history()[1] as typeof gain).db, -6.12);
  const changed = await project.render();
  assert.deepEqual(changed.report.steps.map(({ status }) => status), ['hit', 'miss', 'miss']);
  assert.equal(changed.report.steps[0].cacheKey, first.report.steps[0].cacheKey);
  assert.equal(changed.report.steps[0].renderMs, first.report.steps[0].renderMs);
  assert.ok(changed.report.steps[0].lookupMs > 0);
  assert.notEqual(changed.report.steps[2].cacheKey, first.report.steps[2].cacheKey);

  await project.setHistory([reverse, { ...gain, id: 'new-id' }, trailing]);
  const recalled = await project.render();
  assert.deepEqual(recalled.report.steps.map(({ status }) => status), ['hit', 'hit', 'hit']);
  assert.equal(recalled.outputPath, first.outputPath);
  assert.equal(recalled.report.steps[1].operationId, 'new-id');
});

test('bypass forwards upstream audio; branching and reopen persist graph and render references', async (t) => {
  const { project, storage } = await isolated(t);
  await project.setHistory([reverse, gain]);
  const main = await project.render();
  await project.fork('alternate', 'main', 1);
  await project.fork('recall');
  await project.setHistory([{ ...reverse, enabled: false }, gain], 'alternate');
  const alt = await project.render({ branch: 'alternate' });
  assert.deepEqual(alt.report.steps.map(({ status }) => status), ['bypassed', 'miss']);
  assert.equal(alt.report.steps[0].bytes, alt.report.sourceBytes);
  assert.notEqual(alt.outputPath, main.outputPath);
  assert.deepEqual(project.history(), [reverse, gain]);

  const reopened = await AudioProject.open(storage);
  assert.deepEqual(reopened.history('alternate'), [{ ...reverse, enabled: false }, gain]);
  assert.deepEqual(reopened.history(), [reverse, gain]);
  assert.equal((await reopened.lastRender('recall'))?.outputPath, main.outputPath);
  assert.equal((await reopened.lastRender('alternate'))?.outputPath, alt.outputPath);
  const repeat = await reopened.render();
  assert.deepEqual(repeat.report.steps.map(({ status }) => status), ['hit', 'hit']);
  await reopened.setHistory([gain], 'alternate');
  assert.equal((await reopened.render({ branch: 'alternate' })).report.steps[0].status, 'hit');
});

test('supports PCM8/16/24/32 and float32/64, quantizes PCM and retains float headroom', async (t) => {
  for (const [encoding, bitDepth] of [
    ['pcm', 8], ['pcm', 16], ['pcm', 24], ['pcm', 32], ['float', 32], ['float', 64],
  ] as const) {
    await t.test(`${encoding} ${bitDepth}`, async (t) => {
      const { project } = await isolated(t, fixtureWav([[0], [0.75], [-0.75]], { encoding, bitDepth }));
      await project.setHistory([reverse, { ...gain, db: 12 }]);
      const output = await readFixture((await project.render()).outputPath);
      assert.deepEqual(output.format, project.source.format);
      const expected = 0.75 * 10 ** (12 / 20);
      const step = 2 ** (1 - bitDepth);
      const [negative, positive, silent] = output.frames.flat();
      if (encoding === 'float') {
        assert.ok(Math.abs(negative + expected) <= 1e-6);
        assert.ok(Math.abs(positive - expected) <= 1e-6);
      } else {
        assert.equal(negative, -1);
        assert.equal(positive, 1 - step);
      }
      assert.equal(silent, 0);
    });
  }
});

test('recognizes extensible PCM, rejects malformed WAV, and handles an empty clip', async (t) => {
  const original = fixtureWav([[0.125, 0.25]], { bitDepth: 24 });
  const ext = Buffer.concat([original.subarray(0, 36), Buffer.alloc(24), original.subarray(36)]);
  ext.writeUInt32LE(ext.length - 8, 4);
  ext.writeUInt32LE(40, 16);
  ext.writeUInt16LE(0xfffe, 20);
  ext.writeUInt16LE(22, 36);
  ext.writeUInt16LE(24, 38);
  ext.writeUInt32LE(3, 40);
  Buffer.from('0100000000001000800000aa00389b71', 'hex').copy(ext, 44);
  assert.equal(parseWav(ext).format.bitDepth, 24);
  assert.throws(() => parseWav(original.subarray(0, -1)), /RIFF length/);
  assert.throws(() => parseWav(Buffer.from('not WAV')), /RIFF WAV/);

  const { project } = await isolated(t, fixtureWav([]));
  await project.setHistory([reverse, gain]);
  assert.equal((await project.render()).report.outputFormat.frames, 0);
  assert.deepEqual(await project.waveform(2), [{ min: 0, max: 0 }, { min: 0, max: 0 }]);
});

test('source verification catches replacement and cache checks catch same-size corruption', async (t) => {
  const { project, storage } = await isolated(t);
  await project.setHistory([gain]);
  const result = await project.render();
  const artifact = await readFile(result.outputPath);
  artifact[artifact.length - 1] ^= 1;
  await writeFile(result.outputPath, artifact);
  await assert.rejects(project.render(), /failed its integrity check/);
  await writeFile(project.sourcePath, artifact);
  await assert.rejects(AudioProject.open(storage), /source failed its integrity check/);
});

test('cancellation during DSP leaves no published result; a superseded render cannot publish', async (t) => {
  const { root } = await isolated(t);
  const source = join(root, 'long.wav');
  await writeSignalFixture(source, 2);
  const project = await AudioProject.create(join(root, 'long'), source);
  await project.setHistory([reverse, gain]);
  const controller = new AbortController();
  const fractions: number[] = [];
  await assert.rejects(project.render({
    signal: controller.signal,
    onProgress: (progress) => {
      fractions.push(progress.fraction);
      if (progress.fraction > 0) controller.abort();
    },
  }), { name: 'AbortError' });
  assert.ok(fractions.some((value) => value > 0 && value < 0.5));
  assert.equal(await project.lastRender(), null);

  let replacement: ReturnType<AudioProject['render']> | undefined;
  const old = project.render({
    onProgress: ({ fraction }) => {
      if (fraction === 1) {
        replacement = project.setHistory([gain]).then(() => project.render());
      }
    },
  });
  await assert.rejects(old, { name: 'AbortError' });
  assert.ok(replacement);
  const newest = await replacement;
  assert.equal((await project.lastRender())?.outputPath, newest.outputPath);
  assert.deepEqual(newest.report.steps.map(({ operationId }) => operationId), ['gain']);
});

test('renders concurrent branches safely, validates operation inputs, and measures waveform peaks', async (t) => {
  const { project } = await isolated(t);
  await assert.rejects(project.setHistory([gain, gain]), /unique IDs/);
  await assert.rejects(project.setHistory([{ ...gain, db: -61 }]), /between/);
  assert.deepEqual(await project.waveform(3), [
    { min: -0.25, max: 0.5 }, { min: -0.75, max: 0 }, { min: 0.125, max: 0.875 },
  ]);
  await project.setHistory([reverse, gain]);
  await project.fork('concurrent');
  const events: RenderProgress[] = [];
  const [main, fork] = await Promise.all([
    project.render({ onProgress: (event) => events.push(event) }),
    project.render({ branch: 'concurrent' }),
  ]);
  assert.equal(main.outputPath, fork.outputPath);
  assert.equal((await project.lastRender('concurrent'))?.outputPath, fork.outputPath);
  assert.equal(events[0].fraction, 0);
  assert.equal(events.at(-1)?.fraction, 1);
  assert.ok(events.every((event, i) => !i || event.fraction >= events[i - 1].fraction));
});
