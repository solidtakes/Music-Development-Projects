import test from 'node:test';
import assert from 'node:assert/strict';
import { controller, digest } from '../src/flow.ts';
import { consent, confirmationHtml } from '../src/confirm.ts';
import { validateOutput } from '../../s5-design/fake-host.mjs';
import { encodeWav, makeMetadata, decodeWav } from '../../../engine/src/wav.ts';
import type { Port, Receipt, Snapshot, Created } from '../src/port.ts';

export function fixture(channels = 1): Uint8Array {
  const format = makeMetadata(channels, 48000, 32, 'float', 48000);
  const samples = Float64Array.from({ length: 48000 * channels }, (_, i) => (i % 17 - 8) / 16);
  return encodeWav(format, samples).bytes;
}
export class FakeHost implements Port {
  state: Snapshot = { song: 'song-1', source: 'source-1', sourceTrack: 'track-1', target: 'track-2',
    sourcePath: 'C:/PRIVATE/source.wav', tempo: 120, start: 4, end: 6, sourceDuration: 2,
    sourceAudio: true, sourceMember: true, targetAudio: true, targetName: 'AOPX RESULT', targetMatches: 1,
    originalState: 'private-original-snapshot', sourceClips: 1, sourceSlots: 0, sourceLanes: 0,
    sourceDevices: 0, targetClips: 0, targetSlots: 0, targetLanes: 0, targetDevices: 0,
    grouped: false, warped: false, looping: false, muted: false };
  bytes = fixture(); records: Receipt[] = []; calls: string[] = []; logs: unknown[] = [];
  exported: Uint8Array | undefined; imported = 'C:/PRIVATE/project/copy.wav'; created: Created[] = [];
  fault = ''; cancelAt = ''; driftAt = ''; ackLoss = ''; controller = new AbortController();
  async point(name: string) {
    this.calls.push(name);
    if (this.driftAt === name) this.state.originalState = 'changed';
    if (this.cancelAt === name) this.controller.abort();
    if (this.fault === name) throw new Error('C:/PRIVATE/SECRET source user-name');
  }
  snapshot() { return structuredClone(this.state); }
  async hasPriorOperation() { await this.point('prior'); return this.records.length > 0; }
  async render() { await this.point('render'); return this.bytes.slice(); }
  async confirm(p: { nonce: string }) {
    await this.point('confirm');
    return JSON.stringify({ action: 'import-once', nonce: p.nonce, attest: true, phrase: 'IMPORT ONCE TO AOPX RESULT' });
  }
  async journal(record: Receipt) { await this.point(`journal:${record.stage}:${record.state}`); this.records.push(record); }
  async exportOwned(_id: string, bytes: Uint8Array) { await this.point('export'); this.exported = bytes.slice(); return 'C:/PRIVATE/temp/output.wav'; }
  async verifyOwned(_path: string, hash: string) { await this.point('verify-owned'); assert.equal(digest(this.exported!), hash); }
  async importCopy() { await this.point('import'); if (this.ackLoss === 'import') return new Promise<string>(() => {}); return this.imported; }
  async createClip(target: string, path: string, start: number) {
    await this.point('create');
    const c = { id: 'created-1', parent: target, path, start, end: start + 2, warped: false, looping: false };
    this.created.push(c);
    if (this.ackLoss === 'create') return new Promise<Created>(() => {});
    return c;
  }
  verifyResult() { this.calls.push('verify-result'); if (this.fault === 'verify-result') throw new Error('private failure'); }
  log(x: unknown) { this.logs.push(x); }
}
const run = (h: FakeHost) => controller(h, { enabled: true, timeoutMs: 20 })(h.controller.signal);

test('closed build gate calls no host methods at all', async () => {
  const h = new FakeHost(); assert.equal((await controller(h)()).status, 'locked'); assert.deepEqual(h.calls, []);
});
test('controlled success: original byte/state invariant, exact Reverse/Gain, one import and create', async () => {
  for (const channels of [1, 2]) {
    const h = new FakeHost(); h.bytes = fixture(channels); const before = h.snapshot(), hash = digest(h.bytes);
    assert.equal((await run(h)).status, 'verified');
    assert.deepEqual(h.snapshot(), before); assert.equal(digest(h.bytes), hash);
    assert.equal(h.calls.filter(x => x === 'import').length, 1); assert.equal(h.calls.filter(x => x === 'create').length, 1);
    assert.equal(h.created[0]!.path, h.imported);
    const input = decodeWav(h.bytes), out = decodeWav(h.exported!); const factor = 10 ** (-3 / 20);
    for (const frame of [0, 11, 47999]) for (let ch = 0; ch < channels; ch++)
      assert.ok(Math.abs(out.samples[frame * channels + ch]! - input.samples[(47999 - frame) * channels + ch]! * factor) < 1e-7);
    assert.deepEqual(h.records.filter(x => x.state === 'intent').map(x => x.stage), ['prepare', 'import', 'create']);
  }
});
test('Gemini missing expected metadata yields policy errors, including a valid WAV', () => {
  const bytes = fixture();
  for (const expected of [undefined, null, [], 'bad', 1])
    assert.throws(() => validateOutput(bytes, expected), e => e instanceof Error && !(e instanceof TypeError) && /metadata/.test(e.message));
});
for (const [key, value] of Object.entries({ tempo: 121, start: -1, end: 7, sourceDuration: 1,
  sourceAudio: false, sourceMember: false, targetAudio: false, targetMatches: 2, targetName: 'Wrong',
  sourceClips: 2, sourceSlots: 1, sourceLanes: 1, sourceDevices: 1,
  targetClips: 1, targetSlots: 1, targetLanes: 1, targetDevices: 1,
  grouped: true, warped: true, looping: true, muted: true, target: 'track-1' })) {
  test(`admission rejects ${key} before render/export/import`, async () => {
    const h = new FakeHost(); Object.assign(h.state, { [key]: value });
    assert.equal((await run(h)).status, 'rejected'); assert.deepEqual(h.calls, ['prior']);
  });
}
test('malformed, oversize, nonfinite, wrong rate/frame-count WAVs stop before import', async () => {
  const good = fixture(); const wrongRate = good.slice(); new DataView(wrongRate.buffer).setUint32(24, 44100, true);
  const nan = good.slice(); new DataView(nan.buffer).setFloat32(nan.length - 4, NaN, true);
  const wrongFrames = encodeWav(makeMetadata(1, 48000, 16, 'pcm', 47999), new Float64Array(47999)).bytes;
  for (const bytes of [new Uint8Array(4), new Uint8Array(32 * 1024 * 1024 + 1), wrongRate, nan, wrongFrames]) {
    const h = new FakeHost(); h.bytes = bytes; assert.equal((await run(h)).status, 'rejected');
    assert.ok(!h.calls.includes('import')); assert.ok(!h.calls.includes('export'));
  }
});
for (const point of ['render', 'confirm', 'export', 'verify-owned', 'journal:prepare:intent',
  'journal:import:intent', 'import', 'journal:import:ack', 'journal:create:intent', 'create',
  'journal:create:ack', 'verify-result', 'journal:complete:ack']) {
  test(`failure ${point}: no automatic retry/delete/Undo; private errors stay private`, async () => {
    const h = new FakeHost(); h.fault = point; const result = await run(h);
    const requested = h.calls.includes('import');
    assert.equal(result.status, requested ? 'unknown-outcome' : 'rejected');
    assert.ok(h.calls.filter(x => x === 'import').length <= 1); assert.ok(h.calls.filter(x => x === 'create').length <= 1);
    assert.doesNotMatch(JSON.stringify([result, h.logs]), /PRIVATE|SECRET|source\.wav|user-name/);
    assert.ok(!h.calls.some(x => /delete|undo|retry/i.test(x)));
  });
}
for (const point of ['render', 'confirm', 'export', 'verify-owned', 'import', 'create']) {
  test(`cancel at ${point} schedules no later mutation`, async () => {
    const h = new FakeHost(); h.cancelAt = point; const result = await run(h);
    assert.equal(result.status, h.calls.includes('import') ? 'unknown-outcome' : 'cancelled');
    if (point !== 'create') assert.ok(!h.calls.includes('create'));
  });
}
for (const point of ['render', 'confirm', 'export', 'verify-owned', 'import']) {
  test(`source drift at ${point} stops before next mutation`, async () => {
    const h = new FakeHost(); h.driftAt = point;
    assert.notEqual((await run(h)).status, 'verified'); assert.ok(!h.calls.includes('create'));
  });
}
test('lost import ack and late callback cannot schedule create or retry after timeout', async () => {
  const h = new FakeHost(); let settle!: (s: string) => void;
  h.importCopy = async () => { h.calls.push('import'); return new Promise<string>(r => { settle = r; }); };
  const invoke = controller(h, { enabled: true, timeoutMs: 5 });
  assert.equal((await invoke()).status, 'unknown-outcome'); settle('C:/PRIVATE/late.wav');
  await new Promise(r => setImmediate(r)); assert.ok(!h.calls.includes('create'));
  assert.equal((await invoke()).status, 'rejected');
  assert.equal((await controller(h, { enabled: true })()).status, 'rejected'); // restart reads persistent intents
});
test('lost clip ack preserves possible partial clip and blocks subsequent calls', async () => {
  const h = new FakeHost(); h.ackLoss = 'create';
  assert.equal((await run(h)).status, 'unknown-outcome'); assert.equal(h.created.length, 1);
  assert.equal((await controller(h, { enabled: true })()).status, 'rejected');
});
test('returned clip identity, path, parent, nonfinite or drifted geometry fail verification', async () => {
  for (const patch of [{ id: '' }, { id: 'source-1' }, { path: 'wrong' }, { parent: 'wrong' },
    { start: NaN }, { end: Infinity }, { end: 5 }, { warped: true }, { looping: true }]) {
    const h = new FakeHost(); const create = h.createClip.bind(h);
    h.createClip = async (...args) => ({ ...await create(...args), ...patch });
    assert.equal((await run(h)).status, 'unknown-outcome');
    assert.equal(h.created.length, 1); // possible effect retained; no automatic compensation
  }
});
test('invalid import receipt path stops before creating a clip', async () => {
  for (const receipt of ['', 'relative.wav', 'bad\0name', 'C:/PRIVATE/temp/output.wav']) {
    const h = new FakeHost(); h.imported = receipt;
    assert.equal((await run(h)).status, 'unknown-outcome'); assert.ok(!h.calls.includes('create'));
  }
});
test('export tamper during import-intent journal is detected before the import request', async () => {
  const h = new FakeHost(); const journal = h.journal.bind(h);
  h.journal = async record => {
    await journal(record);
    if (record.stage === 'import' && record.state === 'intent') h.exported![h.exported!.length - 1] ^= 1;
  };
  assert.equal((await run(h)).status, 'rejected');
  assert.ok(!h.calls.includes('import')); assert.ok(!h.calls.includes('create'));
  assert.ok(h.records.some(x => x.stage === 'import' && x.state === 'intent'));
});
test('duplicate clicks are busy, then consumed; cancel preview is a new opt-in opportunity', async () => {
  const h = new FakeHost(); let finish!: (s: string) => void; let nonce = '';
  h.confirm = async p => { nonce = p.nonce; return new Promise(r => { finish = r; }); };
  const invoke = controller(h, { enabled: true }); const first = invoke();
  await new Promise(r => setImmediate(r)); assert.equal((await invoke()).status, 'busy');
  finish(JSON.stringify({ action: 'import-once', nonce, attest: true, phrase: 'IMPORT ONCE TO AOPX RESULT' }));
  assert.equal((await first).status, 'verified'); assert.equal((await invoke()).status, 'rejected');
});
test('strict confirmation rejects cancel, stale nonce, missing attest, extra keys, invalid payload', () => {
  const nonce = '12345678-1234-1234-1234-123456789012';
  const good = { action: 'import-once', nonce, attest: true, phrase: 'IMPORT ONCE TO AOPX RESULT' };
  assert.ok(consent(JSON.stringify(good), nonce));
  for (const x of [null, '', '{}', 'null', '[]', JSON.stringify({ ...good, nonce: 'stale' }),
    JSON.stringify({ ...good, attest: false }), JSON.stringify({ ...good, extra: true }), 'x'.repeat(3000)])
    assert.equal(consent(x, nonce), false);
  assert.match(confirmationHtml(nonce), /disabled/); assert.throws(() => confirmationHtml('<script>'));
});
