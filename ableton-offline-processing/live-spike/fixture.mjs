import { writeFile } from "node:fs/promises";

export function makeFixture() {
  const sampleRate = 48000;
  const frames = 2 * sampleRate;
  const bytes = Buffer.alloc(44 + frames * 4);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 4, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(frames * 4, 40);

  function burst(start, end, channel, cycles, amplitude) {
    for (let frame = start; frame < end; frame++) {
      const phase = (frame - start) / (end - start);
      const sample = amplitude * Math.sin(phase * Math.PI * 2 * cycles) * Math.sin(phase * Math.PI);
      bytes.writeInt16LE(Math.round(sample), 44 + frame * 4 + channel * 2);
    }
  }
  burst(12000, 36000, 0, 110, 8192);
  burst(48000, 72000, 1, 165, 4096);
  return bytes;
}

if (import.meta.main) {
  const path = process.argv[2];
  if (!path) throw new Error("Pass a new output WAV path.");
  await writeFile(path, makeFixture(), { flag: "wx" });
}
