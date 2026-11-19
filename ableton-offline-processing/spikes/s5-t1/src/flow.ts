import { createHash, randomUUID } from 'node:crypto';
import pathModule from 'node:path';
import { decodeWav, encodeWav, readWavMetadata } from '../../../engine/src/wav.ts';
import { reverse, gain } from '../../../engine/src/dsp.ts';
import { validateOutput } from '../../s5-design/fake-host.mjs';
import { consent } from './confirm.ts';
import type { Port, Result, Snapshot } from './port.ts';

export const digest = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
export function admit(s: Snapshot): void {
  if (!s.sourceAudio || !s.sourceMember || !s.targetAudio || s.targetMatches !== 1 ||
      s.targetName !== 'AOPX RESULT' || s.sourceTrack === s.target || s.source === '' ||
      s.tempo !== 120 || !Number.isFinite(s.start) || s.start < 0 ||
      !Number.isFinite(s.end) || s.end - s.start !== 2 || s.sourceDuration !== 2 ||
      s.warped || s.looping || s.muted || s.grouped ||
      s.sourceClips !== 1 || s.sourceSlots !== 0 || s.sourceLanes !== 0 || s.sourceDevices !== 0 ||
      s.targetClips !== 0 || s.targetSlots !== 0 || s.targetLanes !== 0 || s.targetDevices !== 0)
    throw new Error('Admission refused');
}
const same = (a: Snapshot, b: Snapshot): void => {
  admit(b);
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error('Snapshot changed');
};

/** One attempt per controller and per persistent journal, including failed/unknown attempts.
 * No SDK dependency. Timeout is not cancellation: no continuation may schedule another effect.
 */
export function controller(port: Port, options: { enabled?: boolean; timeoutMs?: number } = {}) {
  let busy = false, used = false;
  const timeoutMs = options.timeoutMs ?? 30_000;
  return async (signal: AbortSignal = new AbortController().signal): Promise<Result> => {
    if (!options.enabled) return { status: 'locked', stage: 'activation' };
    if (busy) return { status: 'busy', stage: 'admission' };
    if (used) return { status: 'rejected', stage: 'prior-operation' };
    busy = true;
    const id = randomUUID(); let stage = 'preflight', requested = false;
    const safeLog = (status: string) => {
      try { port.log({ event: 'AOPX_T1', id, stage, status }); } catch { /* no raw error fallback */ }
    };
    const check = () => signal.throwIfAborted();
    const record = async (state: 'intent' | 'ack', details?: Record<string, string | number>) => {
      await port.journal({ schema: 1, id, stage, state, ...(details ? { details } : {}) });
    };
    const bounded = async <T>(fn: () => Promise<T>): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([Promise.resolve().then(fn), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request outcome unknown')), timeoutMs);
      })]); } finally { clearTimeout(timer); }
    };
    try {
      check(); if (await port.hasPriorOperation()) throw new Error('Prior receipt requires reconciliation');
      const baseline = port.snapshot(); admit(baseline);
      stage = 'render';
      const bytes = await port.render(baseline); check(); same(baseline, port.snapshot());
      const input = validateOutput(bytes, { channels: decodeChannels(bytes), sampleRate: 48000, frames: 48000 });
      const decoded = decodeWav(bytes);
      const processed = await gain(await reverse(decoded, { signal }), -3, { signal }); check();
      const output = encodeWav({ ...processed.format, encoding: 'float', bitDepth: 32 }, processed.samples).bytes;
      const meta = validateOutput(output, input); // exact rate/channels/frame count, finite bounded decode
      stage = 'preview'; const nonce = randomUUID();
      if (!consent(await port.confirm({ nonce, frames: meta.frames, channels: meta.channels, hash: meta.sha256 }), nonce))
        return { status: 'cancelled', stage };
      check(); same(baseline, port.snapshot());
      used = true; // Once intent is recorded, this controller never attempts again.
      stage = 'prepare'; await record('intent', { source: baseline.source, target: baseline.target,
        sourceHash: input.sha256, outputHash: meta.sha256, snapshotHash: digest(JSON.stringify(baseline)) });
      const path = await port.exportOwned(id, output, meta.sha256); await record('ack');
      check(); same(baseline, port.snapshot()); await port.verifyOwned(path, meta.sha256);
      stage = 'import'; await record('intent', { ownedPath: path });
      check(); same(baseline, port.snapshot());
      requested = true;
      const imported = await bounded(() => port.importCopy(path));
      if (typeof imported !== 'string' || imported.length === 0 || imported.length > 32768 ||
          imported.includes('\0') || imported === path ||
          !pathModuleAbsolute(imported))
        throw new Error('Invalid imported copy receipt');
      await record('ack', { importedPath: imported });
      check(); same(baseline, port.snapshot());
      stage = 'create'; await record('intent', { target: baseline.target, importedPath: imported });
      check(); same(baseline, port.snapshot());
      const created = await bounded(() => port.createClip(baseline.target, imported, baseline.start));
      await record('ack', { clip: created.id, parent: created.parent, importedPath: imported });
      check(); stage = 'verify';
      if (!created.id || created.id === baseline.source || created.parent !== baseline.target ||
          created.path !== imported || created.warped || created.looping ||
          !Number.isFinite(created.start) || !Number.isFinite(created.end) || created.end <= created.start ||
          Math.abs(created.start - baseline.start) > 1 / 24000 ||
          Math.abs(created.end - baseline.end) > 1 / 24000)
        throw new Error('Returned clip geometry mismatch');
      port.verifyResult(baseline, created);
      stage = 'complete'; await record('ack', { outputHash: meta.sha256 }); safeLog('verified');
      return { status: 'verified', stage, id };
    } catch {
      const status = requested ? 'unknown-outcome' : signal.aborted ? 'cancelled' : 'rejected';
      safeLog(status); return { status, stage, id };
    } finally { busy = false; }
  };
}

function decodeChannels(bytes: Uint8Array): number {
  // Header parser only; allocation is bounded by validateOutput before decode.
  if (bytes.byteLength > 32 * 1024 * 1024) throw new Error('Oversize WAV');
  // readWavMetadata performs structural bounds checks without allocating samples.
  return readWavMetadata(bytes).channels;
}
function pathModuleAbsolute(value: string): boolean {
  return pathModule.posix.isAbsolute(value) || pathModule.win32.isAbsolute(value);
}
