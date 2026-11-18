import { setImmediate } from 'node:timers/promises';
import { FRAMES_PER_BATCH, makeWav, readSample, writeSample } from './wav.ts';
import type { Operation } from './contract.ts';
import type { Wav } from './wav.ts';

export interface ProcessorContext {
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
}

/** A processor's output-affecting state must be explicit and serializable. */
export interface ProcessorAdapter<Spec> {
  version: number;
  cacheIdentity: (operation: Spec) => readonly (string | number | boolean)[];
  process: (input: Wav, operation: Spec, context: ProcessorContext) => Promise<Buffer>;
}

type Reverse = Extract<Operation, { type: 'reverse' }>;
type Gain = Extract<Operation, { type: 'gain' }>;

const reverse: ProcessorAdapter<Reverse> = {
  version: 1,
  cacheIdentity: () => [],
  async process(input, _operation, context) {
    const output = makeWav(input.format);
    for (let frame = 0; frame < input.format.frames; frame++) {
      if (frame % FRAMES_PER_BATCH === 0) await checkpoint(frame, input, context);
      const from = (input.format.frames - 1 - frame) * input.frameBytes;
      input.data.copy(output.data, frame * input.frameBytes, from, from + input.frameBytes);
    }
    return output.file;
  },
};

const gain: ProcessorAdapter<Gain> = {
  version: 1,
  cacheIdentity: (operation) => [operation.db],
  async process(input, operation, context) {
    const output = makeWav(input.format);
    const factor = 10 ** (operation.db / 20);
    for (let frame = 0; frame < input.format.frames; frame++) {
      if (frame % FRAMES_PER_BATCH === 0) await checkpoint(frame, input, context);
      const end = (frame + 1) * input.frameBytes;
      for (let offset = frame * input.frameBytes; offset < end; offset += input.sampleBytes) {
        writeSample(output, offset, readSample(input, offset) * factor);
      }
    }
    return output.file;
  },
};

async function checkpoint(frame: number, input: Wav, context: ProcessorContext) {
  await setImmediate();
  context.signal.throwIfAborted();
  context.onProgress(frame / input.format.frames);
  context.signal.throwIfAborted();
}

export function processorIdentity(operation: Operation) {
  const adapter = operation.type === 'reverse' ? reverse : gain;
  const parameters = operation.type === 'reverse'
    ? reverse.cacheIdentity(operation)
    : gain.cacheIdentity(operation);
  return [operation.type, adapter.version, ...parameters];
}

export function processAudio(input: Wav, operation: Operation, context: ProcessorContext) {
  return operation.type === 'reverse'
    ? reverse.process(input, operation, context)
    : gain.process(input, operation, context);
}
