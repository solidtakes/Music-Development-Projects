import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinModules, createRequire } from 'node:module';
import { readFile, readdir, mkdtemp, mkdir, rm, link, realpath, symlink, unlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import os from 'node:os';
import { beta1CjsExport, INPUT_POLICIES, EXTERNAL_POLICIES, SDK_POLICY,
  WINDOWS_TOOL_POLICY, LINUX_TOOL_POLICY, strictJson, snapshotFile, snapshotInputs, snapshotSdk, verifySdkIdentity,
  verifyCompilerTools, verifiedInputBroker, verifyBundleMetadata, verifyExternals,
  bindSdkRuntime, writeControlledOutputs } from '../ci/build.mjs';
import path from 'node:path';
import vm from 'node:vm';
import { readPinnedParser, sanitizedNodeEnv } from '../ci/syntax-policy.mjs';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(project, 'manifest.trial.json'), 'utf8'));
const entry = process.env.AOPX_LOADER_TEST_ENTRY ?? path.resolve(project, manifest.entry);
const mockBytes = await readFile(entry);
const source = mockBytes.toString('utf8');
const mockMarker = '/* AOPX_OFFLINE_MOCK_ONLY_v1 */\n';
// This digest comes from the controlled mock build, before any test evaluation.
// A caller-provided receipt, environment variable or marker cannot authorize bytes.
const expectedMock = 'ed59403c04517308669f2fc8d6bb6cd931018826730f8f9b28a2beb512866b2a';
if (createHash('sha256').update(mockBytes).digest('hex') !== expectedMock) {
  throw new Error('REFUSED: loader tests require the verified mock bundle digest');
}
const boundary = JSON.parse(await readFile(path.join(project, '.build/package.json'), 'utf8'));
const nativeRequire = createRequire(import.meta.url);
const builtin = new Set(builtinModules.map(x => x.replace(/^node:/, '')));


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
  assert.ok(source.startsWith(mockMarker), 'CI loader tests require a mock SDK entry');
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
  const loaded = loadWithDeniedEffects();
  assert.equal(typeof loaded.exports.activate, 'function');
  assert.deepEqual(loaded.calls, []);
  assert.deepEqual(loaded.effects, []);
  assert.deepEqual(loaded.commands, []);
});

test('ordinary CommonJS loader resolves the verified mock bytes without external SDK', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-verified-mock-'));
  try {
    const verifiedEntry = path.join(temp, 'verified-mock.cjs');
    await writeFile(verifiedEntry, mockBytes, { flag: 'wx' });
    const requireEntry = createRequire(verifiedEntry);
    const loaded = requireEntry(verifiedEntry) as Record<string, unknown>;
    assert.equal(typeof loaded.activate, 'function');
    delete requireEntry.cache[requireEntry.resolve(verifiedEntry)];
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
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

const validBeta1Metadata = () => ({
  name: '@ableton-extensions/sdk', version: '1.0.0-beta.1',
  exports: { '.': { import: { types: './dist/index.d.mts', default: './dist/index.mjs' },
    require: { types: './dist/index.d.cts', default: './dist/index.cjs' } } },
});

test('beta.1 require.default conditional export is selected exactly', () => {
  assert.equal(beta1CjsExport(validBeta1Metadata()), './dist/index.cjs');
});

test('beta.1 export rejects wrong package, version, conditions, fallbacks and paths', () => {
  const mutations: Array<(p: any) => void> = [
    p => { p.name = '@unapproved/sdk'; },
    p => { p.version = '1.0.0-beta.0'; },
    p => { delete p.exports['.'].require; p.main = './dist/index.cjs'; },
    p => { p.exports['.'].require = './dist/index.cjs'; },
    p => { p.exports['.'].require.default = '../escape.cjs'; },
    p => { p.exports['.'].require.types = './dist/index.d.mts'; },
    p => { p.exports['.'].require.other = './dist/extra.cjs'; },
    p => { delete p.exports['.'].require.default; },
    p => { delete p.exports['.']; p.exports.require = { default: './dist/index.cjs' }; },
  ];
  for (const mutate of mutations) {
    const pkg = validBeta1Metadata() as any;
    mutate(pkg);
    assert.throws(() => beta1CjsExport(pkg), /SDK identity|conditional CJS export/);
  }
});

// Diagnostic child runner must NOT inherit node:test's worker context.
// Node 22.16.0 otherwise treats a nested --test as recursive, SKIPS the file,
// warns on stderr, and returns exit status 0. Explicit TS stripping is needed
// on Node 22.16.0 to reach module initialization rather than a .ts loader error.
const runChildTest = (testPath: string, artifactPath: string, fixtureEnv: NodeJS.ProcessEnv = {}) => {
  const env = { ...sanitizedNodeEnv(), ...fixtureEnv, AOPX_LOADER_TEST_ENTRY: artifactPath };
  return spawnSync(process.execPath,
    ['--experimental-strip-types', '--test', '--test-reporter=tap', testPath],
    { cwd: project, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
};

const parseTap = (stdout: string) => {
  const normalized = stdout.replace(/\r\n/g, '\n');
  const count = (kind: string) => {
    const match = normalized.match(new RegExp(`^# ${kind} (\\d+)$`, 'm'));
    return match ? Number(match[1]) : NaN;
  };
  return {
    tests: count('tests'), pass: count('pass'), fail: count('fail'),
    cancelled: count('cancelled'), skipped: count('skipped'), todo: count('todo'),
  };
};

test('P-6 forged mock marker, receipt and environment digest cannot authorize evaluation', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-loader-nonmock-'));
  try {
    const sentinel = path.join(temp, 'fixture-was-evaluated');
    const fixture = path.join(temp, 'forged-mock.cjs');
    const body = '/* AOPX_OFFLINE_MOCK_ONLY_v1 */\n'
      + 'const __t1Mock = true;\n'
      + 'require("node:fs").writeFileSync(' + JSON.stringify(sentinel) + ', "executed");\n';
    const forgedDigest = createHash('sha256').update(body).digest('hex');
    await writeFile(fixture, body);
    await writeFile(path.join(temp, 'receipt.json'), JSON.stringify({ mode: 'mock-sdk', artifact: { sha256: forgedDigest } }));
    const guarded = runChildTest(fileURLToPath(import.meta.url), fixture, {
      AOPX_MOCK_DIGEST: forgedDigest, AOPX_RECEIPT: path.join(temp, 'receipt.json'),
    });
    assert.equal(guarded.error, undefined);
    assert.equal(guarded.signal, null);
    assert.equal(guarded.status, 1);
    assert.deepEqual(parseTap(guarded.stdout ?? ''), {
      tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0, todo: 0,
    });
    assert.match(guarded.stdout ?? '', /REFUSED: loader tests require the verified mock bundle digest/);
    await assert.rejects(readFile(sentinel), /ENOENT/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('rejected offline build invalidates stale entry and preserves unrelated files', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-build-cleanup-'));
  try {
    const scratchProject = path.join(temp, 'spikes/s5-t1-trial');
    const script = path.join(scratchProject, 'ci/build.mjs');
    const manifestPath = path.join(scratchProject, 'manifest.trial.json');
    const entryPath = path.join(scratchProject,
      '.build/ableton-offline-processing/spikes/s5-t1-trial/src/extension.js');
    const buildDir = path.join(scratchProject, '.build');
    const pending = `${entryPath}.aopx-pending.js`;
    const scope = path.join(buildDir, 'package.json');
    const metadata = path.join(buildDir, 'bundle-meta.json');
    const keep = path.join(buildDir, 'unrelated.keep');
    await mkdir(path.dirname(script), { recursive: true });
    await mkdir(path.dirname(entryPath), { recursive: true });
    await writeFile(script, await readFile(path.join(project, 'ci/build.mjs')));
    await writeFile(path.join(path.dirname(script), 'syntax-policy.mjs'),
      await readFile(path.join(project, 'ci/syntax-policy.mjs')));
    await writeFile(manifestPath, JSON.stringify({ entry: manifest.entry }));
    await writeFile(keep, 'must survive all rejected build attempts');
    const seed = async () => {
      for (const file of [entryPath, pending, scope, metadata]) {
        await writeFile(file, `stale controlled output: ${path.basename(file)}`);
      }
    };
    const verify = async () => {
      for (const file of [entryPath, pending, scope, metadata]) {
        await assert.rejects(readFile(file), /ENOENT/, `Rejected generated output survives: ${file}`);
      }
      assert.equal(await readFile(keep, 'utf8'), 'must survive all rejected build attempts');
      await assert.rejects(readFile(path.join(scratchProject, '.compile.generated.json')), /ENOENT/);
    };
    const isolatedNode = (args: string[]) => {
      const env = sanitizedNodeEnv();
      return spawnSync(process.execPath, [script, ...args],
        { cwd: temp, env, encoding: 'utf8', timeout: 15_000 });
    };

    // Failure in argument validation (before SDK/toolchain loading).
    await seed();
    const early = isolatedNode(['--sdk-mock', '--sdk-runtime', 'not-a-real-sdk']);
    assert.equal(early.error, undefined);
    assert.equal(early.signal, null);
    assert.equal(early.status, 1);
    assert.match(early.stderr, /Select exactly one/);
    await verify();

    // A synthetic compiler/bundler may claim the right version, but A1 must
    // refuse its unpinned path/bytes before running it or accepting its output.
    const tsDir = path.join(temp, 'tools/typescript');
    const esDir = path.join(temp, 'tools/esbuild');
    const tscPath = path.join(tsDir, 'lib/tsc.js');
    const esPath = path.join(esDir, 'bin/esbuild');
    const stub = path.join(temp, 'spikes/s5-t1/ci/sdk-stub.d.mts');
    const mock = path.join(temp, 'spikes/s5-t1/ci/runtime-sdk.mjs');
    for (const dir of [path.dirname(tscPath), path.dirname(esPath), path.dirname(stub)]) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path.join(tsDir, 'package.json'), JSON.stringify({name:'typescript',version:'5.9.3'}));
    await writeFile(path.join(esDir, 'package.json'), JSON.stringify({name:'esbuild',version:'0.28.1'}));
    const compilerRan = path.join(temp, 'unverified-compiler-ran');
    await writeFile(tscPath, `require('node:fs').writeFileSync(${JSON.stringify(compilerRan)}, 'BAD');\n`);
    await writeFile(stub, '// mock SDK declaration fixture\n');
    await writeFile(mock, '// synthetic SDK runtime: never imported\n');
    await writeFile(esPath, `
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const outfile = args.find(a => a.startsWith('--outfile=')).slice('--outfile='.length);
const metafile = args.find(a => a.startsWith('--metafile=')).slice('--metafile='.length);
fs.mkdirSync(path.dirname(outfile), { recursive:true });
fs.writeFileSync(outfile, "require('@blocked/unexpected');\\n");
fs.writeFileSync(metafile, JSON.stringify({
  inputs:{'spikes/s5-t1/ci/runtime-sdk.mjs':{}},
  outputs:{[outfile]:{imports:[{path:'@blocked/unexpected',external:true}]}}
}));
`);
    await seed();
    const late = isolatedNode(['--sdk-mock', '--tsc', tscPath, '--esbuild', esPath]);
    assert.equal(late.error, undefined);
    assert.equal(late.signal, null);
    assert.equal(late.status, 1);
    assert.match(late.stderr, /Unexpected enrolled tool path|Enrolled content hash mismatch/);
    await assert.rejects(readFile(compilerRan), /ENOENT/, 'unverified compiler must never execute');
    await verify();
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

// P1-A: invoke the actual copied build script through canonical and linked paths.
test('canonical and symlinked invocation validate arguments and invalidate stale controlled outputs', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-p1-main-'));
  try {
    const scratchProject = path.join(temp, 'spikes/s5-t1-trial');
    const script = path.join(scratchProject, 'ci/build.mjs');
    const buildDir = path.join(scratchProject, '.build');
    const controlledEntry = path.resolve(scratchProject, manifest.entry);
    const outputs = [controlledEntry, `${controlledEntry}.aopx-pending.js`,
      path.join(buildDir, 'package.json'), path.join(buildDir, 'bundle-meta.json')];
    const unrelated = path.join(buildDir, 'unrelated.keep');
    await mkdir(path.dirname(script), { recursive: true });
    await mkdir(path.dirname(controlledEntry), { recursive: true });
    await writeFile(script, await readFile(path.join(project, 'ci/build.mjs')));
    await writeFile(path.join(path.dirname(script), 'syntax-policy.mjs'),
      await readFile(path.join(project, 'ci/syntax-policy.mjs')));
    await writeFile(path.join(scratchProject, 'manifest.trial.json'), JSON.stringify({ entry: manifest.entry }));
    await writeFile(unrelated, 'must survive');

    const checkInvalid = async (scriptPath: string) => {
      for (const file of outputs) await writeFile(file, 'stale controlled output');
      const env = sanitizedNodeEnv();
      const result = spawnSync(process.execPath, [scriptPath, '--bogus'],
        { cwd: temp, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      assert.equal(result.status, 1, 'invalid arguments must fail rather than silently return success');
      assert.match(result.stderr ?? '', /Unrecognized or repeated build option: --bogus/);
      for (const file of outputs) await assert.rejects(readFile(file), /ENOENT/, 'stale output survived: ' + file);
      assert.equal(await readFile(unrelated, 'utf8'), 'must survive');
      await assert.rejects(readFile(path.join(scratchProject, '.compile.generated.json')), /ENOENT/);
    };
    await t.test('canonical path', async () => { await checkInvalid(script); });
    await t.test('symlinked directory path', async subtest => {
      const alias = path.join(temp, 'linked-project');
      try {
        await symlink(scratchProject, alias, process.platform === 'win32' ? 'junction' : 'dir');
      } catch (error) {
        const code = error instanceof Error && 'code' in error ? String(error.code) : '';
        if (['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EINVAL'].includes(code)) {
          subtest.diagnostic('SYMLINK_UNSUPPORTED=' + code + '; alias invocation is not qualified on this runner');
          subtest.skip('Symlink or junction unavailable: ' + code);
          return;
        }
        throw error;
      }
      await checkInvalid(path.join(alias, 'ci/build.mjs'));
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

// Reuse only the existing locked offline toolchain. CI uses the normal installed
// engine paths; isolated local verification can name an already installed copy.
const offlineTsc = () => process.env.AOPX_OFFLINE_TSC ??
  path.resolve(project, '../../engine/node_modules/typescript/lib/tsc.js');
const pinnedParser = () => readPinnedParser(path.join(path.dirname(offlineTsc()), 'typescript.js'));

const a1Hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const a1Externals = () => EXTERNAL_POLICIES.mock.map(specifier => ({ path: specifier, kind: 'require-call', external: true }));
const mockRuntimeId = 'ableton-offline-processing/spikes/s5-t1/ci/runtime-sdk.mjs';

test('A1-P01 production policies are immutable, explicit and mode-separated', () => {
  assert.ok(Object.isFrozen(INPUT_POLICIES) && Object.isFrozen(INPUT_POLICIES.real[0]));
  assert.equal(INPUT_POLICIES.real.length, 12);
  assert.equal(INPUT_POLICIES.mock.length, 12);
  assert.equal(new Set(INPUT_POLICIES.real.map(p => p.id)).size, 12);
  assert.equal(INPUT_POLICIES.real[0].id, 'sdk:dist/index.cjs');
  assert.equal(INPUT_POLICIES.mock[0].id, mockRuntimeId);
  assert.equal(INPUT_POLICIES.real[0].sha256, SDK_POLICY.runtime);
  assert.equal(INPUT_POLICIES.mock[0].sha256, '695316e4386ad7f132c6e967f8661b29c415451f15bd6bc3aeee95e7d78f51b6');
  assert.deepEqual(INPUT_POLICIES.real.slice(1), INPUT_POLICIES.mock.slice(1));
  assert.ok(Object.isFrozen(WINDOWS_TOOL_POLICY.typescript));
  assert.deepEqual(LINUX_TOOL_POLICY.typescript, WINDOWS_TOOL_POLICY.typescript);
  assert.equal(WINDOWS_TOOL_POLICY.typescript['lib/typescript.js'], '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675');
  assert.throws(() => { (INPUT_POLICIES.mock[0] as any).sha256 = '0'.repeat(64); }, TypeError);
});

test('A1-J01 strict metadata JSON rejects duplicate decoded keys and malformed input', () => {
  const parser = pinnedParser();
  assert.deepEqual(strictJson('{"inputs":{"one":{"bytes":1}}}', parser), { inputs: { one: { bytes: 1 } } });
  for (const text of [
    '{"inputs":{},"inputs":{}}', '{"inputs":{"x":{},"\\u0078":{}}}',
    '{"inputs":{"x":{"bytes":1,"bytes":2}}}',
  ]) assert.throws(() => strictJson(text, parser), /Duplicate JSON key/);
  for (const text of ['{"x":', '{"x":1,}', '{/*comment*/"x":1}']) assert.throws(() => strictJson(text, parser));
  assert.throws(() => strictJson('{}', { ...parser, version: '0' }), /pinned parser/);
});

test('A1-E01 each mode enforces exactly four built-ins and the six-record multiset', async t => {
  for (const mode of ['mock', 'real']) {
    assert.doesNotThrow(() => verifyExternals(a1Externals(), mode));
    const bad = [
      a1Externals().slice(1), [...a1Externals(), a1Externals()[0]],
      a1Externals().map((x, i) => i === 0 ? { ...x, external: false } : x),
      a1Externals().map((x, i) => i === 0 ? { ...x, kind: 'dynamic-import' } : x),
      ...['fs', 'node:module', 'node:child_process', 'node:vm', 'node:worker_threads', 'node:fs/'].map(specifier =>
        a1Externals().map((x, i) => i === 0 ? { ...x, path: specifier } : x)),
    ];
    for (const [index, imports] of bad.entries()) await t.test(mode + '-external-negative-' + index, () => {
      assert.throws(() => verifyExternals(imports, mode), /Unexpected external/);
    });
  }
});

async function a1Fixture() {
  const temp = realpathSync.native(await mkdtemp(path.join(os.tmpdir(), 'aopx-a1-fixture-')));
  const texts: Record<string, string> = {
    'entry.ts': "import {value} from './lib.ts'; import {marker} from '@ableton-extensions/sdk'; import p from 'node:path'; export const answer = value + marker; export const pathCheck = p.isAbsolute;\n",
    'lib.ts': "export const value = 'VALUE_FROM_SNAPSHOT';\n",
    [mockRuntimeId]: "export const marker = 'SYNTHETIC_NO_SDK';\n",
  };
  for (const [relative, text] of Object.entries(texts)) {
    await mkdir(path.dirname(path.join(temp, relative)), { recursive: true });
    await writeFile(path.join(temp, relative), text);
  }
  const policy = Object.entries(texts).map(([id, text]) => ({ id, sha256: a1Hash(text), format: 'esm' }));
  const snapshots = snapshotInputs(policy, { repo: temp });
  const candidate = path.join(temp, 'pending.js');
  const metadata = () => ({
    inputs: Object.fromEntries(snapshots.map(s => ['aopx-verified:' + s.compilerId, { bytes: s.bytes.length }])),
    outputs: { [candidate]: { imports: a1Externals() } },
  });
  return { temp, texts, policy, snapshots, candidate, metadata };
}

test('A1-C01 exact closure rejects added, missing, duplicated, substituted and mutated metadata inputs', async t => {
  const f = await a1Fixture();
  try {
    const parser = pinnedParser();
    const loaded = new Set(f.snapshots.map(s => s.id));
    const verify = (metadata: unknown, consumed = loaded) =>
      verifyBundleMetadata(JSON.stringify(metadata), parser, f.snapshots, consumed, f.temp, f.candidate, 'mock');
    assert.doesNotThrow(() => verify(f.metadata()));
    const cases: Array<[string, (m: any) => void]> = [
      ['P-1 added input even with zero bytes', m => { m.inputs['aopx-verified:added.ts'] = { bytes: 0 }; }],
      ['P-1 missing input', m => { delete m.inputs['aopx-verified:lib.mts']; }],
      ['P-1 same bytes at another path', m => { m.inputs['aopx-verified:other/lib.mts'] = m.inputs['aopx-verified:lib.mts']; delete m.inputs['aopx-verified:lib.mts']; }],
      ['P-1 unrecognized namespace', m => { m.inputs['file:lib.mts'] = m.inputs['aopx-verified:lib.mts']; delete m.inputs['aopx-verified:lib.mts']; }],
      ['P-1 alias duplicate', m => { m.inputs['aopx-verified:./lib.mts'] = m.inputs['aopx-verified:lib.mts']; }],
      ['P-1 changed byte count', m => { m.inputs['aopx-verified:lib.mts'].bytes++; }],
      ['P-1/P-3 real SDK in mock graph', m => { m.inputs['aopx-verified:sdk:dist/index.cjs'] = { bytes: 1 }; }],
      ['extra compiler output', m => { m.outputs[path.join(f.temp, 'extra.js')] = { imports: [] }; }],
      ['wrong output path', m => { m.outputs[path.join(f.temp, 'wrong.js')] = m.outputs[f.candidate]; delete m.outputs[f.candidate]; }],
    ];
    for (const [label, mutate] of cases) await t.test(label, () => {
      const metadata = f.metadata(); mutate(metadata);
      assert.throws(() => verify(metadata), /Unexpected|Missing/);
    });
    assert.throws(() => verify(f.metadata(), new Set()), /Missing verified/);
    const duplicate = JSON.stringify(f.metadata()).replace('"inputs":{', '"inputs":{"aopx-verified:lib.mts":{"bytes":0},');
    assert.throws(() => verifyBundleMetadata(duplicate, parser, f.snapshots, loaded, f.temp, f.candidate, 'mock'), /Duplicate JSON key/);
    const repeated = [...f.policy, f.policy[0]];
    assert.throws(() => snapshotInputs(repeated, { repo: f.temp }), /Duplicate enrolled identity/);
  } finally { await rm(f.temp, { recursive: true, force: true }); }
});

test('P-1/P-5 canonical enrollment rejects changed bytes, links, traversal, non-files and physical duplicates', async () => {
  const f = await a1Fixture();
  try {
    await writeFile(path.join(f.temp, 'lib.ts'), 'MUTATED');
    assert.throws(() => snapshotInputs(f.policy, { repo: f.temp }), /hash mismatch/);
    await writeFile(path.join(f.temp, 'lib.ts'), f.texts['lib.ts'].replace(/\n/g, '\r\n'));
    assert.throws(() => snapshotInputs(f.policy, { repo: f.temp }), /hash mismatch/, 'raw CRLF substitution is not enrolled');
    await writeFile(path.join(f.temp, 'lib.ts'), f.texts['lib.ts']);
    assert.throws(() => snapshotFile(f.temp, '../lib.ts', f.policy[0].sha256), /Invalid enrolled/);
    assert.throws(() => snapshotFile(f.temp, 'lib.ts', f.policy[1].sha256, 1), /size/);
    await mkdir(path.join(f.temp, 'directory.ts'));
    assert.throws(() => snapshotFile(f.temp, 'directory.ts', f.policy[0].sha256), /Unsafe enrolled/);
    await link(path.join(f.temp, 'lib.ts'), path.join(f.temp, 'hardlink.ts'));
    assert.throws(() => snapshotInputs([f.policy[1], { id: 'hardlink.ts', sha256: f.policy[1].sha256, format: 'esm' }], { repo: f.temp }), /Duplicate canonical\/physical|Hardlink alias|path casing/);
    await unlink(path.join(f.temp, 'hardlink.ts'));
    if (process.platform === 'win32') assert.throws(() => snapshotInputs([
      f.policy[1], { id: 'LIB.ts', sha256: f.policy[1].sha256, format: 'esm' },
    ], { repo: f.temp }), /Duplicate canonical\/physical|Hardlink alias|path casing/);
    await mkdir(path.join(f.temp, 'real-dir'));
    await writeFile(path.join(f.temp, 'real-dir/value.ts'), f.texts['lib.ts']);
    await symlink(path.join(f.temp, 'real-dir'), path.join(f.temp, 'linked-dir'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => snapshotFile(f.temp, 'linked-dir/value.ts', f.policy[1].sha256), /Unsafe enrolled/);
    const invalid = Buffer.from([0xff]);
    await writeFile(path.join(f.temp, 'invalid.ts'), invalid);
    assert.throws(() => snapshotFile(f.temp, 'invalid.ts', a1Hash(invalid)), /encoded data|encoding|UTF/i);
  } finally { await rm(f.temp, { recursive: true, force: true }); }
});

test('P-2 compiler receives hashed snapshot bytes despite subsequent disk and caller-buffer mutation', async () => {
  const f = await a1Fixture();
  const originalBinary = process.env.ESBUILD_BINARY_PATH;
  try {
    const entry = path.join(f.temp, 'entry.ts');
    const broker = verifiedInputBroker(f.snapshots, entry, 'mock');
    const compilerEntry = broker.resolve({ path: entry, importer: '', kind: 'entry-point' }).path;
    assert.equal(compilerEntry, 'entry.mts');
    broker.load({ path: compilerEntry, namespace: 'aopx-verified' });
    await writeFile(path.join(f.temp, 'lib.ts'), "export const value = 'DISK_MUTATION';\n");
    f.snapshots.find(s => s.id === 'lib.ts')!.bytes.fill(0);
    assert.throws(() => verifiedInputBroker(f.snapshots, entry, 'mock'), /Snapshot buffer changed/);
    assert.throws(() => broker.resolve({ path: 'node:module', importer: compilerEntry, namespace: 'aopx-verified', kind: 'import-statement' }), /Unenrolled import/);
    assert.throws(() => broker.resolve({ path: './extra.ts', importer: compilerEntry, namespace: 'aopx-verified', kind: 'import-statement' }), /Unexpected input/);
    assert.throws(() => broker.load({ path: 'unregistered.ts' }), /Unverified input/);
    const esbuild = process.env.AOPX_OFFLINE_ESBUILD ?? path.resolve(project, '../../engine/node_modules/esbuild/bin/esbuild');
    const tools = verifyCompilerTools(offlineTsc(), esbuild);
    process.env.ESBUILD_BINARY_PATH = tools.binary.path;
    const api = nativeRequire(tools.files['esbuild/lib/main.js'].path);
    const built = await api.build({ absWorkingDir: f.temp, entryPoints: [entry], outfile: f.candidate,
      bundle: true, platform: 'node', format: 'cjs', target: 'node24', write: false, metafile: true,
      tsconfigRaw: {}, plugins: [broker.plugin], logLevel: 'silent' });
    const output = built.outputFiles[0].text;
    assert.match(output, /VALUE_FROM_SNAPSHOT/);
    assert.doesNotMatch(output, /DISK_MUTATION/);
    assert.match(output, /__toESM\(require\("node:path"\), 1\)/, 'explicit ESM policy must retain Node default-import interop');
    assert.equal(broker.loaded.size, 3);
    assert.equal(Object.keys(built.metafile.inputs).length, 3);
    await assert.rejects(readFile(f.candidate), /ENOENT/, 'synthetic compiled output must remain in memory');
  } finally {
    if (originalBinary === undefined) delete process.env.ESBUILD_BINARY_PATH;
    else process.env.ESBUILD_BINARY_PATH = originalBinary;
    await rm(f.temp, { recursive: true, force: true });
  }
});

test('P-3 pure SDK identity and declaration hash tests never load fixture code', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-a1-sdk-'));
  try {
    const parser = pinnedParser();
    const sentinel = path.join(temp, 'SDK_WAS_EXECUTED');
    const pkg = { ...validBeta1Metadata(), engines: { node: '>=24.16.0' } };
    const bytes = {
      package: Buffer.from(JSON.stringify(pkg)),
      runtime: Buffer.from(`require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'BAD'); throw new Error('SDK_MUST_NOT_EXECUTE');\n`),
      declarations: Buffer.from('// synthetic ESM declaration\n'),
      cjsDeclarations: Buffer.from('// synthetic CJS declaration\n'),
    };
    const policy: typeof SDK_POLICY = { package: a1Hash(bytes.package), runtime: a1Hash(bytes.runtime),
      declarations: a1Hash(bytes.declarations), cjsDeclarations: a1Hash(bytes.cjsDeclarations) };
    assert.equal(verifySdkIdentity(bytes, parser, policy).version, '1.0.0-beta.1');
    for (const key of Object.keys(bytes) as Array<keyof typeof bytes>) await t.test('P-3 mutated-' + key, () => {
      const changed = { ...bytes, [key]: Buffer.concat([bytes[key], Buffer.from('!')]) };
      assert.throws(() => verifySdkIdentity(changed, parser, policy), /SDK hash mismatch/);
    });
    const mutations = [
      (p: any) => { p.name = '@wrong/sdk'; }, (p: any) => { p.version = '1.0.0-beta.2'; },
      (p: any) => { p.exports['.'].require.default = '../escape.cjs'; },
      (p: any) => { p.exports['.'].require.extra = './other.cjs'; },
      (p: any) => { p.exports['.'].import.types = './dist/index.d.cts'; },
      (p: any) => { p.engines.node = '>=24.14.1'; },
    ];
    for (const [index, mutate] of mutations.entries()) await t.test('P-3 identity-' + index, () => {
      const changedPackage = structuredClone(pkg); mutate(changedPackage);
      const packageBytes = Buffer.from(JSON.stringify(changedPackage));
      assert.throws(() => verifySdkIdentity({ ...bytes, package: packageBytes }, parser,
        { ...policy, package: a1Hash(packageBytes) }), /SDK|conditional/);
    });
    const duplicatePackage = Buffer.from('{"name":"bad",' + bytes.package.toString('utf8').slice(1));
    assert.throws(() => verifySdkIdentity({ ...bytes, package: duplicatePackage }, parser,
      { ...policy, package: a1Hash(duplicatePackage) }), /Duplicate JSON/);
    assert.throws(() => verifySdkIdentity(bytes, parser), /SDK hash mismatch/, 'synthetic policy cannot become production approval');
    await mkdir(path.join(temp, 'dist'));
    for (const [key, relative] of Object.entries({ package: 'package.json', runtime: 'dist/index.cjs', declarations: 'dist/index.d.mts', cjsDeclarations: 'dist/index.d.cts' })) {
      await writeFile(path.join(temp, relative), bytes[key as keyof typeof bytes]);
    }
    const runtime = path.join(temp, 'dist/index.cjs');
    const types = path.join(temp, 'dist/index.d.mts');
    assert.equal(snapshotSdk(runtime, types, parser, policy).descriptor.version, '1.0.0-beta.1');
    assert.throws(() => snapshotSdk(runtime, path.join(temp, 'another/dist/index.d.mts'), parser, policy), /same enrolled package/);
    assert.throws(() => snapshotSdk(runtime, path.join(temp, 'dist/index.d.cts'), parser, policy), /same enrolled package/);
    await writeFile(path.join(temp, 'dist/index.d.cts'), 'CHANGED');
    assert.throws(() => snapshotSdk(runtime, types, parser, policy), /hash mismatch/);
    await assert.rejects(readFile(sentinel), /ENOENT/, 'no SDK fixture may be imported or evaluated');
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('P-4 each compiler, parser, API, package and binary pin rejects a one-byte mutation', async t => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-a1-tools-'));
  try {
    const esbuild = process.env.AOPX_OFFLINE_ESBUILD ?? path.resolve(project, '../../engine/node_modules/esbuild/bin/esbuild');
    const reviewed = verifyCompilerTools(offlineTsc(), esbuild).files;
    const nativePackage = process.platform === 'win32' ? '@esbuild/win32-x64' : '@esbuild/linux-x64';
    const fixtures: Array<{id: string; file: string; bytes: Buffer}> = [];
    for (const [id, snapshot] of Object.entries(reviewed)) {
      const relative = id.startsWith('native/') ? nativePackage + '/' + id.slice('native/'.length) : id;
      const file = path.join(temp, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, snapshot.bytes);
      fixtures.push({ id, file, bytes: snapshot.bytes });
    }
    const tscFixture = path.join(temp, 'typescript/lib/tsc.js');
    const esbuildFixture = path.join(temp, 'esbuild/bin/esbuild');
    assert.equal(Object.keys(verifyCompilerTools(tscFixture, esbuildFixture).files).length, 9);
    for (const fixture of fixtures) await t.test('P-4 ' + fixture.id, async () => {
      const changed = Buffer.from(fixture.bytes); changed[0] ^= 1;
      await writeFile(fixture.file, changed);
      assert.throws(() => verifyCompilerTools(tscFixture, esbuildFixture).files, /Enrolled content hash mismatch/);
      await writeFile(fixture.file, fixture.bytes);
    });
    // These copied files are inspected as bytes only, never imported/executed.
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('A1-N01 broker admits imports only from its own namespace and only the enrolled entry point', async () => {
  const f = await a1Fixture();
  try {
    const entry = path.join(f.temp, 'entry.ts');
    const broker = verifiedInputBroker(f.snapshots, entry, 'mock');
    const ns = 'aopx-verified';
    assert.equal(broker.resolve({ path: entry, importer: '', kind: 'entry-point' }).path, 'entry.mts');
    assert.throws(() => broker.resolve({ path: path.join(f.temp, 'lib.ts'), importer: '', kind: 'entry-point' }), /Unexpected entry point/);
    assert.throws(() => broker.resolve({ path: './lib.ts', importer: 'entry.mts', namespace: ns, kind: 'import-statement' }), /Unverified importer/);
    broker.load({ path: 'entry.mts', namespace: ns });
    assert.equal(broker.resolve({ path: './lib.ts', importer: 'entry.mts', namespace: ns, kind: 'import-statement' }).path, 'lib.mts');
    assert.equal(broker.resolve({ path: '@ableton-extensions/sdk', importer: 'entry.mts', namespace: ns, kind: 'import-statement' }).path, mockRuntimeId);
    assert.deepEqual(broker.resolve({ path: 'node:path', importer: 'entry.mts', namespace: ns, kind: 'import-statement' }), { path: 'node:path', external: true });
    // A matching importer name is not provenance: wrong, missing or file namespaces reject,
    // as does a correct namespace with an importer this broker never loaded.
    for (const args of [
      { path: './lib.ts', importer: 'entry.mts', namespace: 'file', kind: 'import-statement' },
      { path: './lib.ts', importer: 'entry.mts', kind: 'import-statement' },
      { path: '@ableton-extensions/sdk', importer: 'entry.mts', namespace: 'file', kind: 'import-statement' },
      { path: 'node:path', importer: 'entry.mts', namespace: 'file', kind: 'require-call' },
      { path: './lib.ts', importer: path.join(f.temp, 'entry.ts'), namespace: ns, kind: 'import-statement' },
      { path: './lib.ts', importer: 'other.mts', namespace: ns, kind: 'import-statement' },
    ]) assert.throws(() => broker.resolve(args), /Unverified importer/, JSON.stringify(args));
  } finally { await rm(f.temp, { recursive: true, force: true }); }
});

test('P-3 compiled SDK runtime is bound to the verified package by canonical path and identity', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-a1-bind-'));
  try {
    const parser = pinnedParser();
    const pkg = { ...validBeta1Metadata(), engines: { node: '>=24.16.0' } };
    const bytes = {
      package: Buffer.from(JSON.stringify(pkg)),
      runtime: Buffer.from('// synthetic runtime bytes, never executed\n'),
      declarations: Buffer.from('// synthetic ESM declaration\n'),
      cjsDeclarations: Buffer.from('// synthetic CJS declaration\n'),
    };
    const policy: typeof SDK_POLICY = { package: a1Hash(bytes.package), runtime: a1Hash(bytes.runtime),
      declarations: a1Hash(bytes.declarations), cjsDeclarations: a1Hash(bytes.cjsDeclarations) };
    const files = { package: 'package.json', runtime: 'dist/index.cjs', declarations: 'dist/index.d.mts', cjsDeclarations: 'dist/index.d.cts' };
    for (const name of ['a', 'b']) {
      await mkdir(path.join(temp, name, 'dist'), { recursive: true });
      for (const [key, relative] of Object.entries(files)) await writeFile(path.join(temp, name, relative), bytes[key as keyof typeof bytes]);
    }
    const runtimePolicy = [{ id: 'sdk:dist/index.cjs', sha256: policy.runtime, format: 'cjs' }];
    const capture = (sdk: string) => snapshotInputs(runtimePolicy, { repo: temp, sdk });
    // Root selected through a junction alias: the verified package is canonical package a.
    const alias = path.join(temp, 'alias');
    await symlink(path.join(temp, 'a'), alias, process.platform === 'win32' ? 'junction' : 'dir');
    const verified = snapshotSdk(path.join(alias, 'dist/index.cjs'), path.join(alias, 'dist/index.d.mts'), parser, policy);
    assert.equal(path.relative(verified.canonicalRoot, await realpath(path.join(temp, 'a'))), '');
    assert.equal(bindSdkRuntime(verified, capture(verified.canonicalRoot)).id, 'sdk:dist/index.cjs');
    // Identical runtime bytes from another package directory are not the verified runtime.
    assert.throws(() => bindSdkRuntime(verified, capture(path.join(temp, 'b'))), /not the verified package runtime/);
    // Re-pointing the alias between captures must not substitute package b.
    await unlink(alias);
    await symlink(path.join(temp, 'b'), alias, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => bindSdkRuntime(verified, capture(alias)), /not the verified package runtime/);
    assert.equal(bindSdkRuntime(verified, capture(verified.canonicalRoot)).id, 'sdk:dist/index.cjs', 'canonical root is unaffected by the alias');
    // Pure negative cases: missing, duplicated or buffer-mutated compiled records.
    const good = capture(verified.canonicalRoot);
    assert.throws(() => bindSdkRuntime(verified, []), /not the verified/);
    assert.throws(() => bindSdkRuntime(verified, [...good, ...good]), /not the verified/);
    assert.throws(() => bindSdkRuntime(undefined, good), /not the verified/);
    const mutated = [{ ...good[0], bytes: Buffer.concat([good[0].bytes, Buffer.from('!')]) }];
    assert.throws(() => bindSdkRuntime(verified, mutated), /not the verified/);
    assert.throws(() => bindSdkRuntime(verified, [{ ...good[0], identity: '0:0' }]), /not the verified/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('A1-W01 controlled outputs are staged, never opened at final paths, and refuse planted links', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-a1-write-'));
  try {
    const out = path.join(temp, 'out');
    await mkdir(out);
    const victimDir = path.join(temp, 'victim-dir');
    const victim = path.join(temp, 'victim.txt');
    await mkdir(victimDir);
    await writeFile(victim, 'ORIGINAL');
    const dirLink = process.platform === 'win32' ? 'junction' : 'dir';
    const noStageLeft = async () => assert.deepEqual((await readdir(out)).filter(x => x.startsWith('.aopx-stage-')), []);
    const fresh = ['meta.json', 'entry.js.aopx-pending.js', 'package.json'].map(x => path.join(out, x));
    writeControlledOutputs(out, fresh.map((file, i) => [file, 'CONTENT_' + i]));
    for (const [i, file] of fresh.entries()) assert.equal(await readFile(file, 'utf8'), 'CONTENT_' + i);
    await noStageLeft();
    // Every planted destination is refused, including dangling links, which an
    // exclusive ('wx') open would follow on Windows and create at their targets.
    const gone = path.join(temp, 'gone');
    const missing = path.join(temp, 'missing.txt');
    const planted: Array<[string, () => Promise<void>]> = [
      ['regular file', async () => { await writeFile(path.join(out, 'p0'), 'STALE'); }],
      ['junction to existing directory', async () => { await symlink(victimDir, path.join(out, 'p1'), dirLink); }],
      ['dangling junction', async () => { await mkdir(gone); await symlink(gone, path.join(out, 'p2'), dirLink); await rm(gone, { recursive: true }); }],
    ];
    let fileLinks = true; // File symlinks need the Windows symlink privilege; junctions do not.
    try { await symlink(victim, path.join(out, 'probe-link'), 'file'); await unlink(path.join(out, 'probe-link')); } catch { fileLinks = false; }
    if (fileLinks) planted.push(
      ['file symlink to existing file', async () => { await symlink(victim, path.join(out, 'p3'), 'file'); }],
      ['dangling file symlink', async () => { await symlink(missing, path.join(out, 'p4'), 'file'); }]);
    for (const [index, [label, plant]] of planted.entries()) {
      const destination = path.join(out, 'p' + index);
      const sibling = path.join(out, 'sibling' + index);
      await plant();
      assert.throws(() => writeControlledOutputs(out, [[sibling, 'FIRST'], [destination, 'NEW']]), /already present/, label);
      await assert.rejects(readFile(sibling), /ENOENT/, label + ': no partial set may be published');
      await noStageLeft();
    }
    assert.equal(await readFile(path.join(out, 'p0'), 'utf8'), 'STALE');
    assert.equal(await readFile(victim, 'utf8'), 'ORIGINAL', 'no write may follow a planted link');
    assert.deepEqual(await readdir(victimDir), []);
    await assert.rejects(readFile(gone), /ENOENT/, 'dangling junction target must not be created');
    await assert.rejects(readFile(missing), /ENOENT/, 'dangling symlink target must not be created');
  } finally { await rm(temp, { recursive: true, force: true }); }
});
