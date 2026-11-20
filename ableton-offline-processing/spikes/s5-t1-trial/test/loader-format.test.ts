import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(project, 'manifest.trial.json'), 'utf8'));
const entry = path.resolve(project, manifest.entry);
const source = await readFile(entry, 'utf8');
const nativeRequire = createRequire(import.meta.url);

function loadWithMockSdk() {
  const registrations: string[] = [];
  class AudioClip {}
  class AudioTrack {}
  const sdk = {
    AudioClip,
    AudioTrack,
    initialize() {
      return {
        commands: { registerCommand(id: string) { registrations.push(`command:${id}`); } },
        ui: {
          showModalDialog() { throw new Error('load must not show a modal'); },
          async registerContextMenuAction(kind: string, _label: string, id: string) {
            registrations.push(`menu:${kind}:${id}`);
          },
        },
        environment: { tempDirectory: 'unused', storageDirectory: 'unused' },
      };
    },
  };
  const module = { exports: {} as Record<string, unknown> };
  const wrapper = new vm.Script(`(function(exports, require, module, __filename, __dirname) {\n${source}\n})`,
    { filename: entry });
  const require = (id: string) => {
    if (id === '@ableton-extensions/sdk') return sdk;
    if (id.startsWith('node:')) return nativeRequire(id);
    throw new Error(`unexpected external dependency: ${id}`);
  };
  const fn = wrapper.runInThisContext();
  fn(module.exports, require, module, entry, path.dirname(entry));
  return { exports: module.exports, registrations };
}

test('manifest resolves to the single CommonJS host entry', () => {
  assert.equal(manifest.entry,
    '.build/ableton-offline-processing/spikes/s5-t1-trial/src/extension.js');
  assert.equal(path.extname(entry), '.js');
  assert.match(source, /require\(["']@ableton-extensions\/sdk["']\)/);
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /^\s*export\s/m);
  assert.doesNotMatch(source, /require\(["']\.\.?\//);
});

test('CommonJS entry parses and loading alone has no registration or project effects', () => {
  const loaded = loadWithMockSdk();
  assert.equal(typeof loaded.exports.activate, 'function');
  assert.deepEqual(loaded.registrations, []);
});

test('activation registers only the command and context action', async () => {
  const loaded = loadWithMockSdk();
  (loaded.exports.activate as (value: unknown) => void)({});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(loaded.registrations, [
    'command:aopx.s5.t1.controlled-trial',
    'menu:AudioClip:aopx.s5.t1.controlled-trial',
  ]);
});
