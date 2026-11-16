/**
 * S4 helper: check that a WAV rendered by Live's renderPreFxAudio is readable by the AOPX engine.
 * Read-only: it reads the file you pass and prints its format. It never writes or modifies anything.
 *
 *   node ableton-offline-processing/spikes/s4-wav-check.mts "C:\path\to\copy-of-render.wav" [expectedSeconds]
 */
import { readFile } from 'node:fs/promises';
import { decodeWav, readWavMetadata } from '../engine/src/wav.ts';

const [path, expected] = process.argv.slice(2);
if (!path) {
  console.error('usage: node s4-wav-check.mts <file.wav> [expectedSeconds]');
  process.exit(2);
}
const bytes = await readFile(path);
const head = Buffer.from(bytes.subarray(0, 12));
const report: Record<string, unknown> = {
  path,
  bytes: bytes.byteLength,
  first12Hex: head.toString('hex'),
  first12Ascii: head.toString('latin1').replace(/[^\x20-\x7e]/g, '.'),
};
try {
  const format = readWavMetadata(bytes, bytes.byteLength);
  decodeWav(bytes); // full decode: proves every sample frame is readable
  report['format'] = format;
  report['decodedOk'] = true;
  if (expected !== undefined) {
    const want = Number(expected);
    report['expectedSeconds'] = want;
    report['durationDeltaSeconds'] = Number((format.durationSeconds - want).toFixed(6));
  }
} catch (e) {
  report['decodedOk'] = false;
  report['error'] = `${(e as Error).name}: ${(e as Error).message}`;
}
console.log(JSON.stringify(report, null, 2));
process.exit(report['decodedOk'] ? 0 : 1);
