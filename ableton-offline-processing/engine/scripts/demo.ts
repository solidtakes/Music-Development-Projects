/**
 * Alpha 0.1 engine acceptance demonstration.
 *
 *   node scripts/demo.ts [--seconds 30] [--channels 2] [--format pcm24|pcm16|float32|...] [--storage DIR] [--verify hash|size]
 *
 * Generates a deterministic WAV fixture, then runs:
 *   Original -> Reverse -> Gain; remove Reverse; re-render Gain
 * and verifies the result is bit-identical to direct Gain on the original, plus cache reuse,
 * downstream-only invalidation, branching and save/reopen. Prints measured times and real byte counts
 * and writes a JSON report next to the project. Exits non-zero if any check fails.
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { RenderReport } from '../src/contract.ts';
import { gain } from '../src/dsp.ts';
import { sha256File, sha256Hex } from '../src/hash.ts';
import { Project, type RenderResult } from '../src/project.ts';
import { decodeWav, encodeWav, makeMetadata } from '../src/wav.ts';

const { values } = parseArgs({
  options: {
    seconds: { type: 'string', default: '30' },
    channels: { type: 'string', default: '2' },
    format: { type: 'string', default: 'pcm24' },
    'sample-rate': { type: 'string', default: '48000' },
    storage: { type: 'string' },
    verify: { type: 'string', default: 'hash' },
    json: { type: 'boolean', default: false },
  },
});

const seconds = Number(values.seconds);
const channels = Number(values.channels);
const sampleRate = Number(values['sample-rate']);
const m = /^(pcm|float)(\d+)$/.exec(values.format!);
if (!m) throw new Error(`Bad --format ${values.format}`);
const encoding = m[1] as 'pcm' | 'float';
const bitDepth = Number(m[2]);
const verify = values.verify === 'size' ? 'size' : 'hash';

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => {
  checks.push({ name, ok, ...(detail ? { detail } : {}) });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const kb = (b: number) => (b >= 1 << 20 ? `${(b / (1 << 20)).toFixed(2)} MiB` : `${(b / 1024).toFixed(1)} KiB`);
const ms = (x: number) => `${x.toFixed(2)} ms`;

const stages: Array<{ stage: string; status: string; wallMs: number; report: RenderReport | null }> = [];
function show(stage: string, r: RenderResult) {
  stages.push({ stage, status: r.status, wallMs: r.wallMs, report: r.report });
  console.log(`\n== ${stage}  [${r.status}]  wall ${ms(r.wallMs)}`);
  if (!r.report) return;
  console.log('   op            status    render ms    lookup ms        bytes   key');
  for (const s of r.report.steps) {
    console.log(
      `   ${s.operationId.padEnd(12)}  ${s.status.padEnd(8)}  ${s.renderMs.toFixed(2).padStart(9)}  ${s.lookupMs.toFixed(2).padStart(11)}  ${String(s.bytes).padStart(11)}   ${s.cacheKey?.slice(0, 12) ?? '-'}`,
    );
  }
  console.log(`   source ${kb(r.report.sourceBytes)} | output ${kb(r.report.outputBytes)} | cache ${kb(r.report.cacheBytes)} | project ${kb(r.report.projectBytes)}`);
}
const statuses = (r: RenderResult) => r.report?.steps.map((s) => s.status).join(',') ?? r.status;

// ------------------------------------------------------------------ fixture
const root = values.storage ? resolve(values.storage) : await mkdtemp(join(tmpdir(), 'aopx-demo-'));
await mkdir(join(root, 'user'), { recursive: true });
const frames = Math.round(seconds * sampleRate);
const samples = new Float64Array(frames * channels);
for (let f = 0; f < frames; f++) {
  const t = f / sampleRate;
  const env = Math.min(1, t * 4); // fade-in makes direction audible and testable
  for (let c = 0; c < channels; c++) {
    samples[f * channels + c] = c % 2 === 0 ? 0.5 * env * Math.sin(2 * Math.PI * 220 * t) : 0.4 * env * Math.sin(2 * Math.PI * 330 * t + 0.5);
  }
}
const fixturePath = join(root, 'user', 'fixture.wav');
await writeFile(fixturePath, encodeWav(makeMetadata(channels, sampleRate, bitDepth, encoding, frames), samples).bytes);
const originalHash = await sha256File(fixturePath);

console.log(`AOPX engine demo — Node ${process.version}`);
console.log(`storage: ${root}`);
console.log(`fixture: ${seconds}s ${channels}ch ${sampleRate} Hz ${encoding}${bitDepth}, sha256 ${originalHash.slice(0, 16)}…`);

const opts = { storageRoot: join(root, 'storage'), tempRoot: join(root, 'temp'), verify } as const;
const project = await Project.create(opts);
const t0 = performance.now();
const source = await project.importSource(fixturePath);
console.log(`import: ${ms(performance.now() - t0)}, ${kb(source.bytes)}, ${source.format.frames} frames`);
const fp = source.fingerprint;

const REV = { id: 'reverse-1', type: 'reverse', enabled: true } as const;
const GAIN = (db: number) => ({ id: 'gain-1', type: 'gain', db, enabled: true }) as const;
const plan = (...operations: Array<typeof REV | ReturnType<typeof GAIN>>) => ({ version: 1 as const, operations: [...operations] });

// 1. Original -> Reverse -> Gain
project.setPlan('main', fp, plan(REV, GAIN(-3)));
const r1 = await project.render('main');
show('1. Original -> Reverse -> Gain(-3 dB)', r1);
check('both operations rendered as separate immutable outputs', statuses(r1) === 'miss,miss' && r1.report!.steps[0]!.cacheKey !== r1.report!.steps[1]!.cacheKey);

// 2. Remove Reverse, re-render
project.setPlan('main', fp, plan(GAIN(-3)));
const r2 = await project.render('main');
show('2. Remove Reverse -> re-render Gain from Original', r2);
check('only the affected Gain node re-rendered', statuses(r2) === 'miss');

// 3. Correctness vs direct gain
const direct = await gain(decodeWav(await readFile(project.sourcePath(fp))), -3);
const directHash = sha256Hex(encodeWav(direct.format, direct.samples).bytes);
const outHash = await sha256File(r2.outputPath!);
check('output == direct Gain(Original), bit-exact (tolerance 0)', outHash === directHash, `sha256 ${outHash.slice(0, 16)}…`);
const outFmt = decodeWav(await readFile(r2.outputPath!)).format;
check('sample rate, channels, frames and sample format preserved', JSON.stringify(outFmt) === JSON.stringify(source.format));
check('original user file hash unchanged', (await sha256File(fixturePath)) === originalHash);
check('stored immutable source hash unchanged', await project.verifySource(fp));

// 4. Identical chain -> hits
const r3 = await project.render('main');
show('3. Re-render identical chain', r3);
check('identical chain is a cache hit', statuses(r3) === 'hit');

// 5. Restore previous configuration -> hits
project.setPlan('main', fp, plan(REV, GAIN(-3)));
const r4 = await project.render('main');
show('4. Restore Reverse -> Gain(-3) (prior exact configuration)', r4);
check('prior configuration fully reused', statuses(r4) === 'hit,hit' && r4.outputKey === r1.outputKey);

// 6. Change Gain only -> Reverse reused
project.setPlan('main', fp, plan(REV, GAIN(-6)));
const r5 = await project.render('main');
show('5. Change Gain to -6 dB (downstream-only invalidation)', r5);
check('upstream Reverse reused, only Gain recomputed', statuses(r5) === 'hit,miss');

// 7. Branch from the Reverse node
const reverseNode = project.history('main')[0]!.nodeId;
project.createBranch('alt', { node: reverseNode });
project.extendBranch('alt', [{ id: 'gain-alt', type: 'gain', db: -12, enabled: true }]);
const r6 = await project.render('alt');
show('6. Branch "alt" from Reverse node -> Gain(-12)', r6);
check('branch reuses shared Reverse', statuses(r6) === 'hit,miss');
const r7 = await project.render('main');
check('main branch unaffected by alt', statuses(r7) === 'hit,hit' && r7.outputKey === r5.outputKey);

// 8. Save, reopen
await project.save();
const reopened = await Project.open(opts);
const refs = await reopened.validateCacheReferences();
check('reopened: history restored', JSON.stringify(reopened.history('main')) === JSON.stringify(project.history('main')));
check('reopened: all cache references valid', refs.invalid.length === 0 && refs.valid.length > 0, `${refs.valid.length} refs`);
const r8 = await reopened.render('main');
show('7. Reopen project and render main', r8);
check('reopened render is all cache hits', statuses(r8) === 'hit,hit');
const r9 = await reopened.render('alt');
check('reopened alt branch is all cache hits', statuses(r9) === 'hit,hit');

const footprint = await reopened.footprint();
console.log(`\nfootprint: sources ${kb(footprint.sourceBytes)} | cache ${kb(footprint.cacheBytes)} | manifest ${kb(footprint.manifestBytes)} | project total ${kb(footprint.projectBytes)}`);

const failed = checks.filter((c) => !c.ok);
const summary = {
  node: process.version,
  fixture: { seconds, channels, sampleRate, encoding, bitDepth, bytes: source.bytes, sha256: originalHash },
  verifyMode: verify,
  stages,
  footprint,
  checks,
  passed: failed.length === 0,
};
await writeFile(join(root, 'demo-report.json'), JSON.stringify(summary, null, 2));
if (values.json) console.log(JSON.stringify(summary, null, 2));
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed. Report: ${join(root, 'demo-report.json')}`);
process.exitCode = failed.length === 0 ? 0 : 1;
