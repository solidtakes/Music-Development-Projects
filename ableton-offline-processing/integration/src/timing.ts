/**
 * Beat/second/frame conversion at a constant tempo. One beat lasts 60 / tempo seconds, so
 * seconds = beats * 60 / tempo and beats = seconds * tempo / 60. (At 120 BPM one second is two
 * beats. A community recipe gets this backwards; see the plan's evidence section.)
 */
function finite(name: string, v: number): void {
  if (!Number.isFinite(v)) throw new RangeError(`${name} must be finite, got ${v}.`);
}

function tempoOk(tempo: number): void {
  finite('tempo', tempo);
  if (tempo <= 0) throw new RangeError(`tempo must be positive, got ${tempo}.`);
}

export function beatsToSeconds(beats: number, tempo: number): number {
  finite('beats', beats);
  tempoOk(tempo);
  return (beats * 60) / tempo;
}

export function secondsToBeats(seconds: number, tempo: number): number {
  finite('seconds', seconds);
  tempoOk(tempo);
  return (seconds * tempo) / 60;
}

/** Exact (generally non-integer) frame count of [startBeat, endBeat) at a constant tempo. */
export function expectedFrames(startBeat: number, endBeat: number, tempo: number, sampleRate: number): number {
  finite('sampleRate', sampleRate);
  if (sampleRate <= 0) throw new RangeError(`sampleRate must be positive, got ${sampleRate}.`);
  if (!(endBeat > startBeat)) throw new RangeError(`endBeat ${endBeat} must be after startBeat ${startBeat}.`);
  return beatsToSeconds(endBeat - startBeat, tempo) * sampleRate;
}

/** Beat tolerance equivalent to `frames` frames, for checking clip geometry returned by Live. */
export function frameToleranceInBeats(frames: number, sampleRate: number, tempo: number): number {
  return secondsToBeats(frames / sampleRate, tempo);
}
