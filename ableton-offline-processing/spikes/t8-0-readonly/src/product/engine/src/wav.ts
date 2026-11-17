/**
 * Minimal, dependency-free RIFF/WAVE reader and writer.
 *
 * Supported input:
 *   - WAVE_FORMAT_PCM (1): 8-bit unsigned, 16/24/32-bit signed little-endian.
 *   - WAVE_FORMAT_IEEE_FLOAT (3): 32/64-bit little-endian.
 *   - WAVE_FORMAT_EXTENSIBLE (0xFFFE) whose sub-format GUID is PCM or IEEE float.
 * Unsupported (rejected with WavError): compressed formats (ADPCM, mu-law, A-law, MP3, ...),
 * RF64/BW64 (>4 GiB), big-endian RIFX, non-finite float samples.
 *
 * Internal representation: interleaved Float64Array, one value per sample, in frame order
 * (frame 0 ch 0, frame 0 ch 1, ...). PCM is normalised by 2^(bits-1) so integer -> float64 -> integer
 * round-trips are lossless.
 *
 * Output: plain WAVE_FORMAT_PCM / WAVE_FORMAT_IEEE_FLOAT files with no metadata chunks and no
 * timestamps, so identical audio always produces identical bytes (required for content addressing).
 */
import type { AudioMetadata } from './contract.ts';

export interface DecodedAudio {
  format: AudioMetadata;
  /** Interleaved samples, length === frames * channels. */
  samples: Float64Array;
}

export interface EncodeResult {
  bytes: Uint8Array;
  /** Samples that exceeded the representable range and were saturated (PCM only). */
  clippedSamples: number;
}

export type WavErrorCode =
  | 'not-riff'
  | 'not-wave'
  | 'truncated'
  | 'missing-fmt'
  | 'missing-data'
  | 'unsupported-format'
  | 'invalid-format'
  | 'non-finite-sample';

export class WavError extends Error {
  readonly code: WavErrorCode;
  constructor(code: WavErrorCode, message: string) {
    super(message);
    this.name = 'WavError';
    this.code = code;
  }
}

const FORMAT_PCM = 0x0001;
const FORMAT_FLOAT = 0x0003;
const FORMAT_EXTENSIBLE = 0xfffe;
/** Shared tail of the KSDATAFORMAT_SUBTYPE_* GUIDs: 00000000-0010-0080-00AA-00389B71. */
const GUID_TAIL = [0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];

export const SUPPORTED_FORMATS: ReadonlyArray<{ encoding: AudioMetadata['encoding']; bitDepth: number }> = [
  { encoding: 'pcm', bitDepth: 8 },
  { encoding: 'pcm', bitDepth: 16 },
  { encoding: 'pcm', bitDepth: 24 },
  { encoding: 'pcm', bitDepth: 32 },
  { encoding: 'float', bitDepth: 32 },
  { encoding: 'float', bitDepth: 64 },
];

export function isSupportedFormat(encoding: string, bitDepth: number): boolean {
  return SUPPORTED_FORMATS.some((f) => f.encoding === encoding && f.bitDepth === bitDepth);
}

function fourcc(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function makeMetadata(
  channels: number,
  sampleRate: number,
  bitDepth: number,
  encoding: AudioMetadata['encoding'],
  frames: number,
): AudioMetadata {
  return { channels, sampleRate, bitDepth, frames, durationSeconds: frames / sampleRate, encoding };
}

/**
 * Parse only the header and return metadata, without decoding samples.
 * `input` may be a prefix of the file (e.g. its first 4 KiB) if `fileLength` gives the full length;
 * the data chunk is then bounds-checked against `fileLength`.
 */
export function readWavMetadata(input: Uint8Array, fileLength: number = input.byteLength): AudioMetadata {
  return parseHeader(input, fileLength).format;
}

interface ParsedHeader {
  format: AudioMetadata;
  dataOffset: number;
  dataBytes: number;
}

function parseHeader(input: Uint8Array, fileLength: number = input.byteLength): ParsedHeader {
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (input.byteLength < 12) throw new WavError('truncated', 'File is shorter than a RIFF header.');
  const riff = fourcc(view, 0);
  if (riff === 'RF64' || riff === 'BW64') throw new WavError('unsupported-format', `${riff} (>4 GiB WAV) is not supported.`);
  if (riff === 'RIFX') throw new WavError('unsupported-format', 'Big-endian RIFX is not supported.');
  if (riff !== 'RIFF') throw new WavError('not-riff', 'Missing RIFF signature.');
  if (fourcc(view, 8) !== 'WAVE') throw new WavError('not-wave', 'RIFF form type is not WAVE.');

  let offset = 12;
  let fmt: { tag: number; channels: number; sampleRate: number; blockAlign: number; bits: number } | null = null;
  let data: { offset: number; bytes: number } | null = null;

  while (offset + 8 <= input.byteLength) {
    const id = fourcc(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + size > input.byteLength) throw new WavError('truncated', 'fmt chunk is truncated.');
      let tag = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      const sampleRate = view.getUint32(body + 4, true);
      const blockAlign = view.getUint16(body + 12, true);
      const bits = view.getUint16(body + 14, true);
      if (tag === FORMAT_EXTENSIBLE) {
        if (size < 40) throw new WavError('invalid-format', 'WAVE_FORMAT_EXTENSIBLE fmt chunk is too short.');
        const sub = view.getUint16(body + 24, true);
        for (let i = 0; i < GUID_TAIL.length; i++) {
          if (view.getUint8(body + 26 + i) !== GUID_TAIL[i]) {
            throw new WavError('unsupported-format', 'Unknown WAVE_FORMAT_EXTENSIBLE sub-format GUID.');
          }
        }
        tag = sub;
      }
      fmt = { tag, channels, sampleRate, blockAlign, bits };
    } else if (id === 'data') {
      if (body + size > fileLength) {
        throw new WavError('truncated', `data chunk declares ${size} bytes but only ${fileLength - body} are present.`);
      }
      data = { offset: body, bytes: size };
      break; // samples found; trailing chunks are ignored
    }
    offset = body + size + (size & 1); // RIFF chunks are word aligned
  }

  if (!fmt) throw new WavError('missing-fmt', 'No fmt chunk found.');
  if (!data) throw new WavError('missing-data', 'No data chunk found (file may be truncated).');

  let encoding: AudioMetadata['encoding'];
  if (fmt.tag === FORMAT_PCM) encoding = 'pcm';
  else if (fmt.tag === FORMAT_FLOAT) encoding = 'float';
  else throw new WavError('unsupported-format', `Unsupported WAV format tag 0x${fmt.tag.toString(16)}.`);

  if (!isSupportedFormat(encoding, fmt.bits)) {
    throw new WavError('unsupported-format', `Unsupported ${encoding} bit depth ${fmt.bits}.`);
  }
  if (fmt.channels < 1) throw new WavError('invalid-format', 'Channel count must be >= 1.');
  if (fmt.sampleRate < 1) throw new WavError('invalid-format', 'Sample rate must be >= 1.');
  const expectedAlign = fmt.channels * (fmt.bits / 8);
  if (fmt.blockAlign !== expectedAlign) {
    throw new WavError('invalid-format', `blockAlign ${fmt.blockAlign} does not match ${expectedAlign}.`);
  }
  if (data.bytes % fmt.blockAlign !== 0) {
    throw new WavError('truncated', `data size ${data.bytes} is not a whole number of ${fmt.blockAlign}-byte frames.`);
  }
  const frames = data.bytes / fmt.blockAlign;
  return {
    format: makeMetadata(fmt.channels, fmt.sampleRate, fmt.bits, encoding, frames),
    dataOffset: data.offset,
    dataBytes: data.bytes,
  };
}

export function decodeWav(input: Uint8Array): DecodedAudio {
  const header = parseHeader(input);
  const { format } = header;
  const count = format.frames * format.channels;
  const samples = new Float64Array(count);
  const view = new DataView(input.buffer, input.byteOffset + header.dataOffset, header.dataBytes);
  switch (`${format.encoding}${format.bitDepth}`) {
    case 'pcm8':
      for (let i = 0; i < count; i++) samples[i] = (view.getUint8(i) - 128) / 128;
      break;
    case 'pcm16':
      for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
      break;
    case 'pcm24':
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        let v = view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getUint8(o + 2) << 16);
        if (v & 0x800000) v -= 0x1000000;
        samples[i] = v / 8388608;
      }
      break;
    case 'pcm32':
      for (let i = 0; i < count; i++) samples[i] = view.getInt32(i * 4, true) / 2147483648;
      break;
    case 'float32':
      for (let i = 0; i < count; i++) samples[i] = view.getFloat32(i * 4, true);
      break;
    case 'float64':
      for (let i = 0; i < count; i++) samples[i] = view.getFloat64(i * 8, true);
      break;
    default:
      throw new WavError('unsupported-format', `Unsupported format ${format.encoding}/${format.bitDepth}.`);
  }
  if (format.encoding === 'float') {
    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(samples[i]!)) {
        throw new WavError('non-finite-sample', `Non-finite float sample at index ${i}.`);
      }
    }
  }
  return { format, samples };
}

/**
 * Encode interleaved float samples. `format.frames` must match `samples.length / channels`.
 *
 * Quantisation (PCM): round-half-up of x * 2^(bits-1), then saturate to
 * [-2^(bits-1), 2^(bits-1) - 1]. Each saturated sample increments `clippedSamples`. No dither.
 * Float: written as-is (float32 rounds to nearest); values beyond +/-1.0 are preserved, not clipped.
 */
export function encodeWav(format: AudioMetadata, samples: Float64Array): EncodeResult {
  const { channels, sampleRate, bitDepth, encoding } = format;
  if (!isSupportedFormat(encoding, bitDepth)) {
    throw new WavError('unsupported-format', `Cannot encode ${encoding}/${bitDepth}.`);
  }
  if (samples.length % channels !== 0) throw new WavError('invalid-format', 'Sample count is not a multiple of channels.');
  const frames = samples.length / channels;
  if (frames !== format.frames) throw new WavError('invalid-format', `Format declares ${format.frames} frames, got ${frames}.`);

  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  if (dataBytes > 0xffffffff - 64) throw new WavError('unsupported-format', 'Output exceeds 4 GiB WAV limit.');
  const isFloat = encoding === 'float';
  const fmtSize = isFloat ? 18 : 16;
  const factSize = isFloat ? 12 : 0;
  const headerBytes = 12 + 8 + fmtSize + factSize + 8;
  const out = new Uint8Array(headerBytes + dataBytes + (dataBytes & 1));
  const view = new DataView(out.buffer);

  const writeId = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeId(0, 'RIFF');
  view.setUint32(4, out.byteLength - 8, true);
  writeId(8, 'WAVE');
  let o = 12;
  writeId(o, 'fmt ');
  view.setUint32(o + 4, fmtSize, true);
  view.setUint16(o + 8, isFloat ? FORMAT_FLOAT : FORMAT_PCM, true);
  view.setUint16(o + 10, channels, true);
  view.setUint32(o + 12, sampleRate, true);
  view.setUint32(o + 16, sampleRate * blockAlign, true);
  view.setUint16(o + 20, blockAlign, true);
  view.setUint16(o + 22, bitDepth, true);
  if (isFloat) view.setUint16(o + 24, 0, true); // cbSize
  o += 8 + fmtSize;
  if (isFloat) {
    writeId(o, 'fact');
    view.setUint32(o + 4, 4, true);
    view.setUint32(o + 8, frames, true);
    o += factSize;
  }
  writeId(o, 'data');
  view.setUint32(o + 4, dataBytes, true);
  o += 8;

  let clipped = 0;
  const count = samples.length;
  const d = new DataView(out.buffer, o, dataBytes);
  if (isFloat) {
    if (bitDepth === 32) for (let i = 0; i < count; i++) d.setFloat32(i * 4, samples[i]!, true);
    else for (let i = 0; i < count; i++) d.setFloat64(i * 8, samples[i]!, true);
  } else {
    const scale = 2 ** (bitDepth - 1);
    const max = scale - 1;
    const min = -scale;
    for (let i = 0; i < count; i++) {
      const x = samples[i]!;
      let v = Math.floor(x * scale + 0.5);
      if (v > max) { v = max; clipped++; }
      else if (v < min) { v = min; clipped++; }
      else if (Number.isNaN(v)) { v = 0; clipped++; }
      switch (bitDepth) {
        case 8: d.setUint8(i, v + 128); break;
        case 16: d.setInt16(i * 2, v, true); break;
        case 24: {
          const u = v & 0xffffff;
          d.setUint8(i * 3, u & 0xff);
          d.setUint8(i * 3 + 1, (u >> 8) & 0xff);
          d.setUint8(i * 3 + 2, (u >> 16) & 0xff);
          break;
        }
        case 32: d.setInt32(i * 4, v, true); break;
      }
    }
  }
  return { bytes: out, clippedSamples: clipped };
}
