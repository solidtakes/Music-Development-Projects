/**
 * Admission of the file `renderPreFxAudio` returns, before the engine sees it.
 *
 * beta.1 renders in Live's Record File Type, which can be AIFF, and the engine reads WAV only.
 * The file is read once, through one descriptor, with size and identity checks (bounded-read.ts).
 * Format, frame count and the memory budget are checked on a prefix before the full allocation,
 * then the complete container is validated strictly (wav-container.ts). The verified bytes are
 * handed to the engine directly, so the path is never read a second time.
 */
import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { readWavMetadata, WavError } from '../../engine/src/wav.ts';
import type { AudioMetadata } from '../../engine/src/contract.ts';
import { BoundedReadError, readFileBounded } from './bounded-read.ts';
import { IntegrationError } from './errors.ts';
import { validateWavContainer } from './wav-container.ts';

export type AudioHeaderKind = 'wav' | 'rf64' | 'aiff' | 'unknown';

const ascii = (b: Uint8Array, at: number, len: number): string => String.fromCharCode(...b.subarray(at, at + len));

/** Classify a file from its first 12 bytes. */
export function classifyAudioHeader(head: Uint8Array): AudioHeaderKind {
  if (head.byteLength < 12) return 'unknown';
  const id = ascii(head, 0, 4);
  const form = ascii(head, 8, 4);
  if (id === 'RIFF' && form === 'WAVE') return 'wav';
  if ((id === 'RF64' || id === 'BW64') && form === 'WAVE') return 'rf64';
  if (id === 'FORM' && (form === 'AIFF' || form === 'AIFC')) return 'aiff';
  return 'unknown';
}

/**
 * Conservative peak memory of one invocation, in bytes, for a WAV of `fileBytes` holding `samples`
 * interleaved samples. It counts what can be alive at once:
 * - file bytes ×3: the admitted render, the encoded output of the current engine step, and the
 *   exported or imported copy being verified;
 * - float64 samples ×3 (8 bytes each): the engine's decoded input, the kernel's output buffer, and
 *   the decoded stored output that the next step consumes.
 * The editor's peak decode happens before the engine render and is covered by the same terms.
 */
export function estimateWorkingSetBytes(fileBytes: number, samples: number): number {
  return 3 * fileBytes + 3 * 8 * samples;
}

export interface RenderAdmissionOptions {
  /** The file must resolve inside this directory (the Extension's tempDirectory). */
  tempRoot: string;
  /** Exact expected frame count for a given sample rate (from the clip's beat range and tempo). */
  expectedFramesFor: (sampleRate: number) => number;
  /** Allowed |actual - expected| in frames. Live's rounding is a native uncertainty (U3). */
  frameTolerance: number;
  /** Hard cap on the file size. */
  maxFileBytes: number;
  /** Hard cap on estimateWorkingSetBytes for this render. */
  maxWorkingSetBytes: number;
  maxChannels: number;
}

export const DEFAULT_RENDER_ADMISSION: Omit<RenderAdmissionOptions, 'tempRoot' | 'expectedFramesFor'> = {
  frameTolerance: 2,
  maxFileBytes: 512 * 1024 * 1024,
  maxWorkingSetBytes: 2 * 1024 * 1024 * 1024,
  maxChannels: 2,
};

export interface AdmittedRender {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  format: AudioMetadata;
}

/** Resolve `file` and require it to lie strictly inside `root` (both canonicalized: 8.3 names, junctions, symlinks). */
export async function resolveInside(root: string, file: string): Promise<string | null> {
  const realRoot = await realpath(resolve(root));
  const realFile = await realpath(resolve(file));
  const rel = relative(realRoot, realFile);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  return realFile;
}

function headerChecks(prefix: Uint8Array, size: number, opts: RenderAdmissionOptions): void {
  const kind = classifyAudioHeader(prefix);
  if (kind === 'aiff') {
    throw new IntegrationError('render-aiff', 'Live rendered AIFF. Set Preferences > Record > File Type to WAV and try again.');
  }
  if (kind === 'rf64') throw new IntegrationError('render-rf64', 'Live rendered an RF64/BW64 file, which Alpha 0.1 does not support.');
  if (kind !== 'wav') throw new IntegrationError('render-unknown-format', 'The rendered file is not a WAV file.');
  let format: AudioMetadata;
  try {
    format = readWavMetadata(prefix, size);
  } catch (e) {
    if (e instanceof WavError) throw new IntegrationError('render-invalid-wav', `The rendered WAV is invalid (${e.code}).`);
    throw e;
  }
  if (format.frames === 0) throw new IntegrationError('render-empty', 'The rendered range contains no audio frames.');
  if (format.channels < 1 || format.channels > opts.maxChannels) {
    throw new IntegrationError('render-channels', `The render has ${format.channels} channels; Alpha 0.1 supports 1 to ${opts.maxChannels}.`);
  }
  const expected = opts.expectedFramesFor(format.sampleRate);
  if (!Number.isFinite(expected) || Math.abs(format.frames - expected) > opts.frameTolerance) {
    throw new IntegrationError(
      'render-frame-mismatch',
      `The render has ${format.frames} frames; the clip range implies ${expected.toFixed(3)} (tolerance ${opts.frameTolerance}).`,
    );
  }
  const need = estimateWorkingSetBytes(size, format.frames * format.channels);
  if (need > opts.maxWorkingSetBytes) {
    throw new IntegrationError('render-too-large', `Processing this render needs about ${need} bytes of memory; the limit is ${opts.maxWorkingSetBytes}.`);
  }
}

export async function admitRenderedFile(path: string, opts: RenderAdmissionOptions): Promise<AdmittedRender> {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) {
    throw new IntegrationError('render-not-regular-file', 'The host did not return a usable render path.');
  }
  const real = await resolveInside(opts.tempRoot, path);
  if (!real) throw new IntegrationError('render-outside-temp', 'The rendered file is not inside the Extension temp directory.');

  let bytes: Uint8Array;
  try {
    // The canonical path is opened (no symlink to follow); prefix checks run before the full read.
    ({ bytes } = await readFileBounded(real, opts.maxFileBytes, { onPrefix: (p, size) => headerChecks(p, size, opts) }));
  } catch (e) {
    if (e instanceof BoundedReadError) {
      const code = e.kind === 'too-large' ? 'render-too-large' : e.kind === 'not-regular-file' ? 'render-not-regular-file' : 'render-changed';
      throw new IntegrationError(code, `Rendered file: ${e.message}`);
    }
    throw e;
  }
  validateWavContainer(bytes);
  // Re-run the header checks on the bytes actually read (the prefix could have been replaced).
  headerChecks(bytes, bytes.byteLength, opts);
  return { path: real, bytes, sha256: createHash('sha256').update(bytes).digest('hex'), format: readWavMetadata(bytes) };
}
