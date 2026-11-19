// OFFLINE TEST MOCK ONLY. No import/re-export from any actual SDK package.
export class AudioClip {}
export class AudioTrack {}
export function initialize() {
  globalThis.__t1Mock.calls.push('initialize');
  return globalThis.__t1Mock.context;
}
