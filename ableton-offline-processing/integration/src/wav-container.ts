/**
 * Strict, allocation-free validation of a complete RIFF/WAVE file before the engine decodes it.
 * The engine's header reader deliberately tolerates prefixes and trailing data. Admission must not:
 * the RIFF extent has to match the file, every chunk has to lie inside it with its pad byte, `fmt `
 * and `data` must each appear exactly once (fmt first), the format fields must agree with each other,
 * and float samples must be finite.
 */
import { IntegrationError } from './errors.ts';

const PCM = 0x0001;
const FLOAT = 0x0003;
const EXTENSIBLE = 0xfffe;
/** KSDATAFORMAT_SUBTYPE_{PCM,IEEE_FLOAT} = xxxxxxxx-0000-0010-8000-00AA00389B71, after the 2-byte tag. */
const GUID_TAIL = [0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];

export interface WavContainerInfo {
  encoding: 'pcm' | 'float';
  channels: number;
  sampleRate: number;
  bitDepth: number;
  frames: number;
  dataOffset: number;
  dataBytes: number;
}

function fail(detail: string): never {
  throw new IntegrationError('render-invalid-wav', `The rendered WAV is invalid (${detail}).`);
}

export function validateWavContainer(b: Uint8Array): WavContainerInfo {
  const len = b.byteLength;
  if (len < 12) fail('truncated');
  const dv = new DataView(b.buffer, b.byteOffset, len);
  const id = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  if (id(0) !== 'RIFF' || id(8) !== 'WAVE') fail('not RIFF/WAVE');
  if (dv.getUint32(4, true) + 8 !== len) fail('RIFF size does not match the file length');

  let fmt: { tag: number; channels: number; sampleRate: number; byteRate: number; blockAlign: number; bits: number } | null = null;
  let dataOffset = -1;
  let dataBytes = 0;
  let off = 12;
  while (off < len) {
    if (off + 8 > len) fail('truncated chunk header');
    const cid = id(off);
    const size = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (body + size > len) fail(`chunk '${cid}' extends past the end of the file`);
    if (cid === 'fmt ') {
      if (fmt) fail('duplicate fmt chunk');
      if (dataOffset >= 0) fail('fmt chunk after data');
      if (size < 16) fail('fmt chunk too short');
      let tag = dv.getUint16(body, true);
      const bits = dv.getUint16(body + 14, true);
      if (tag === EXTENSIBLE) {
        if (size < 40 || dv.getUint16(body + 16, true) < 22) fail('short WAVE_FORMAT_EXTENSIBLE');
        if (dv.getUint16(body + 18, true) !== bits) fail('EXTENSIBLE valid bits differ from container bits');
        for (let i = 0; i < GUID_TAIL.length; i++) if (b[body + 26 + i] !== GUID_TAIL[i]) fail('unknown EXTENSIBLE subformat');
        tag = dv.getUint16(body + 24, true);
      }
      fmt = {
        tag,
        channels: dv.getUint16(body + 2, true),
        sampleRate: dv.getUint32(body + 4, true),
        byteRate: dv.getUint32(body + 8, true),
        blockAlign: dv.getUint16(body + 12, true),
        bits,
      };
    } else if (cid === 'data') {
      if (dataOffset >= 0) fail('duplicate data chunk');
      if (!fmt) fail('data chunk before fmt');
      dataOffset = body;
      dataBytes = size;
    }
    off = body + size + (size & 1);
    if (off > len) fail(`chunk '${cid}' is missing its pad byte`);
  }
  if (!fmt) fail('missing fmt chunk');
  if (dataOffset < 0) fail('missing data chunk');

  const { tag, channels, sampleRate, byteRate, blockAlign, bits } = fmt;
  let encoding: 'pcm' | 'float';
  if (tag === PCM && [8, 16, 24, 32].includes(bits)) encoding = 'pcm';
  else if (tag === FLOAT && (bits === 32 || bits === 64)) encoding = 'float';
  else fail(`unsupported format tag ${tag} / ${bits} bits`);
  if (channels < 1) fail('zero channels');
  if (sampleRate < 1) fail('zero sample rate');
  if (blockAlign !== (channels * bits) / 8) fail('blockAlign does not match channels and bits');
  if (byteRate !== sampleRate * blockAlign) fail('byteRate does not match sampleRate and blockAlign');
  if (dataBytes % blockAlign !== 0) fail('data size is not a whole number of frames');

  if (encoding === 'float') {
    const step = bits / 8;
    for (let o = dataOffset; o < dataOffset + dataBytes; o += step) {
      const v = bits === 32 ? dv.getFloat32(o, true) : dv.getFloat64(o, true);
      if (!Number.isFinite(v)) fail('non-finite float sample');
    }
  }
  return { encoding, channels, sampleRate, bitDepth: bits, frames: dataBytes / blockAlign, dataOffset, dataBytes };
}
