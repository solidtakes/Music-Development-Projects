/**
 * Admission of the file `renderPreFxAudio` returns, before the engine reads it.
 *
 * beta.1 renders in Live's Record File Type, which can be AIFF, and the engine reads WAV only.
 * Everything is checked from the header before the whole file is decoded, and the size is capped
 * so a wrong range cannot exhaust memory (the engine decodes to float64: 8 bytes per sample).
 */
import { createHash } from 'node:crypto';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { readWavMetadata, WavError } from '../../engine/src/wav.ts';
import type { AudioMetadata } from '../../engine/src/contract.ts';
import { IntegrationError } from './errors.ts';

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

export interface RenderAdmissionOptions {
  /** The file must resolve inside this directory (the Extension's tempDirectory). */
  tempRoot: string;
  /** Exact expected frame count for a given sample rate (from the clip's beat range and tempo). */
  expectedFramesFor: (sampleRate: number) => number;
  /** Allowed |actual - expected| in frames. Live's rounding is a native uncertainty (U3). */
  frameTolerance: number;
  /** Hard cap on the file size. */
  maxFileBytes: number;
  /** Hard cap on the decoded float64 size (frames * channels * 8). */
  maxDecodedBytes: number;
  maxChannels: number;
}

export const DEFAULT_RENDER_ADMISSION: Omit<RenderAdmissionOptions, 'tempRoot' | 'expectedFramesFor'> = {
  frameTolerance: 2,
  maxFileBytes: 512 * 1024 * 1024,
  maxDecodedBytes: 2 * 1024 * 1024 * 1024,
  maxChannels: 2,
};

export interface AdmittedRender {
  path: string;
  bytes: Uint8Array;
  sha256: string;
  format: AudioMetadata;
}

async function inside(root: string, file: string): Promise<string> {
  const realRoot = await realpath(resolve(root));
  const realFile = await realpath(resolve(file));
  const rel = relative(realRoot, realFile);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new IntegrationError('render-outside-temp', 'The rendered file is not inside the Extension temp directory.');
  }
  return realFile;
}

export async function admitRenderedFile(path: string, opts: RenderAdmissionOptions): Promise<AdmittedRender> {
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) {
    throw new IntegrationError('render-not-regular-file', 'The host did not return a usable render path.');
  }
  const st = await lstat(path);
  if (!st.isFile()) throw new IntegrationError('render-not-regular-file', 'The rendered path is not a regular file.');
  const real = await inside(opts.tempRoot, path);
  if (st.size > opts.maxFileBytes) {
    throw new IntegrationError('render-too-large', `The rendered file is ${st.size} bytes; the limit is ${opts.maxFileBytes}.`);
  }

  const head = new Uint8Array(12);
  const fh = await open(real, 'r');
  try {
    await fh.read(head, 0, 12, 0);
  } finally {
    await fh.close();
  }
  const kind = classifyAudioHeader(head);
  if (kind === 'aiff') {
    throw new IntegrationError('render-aiff', "Live rendered AIFF. Set Preferences > Record > File Type to WAV and try again.");
  }
  if (kind === 'rf64') throw new IntegrationError('render-rf64', 'Live rendered an RF64/BW64 file, which Alpha 0.1 does not support.');
  if (kind !== 'wav') throw new IntegrationError('render-unknown-format', 'The rendered file is not a WAV file.');

  const bytes = new Uint8Array(await readFile(real));
  if (bytes.byteLength !== st.size) throw new IntegrationError('render-changed', 'The rendered file changed while it was being read.');
  let format: AudioMetadata;
  try {
    format = readWavMetadata(bytes);
  } catch (e) {
    if (e instanceof WavError) throw new IntegrationError('render-invalid-wav', `The rendered WAV is invalid (${e.code}).`);
    throw e;
  }
  if (format.frames === 0) throw new IntegrationError('render-empty', 'The rendered range contains no audio frames.');
  if (format.channels < 1 || format.channels > opts.maxChannels) {
    throw new IntegrationError('render-channels', `The render has ${format.channels} channels; Alpha 0.1 supports 1 to ${opts.maxChannels}.`);
  }
  if (format.frames * format.channels * 8 > opts.maxDecodedBytes) {
    throw new IntegrationError('render-too-large', 'The render would exceed the decoded-memory limit.');
  }
  const expected = opts.expectedFramesFor(format.sampleRate);
  if (!Number.isFinite(expected) || Math.abs(format.frames - expected) > opts.frameTolerance) {
    throw new IntegrationError(
      'render-frame-mismatch',
      `The render has ${format.frames} frames; the clip range implies ${expected.toFixed(3)} (tolerance ${opts.frameTolerance}).`,
    );
  }
  return { path: real, bytes, sha256: createHash('sha256').update(bytes).digest('hex'), format };
}
