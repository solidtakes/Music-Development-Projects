import test from 'node:test';
import assert from 'node:assert/strict';
import { builtinModules, createRequire } from 'node:module';
import { readFile, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import { beta1CjsExport, validateBundleRequires } from '../ci/build.mjs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(project, 'manifest.trial.json'), 'utf8'));
const entry = process.env.AOPX_LOADER_TEST_ENTRY ?? path.resolve(project, manifest.entry);
const source = await readFile(entry, 'utf8');
// Module-initialization gate: *no test*, including synthetic negative tests, may
// evaluate a real SDK bundle. It must reject before VM compilation or require().
const mockMarker = '/* AOPX_OFFLINE_MOCK_ONLY_v1 */\n';
if (!source.startsWith(mockMarker) || !source.includes('__t1Mock')) {
  throw new Error('REFUSED: loader tests require a mock SDK bundle');
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

test('ordinary CommonJS loader resolves the mock entry without external SDK', () => {
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
const runChildTest = (testPath: string, artifactPath: string) => {
  const env: NodeJS.ProcessEnv = { ...process.env, AOPX_LOADER_TEST_ENTRY: artifactPath };
  delete env.NODE_TEST_CONTEXT;
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

const mockGateSource = `if (!source.startsWith(mockMarker) || !source.includes('__t1Mock')) {\n  throw new Error('REFUSED: loader tests require a mock SDK bundle');\n}\n`;

// Normalize checkout line endings, but remove only the single, exact expected guard.
// Missing, duplicated or unexpectedly changed guards must fail closed.
function guardRemovedPrefix(testBody: string): string {
  const normalized = testBody.replace(/\r\n/g, '\n');
  assert.equal(normalized.split(mockGateSource).length, 2, 'guard source must match exactly once');
  const mutated = normalized.replace(mockGateSource, '// NEGATIVE CONTROL: guard deliberately removed\n');
  const cutoff = mutated.lastIndexOf("\ntest('non-mock fixture is rejected before evaluation; guard-removal control exposes sentinel'") + 1;
  assert.ok(cutoff > 0, 'self-test cutoff must be present');
  return mutated.slice(0, cutoff);
}

test('non-mock fixture is rejected before evaluation; guard-removal control exposes sentinel', async t => {
  for (const [ending, newline] of [['LF', '\n'], ['CRLF', '\r\n']] as const) {
    await t.test(ending, async () => {
      const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-loader-nonmock-'));
      const originalTest = fileURLToPath(import.meta.url);
      // Isolate the deliberate guard-removal case *outside* the repository tree.
      // It is explicitly invoked by the child runner and is never eligible for
      // concurrent default discovery, even when the project uses a *.test.ts glob.
      const negativeProject = path.join(temp, `isolated-negative-control-${randomUUID()}`);
      const negativeTest = path.join(negativeProject, 'test', 'unguarded-control.ts');
      try {
        const sentinel = path.join(temp, 'nonmock-top-level-was-evaluated.txt');
        const fake = path.join(temp, 'real-sdk-like.cjs');
        await writeFile(fake, `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'executed');\nthrow new Error('REAL_SDK_TOPLEVEL_EXECUTED');\n`);

        const guarded = runChildTest(originalTest, fake);
        const guardedTap = parseTap(guarded.stdout ?? '');
        const guardedTrace = {
          exitCode: guarded.status, signal: guarded.signal, error: guarded.error?.message ?? null,
          stdout: guarded.stdout, stderr: guarded.stderr, tap: guardedTap,
        };
        console.log('AOPX_GUARDED_CHILD_EVIDENCE=' + JSON.stringify(guardedTrace));
        assert.equal(guarded.error, undefined, 'child must launch, not time out or fail to spawn');
        assert.equal(guarded.signal, null, 'child must exit normally');
        assert.equal(guarded.status, 1, 'module initialization must reject non-mock input');
        assert.deepEqual(guardedTap, {
          tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0, todo: 0,
        }, 'must see exactly one failed module-load test, not a skipped recursive runner');
        assert.match(guarded.stdout ?? '', /REFUSED: loader tests require a mock SDK bundle/);
        assert.doesNotMatch((guarded.stdout ?? '') + (guarded.stderr ?? ''),
          /REAL_SDK_TOPLEVEL_EXECUTED|recursively within a test file|ERR_UNKNOWN_FILE_EXTENSION/);
        await assert.rejects(readFile(sentinel), /ENOENT/,
          'no sentinel write is allowed when the guard is present');

        // Negative control: remove ONLY the module-initialization guard from a
        // separate throwaway project under the OS temp directory. Copy the minimal
        // relative dependencies, so no test source is ever written into the live
        // test/ folder or a default test-discovery glob.
        const testBody = await readFile(originalTest, 'utf8');
        const withoutGuard = guardRemovedPrefix(testBody).replace(/\n/g, newline);
        assert.ok(!negativeTest.startsWith(project + path.sep),
          'negative-control test must reside outside the project');
        assert.ok(!negativeTest.endsWith('.test.ts'),
          'negative-control file must not match test discovery naming');
        await mkdir(path.dirname(negativeTest), { recursive: true });
        await mkdir(path.join(negativeProject, 'ci'), { recursive: true });
        await mkdir(path.join(negativeProject, '.build'), { recursive: true });
        await writeFile(path.join(negativeProject, 'ci/build.mjs'),
          await readFile(path.join(project, 'ci/build.mjs')));
        await writeFile(path.join(negativeProject, 'manifest.trial.json'),
          await readFile(path.join(project, 'manifest.trial.json')));
        await writeFile(path.join(negativeProject, '.build/package.json'),
          await readFile(path.join(project, '.build/package.json')));
        await writeFile(negativeTest, withoutGuard, { flag: 'wx' });

        const unguarded = runChildTest(negativeTest, fake);
        const unguardedTap = parseTap(unguarded.stdout ?? '');
        const unguardedTrace = {
          exitCode: unguarded.status, signal: unguarded.signal, error: unguarded.error?.message ?? null,
          stdout: unguarded.stdout, stderr: unguarded.stderr, tap: unguardedTap,
        };
        console.log('AOPX_UNGUARDED_NEGATIVE_CONTROL=' + JSON.stringify({ ending, ...unguardedTrace }));
        assert.equal(unguarded.error, undefined);
        assert.equal(unguarded.signal, null);
        assert.equal(unguarded.status, 1);
        assert.ok(unguardedTap.tests >= 3 && unguardedTap.fail >= 1 && unguardedTap.skipped === 0,
          'unguarded child must execute actual loader tests and report failures');
        assert.match(unguarded.stdout ?? '', /REAL_SDK_TOPLEVEL_EXECUTED/,
          'unguarded loader must reach the synthetic non-mock top-level throw');
        assert.equal(await readFile(sentinel, 'utf8'), 'executed',
          'negative control must observe the attempted top-level filesystem write');
      } finally {
        // The negative fixture and sentinel share this one scratch root. No
        // cleanup can delete or modify a file beneath the real project.
        await rm(temp, { recursive: true, force: true });
      }
    });
  }
});


test('guard-removal matching accepts LF and CRLF but rejects an absent, altered or duplicate guard', async () => {
  const body = (await readFile(fileURLToPath(import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  const lf = guardRemovedPrefix(body);
  assert.equal(guardRemovedPrefix(body.replace(/\n/g, '\r\n')), lf);
  assert.ok(lf.includes('// NEGATIVE CONTROL: guard deliberately removed\n'));
  assert.ok(!lf.includes(mockGateSource));
  const badSources = [
    body.replace(mockGateSource, ''),
    body.replace(mockGateSource, mockGateSource.replace("source.includes('__t1Mock')", "source.includes('__unexpected')")),
    body + mockGateSource,
  ];
  for (const bad of badSources) {
    assert.throws(() => guardRemovedPrefix(bad), /guard source must match exactly once/);
    assert.throws(() => guardRemovedPrefix(bad.replace(/\n/g, '\r\n')), /guard source must match exactly once/);
  }
  assert.deepEqual(parseTap('# tests 1\r\n# pass 0\r\n# fail 1\r\n# cancelled 0\r\n# skipped 0\r\n# todo 0\r\n'),
    { tests: 1, pass: 0, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
});

// Isolated scratch integration: no installed toolchain, real SDK, host, media or repo files.
// Two deliberately failing builders prove that the fixed manifest entry is invalidated
// both before and after synthetic compiler output, without deleting unrelated files.
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
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
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

    // Failure AFTER a synthetic esbuild emits a rejected candidate and metafile.
    // No dependency installation or real SDK execution; only synthetic Node scripts.
    const tsDir = path.join(temp, 'tools/typescript');
    const esDir = path.join(temp, 'tools/esbuild');
    const tscPath = path.join(tsDir, 'lib/tsc.js');
    const esPath = path.join(esDir, 'bin/esbuild.js');
    const stub = path.join(temp, 'spikes/s5-t1/ci/sdk-stub.d.mts');
    const mock = path.join(temp, 'spikes/s5-t1/ci/runtime-sdk.mjs');
    for (const dir of [path.dirname(tscPath), path.dirname(esPath), path.dirname(stub)]) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path.join(tsDir, 'package.json'), JSON.stringify({name:'typescript',version:'5.9.3'}));
    await writeFile(path.join(esDir, 'package.json'), JSON.stringify({name:'esbuild',version:'0.28.1'}));
    await writeFile(tscPath, '// synthetic compiler: no source emission\n');
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
    assert.match(late.stderr, /Unexpected external\/dynamic dependencies/);
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
    await writeFile(path.join(scratchProject, 'manifest.trial.json'), JSON.stringify({ entry: manifest.entry }));
    await writeFile(unrelated, 'must survive');

    const checkInvalid = async (scriptPath: string) => {
      for (const file of outputs) await writeFile(file, 'stale controlled output');
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
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
const pinnedParser = () => nativeRequire(path.join(path.dirname(offlineTsc()), 'typescript.js'));

test('syntax-aware validator accepts an SDK-free esbuild CommonJS helper without evaluating output', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'aopx-cjs-validator-'));
  try {
    const fixture = "module.exports = { synthetic: true };\nthrow new Error('VALIDATOR_MUST_NOT_EVALUATE_OUTPUT');\n";
    const input = "import value from './fixture.cjs';\nexport const result = value;\n";
    await writeFile(path.join(temp, 'fixture.cjs'), fixture);
    await writeFile(path.join(temp, 'entry.mjs'), input);
    const outputPath = path.join(temp, 'unvalidated-output.js');
    const esbuild = process.env.AOPX_OFFLINE_ESBUILD ??
      path.resolve(project, '../../engine/node_modules/esbuild/bin/esbuild');
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const built = spawnSync(process.execPath, [esbuild, 'entry.mjs', '--outfile=' + outputPath,
      '--bundle', '--format=cjs', '--platform=node', '--target=node24',
      '--legal-comments=none', '--log-level=warning'],
    { cwd: temp, env, encoding: 'utf8', timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(built.error, undefined);
    assert.equal(built.signal, null);
    assert.equal(built.status, 0, built.stderr);
    const generated = await readFile(outputPath, 'utf8');
    assert.match(generated, /function __require\(\)/, 'must exercise the actual compiler-generated helper');
    assert.match(generated, /VALIDATOR_MUST_NOT_EVALUATE_OUTPUT/);
    assert.doesNotThrow(() => validateBundleRequires(generated, pinnedParser()));
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    console.log('AOPX_CJS_VALIDATOR_FIXTURE=' + JSON.stringify({
      fixtureSha256: sha(fixture), entrySha256: sha(input), outputSha256: sha(generated),
      sdkUsed: false, outputEvaluated: false,
    }));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('syntax-aware validator accepts declaration names and allowed literal built-ins', () => {
  const parser = pinnedParser();
  for (const candidate of [
    'var wrap = (cb, mod) => function __require() { return mod; };',
    'function __require() {} function require() {}',
    'require("node:fs"); __require("node:path");',
    'require /* comment */ ("node:fs");',
  ]) assert.doesNotThrow(() => validateBundleRequires(candidate, parser));
});

test('syntax-aware validator rejects genuine forbidden calls, including inside helpers and beside lookalikes', async t => {
  const parser = pinnedParser();
  const cases = [
    'require(target);', '__require(target);', 'require();', '__require();',
    'require(...["node:fs"]);', 'require("node:fs", extra);',
    'require(`node:fs`);', 'require("node:" + name);',
    'require("fs");', '__require("@blocked/package");', 'require("node:not-a-built-in");',
    'var wrap = () => function __require() { require(target); };',
    'function __require() { __require(target); }',
    '// function __require() {}\nrequire /* hidden */ (target);',
    'const decoy = "function __require() {}"; __require /* hidden */ ("@blocked/package");',
    'const decoy = "require(\'node:fs\')"; require /* hidden */ (target);',
    'const decoy = /__require\\(/; __require /* hidden */ ();',
    'const decoy = `text ${require(target)}`;',
    '(require)(target);', 'requ\\u0069re(target);',
    'module.require /* hidden */ (target);', 'globalThis["require"]("@blocked/package");',
    'require.call(null, target);', '__require.apply(null, [target]);',
    'require.bind(null, target)();', 'require?.(target);',
    'import /* hidden */ ("node:fs");',
  ];
  for (const [index, candidate] of cases.entries()) {
    await t.test(String(index + 1) + ': ' + candidate, () => {
      assert.throws(() => validateBundleRequires(candidate, parser), /unexpected or nonliteral require/);
    });
  }
});

test('syntax-aware validator fails closed on malformed syntax, unavailable parser or incomplete traversal', () => {
  const parser = pinnedParser();
  assert.throws(() => validateBundleRequires('function {', parser), /syntax parsing failed/);
  assert.throws(() => validateBundleRequires('require("node:fs");', undefined), /pinned TypeScript/);
  assert.throws(() => validateBundleRequires('', { ...parser, version: '0.0.0' }), /pinned TypeScript/);
  assert.throws(() => validateBundleRequires('', { ...parser, createSourceFile: () => null }), /syntax parsing failed/);
  assert.throws(() => validateBundleRequires('require("node:fs");', {
    ...parser, forEachChild: () => { throw new Error('parser traversal failed'); },
  }), /parser traversal failed/);
});
