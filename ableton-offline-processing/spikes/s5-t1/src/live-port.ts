import type { ExtensionContext, Handle, AudioTrack, AudioClip } from '@ableton-extensions/sdk';
import { ownedFiles, ownedRoot, readOwned } from './files.ts';
import { confirmationHtml } from './confirm.ts';
import type { Created, Port, Snapshot } from './port.ts';

type V = '1.0.0';
// Runtime class constructors are supplied only by extension.ts; tests supply mock SDK classes.
export function livePort(context: ExtensionContext<V>, getArgument: () => unknown,
  classes: { AudioTrack: typeof AudioTrack; AudioClip: typeof AudioClip }): Port {
  const id = (x: { handle: Handle }) => String(x.handle.id);
  function objects() {
    const arg = getArgument();
    if (!arg || typeof arg !== 'object' || !('id' in arg) || typeof arg.id !== 'bigint')
      throw new Error('AudioClip handle required');
    const song = context.application.song;
    const source = context.getObjectFromHandle(arg as Handle, classes.AudioClip);
    const sourceTrack = source.parent;
    if (!(sourceTrack instanceof classes.AudioTrack)) throw new Error('Arrangement AudioTrack required');
    const matches = song.tracks.filter(t => t.name === 'AOPX RESULT');
    const target = matches[0];
    if (!(target instanceof classes.AudioTrack) || matches.length !== 1) throw new Error('Unique audio result track required');
    return { song, source, sourceTrack, target, matches };
  }
  function snapshot(): Snapshot {
    const { song, source, sourceTrack: t, target: r, matches } = objects();
    const members = song.tracks.filter(x => id(x) === id(t));
    const originalState = JSON.stringify({ path: source.filePath, name: source.name, muted: source.muted,
      start: source.startTime, end: source.endTime, duration: source.duration,
      startMarker: source.startMarker, endMarker: source.endMarker, loopStart: source.loopStart,
      loopEnd: source.loopEnd, warped: source.warping, warpMode: source.warpMode,
      looping: source.looping, trackName: t.name, trackMute: t.mute, trackSolo: t.solo,
      trackArm: t.arm, resultMute: r.mute, resultSolo: r.solo, resultArm: r.arm });
    return { song: id(song), source: id(source), sourceTrack: id(t), target: id(r),
      sourcePath: source.filePath, tempo: song.tempo, start: source.startTime, end: source.endTime,
      sourceDuration: source.duration, sourceAudio: source instanceof classes.AudioClip,
      sourceMember: members.length === 1 && t.arrangementClips.some(c => id(c) === id(source)),
      targetAudio: r instanceof classes.AudioTrack, targetName: r.name, targetMatches: matches.length,
      sourceClips: t.arrangementClips.length, sourceSlots: t.clipSlots.filter(s => s.clip !== null).length,
      sourceLanes: t.takeLanes.length, sourceDevices: t.devices.length,
      targetClips: r.arrangementClips.length, targetSlots: r.clipSlots.filter(s => s.clip !== null).length,
      targetLanes: r.takeLanes.length, targetDevices: r.devices.length,
      grouped: t.groupTrack !== null || r.groupTrack !== null,
      warped: source.warping, looping: source.looping, muted: source.muted, originalState };
  }
  function describe(c: AudioClip<V>): Created {
    if (!c.parent) throw new Error('Missing returned parent');
    return { id: id(c), parent: id(c.parent), path: c.filePath, start: c.startTime,
      end: c.endTime, warped: c.warping, looping: c.looping };
  }
  const files = ownedFiles(() => context.environment.tempDirectory, () => context.environment.storageDirectory);
  return {
    snapshot, ...files,
    async render(s) {
      const { sourceTrack } = objects(); if (id(sourceTrack) !== s.sourceTrack) throw new Error('Track changed');
      const root = await ownedRoot(context.environment.tempDirectory);
      const file = await context.resources.renderPreFxAudio(sourceTrack, s.start, s.end);
      return readOwned(root, file);
    },
    confirm: p => context.ui.showModalDialog(`data:text/html;base64,${Buffer.from(confirmationHtml(p.nonce)).toString('base64')}`, 720, 600),
    importCopy: path => context.resources.importIntoProject(path),
    async createClip(targetId, path, start) {
      const { target } = objects(); if (id(target) !== targetId || target.arrangementClips.length !== 0)
        throw new Error('Target changed');
      // Deliberately omit duration: natural length of exactly 48,000 frames at 120 BPM.
      // Verify returned end time after acknowledgment; native rounding remains a trial observation.
      const clip = await target.createAudioClip({ filePath: path, startTime: start, isWarped: false });
      return describe(clip);
    },
    verifyResult(baseline, c) {
      const now = snapshot(); const { target } = objects();
      const clips = target.arrangementClips;
      if (clips.length !== 1 || !(clips[0] instanceof classes.AudioClip) || id(clips[0]) !== c.id)
        throw new Error('Unexpected result inventory');
      // Re-read after the asynchronous create-ack journal. The returned descriptor can
      // be stale even while the result's identity/count remains unchanged.
      const current = describe(clips[0]);
      for (const key of ['id', 'parent', 'path', 'start', 'end', 'warped', 'looping'] as const) {
        if (current[key] !== c[key]) throw new Error('Result changed after acknowledgment');
      }
      now.targetClips = 0;
      if (JSON.stringify(now) !== JSON.stringify(baseline)) throw new Error('State changed');
    },
    log: event => console.log(JSON.stringify(event)), // no SDK errors, paths, names, or raw snapshots
  };
}
