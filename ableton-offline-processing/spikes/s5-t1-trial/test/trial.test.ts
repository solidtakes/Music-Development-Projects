import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { controlledTrial } from '../src/trial.ts';
import { trialConsent, trialHtml, type Preview } from '../src/consent.ts';
import { CONTROLLED_TRIAL_PROFILE as PROFILE, OWNER_SOURCE } from '../src/profile.ts';
import { encodeWav, makeMetadata, decodeWav } from '../../../engine/src/wav.ts';
import type { Port, Snapshot, Receipt } from '../../s5-t1/src/port.ts';

function approved(nonce: string) {
  return { action: 'import-once', approvedArtifact: true, attest: true, nonce,
    phrase: PROFILE.phrase, sourceBytes: OWNER_SOURCE.bytes, sourceSha256: OWNER_SOURCE.sha256 };
}
function fake() {
  const state: Snapshot = { song: 'song', source: 'clip', sourceTrack: 'source-track', target: 'result',
    sourcePath: '/PRIVATE/source.wav', tempo: 120, start: 4, end: 6, sourceDuration: 2,
    sourceAudio: true, sourceMember: true, targetAudio: true, targetName: 'AOPX RESULT', targetMatches: 1,
    originalState: 'original', sourceClips: 1, sourceSlots: 0, sourceLanes: 0, sourceDevices: 0,
    targetClips: 0, targetSlots: 0, targetLanes: 0, targetDevices: 0,
    grouped: false, warped: false, looping: false, muted: false };
  let bytes = encodeWav(makeMetadata(1, 48000, 32, 'float', 48000),
    Float64Array.from({ length: 48000 }, (_, i) => (i % 17 - 8) / 16)).bytes;
  const calls: string[] = [], records: Receipt[] = [], logs: unknown[] = [];
  let output: Uint8Array | undefined;
  const port: Port = {
    snapshot: () => structuredClone(state), hasPriorOperation: async () => records.length > 0,
    render: async () => { calls.push('render'); return bytes; },
    confirm: async () => { throw new Error('Base consent must never be used'); },
    journal: async r => { records.push(r); },
    exportOwned: async (_id, b) => { calls.push('export'); output = b; return '/temp/out.wav'; },
    verifyOwned: async () => {},
    importCopy: async () => { calls.push('import'); return '/project/copy.wav'; },
    createClip: async (target, path, start) => {
      calls.push('create'); return { id: 'new', parent: target, path, start, end: start + 2, warped: false, looping: false };
    },
    verifyResult: () => {}, log: x => { logs.push(x); },
  };
  return { port, state, calls, records, logs, get output() { return output; },
    setBytes(b: Uint8Array) { bytes = b; } };
}
test('profile enables separate controller only; complete consent gives one import/create and no replay', async () => {
  assert.equal(PROFILE.enabled, true); assert.ok(Object.isFrozen(PROFILE)); assert.ok(Object.isFrozen(OWNER_SOURCE));
  const f = fake(), before = structuredClone(f.state);
  const invoke = controlledTrial(f.port, async p => JSON.stringify(approved(p.nonce)));
  assert.equal((await invoke()).status, 'verified');
  assert.deepEqual(f.calls, ['render', 'export', 'import', 'create']); assert.deepEqual(f.state, before);
  assert.equal(decodeWav(f.output!).format.frames, 48000);
  assert.equal((await invoke()).status, 'rejected');
  assert.equal((await controlledTrial(f.port, async p => JSON.stringify(approved(p.nonce)))()).status, 'rejected');
});
test('invalid/provenance/approval consent never schedules export or host mutation', async () => {
  const variants = [undefined, null, '{}', '[]', 'null', 'x'.repeat(4097)];
  for (const change of [{ approvedArtifact: false }, { attest: false }, { nonce: 'old' }, { phrase: 'IMPORT ONCE TO AOPX RESULT' },
    { sourceSha256: 'a'.repeat(64) }, { sourceBytes: 192044 }, { extra: true }]) {
    const f = fake();
    const r = await controlledTrial(f.port, async p => JSON.stringify({ ...approved(p.nonce), ...change }))();
    assert.equal(r.status, 'cancelled'); assert.deepEqual(f.calls, ['render']); assert.equal(f.records.length, 0);
  }
  for (const value of variants) {
    const f = fake(); assert.equal((await controlledTrial(f.port, async () => value)()).status, 'cancelled');
    assert.deepEqual(f.calls, ['render']);
  }
});
test('trial-specific 32-bit mono policy refuses other renders before confirmation or import', async () => {
  for (const [channels, rate, bits, frames] of [[2,48000,32,48000], [1,44100,32,48000],
    [1,48000,16,48000], [1,48000,32,47999]]) {
    const f = fake(); f.setBytes(encodeWav(makeMetadata(channels!,rate!,bits!,'pcm',frames!),
      new Float64Array(channels! * frames!)).bytes);
    let asked = false;
    const r = await controlledTrial(f.port, async () => { asked = true; return null; })();
    assert.equal(r.status, 'rejected'); assert.equal(asked, false); assert.deepEqual(f.calls, ['render']);
  }
});
test('original media hash is explicit attestation, not incorrectly compared with rendered container hash', async () => {
  const f = fake();
  // Synthetic fixture deliberately is not owner media and has no matching original hash.
  let preview: Preview | undefined;
  const r = await controlledTrial(f.port, async p => { preview = p; return JSON.stringify(approved(p.nonce)); })();
  assert.equal(r.status, 'verified'); assert.notEqual(preview!.hash, OWNER_SOURCE.sha256);
  assert.doesNotMatch(JSON.stringify(f.logs), /PRIVATE|source\.wav|c897d44b/i);
});
test('HTML starts closed and requires every field before emitting Windows bridge consent', () => {
  const nonce = randomUUID(), html = trialHtml({ nonce, frames: 48000, channels: 1, hash: 'a'.repeat(64) });
  assert.match(html, /NOT AUTHORIZED FOR LIVE/); assert.match(html, /button id="go" disabled/);
  const elements: Record<string, any> = Object.fromEntries(['approved','attest','source','phrase','go','cancel']
    .map(id => [id, { checked: false, value: '', disabled: id === 'go' }]));
  const sent: any[] = [];
  const script = html.match(/<script>([\s\S]*)<\/script>/)![1]!;
  vm.runInNewContext(script, { document: { getElementById: (id: string) => elements[id] },
    window: { chrome: { webview: { postMessage: (x: any) => sent.push(x) } } } });
  elements.go.onclick(); assert.equal(sent.length, 0);
  elements.approved.checked = true; elements.attest.checked = true; elements.phrase.value = PROFILE.phrase;
  elements.phrase.oninput(); assert.equal(elements.go.disabled, true);
  elements.source.value = OWNER_SOURCE.sha256; elements.source.oninput(); assert.equal(elements.go.disabled, false);
  elements.go.onclick(); elements.go.onclick(); assert.equal(sent.length, 1);
  assert.ok(trialConsent(sent[0].params[0], nonce));
  assert.throws(() => trialHtml({ nonce: '</script>', frames: 48000, channels: 1, hash: 'a'.repeat(64) }));
});
test('source drift, receipt failure and interrupted import preserve unknown outcome/no second effect', async () => {
  for (const fault of ['drift', 'receipt', 'cancel']) {
    const f = fake(), abort = new AbortController(); const originalImport = f.port.importCopy;
    f.port.importCopy = async p => {
      const result = await originalImport(p);
      if (fault === 'drift') f.state.originalState = 'changed';
      if (fault === 'cancel') abort.abort();
      return result;
    };
    if (fault === 'receipt') f.port.journal = async r => {
      f.records.push(r); if (r.stage === 'import' && r.state === 'ack') throw new Error('/PRIVATE/receipt');
    };
    const r = await controlledTrial(f.port, async p => JSON.stringify(approved(p.nonce)))(abort.signal);
    assert.equal(r.status, 'unknown-outcome'); assert.ok(!f.calls.includes('create'));
    assert.doesNotMatch(JSON.stringify([r,f.logs]), /PRIVATE/);
  }
});
