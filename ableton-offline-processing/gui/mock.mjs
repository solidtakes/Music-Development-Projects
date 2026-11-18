const durationSeconds = 8;
const sampleRate = 48000;

/** @type {import('./types.d.ts').EditorSession} */
export const mockSession = {
  mode: 'mock',
  source: {
    name: 'Mock Drum Loop.wav',
    fingerprint: '',
    bytes: 0,
    format: {
      encoding: 'pcm',
      sampleRate,
      durationSeconds,
      frames: durationSeconds * sampleRate,
      channels: 2,
      bitDepth: 24,
    },
  },
  operations: [
    { id: 'mock-reverse', type: 'reverse', enabled: true },
    { id: 'mock-gain', type: 'gain', enabled: true, db: -3 },
  ],
  waveform: Array.from({ length: 448 }, (_, index) => {
    const decay = Math.exp(-5 * (index % 28) / 28);
    const accent = Math.floor(index / 28) % 4 === 0 ? 1 : 0.67;
    const amplitude = (0.1 + 0.8 * decay * accent) * (0.6 + 0.4 * Math.sin(index * 2.38) ** 2);
    return { min: -amplitude * (0.65 + 0.3 * Math.sin(index * 0.21) ** 2), max: amplitude };
  }),
};
