/**
 * SDK-independent host side of the modal Webview contract (T2).
 *
 * The Extension Host gives the GUI a HostInitialState and receives back a ModalResult string through
 * the SDK's `close_and_send`. This module builds, serializes and injects the initial state, and
 * validates the returned string. It has no dependency on the Ableton SDK or on any Webview
 * transport, and the WAV engine does not depend on it.
 */
import {
  CONTRACT_VERSION,
  GAIN_MAX_DB,
  GAIN_MIN_DB,
  MODAL_ENVELOPE_VERSION,
  type HostInitialState,
  type ModalResult,
  type Operation,
  type OperationPlan,
  type RenderReport,
  type SourceInfo,
  type WaveformPeak,
} from '../../engine/src/contract.ts';

export class ModalResultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModalResultError';
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function onlyKeys(o: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new ModalResultError(`${where}: unexpected field '${k}'.`);
}

function parseOperation(raw: unknown, i: number): Operation {
  const where = `operations[${i}]`;
  if (!isObject(raw)) throw new ModalResultError(`${where} must be an object.`);
  const { id, type, enabled } = raw;
  if (typeof id !== 'string' || id.length === 0) throw new ModalResultError(`${where}.id must be a non-empty string.`);
  if (typeof enabled !== 'boolean') throw new ModalResultError(`${where}.enabled must be a boolean.`);
  if (type === 'reverse') {
    onlyKeys(raw, ['id', 'type', 'enabled'], where);
    return { id, type, enabled };
  }
  if (type === 'gain') {
    onlyKeys(raw, ['id', 'type', 'enabled', 'db'], where);
    const db = raw['db'];
    if (typeof db !== 'number' || !Number.isFinite(db)) throw new ModalResultError(`${where}.db must be a finite number.`);
    if (db < GAIN_MIN_DB || db > GAIN_MAX_DB) throw new ModalResultError(`${where}.db ${db} is outside [${GAIN_MIN_DB}, ${GAIN_MAX_DB}].`);
    return { id, type, enabled, db };
  }
  throw new ModalResultError(`${where}.type '${String(type)}' is not a supported operation.`);
}

function parsePlan(raw: unknown): OperationPlan {
  if (!isObject(raw)) throw new ModalResultError('plan must be an object.');
  onlyKeys(raw, ['version', 'operations'], 'plan');
  if (raw['version'] !== CONTRACT_VERSION) throw new ModalResultError(`plan.version must be ${CONTRACT_VERSION}.`);
  const ops = raw['operations'];
  if (!Array.isArray(ops)) throw new ModalResultError('plan.operations must be an array.');
  const operations = ops.map(parseOperation);
  const ids = new Set(operations.map((o) => o.id));
  if (ids.size !== operations.length) throw new ModalResultError('plan.operations ids must be unique.');
  return { version: CONTRACT_VERSION, operations };
}

/**
 * Validate the string returned by the modal. Returns a fresh ModalResult holding only known fields;
 * throws ModalResultError on anything else (wrong version, unknown action or fields, invalid plan).
 * Range checks match the engine, which still normalizes the plan again in Project.setPlan.
 */
export function parseModalResult(returned: string): ModalResult {
  if (typeof returned !== 'string') throw new ModalResultError('Modal result must be a string.');
  let raw: unknown;
  try {
    raw = JSON.parse(returned);
  } catch {
    throw new ModalResultError('Modal result is not valid JSON.');
  }
  if (!isObject(raw)) throw new ModalResultError('Modal result must be a JSON object.');
  if (raw['envelopeVersion'] !== MODAL_ENVELOPE_VERSION) {
    throw new ModalResultError(`Unsupported modal envelopeVersion ${JSON.stringify(raw['envelopeVersion'])}; expected ${MODAL_ENVELOPE_VERSION}.`);
  }
  if (raw['action'] === 'cancel') {
    onlyKeys(raw, ['envelopeVersion', 'action'], 'result');
    return { envelopeVersion: MODAL_ENVELOPE_VERSION, action: 'cancel' };
  }
  if (raw['action'] === 'process') {
    onlyKeys(raw, ['envelopeVersion', 'action', 'plan'], 'result');
    return { envelopeVersion: MODAL_ENVELOPE_VERSION, action: 'process', plan: parsePlan(raw['plan']) };
  }
  throw new ModalResultError(`Unknown modal action ${JSON.stringify(raw['action'])}.`);
}

export function buildHostInitialState(input: {
  source: SourceInfo;
  waveform: WaveformPeak[];
  plan: OperationPlan;
  diagnostics?: RenderReport | null;
}): HostInitialState {
  return {
    envelopeVersion: MODAL_ENVELOPE_VERSION,
    source: input.source,
    waveform: input.waveform,
    plan: input.plan,
    diagnostics: input.diagnostics ?? null,
    preview: false,
  };
}

/**
 * JSON safe to embed inside an inline <script>: `<`, `>`, `&` and the JS line separators are escaped,
 * so a source name such as `</script>` cannot end the script early.
 */
export function serializeInitialState(state: HostInitialState): string {
  return JSON.stringify(state)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Marker in editor/interface.html: the main UI script starts after the plan-core script. */
const MAIN_SCRIPT_MARKER = '<script id="aopx-plan-core">';

/**
 * Return a copy of the GUI document with `window.AOPX_INITIAL_STATE` set before any UI script runs.
 * How the result is handed to `showModalDialog` (data URL or generated file) is decided by spike S3.
 */
export function injectInitialState(html: string, state: HostInitialState): string {
  const at = html.indexOf(MAIN_SCRIPT_MARKER);
  if (at < 0 || html.indexOf(MAIN_SCRIPT_MARKER, at + 1) >= 0) {
    throw new Error('GUI document must contain exactly one <script id="aopx-plan-core">.');
  }
  const tag = `<script>window.AOPX_INITIAL_STATE=${serializeInitialState(state)};</script>\n`;
  return html.slice(0, at) + tag + html.slice(at);
}
