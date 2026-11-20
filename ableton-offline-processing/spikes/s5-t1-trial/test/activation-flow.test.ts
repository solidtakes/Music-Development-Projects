import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtemp, mkdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { encodeWav, makeMetadata } from '../../../engine/src/wav.ts';
import { OWNER_SOURCE, CONTROLLED_TRIAL_PROFILE as PROFILE } from '../src/profile.ts';

test('actual trial activation/adapter with mock SDK: invalid consent has zero effects, valid consent is one-shot', async () => {
  const sdkUrl = new URL('../../s5-t1/ci/runtime-sdk.mjs', import.meta.url).href;
  const hook = registerHooks({ resolve(s,c,next) {
    return s === '@ableton-extensions/sdk' ? { url: sdkUrl, shortCircuit: true } : next(s,c);
  } });
  const sdk = await import('../../s5-t1/ci/runtime-sdk.mjs');
  // Windows runners may supply an 8.3 TEMP alias. Use a canonical synthetic path so
  // this test reaches consent instead of intentionally strict owned-root admission.
  const temp = await realpath(await mkdtemp(path.join(os.tmpdir(), 'aopx-controlled-mock-')));
  const storage = path.join(temp, 'storage'); await mkdir(storage);
  const wav = path.join(temp, 'synthetic-render.wav');
  await writeFile(wav, encodeWav(makeMetadata(1,48000,32,'float',48000),new Float64Array(48000).fill(.25)).bytes);
  const song: any = { handle: { id: 0n }, tempo: 120, tracks: [] };
  const track = (id: bigint, name: string) => Object.assign(new sdk.AudioTrack(), {
    handle: { id }, parent: song, name, mute: false, solo: false, arm: false,
    groupTrack: null, arrangementClips: [] as any[], clipSlots: [], takeLanes: [], devices: [],
  });
  const source: any = track(1n,'PRIVATE SOURCE'), target: any = track(2n,'AOPX RESULT');
  const clip: any = Object.assign(new sdk.AudioClip(), { handle: { id: 3n }, parent: source,
    name: 'PRIVATE CLIP', filePath: '/PRIVATE/source.wav', startTime: 4, endTime: 6, duration: 2,
    startMarker: 0, endMarker: 2, loopStart: 0, loopEnd: 2, muted: false, warping: false, warpMode: 0, looping: false });
  source.arrangementClips.push(clip); song.tracks = [source,target];
  const effects: string[] = [], calls: string[] = [], logs: string[] = [];
  let cmd!: (...args: unknown[])=>void, invalid = true;
  target.createAudioClip = async (spec: any) => {
    effects.push('create'); assert.deepEqual(Object.keys(spec).sort(),['filePath','isWarped','startTime']);
    assert.equal(spec.filePath, '/project/returned-copy.wav'); assert.equal(spec.isWarped,false);
    const result = Object.assign(new sdk.AudioClip(), { handle: { id: 4n }, parent: target,
      filePath: spec.filePath, startTime: spec.startTime, endTime: spec.startTime+2, warping: false, looping: false });
    target.arrangementClips.push(result); return result;
  };
  (globalThis as any).__t1Mock = { calls, context: {
    application: { song }, environment: { tempDirectory: temp, storageDirectory: storage },
    getObjectFromHandle: () => clip,
    resources: { renderPreFxAudio: async () => { calls.push('render'); return wav; },
      importIntoProject: async () => { effects.push('import'); return '/project/returned-copy.wav'; } },
    commands: { registerCommand: (_: string, cb: typeof cmd) => { cmd=cb; calls.push('register'); } },
    ui: { registerContextMenuAction: async () => async () => {}, showModalDialog: async (url: string) => {
      const html = Buffer.from(url.split(',')[1]!, 'base64').toString('utf8');
      const nonce = html.match(/nonce:'([^']+)'/)![1]!;
      return JSON.stringify({ action:'import-once',approvedArtifact:!invalid,attest:true,nonce,
        phrase:PROFILE.phrase,sourceBytes:OWNER_SOURCE.bytes,sourceSha256:OWNER_SOURCE.sha256 });
    } },
  } };
  const old = console.log; console.log = x => logs.push(String(x));
  async function invoke() {
    const count = logs.length; cmd({ id: 3n, confirmed: true, enabled: true });
    for(let i=0;i<200 && logs.length===count;i++) await new Promise(r=>setTimeout(r,5));
    assert.ok(logs.length>count,'command settled'); await new Promise(r=>setImmediate(r));
    return JSON.parse(logs.at(-1)!).status;
  }
  try {
    const entry = await import('../src/extension.ts'); entry.activate({} as any);
    assert.deepEqual(effects,[]); assert.ok(!calls.includes('render'));
    assert.equal(await invoke(),'cancelled'); assert.deepEqual(effects,[]);
    invalid=false; assert.equal(await invoke(),'verified'); assert.deepEqual(effects,['import','create']);
    assert.equal(await invoke(),'rejected'); assert.deepEqual(effects,['import','create']);
    assert.equal(source.arrangementClips.length,1); assert.equal(clip.filePath,'/PRIVATE/source.wav');
    assert.doesNotMatch(logs.join('\n'), /PRIVATE|source\.wav/);
  } finally { console.log=old; hook.deregister(); delete (globalThis as any).__t1Mock; }
});
