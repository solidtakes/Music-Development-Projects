/** Reviewed source profile, not a runtime switch. DO NOT RUN without separate owner approval. */
export const OWNER_SOURCE = Object.freeze({
  sha256: 'c897d44b640a602f162e61ed7719d6469722cf22b51fcec894dd6f9231633026',
  bytes: 192080, frames: 48000, sampleRate: 48000, channels: 1, bitDepth: 32,
});
export const CONTROLLED_TRIAL_PROFILE = Object.freeze({
  id: 'S5-T1-OWNER-7025538391',
  enabled: true as const,
  target: 'AOPX RESULT', tempo: 120,
  phrase: 'T1 CONTROLLED ONE IMPORT TO AOPX RESULT',
  source: OWNER_SOURCE,
});
// This literal enables ONLY the separate trial entry. The default extension.ts remains false.
