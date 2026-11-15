import { GAIN_MAX_DB, GAIN_MIN_DB, type Operation } from './contract.ts';
import { gain, reverse } from './dsp.ts';
import type { ProcessorAdapter, ProcessorIdentity } from './processor.ts';

export class OperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OperationError';
  }
}

export type ReverseParams = Record<string, never>;
export interface GainParams { db: number }

const nativeIdentity = (type: string, version: string): ProcessorIdentity => ({
  format: 'native',
  uniqueId: `aopx.${type}`,
  version,
  binaryHash: null,
  stateHash: null,
});

export const reverseAdapter: ProcessorAdapter<ReverseParams> = {
  type: 'reverse',
  schemaVersion: 1,
  deterministic: true,
  normalize: () => ({}),
  identity: () => nativeIdentity('reverse', '1'),
  outputFormat: (input) => ({ ...input }),
  process: (input, _params, ctx) => reverse(input, ctx),
};

/** Gain is canonicalized to 1e-6 dB so that e.g. -3 and -3.0000000001 share one cache entry. */
export const GAIN_DB_RESOLUTION = 1e-6;

export const gainAdapter: ProcessorAdapter<GainParams> = {
  type: 'gain',
  schemaVersion: 1,
  deterministic: true,
  normalize(raw) {
    const db = raw['db'];
    if (typeof db !== 'number' || !Number.isFinite(db)) throw new OperationError('gain.db must be a finite number.');
    if (db < GAIN_MIN_DB || db > GAIN_MAX_DB) {
      throw new OperationError(`gain.db ${db} is outside [${GAIN_MIN_DB}, ${GAIN_MAX_DB}].`);
    }
    const q = Math.round(db / GAIN_DB_RESOLUTION) * GAIN_DB_RESOLUTION;
    return { db: Number(q.toFixed(6)) + 0 };
  },
  identity: () => nativeIdentity('gain', '1'),
  outputFormat: (input) => ({ ...input }),
  process: (input, params, ctx) => gain(input, params.db, ctx),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, ProcessorAdapter<any>>([
  [reverseAdapter.type, reverseAdapter],
  [gainAdapter.type, gainAdapter],
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdapter(type: string): ProcessorAdapter<any> {
  const a = registry.get(type);
  if (!a) throw new OperationError(`Unknown operation type '${type}'.`);
  return a;
}

/** Engine-internal normalized operation: stable id, type, enabled, canonical params. */
export interface NormalizedOperation {
  id: string;
  type: string;
  schemaVersion: number;
  enabled: boolean;
  params: Record<string, unknown>;
}

export function normalizeOperation(op: Operation): NormalizedOperation {
  if (typeof op.id !== 'string' || op.id.length === 0) throw new OperationError('Operation id must be a non-empty string.');
  if (typeof op.enabled !== 'boolean') throw new OperationError(`Operation ${op.id}: enabled must be boolean.`);
  const adapter = getAdapter(op.type);
  const { id: _id, enabled: _enabled, type: _type, ...raw } = op as Operation & Record<string, unknown>;
  return { id: op.id, type: op.type, schemaVersion: adapter.schemaVersion, enabled: op.enabled, params: adapter.normalize(raw) };
}

/** Convert back to the shared contract shape. */
export function toContractOperation(op: NormalizedOperation): Operation {
  if (op.type === 'gain') return { id: op.id, enabled: op.enabled, type: 'gain', db: op.params['db'] as number };
  if (op.type === 'reverse') return { id: op.id, enabled: op.enabled, type: 'reverse' };
  throw new OperationError(`Unknown operation type '${op.type}'.`);
}
