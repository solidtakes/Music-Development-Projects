import { readFile, writeFile } from 'node:fs/promises';
import { makeWav, parseWav, readSample, writeSample } from '../src/wav.ts';

export function fixtureWav(
  frames: number[][],
  { channels = frames[0]?.length ?? 1, encoding = 'pcm', bitDepth = 16, sampleRate = 48_000 }:
    { channels?: number; encoding?: 'pcm' | 'float'; bitDepth?: number; sampleRate?: number } = {},
) {
  const wav = makeWav({
    channels, bitDepth, encoding, sampleRate, frames: frames.length, durationSeconds: frames.length / sampleRate,
  });
  for (const [frame, samples] of frames.entries()) {
    for (const [channel, sample] of samples.entries()) {
      writeSample(wav, frame * wav.frameBytes + channel * wav.sampleBytes, sample);
    }
  }
  return wav.file;
}

export async function readFixture(path: string) {
  const wav = parseWav(await readFile(path));
  const frames = Array.from({ length: wav.format.frames }, (_, frame) =>
    Array.from({ length: wav.format.channels }, (_, channel) =>
      readSample(wav, frame * wav.frameBytes + channel * wav.sampleBytes),
    ),
  );
  return { format: wav.format, frames };
}

export async function writeSignalFixture(path: string, seconds: number) {
  const sampleRate = 48_000;
  const frames = seconds * sampleRate;
  const wav = makeWav({
    channels: 2, encoding: 'pcm', bitDepth: 24, sampleRate, frames, durationSeconds: seconds,
  });
  for (let frame = 0; frame < frames; frame++) {
    const time = frame / sampleRate;
    const offset = frame * wav.frameBytes;
    const envelope = 0.2 + 0.7 * frame / frames;
    writeSample(wav, offset, Math.sin(time * 220 * 2 * Math.PI) * envelope);
    writeSample(wav, offset + wav.sampleBytes, Math.sin(time * 327 * 2 * Math.PI) * envelope);
  }
  await writeFile(path, wav.file, { flag: 'wx' });
}
