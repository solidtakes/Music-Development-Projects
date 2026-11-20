import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

test('default stays locked; separate trial connection only registers, ordinary args cannot mutate', async () => {
  const hook = registerHooks({ resolve(specifier, context, next) {
    return specifier === '@ableton-extensions/sdk' ?
      { url: new URL('../../s5-t1/ci/runtime-sdk.mjs', import.meta.url).href, shortCircuit: true } : next(specifier, context);
  } });
  const calls: string[] = [], commands: Record<string,(...args: unknown[])=>void> = {};
  const fail = () => { calls.push('preflight-read'); throw new Error('/PRIVATE/not-a-disposable-set'); };
  (globalThis as any).__t1Mock = { calls, context: {
    application: { get song() { return fail(); } }, resources: {
      importIntoProject: () => { calls.push('MUTATOR'); throw new Error('NO'); },
      renderPreFxAudio: () => { calls.push('render'); throw new Error('NO'); },
    },
    environment: { get storageDirectory() { return fail(); }, get tempDirectory() { return fail(); } },
    commands: { registerCommand(id: string, cb: (...args: unknown[])=>void) { commands[id] = cb; calls.push('register-command'); } },
    ui: { registerContextMenuAction: async () => { calls.push('register-menu'); return async () => {}; } },
  } };
  const old = console.log, logs: string[] = []; console.log = x => logs.push(String(x));
  const previousEnv = process.env.AOPX_S5_ENABLE; process.env.AOPX_S5_ENABLE = 'true';
  try {
    const locked = await import('../../s5-t1/src/extension.ts'); const trial = await import('../src/extension.ts');
    assert.equal(locked.LIVE_TRIAL_ENABLED, false); assert.equal(trial.CONTROLLED_TRIAL_PROFILE.enabled, true);
    locked.activate({} as any); trial.activate({} as any);
    assert.deepEqual(calls, ['initialize','register-command','register-menu','initialize','register-command','register-menu']);
    commands['aopx.s5.t1.build-only']!({ id: 1n, enabled: true });
    await new Promise(r => setImmediate(r)); assert.ok(!calls.includes('preflight-read'));
    commands['aopx.s5.t1.controlled-trial']!({ id: 1n, enabled: true, confirmed: true });
    await new Promise(r => setImmediate(r));
    assert.ok(!calls.includes('MUTATOR')); assert.ok(!calls.includes('render'));
    assert.doesNotMatch(logs.join('\n'), /PRIVATE/);
  } finally {
    if (previousEnv === undefined) delete process.env.AOPX_S5_ENABLE; else process.env.AOPX_S5_ENABLE = previousEnv;
    hook.deregister(); console.log = old; delete (globalThis as any).__t1Mock;
  }
});
