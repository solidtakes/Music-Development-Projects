import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinModules, createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(project, 'manifest.trial.json'), 'utf8'));
const entry = path.resolve(project, manifest.entry);
const source = await readFile(entry, 'utf8');
const boundary = JSON.parse(await readFile(path.join(project, '.build/package.json'), 'utf8'));
const nativeRequire = createRequire(import.meta.url);
const builtin = new Set(builtinModules.map(x => x.replace(/^node:/, '')));

// The loader tests MUST only evaluate the mock-backed CI entry, never the real SDK runtime.
const mockMarker = '__t1Mock';

type Audit = {
  exports: Record<string, unknown>;
  calls: string[];
  effects: string[];
  commands: Array<(...args: unknown[]) => void>;
};
function loadWithDeniedEffects(js: string = source): Audit {
  const calls: string[] = [];
  const effects: string[] = [];
  const commands: Array<(...args: unknown[]) => void> = [];
  const deny = (operation: string) => (..._args: unknown[]) => {
    effects.push(operation);
    throw new Error(`Blocked load-time effect: ${operation}`);
  };
  const guarded = (id: string) => new Proxy(nativeRequire(id), {
    get(target, key) {
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? deny(`${id}.${String(key)}`) : value;
    },
  });
  const context = {
    commands: { registerCommand(id: string, callback: (...args: unknown[]) => void) {
      calls.push(`command:${id}`); commands.push(callback);
    } },
    ui: {
      showModalDialog: deny('sdk.ui.showModalDialog'),
      registerContextMenuAction(kind: string, _label: string, id: string) {
        calls.push(`menu:${kind}:${id}`);
        return Promise.resolve(async () => {});
      },
    },
    application: new Proxy({}, { get: (_target, key) => deny(`sdk.application.${String(key)}`)() }),
    resources: new Proxy({}, { get: (_target, key) => deny(`sdk.resources.${String(key)}`) }),
    environment: new Proxy({}, { get: (_target, key) => deny(`sdk.environment.${String(key)}`)() }),
  };
  const require = (id: string) => {
    if (!id.startsWith('node:') || !builtin.has(id.slice(5))) {
      throw new Error(`Unexpected external dependency: ${id}`);
    }
    return id === 'node:path' || id === 'node:url' ? nativeRequire(id) : guarded(id);
  };
  const module = { exports: {} as Record<string, unknown> };
  const sandbox = {
    __t1Mock: { calls, context }, Buffer,
    console: { log: deny('console.log'), error: deny('console.error'), warn: deny('console.warn') },
    process: new Proxy({}, { get: (_target, key) => deny(`process.${String(key)}`)() }),
    setTimeout: deny('timer.setTimeout'), setInterval: deny('timer.setInterval'),
    setImmediate: deny('timer.setImmediate'), queueMicrotask: deny('timer.queueMicrotask'),
    fetch: deny('network.fetch'),
  };
  const wrapper = new vm.Script(`(function(exports, require, module, __filename, __dirname) {\n${js}\n})`,
    { filename: entry });
  const fn = wrapper.runInNewContext(sandbox);
  fn(module.exports, require, module, entry, path.dirname(entry));
  return { exports: module.exports, calls, effects, commands };
}

test('manifest, SDK closure and generated CommonJS package boundary', () => {
  assert.equal(manifest.entry,
    '.build/ableton-offline-processing/spikes/s5-t1-trial/src/extension.js');
  assert.equal(path.extname(entry), '.js');
  assert.equal(boundary.type, 'commonjs');
  assert.ok(source.includes(mockMarker), 'CI loader tests require the synthetic SDK entry');
  assert.doesNotMatch(source, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  const requireCalls = /\b(?:__require|require)\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g;
  const matched = [...source.matchAll(requireCalls)].map(m => m[2]);
  assert.ok(matched.every(id => id.startsWith('node:') && builtin.has(id.slice(5))),
    `unexpected external dependency: ${matched.join(', ')}`);
  assert.doesNotMatch(source.replace(requireCalls, ''), /\b(?:__require|require)\s*\(/,
    'dynamic/nonliteral require()');
});

test('load-only: zero registrations and zero filesystem/host effects', () => {
  assert.ok(source.includes(mockMarker), 'never evaluate a real-SDK artifact in the loader tests');
  const loaded = loadWithDeniedEffects();
  assert.equal(typeof loaded.exports.activate, 'function');
  assert.deepEqual(loaded.calls, []);
  assert.deepEqual(loaded.effects, []);
  assert.deepEqual(loaded.commands, []);
});

test('ordinary CommonJS loader resolves the mock entry without external SDK', () => {
  assert.ok(source.includes(mockMarker), 'never evaluate a real-SDK artifact in the loader tests');
  const requireEntry = createRequire(entry);
  const loaded = requireEntry(entry) as Record<string, unknown>;
  assert.equal(typeof loaded.activate, 'function');
  delete requireEntry.cache[requireEntry.resolve(entry)];
});

test('activation registers exactly one command and AudioClip menu, without invocation', async () => {
  const loaded = loadWithDeniedEffects();
  (loaded.exports.activate as (value: unknown) => void)({});
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(loaded.calls, [
    'initialize',
    'command:aopx.s5.t1.controlled-trial',
    'menu:AudioClip:aopx.s5.t1.controlled-trial',
  ]);
  assert.equal(loaded.commands.length, 1);
  assert.deepEqual(loaded.effects, []);
});

test('synthetic top-level filesystem write is detected and denied', () => {
  const injected = `${source}\nrequire('node:fs').writeFileSync('synthetic-marker-only', 'no');`;
  assert.throws(() => loadWithDeniedEffects(injected), /Blocked load-time effect: node:fs.writeFileSync/);
});

test('unexpected external package is rejected during evaluation', () => {
  const injected = `${source}\nrequire('@unapproved/dependency');`;
  assert.throws(() => loadWithDeniedEffects(injected), /Unexpected external dependency/);
});

test('injected ESM is rejected by the CJS parser', () => {
  const injected = `${source}\nimport { something } from './unapproved.mjs';`;
  assert.throws(() => loadWithDeniedEffects(injected), SyntaxError);
});
