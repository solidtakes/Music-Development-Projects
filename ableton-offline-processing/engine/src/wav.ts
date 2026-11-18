import { setImmediate } from 'node:timers/promises';
import type { AudioMetadata, WaveformPeak } from './contract.ts';

export interface Wav {
  format: AudioMetadata;
  data: Buffer;
  sampleBytes: number;
  frameBytes: number;
}

const CLASSIC_SUBFORMAT_TAIL = '00001000800000aa00389b71';
export const FRAMES_PER_BATCH = 16_384;

/** Parse classic little-endian RIFF WAV, including common extensible mono/stereo files. */
export function parseWav(file: Buffer): Wav {
  if (file.length < 12 || file.toString('latin1', 0, 4) !== 'RIFF' || file.toString('latin1', 8, 12) !== 'WAVE') {
    throw new Error('Expected a little-endian RIFF WAV file');
  }
  const end = 8 + file.readUInt32LE(4);
  if (end > file.length || end < 12) throw new Error('Invalid RIFF length');

  let formatChunk: Buffer | undefined;
  let data: Buffer | undefined;
  for (let cursor = 12; cursor < end;) {
    if (cursor + 8 > end) throw new Error('Truncated WAV chunk header');
    const id = file.toString('latin1', cursor, cursor + 4);
    const size = file.readUInt32LE(cursor + 4);
    const start = cursor + 8;
    cursor = start + size + (size % 2);
    if (cursor > end) throw new Error('Truncated WAV chunk');
    if (id === 'fmt ') {
      if (formatChunk) throw new Error('Multiple WAV format chunks');
      formatChunk = file.subarray(start, start + size);
    } else if (id === 'data') {
      if (data) throw new Error('Multiple WAV data chunks');
      data = file.subarray(start, start + size);
    }
  }

  if (!formatChunk || formatChunk.length < 16 || !data) throw new Error('Missing WAV format or sample data');
  let code = formatChunk.readUInt16LE(0);
  const channels = formatChunk.readUInt16LE(2);
  const sampleRate = formatChunk.readUInt32LE(4);
  const byteRate = formatChunk.readUInt32LE(8);
  const frameBytes = formatChunk.readUInt16LE(12);
  const bitDepth = formatChunk.readUInt16LE(14);
  if (channels !== 1 && channels !== 2) throw new Error('Only mono and stereo WAV files are supported');
  if (code === 0xfffe) {
    if (formatChunk.length < 40 || formatChunk.readUInt16LE(16) < 22 ||
        18 + formatChunk.readUInt16LE(16) > formatChunk.length ||
        formatChunk.readUInt16LE(18) !== bitDepth ||
        formatChunk.toString('hex', 28, 40) !== CLASSIC_SUBFORMAT_TAIL) {
      throw new Error('Unsupported extensible WAV format');
    }
    const channelMask = formatChunk.readUInt32LE(20);
    if (channelMask !== 0 && channelMask !== (channels === 1 ? 4 : 3)) {
      throw new Error('Unsupported extensible WAV channel mask');
    }
    code = formatChunk.readUInt32LE(24);
  }

  const pcm = code === 1 && [8, 16, 24, 32].includes(bitDepth);
  const float = code === 3 && [32, 64].includes(bitDepth);
  if (!pcm && !float) throw new Error('Only PCM 8/16/24/32-bit and IEEE float 32/64-bit WAV are supported');
  const sampleBytes = bitDepth / 8;
  if (!sampleRate || frameBytes !== channels * sampleBytes ||
      byteRate !== sampleRate * frameBytes || data.length % frameBytes !== 0) {
    throw new Error('Invalid WAV frame layout');
  }
  const frames = data.length / frameBytes;
  const format: AudioMetadata = {
    channels, sampleRate, bitDepth, frames, durationSeconds: frames / sampleRate,
    encoding: pcm ? 'pcm' : 'float',
  };
  return { format, data, sampleBytes, frameBytes };
}

/** Allocate a standard WAV container for a render with the specified sample format. */
export function makeWav(format: AudioMetadata): Wav & { file: Buffer } {
  const floatingPoint = format.encoding === 'float';
  const sampleBytes = format.bitDepth / 8;
  const frameBytes = sampleBytes * format.channels;
  const dataBytes = format.frames * frameBytes;
  const dataOffset = floatingPoint ? 58 : 44;
  const file = Buffer.alloc(dataOffset + dataBytes + (dataBytes % 2));
  file.write('RIFF', 0);
  file.writeUInt32LE(file.length - 8, 4);
  file.write('WAVEfmt ', 8);
  file.writeUInt32LE(floatingPoint ? 18 : 16, 16);
  file.writeUInt16LE(floatingPoint ? 3 : 1, 20);
  file.writeUInt16LE(format.channels, 22);
  file.writeUInt32LE(format.sampleRate, 24);
  file.writeUInt32LE(format.sampleRate * frameBytes, 28);
  file.writeUInt16LE(frameBytes, 32);
  file.writeUInt16LE(format.bitDepth, 34);
  if (floatingPoint) {
    file.write('fact', 38);
    file.writeUInt32LE(4, 42);
    file.writeUInt32LE(format.frames, 46);
  }
  file.write('data', dataOffset - 8);
  file.writeUInt32LE(dataBytes, dataOffset - 4);
  return { format, file, data: file.subarray(dataOffset, dataOffset + dataBytes), sampleBytes, frameBytes };
}

export function readSample(wav: Wav, offset: number): number {
  if (wav.format.encoding === 'float') {
    const sample = wav.sampleBytes === 4 ? wav.data.readFloatLE(offset) : wav.data.readDoubleLE(offset);
    if (!Number.isFinite(sample)) throw new Error('WAV contains a non-finite float sample');
    return sample;
  }
  if (wav.sampleBytes === 1) return (wav.data[offset] - 128) / 128;
  const scale = 2 ** (wav.format.bitDepth - 1);
  return wav.data.readIntLE(offset, wav.sampleBytes) / scale;
}

export function writeSample(wav: Wav, offset: number, sample: number): void {
  if (wav.format.encoding === 'float') {
    if (wav.sampleBytes === 4) {
      if (!Number.isFinite(Math.fround(sample))) throw new Error('Gain exceeds the finite float32 range');
      wav.data.writeFloatLE(sample, offset);
    } else {
      if (!Number.isFinite(sample)) throw new Error('Gain exceeds the finite float64 range');
      wav.data.writeDoubleLE(sample, offset);
    }
    return;
  }
  const scale = 2 ** (wav.format.bitDepth - 1);
  const integer = Math.max(-scale, Math.min(scale - 1, Math.round(sample * scale)));
  if (wav.sampleBytes === 1) {
    wav.data[offset] = integer + 128;
  } else {
    wav.data.writeIntLE(integer, offset, wav.sampleBytes);
  }
}

export async function waveformPeaks(wav: Wav, columns: number): Promise<WaveformPeak[]> {
  if (!Number.isInteger(columns) || columns < 1 || columns > 8192) {
    throw new RangeError('Waveform column count must be an integer from 1 to 8192');
  }
  const peaks: WaveformPeak[] = [];
  for (let column = 0; column < columns; column++) {
    const start = Math.floor(column / columns * wav.format.frames);
    const end = Math.floor((column + 1) / columns * wav.format.frames);
    let min = Infinity;
    let max = -Infinity;
    for (let frame = start; frame < end; frame++) {
      if (frame % FRAMES_PER_BATCH === 0) await setImmediate();
      for (let channel = 0; channel < wav.format.channels; channel++) {
        const sample = readSample(wav, frame * wav.frameBytes + channel * wav.sampleBytes);
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }
    }
    peaks.push(start === end ? { min: 0, max: 0 } : { min, max });
  }
  return peaks;
}
