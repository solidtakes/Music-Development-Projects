import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

test('real activation code against mock SDK registers only; repeated command remains locked', async () => {
  const mockUrl = new URL('../ci/runtime-sdk.mjs', import.meta.url).href;
  const hook = registerHooks({ resolve(specifier, context, next) {
    return specifier === '@ableton-extensions/sdk' ? { url: mockUrl, shortCircuit: true } : next(specifier, context);
  } });
  let command!: (...args: unknown[]) => void;
  const calls: string[] = [];
  const fail = () => { calls.push('UNEXPECTED_HOST_CALL'); throw new Error('Host must not be accessed'); };
  (globalThis as any).__t1Mock = { calls, context: {
    application: { get song() { return fail(); } }, resources: { importIntoProject: fail, renderPreFxAudio: fail },
    environment: { get storageDirectory() { return fail(); }, get tempDirectory() { return fail(); } },
    commands: { registerCommand(_id: string, callback: typeof command) { calls.push('register-command'); command = callback; } },
    ui: { registerContextMenuAction: async () => { calls.push('register-menu'); return async () => {}; } },
  } };
  const oldLog = console.log; const logs: string[] = []; console.log = x => { logs.push(String(x)); };
  try {
    const module = await import('../src/extension.ts');
    assert.equal(module.LIVE_TRIAL_ENABLED, false);
    module.activate({} as any);
    assert.deepEqual(calls, ['initialize', 'register-command', 'register-menu']);
    command({ id: 99n }); await new Promise(r => setImmediate(r));
    command({ id: 99n }); await new Promise(r => setImmediate(r));
    assert.deepEqual(calls, ['initialize', 'register-command', 'register-menu']);
    assert.ok(logs.every(x => JSON.parse(x).status === 'locked'));
  } finally { hook.deregister(); console.log = oldLog; delete (globalThis as any).__t1Mock; }
});
