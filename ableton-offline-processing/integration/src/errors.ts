/**
 * Typed failures of the offline integration flow. `status` says what the user is told and whether
 * the Set may have changed: everything except 'unknown-outcome' is raised before any host effect.
 */
export type IntegrationErrorCode =
  | 'no-storage'
  | 'not-admitted'
  | 'selection-changed'
  | 'render-outside-temp'
  | 'render-not-regular-file'
  | 'render-too-large'
  | 'render-aiff'
  | 'render-rf64'
  | 'render-unknown-format'
  | 'render-invalid-wav'
  | 'render-empty'
  | 'render-channels'
  | 'render-frame-mismatch'
  | 'render-changed'
  | 'output-format-mismatch'
  | 'output-changed';

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  constructor(code: IntegrationErrorCode, message: string) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
  }
}

/** A host call did not settle in time. This is not cancellation: the effect may still happen. */
export class HostTimeoutError extends Error {
  constructor(call: string, ms: number) {
    super(`Host call ${call} did not settle within ${ms} ms; its outcome is unknown.`);
    this.name = 'HostTimeoutError';
  }
}
