/** Investigation fixture only. No SDK, filesystem, network, or injectable host port. */
import { createHash } from 'node:crypto';
import { decodeWav, readWavMetadata } from '../../engine/src/wav.ts';

export const STAGES = ['preflight', 'validate', 'export', 'import', 'track', 'clip', 'verify', 'commit'];
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => structuredClone(value);
const fingerprint = value => hash(JSON.stringify(value));

// Policy proposal, intentionally narrower than the engine's supported WAV formats.
export function validateOutput(bytes, expected) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 32 * 1024 * 1024)
    throw new Error('WAV byte limit/type');
  const meta = readWavMetadata(bytes);
  if (![1, 2].includes(meta.channels) || meta.sampleRate < 8000 || meta.sampleRate > 192000 ||
      meta.frames < 1 || meta.frames * meta.channels > 16_000_000 ||
      meta.durationSeconds > 600) throw new Error('WAV decoded allocation/duration limit');
  for (const key of ['channels', 'sampleRate', 'frames']) {
    if (meta[key] !== expected[key]) throw new Error(`WAV changed ${key}`);
  }
  decodeWav(bytes); // Full bounded decode rejects malformed/non-finite samples.
  return { ...meta, sha256: hash(bytes) };
}

export class FakeHost {
  constructor() {
    this.original = { clip: 'original-clip', track: 'original-track', start: 4,
      duration: 2, sourceHash: hash('synthetic-source'), generation: 1 };
    this.files = new Map();
    this.tracks = [];
    this.journal = [];
    this.calls = [];
  }
  snapshot() {
    return copy({ original: this.original, files: [...this.files], tracks: this.tracks,
      journal: this.journal, calls: this.calls });
  }
  static restart(snapshot) {
    const host = new FakeHost();
    Object.assign(host, copy(snapshot));
    host.files = new Map(snapshot.files);
    return host;
  }
  fakeImport(id, bytes) {
    const path = `project-copy:${id}`;
    this.files.set(path, { owner: 'host', sha256: hash(bytes) });
    this.calls.push('import');
    return path;
  }
  fakeTrack(id) {
    const track = { id: `track:${id}`, owner: id, clips: [] };
    this.tracks.push(track);
    this.calls.push('track');
    return track;
  }
  fakeClip(track, receipt, id, original) {
    const clip = { id: `clip:${id}`, file: receipt.path, owner: id,
      start: original.start, duration: original.duration, warped: false };
    track.clips.push(clip);
    this.calls.push('clip');
    return clip;
  }
}

/**
 * Memory-only sequence, not an adapter implementation. Effects deliberately survive errors.
 * after:<stage> models an effect with a lost acknowledgment (including process interruption).
 * cancelAt is checked after settling that stage: it cannot cancel an in-flight host request.
 */
export function investigate({ bytes, expected, optIn = true, fault, cancelAt, driftAt,
  corruptAtVerify, id = 'trial-1' } = {}) {
  const host = new FakeHost(); // Never accepts a real or externally supplied host.
  const before = host.snapshot();
  const source = copy(host.original);
  let stage = 'preflight';
  let metadata, temp, receipt, track, clip;
  try {
    for (stage of STAGES) {
      host.journal.push({ id, stage, state: 'intent' });
      if (fault === `before:${stage}`) throw new Error('injected failure before effect');
      if (driftAt === stage) host.original.generation++;
      if (fingerprint(host.original) !== fingerprint(source)) throw new Error('source changed; stop');
      switch (stage) {
        case 'preflight':
          if (!optIn) throw new Error('no opt-in');
          break;
        case 'validate': metadata = validateOutput(bytes, expected); break;
        case 'export':
          temp = `temp:${id}`;
          host.files.set(temp, { owner: id, sha256: metadata.sha256 });
          break;
        case 'import': receipt = { path: host.fakeImport(id, bytes), sha256: metadata.sha256 }; break;
        case 'track': track = host.fakeTrack(id); break;
        case 'clip': clip = host.fakeClip(track, receipt, id, source); break;
        case 'verify':
          if (corruptAtVerify === 'path') clip.file = 'unrelated-project-copy';
          if (corruptAtVerify === 'timing') clip.duration++;
          if (corruptAtVerify === 'media-hash') host.files.get(clip.file).sha256 = hash('wrong bytes');
          if (corruptAtVerify === 'extra-clip') track.clips.push({ id: 'unexpected' });
          if (clip.file !== receipt.path || host.files.get(clip.file)?.sha256 !== metadata.sha256 ||
              clip.start !== source.start || clip.duration !== source.duration || track.clips.length !== 1)
            throw new Error('verification mismatch');
          break;
        case 'commit': break; // An in-memory receipt, not a Live or durable commit.
      }
      if (fault === `after:${stage}`) throw new Error('effect acknowledgment lost');
      host.journal.push({ id, stage, state: 'ack' });
      if (cancelAt === stage) throw new Error('cancel requested after settling effect');
    }
    return { status: 'model-complete', host, before, receipt };
  } catch (error) {
    return { status: 'stopped-reconcile', stage, reason: error.message, host, before };
  }
}

/** Read-only reconciliation proposal: never replay, delete, or assume undo after restart. */
export function recoveryReport(host) {
  const last = host.journal.at(-1);
  return { action: 'manual-reconciliation-only', replayAllowed: false,
    uncertain: last?.state === 'intent',
    modelReceiptComplete: last?.stage === 'commit' && last?.state === 'ack',
    original: copy(host.original), tracks: copy(host.tracks),
    retainedFiles: [...host.files.keys()] };
}
