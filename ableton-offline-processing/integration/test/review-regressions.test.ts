/**
 * One regression test (or group) per finding of Codex review #7054566988 against 0690422.
 * Each reproduces the reviewer's probe and asserts the corrected behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, readdir, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { encodeWav, makeMetadata } from '../../engine/src/wav.ts';
import { createOfflineProcess, type FlowResult } from '../src/flow.ts';
import { acknowledgeReconciliation, journalDir, pendingReconciliation } from '../src/journal.ts';
import { BoundedReadError, readFileBounded } from '../src/bounded-read.ts';
import { validateWavContainer } from '../src/wav-container.ts';
import { makeFakePort, sha256, wavBytes, type FakePort } from './fake-port.ts';

const imports = (p: FakePort) => p.calls.filter((c) => c === 'importIntoProject').length;
const creates = (p: FakePort) => p.calls.filter((c) => c.startsWith('createAudioClip')).length;
const manifestPath = (p: FakePort) => join(p.storageDirectory!, 'aopx-project', 'project.json');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function untouched(r: FlowResult, p: FakePort): void {
  assert.equal(r.setChanged, 'no');
  assert.deepEqual(r.effects, []);
  assert.equal(imports(p) + creates(p), 0, p.calls.join(', '));
}

// ---------------------------------------------------------------- H1

test('H1: an existing project that cannot be opened is never overwritten', async (t) => {
  const cases: Record<string, (p: FakePort) => Promise<void>> = {
    'newer schema (probe: schemaVersion 999 + Cancel)': async (p) => {
      await mkdir(join(p.storageDirectory!, 'aopx-project'), { recursive: true });
      await writeFile(manifestPath(p), JSON.stringify({ schemaVersion: 999, history: 'KEEP' }));
    },
    'corrupt JSON': async (p) => {
      await mkdir(join(p.storageDirectory!, 'aopx-project'), { recursive: true });
      await writeFile(manifestPath(p), '{"schemaVersion":1,');
    },
    'unreadable (manifest is a directory)': async (p) => {
      await mkdir(manifestPath(p), { recursive: true });
    },
  };
  for (const [name, setup] of Object.entries(cases)) {
    await t.test(name, async () => {
      const p = await makeFakePort({ editor: () => JSON.stringify({ envelopeVersion: 1, action: 'cancel' }) });
      await setup(p);
      const before = await readFile(manifestPath(p)).catch(() => null);
      const r = await createOfflineProcess(p)();
      assert.equal(r.status, 'failed');
      assert.equal(r.reason, 'project-unreadable');
      assert.ok(!p.calls.includes('showEditor'), 'stops before the editor');
      untouched(r, p);
      assert.deepEqual(await readFile(manifestPath(p)).catch(() => null), before, 'manifest bytes unchanged');
    });
  }
  await t.test('missing stored media', async () => {
    const p = await makeFakePort();
    assert.equal((await createOfflineProcess(p)()).status, 'completed');
    const sources = join(p.storageDirectory!, 'aopx-project', 'sources');
    for (const f of await readdir(sources)) await rm(join(sources, f), { force: true });
    const before = await readFile(manifestPath(p));
    p.selection.resultOverlapCount = 0; // a new run on a fresh result range
    const r = await createOfflineProcess(p)();
    assert.equal(r.reason, 'project-unreadable');
    assert.equal(r.setChanged, 'no');
    assert.deepEqual(await readFile(manifestPath(p)), before);
  });
  await t.test('absent manifest: created', async () => {
    const p = await makeFakePort();
    assert.equal((await createOfflineProcess(p)()).status, 'completed');
    assert.equal(JSON.parse(await readFile(manifestPath(p), 'utf8')).schemaVersion, 1);
  });
});

// ---------------------------------------------------------------- H2

test('H2: an uncertain import blocks every re-run until reconciled (no second import)', async () => {
  const p = await makeFakePort({ importBehaviour: 'hang' });
  const run = createOfflineProcess(p, { hostCallTimeoutMs: 30 });
  const first = await run();
  assert.equal(first.status, 'unknown-outcome');
  assert.equal(first.setChanged, 'unknown');
  assert.deepEqual(first.pending, [first.invocation]);

  const callsBefore = p.calls.length;
  const second = await run();
  assert.equal(second.status, 'reconciliation-required');
  assert.equal(second.setChanged, 'no');
  assert.equal(p.calls.length, callsBefore, 'no host call at all, not even resolveSelection');
  assert.equal(imports(p), 1, 'probe: previously a second import was requested');

  // Restart: a fresh controller (and process) sees the durable journal.
  const restarted = await createOfflineProcess(p)();
  assert.equal(restarted.status, 'reconciliation-required');
  assert.deepEqual(await pendingReconciliation(p.storageDirectory!), [first.invocation]);

  // After the user has checked the Set, acknowledging clears the block.
  await acknowledgeReconciliation(p.storageDirectory!, first.invocation!);
  assert.deepEqual(await pendingReconciliation(p.storageDirectory!), []);
});

test('H2: a late import completion after the timeout never leads to a clip or a retry', async () => {
  const p = await makeFakePort({ importBehaviour: 'late', lateMs: 80 });
  const run = createOfflineProcess(p, { hostCallTimeoutMs: 20 });
  const r = await run();
  assert.equal(r.status, 'unknown-outcome');
  await sleep(150);
  assert.equal(p.lateImports, 1, 'the import did complete late');
  assert.equal(creates(p), 0);
  assert.equal((await run()).status, 'reconciliation-required');
  assert.equal(imports(p), 1);
});

test('H2: the intent is durable before the import is requested', async () => {
  let seen: unknown = null;
  const p = await makeFakePort({
    onImport: () => {
      seen = readdir(journalDir(p.storageDirectory!)).then(async (names) =>
        Promise.all(names.filter((n) => n.endsWith('.json')).map(async (n) => JSON.parse(await readFile(join(journalDir(p.storageDirectory!), n), 'utf8')).state)),
      );
    },
  });
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'completed');
  assert.deepEqual(await seen, ['import-intent']);
  assert.deepEqual(await pendingReconciliation(p.storageDirectory!), [], 'closed after a completed run');
});

test('H2: if the intent cannot be recorded, nothing is imported', async () => {
  const p = await makeFakePort();
  const r = await createOfflineProcess(p, { journalWriter: async () => { throw new Error('disk full'); } })();
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'journal-failed');
  assert.ok(p.calls.includes('showEditor'), 'the failure is at the intent write, right before import');
  untouched(r, p);
});

test('H2: an unreadable journal blocks everything before any host call', async () => {
  const p = await makeFakePort();
  await writeFile(journalDir(p.storageDirectory!), 'not a directory');
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'journal-failed');
  assert.deepEqual(p.calls, []);
});

test('H2: an interrupted or unparsable journal entry fails closed', async () => {
  const p = await makeFakePort();
  await mkdir(journalDir(p.storageDirectory!), { recursive: true });
  await writeFile(join(journalDir(p.storageDirectory!), 'abc.import-intent.1.tmp'), '{');
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'reconciliation-required');
  assert.deepEqual(r.pending, ['abc']);
  assert.deepEqual(p.calls, []);
  await acknowledgeReconciliation(p.storageDirectory!, 'abc');
  assert.equal((await createOfflineProcess(p)()).status, 'completed');
});

// ---------------------------------------------------------------- H3

test('H3: cancel during the pre-create recheck does not create a clip (probe n===3)', async () => {
  const ac = new AbortController();
  const p = await makeFakePort({ onResolve: (n) => void (n === 3 && ac.abort()) });
  const r = await createOfflineProcess(p)(ac.signal);
  assert.equal(creates(p), 0, 'probe: previously createAudioClip was dispatched');
  assert.equal(r.status, 'partial');
  assert.equal(r.reason, 'user-cancel');
  assert.deepEqual(r.effects.map((e) => e.kind), ['imported']);
  assert.deepEqual(await pendingReconciliation(p.storageDirectory!), [], 'known effects: record closed');
});

test('H3: cancel during the pre-import recheck does not import', async () => {
  const ac = new AbortController();
  const p = await makeFakePort({ onResolve: (n) => void (n === 2 && ac.abort()) });
  const r = await createOfflineProcess(p)(ac.signal);
  assert.equal(r.status, 'cancelled');
  untouched(r, p);
});

// ---------------------------------------------------------------- H4

test('H4: an export changed after verification is not imported (probe: one byte during recheck)', async () => {
  const p = await makeFakePort({
    onResolve: async (n, _s, port) => {
      if (n !== 2) return;
      for (const f of await port.exportPaths()) {
        const b = new Uint8Array(await readFile(f));
        b[b.length - 1] = b[b.length - 1]! ^ 0x01;
        await writeFile(f, b);
      }
    },
  });
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'output-changed');
  untouched(r, p);
});

test('H4: unusable import receipts stop before create as unknown outcomes', async (t) => {
  for (const b of ['same-path', 'relative', 'in-temp'] as const) {
    await t.test(b, async () => {
      const p = await makeFakePort({ importBehaviour: b });
      const r = await createOfflineProcess(p)();
      assert.equal(r.status, 'unknown-outcome', r.message);
      assert.equal(r.reason, 'invalid-import-receipt');
      assert.equal(creates(p), 0);
      assert.deepEqual(r.pending, [r.invocation]);
    });
  }
});

test('H4: imported content is read back and must match before a clip is created', async (t) => {
  await t.test('corrupt copy', async () => {
    const p = await makeFakePort({ importBehaviour: 'corrupt-copy' });
    const r = await createOfflineProcess(p)();
    assert.equal(r.status, 'partial');
    assert.equal(r.reason, 'imported-content-mismatch');
    assert.equal(creates(p), 0);
    assert.equal((await createOfflineProcess(p)()).status, 'reconciliation-required');
  });
  await t.test('unreadable copy, required (default)', async () => {
    const p = await makeFakePort({ importBehaviour: 'unreadable' });
    const r = await createOfflineProcess(p)();
    assert.equal(r.reason, 'imported-content-unverified');
    assert.equal(creates(p), 0);
  });
  await t.test("unreadable copy, 'if-readable'", async () => {
    const p = await makeFakePort({ importBehaviour: 'unreadable' });
    const r = await createOfflineProcess(p, { verifyImportedContent: 'if-readable' })();
    assert.equal(r.status, 'completed', r.message);
  });
});

// ---------------------------------------------------------------- H5

test('H5: the engine gets the verified bytes; rewriting the render path later changes nothing', async () => {
  let renderFile = '';
  const p = await makeFakePort({
    editor: async (s) => {
      await writeFile(renderFile, wavBytes(10));
      return JSON.stringify({ envelopeVersion: 1, action: 'process', plan: s.plan });
    },
  });
  const orig = p.renderPreFx.bind(p);
  p.renderPreFx = async (...a) => (renderFile = await orig(...a));
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'completed', r.message);
  const sources = join(p.storageDirectory!, 'aopx-project', 'sources');
  const [stored] = await readdir(sources);
  assert.equal(sha256(new Uint8Array(await readFile(join(sources, stored!)))), p.sourceMediaSha);
});

test('H5: bounded read detects growth and shrinkage during the read, symlinks and the cap', async (t) => {
  const p = await makeFakePort();
  const f = join(p.tempDirectory!, 'probe.wav');
  await t.test('growth', async () => {
    await writeFile(f, wavBytes(1000));
    await assert.rejects(readFileBounded(f, 1e9, { onPrefix: () => appendFile(f, 'xx') }), (e: unknown) => {
      return e instanceof BoundedReadError && e.kind === 'changed';
    });
  });
  await t.test('shrink', async () => {
    await writeFile(f, wavBytes(1000));
    await assert.rejects(readFileBounded(f, 1e9, { onPrefix: () => truncate(f, 100) }), (e: unknown) => e instanceof BoundedReadError && e.kind === 'changed');
  });
  await t.test('symlink', async () => {
    const link = join(p.tempDirectory!, 'link.wav');
    await symlink(f, link).catch(() => t.skip('symlinks unavailable'));
    await assert.rejects(readFileBounded(link, 1e9), (e: unknown) => e instanceof BoundedReadError && e.kind === 'not-regular-file');
  });
  await t.test('cap', async () => {
    await writeFile(f, wavBytes(1000));
    await assert.rejects(readFileBounded(f, 10), (e: unknown) => e instanceof BoundedReadError && e.kind === 'too-large');
  });
});

test('H5: the combined working-set budget refuses before the full read', async () => {
  // 4 beats at 120 BPM, stereo pcm24 at 48 kHz: 576,000 file bytes + 24 x 192,000 samples = about 6.3 MB
  const p = await makeFakePort();
  const r = await createOfflineProcess(p, { admission: { maxWorkingSetBytes: 5_000_000 } })();
  assert.equal(r.reason, 'render-too-large');
  assert.match(r.message ?? '', /memory/);
  untouched(r, p);
});

test('H5: one invocation per process across controllers', async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((r) => (release = r));
  const a = await makeFakePort({ editor: async (s) => (await gate, JSON.stringify({ envelopeVersion: 1, action: 'process', plan: s.plan })) });
  const b = await makeFakePort();
  const first = createOfflineProcess(a)();
  await sleep(20);
  const other = await createOfflineProcess(b)();
  assert.equal(other.status, 'busy');
  assert.deepEqual(b.calls, []);
  release();
  assert.equal((await first).status, 'completed');
});

// ---------------------------------------------------------------- M1

test('M1: a hung progress dialog never blocks the outcome', { timeout: 10_000 }, async (t) => {
  await t.test('success', async () => {
    const p = await makeFakePort({ hangProgress: true });
    const t0 = performance.now();
    const r = await createOfflineProcess(p, { progressDrainMs: 50, progressIntervalMs: 0 })();
    assert.equal(r.status, 'completed', r.message);
    assert.ok(performance.now() - t0 < 5000);
    const next = await createOfflineProcess(p, { progressDrainMs: 50 })();
    assert.notEqual(next.status, 'busy', 'the next invocation is not blocked');
  });
  await t.test('host timeout', async () => {
    const p = await makeFakePort({ hangProgress: true, importBehaviour: 'hang' });
    const r = await createOfflineProcess(p, { progressDrainMs: 50, hostCallTimeoutMs: 30 })();
    assert.equal(r.status, 'unknown-outcome');
  });
  await t.test('cancel', async () => {
    const p = await makeFakePort({ hangProgress: true, editor: () => JSON.stringify({ envelopeVersion: 1, action: 'cancel' }) });
    const r = await createOfflineProcess(p, { progressDrainMs: 50 })();
    assert.equal(r.status, 'cancelled');
  });
});

// ---------------------------------------------------------------- M2

test('M2: drift after a known import is partial with setChanged yes, never "rejected"', async () => {
  const p = await makeFakePort({ onResolve: (n, s) => void (n === 3 && (s.resultOverlapCount = 1)) });
  const r = await createOfflineProcess(p)();
  assert.equal(r.status, 'partial', 'probe: previously rejected/selection-changed with an import');
  assert.equal(r.reason, 'selection-changed');
  assert.equal(r.setChanged, 'yes');
  assert.deepEqual(r.effects.map((e) => e.kind), ['imported']);
  assert.equal(creates(p), 0);
});

// ---------------------------------------------------------------- M3

function riffWith(chunks: Array<[string, Uint8Array]>, riffSizeOverride?: number): Uint8Array {
  const parts: number[] = [];
  const push = (s: string) => parts.push(...[...s].map((c) => c.charCodeAt(0)));
  const u32 = (n: number) => parts.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
  push('RIFF');
  u32(0);
  push('WAVE');
  for (const [id, body] of chunks) {
    push(id);
    u32(body.byteLength);
    parts.push(...body);
    if (body.byteLength & 1) parts.push(0);
  }
  const out = new Uint8Array(parts);
  new DataView(out.buffer).setUint32(4, riffSizeOverride ?? out.byteLength - 8, true);
  return out;
}

function fmtBody(o: { tag?: number; ch?: number; sr?: number; bits?: number; byteRate?: number; blockAlign?: number } = {}): Uint8Array {
  const ch = o.ch ?? 2, sr = o.sr ?? 48000, bits = o.bits ?? 16, ba = o.blockAlign ?? (ch * bits) / 8;
  const b = new Uint8Array(16);
  const v = new DataView(b.buffer);
  v.setUint16(0, o.tag ?? 1, true);
  v.setUint16(2, ch, true);
  v.setUint32(4, sr, true);
  v.setUint32(8, o.byteRate ?? sr * ba, true);
  v.setUint16(12, ba, true);
  v.setUint16(14, bits, true);
  return b;
}

test('M3: strict full-container WAV validation', async (t) => {
  const data = new Uint8Array(40);
  const ok = riffWith([['fmt ', fmtBody()], ['data', data]]);
  assert.equal(validateWavContainer(ok).frames, 10);
  const bad: Record<string, Uint8Array> = {
    'RIFF size declares only 12 bytes (probe)': riffWith([['fmt ', fmtBody()], ['data', data]], 4),
    'RIFF size larger than the file': riffWith([['fmt ', fmtBody()], ['data', data]], ok.byteLength),
    'duplicate data': riffWith([['fmt ', fmtBody()], ['data', data], ['data', data]]),
    'duplicate fmt': riffWith([['fmt ', fmtBody()], ['fmt ', fmtBody()], ['data', data]]),
    'data before fmt': riffWith([['data', data], ['fmt ', fmtBody()]]),
    'byteRate mismatch': riffWith([['fmt ', fmtBody({ byteRate: 1 })], ['data', data]]),
    'blockAlign mismatch': riffWith([['fmt ', fmtBody({ blockAlign: 3, byteRate: 144000 })], ['data', data]]),
    'partial frame': riffWith([['fmt ', fmtBody()], ['data', new Uint8Array(42)]]),
    'missing data': riffWith([['fmt ', fmtBody()]]),
    'unsupported tag': riffWith([['fmt ', fmtBody({ tag: 2 })], ['data', data]]),
    'missing pad byte': ok.slice(0, 0),
  };
  {
    // odd-sized chunk at the end without its pad byte
    const odd = riffWith([['fmt ', fmtBody()], ['data', data], ['LIST', new Uint8Array(3)]]);
    const trimmed = odd.slice(0, odd.byteLength - 1);
    new DataView(trimmed.buffer).setUint32(4, trimmed.byteLength - 8, true);
    bad['missing pad byte'] = trimmed;
  }
  {
    const f = new Uint8Array(16);
    new DataView(f.buffer).setFloat32(4, Number.NaN, true);
    bad['non-finite float'] = riffWith([['fmt ', fmtBody({ tag: 3, bits: 32 })], ['data', f]]);
  }
  for (const [name, bytes] of Object.entries(bad)) {
    await t.test(name, () => {
      assert.throws(() => validateWavContainer(bytes), { name: 'IntegrationError', code: 'render-invalid-wav' });
    });
  }
  await t.test('accepts everything the engine writes, incl. odd data sizes with pad bytes', () => {
    for (const [ch, bits, enc, frames] of [[1, 24, 'pcm', 7], [1, 8, 'pcm', 5], [2, 16, 'pcm', 9], [2, 32, 'float', 4], [1, 64, 'float', 3]] as const) {
      const b = encodeWav(makeMetadata(ch, 44100, bits, enc, frames), new Float64Array(ch * frames).fill(0.25)).bytes;
      assert.equal(validateWavContainer(b).frames, frames);
    }
  });
  await t.test('accepts WAVE_FORMAT_EXTENSIBLE PCM', () => {
    const fmt = new Uint8Array(40);
    fmt.set(fmtBody({ tag: 0xfffe, bits: 24 }));
    const v = new DataView(fmt.buffer);
    v.setUint16(16, 22, true);
    v.setUint16(18, 24, true);
    v.setUint32(20, 3, true);
    fmt.set([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71], 24);
    assert.equal(validateWavContainer(riffWith([['fmt ', fmt], ['data', new Uint8Array(60)]])).frames, 10);
  });
  await t.test('end to end: a render with a wrong RIFF extent is refused before any effect', async () => {
    const p = await makeFakePort({
      renderBytes: (n) => {
        const b = wavBytes(n);
        new DataView(b.buffer, b.byteOffset).setUint32(4, 4, true);
        return b;
      },
    });
    const r = await createOfflineProcess(p)();
    assert.equal(r.reason, 'render-invalid-wav', 'probe: previously admitted and completed');
    untouched(r, p);
  });
});
