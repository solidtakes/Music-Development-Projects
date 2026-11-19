import test from 'node:test';
import assert from 'node:assert/strict';
import { livePort } from '../src/live-port.ts';
import { admit, controller } from '../src/flow.ts';
import { encodeWav, makeMetadata } from '../../../engine/src/wav.ts';
import type { Receipt } from '../src/port.ts';

// Narrow in-memory SDK-like objects; no real SDK runtime imported.
class Obj {
  handle: { id: bigint }; parent: Obj | null;
  constructor(handle: { id: bigint }, parent: Obj | null = null) { this.handle = handle; this.parent = parent; }
}
class AudioClip extends Obj {
  filePath = 'C:/PRIVATE/source.wav'; name = 'PRIVATE'; muted = false; warping = false; warpMode = 0;
  looping = false; startTime = 4; endTime = 6; duration = 2; startMarker = 0; endMarker = 2; loopStart = 0; loopEnd = 2;
}
class AudioTrack extends Obj {
  name = 'Source'; mute = false; solo = false; arm = false; groupTrack = null;
  arrangementClips: AudioClip[] = []; clipSlots: { clip: AudioClip | null }[] = [];
  takeLanes: unknown[] = []; devices: unknown[] = []; args: unknown[] = [];
  async createAudioClip(spec: any) {
    this.args.push(spec); const c = new AudioClip({ id: 4n }, this);
    c.filePath = spec.filePath; c.startTime = spec.startTime; c.endTime = spec.startTime + 2;
    this.arrangementClips.push(c); return c;
  }
}
function fixture() {
  const song = Object.assign(new Obj({ id: 0n }), { tempo: 120, tracks: [] as AudioTrack[] });
  const sourceTrack = new AudioTrack({ id: 1n }, song), target = new AudioTrack({ id: 2n }, song);
  target.name = 'AOPX RESULT'; const clip = new AudioClip({ id: 3n }, sourceTrack);
  sourceTrack.arrangementClips.push(clip); song.tracks = [sourceTrack, target]; const calls: string[] = [];
  const context = { application: { song }, getObjectFromHandle: () => clip,
    resources: { importIntoProject: async (p: string) => { calls.push(p); return 'C:/PRIVATE/imported.wav'; } },
    environment: { storageDirectory: undefined, tempDirectory: undefined }, ui: {} };
  const port = livePort(context as any, () => clip.handle, { AudioTrack, AudioClip } as any);
  return { port, song, sourceTrack, target, clip, calls };
}
test('adapter uses only imported returned path, exact target and explicit warp false; omits duration', async () => {
  const f = fixture(), snapshot = f.port.snapshot(); admit(snapshot);
  const path = await f.port.importCopy('C:/PRIVATE/owned.wav');
  const created = await f.port.createClip(snapshot.target, path, snapshot.start);
  f.port.verifyResult(snapshot, created);
  assert.deepEqual(f.target.args, [{ filePath: path, startTime: 4, isWarped: false }]);
  assert.equal(f.sourceTrack.arrangementClips.length, 1); assert.equal(f.clip.filePath, 'C:/PRIVATE/source.wav');
  await assert.rejects(f.port.createClip(snapshot.target, path, snapshot.start));
});
test('adapter refuses missing/duplicate/non-audio result and source outside Arrangement', () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => { f.target.name = 'different'; },
    (f: ReturnType<typeof fixture>) => { f.song.tracks.push(f.target); },
    (f: ReturnType<typeof fixture>) => { f.song.tracks[1] = { ...f.target } as any; },
    (f: ReturnType<typeof fixture>) => { f.clip.parent = new Obj({ id: 5n }); },
  ]) { const f = fixture(); change(f); assert.throws(() => f.port.snapshot()); }
});
test('returned object parent/path/timing and original/target inventory changes are detected', async () => {
  const f = fixture(), before = f.port.snapshot();
  const created = await f.port.createClip(before.target, 'import-copy', before.start);
  f.clip.name = 'changed'; assert.throws(() => f.port.verifyResult(before, created));
  f.clip.name = 'PRIVATE'; f.target.arrangementClips.push(f.clip);
  assert.throws(() => f.port.verifyResult(before, created));
});
test('actual flow/adapter detects result drift across the awaited create-ack journal', async () => {
  for (const patch of [{ filePath: 'C:/PRIVATE/changed.wav' }, { startTime: 100 }, { endTime: 100 },
    { warping: true }, { looping: true }, { parent: new Obj({ id: 999n }) }]) {
    const f = fixture();
    const bytes = encodeWav(makeMetadata(1, 48000, 32, 'float', 48000), new Float64Array(48000)).bytes;
    const port = { ...f.port,
      hasPriorOperation: async () => false,
      render: async () => bytes,
      exportOwned: async () => 'C:/PRIVATE/temp.wav',
      verifyOwned: async () => {},
      confirm: async (p: { nonce: string }) => JSON.stringify({ action: 'import-once', nonce: p.nonce,
        attest: true, phrase: 'IMPORT ONCE TO AOPX RESULT' }),
      journal: async (record: Receipt) => {
        if (record.stage === 'create' && record.state === 'ack') {
          await Promise.resolve(); Object.assign(f.target.arrangementClips[0]!, patch);
        }
      },
      log: () => {},
    };
    const result = await controller(port, { enabled: true })();
    assert.equal(result.status, 'unknown-outcome'); assert.equal(result.stage, 'verify');
    assert.equal(f.target.args.length, 1); assert.equal(f.sourceTrack.arrangementClips.length, 1);
  }
});
