import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EXTERNAL_POLICIES, INPUT_POLICIES, runCompiler, snapshotFile, snapshotInputs,
  verifyBundleMetadata, verifyCompilerTools, verifySdkIdentity, verifiedInputBroker } from '../ci/build.mjs';
import { readPinnedParser, sanitizedNodeEnv, SYNTAX_LIMITS, validateInWorker, validateSyntax,
  verifySyntaxExternals } from '../ci/syntax-policy.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const compiler = process.env.AOPX_OFFLINE_TSC ?? path.resolve(project, '../../engine/node_modules/typescript/lib/tsc.js');
const esbuild = process.env.AOPX_OFFLINE_ESBUILD ?? path.resolve(project, '../../engine/node_modules/esbuild/bin/esbuild');
const sha = data => createHash('sha256').update(data).digest('hex');
const parserPath = path.join(path.dirname(compiler), 'typescript.js');
const parser = readPinnedParser(parserPath);
const inspect = (text, mode = 'mock', ts = parser) => validateSyntax(Buffer.from(text), ts, mode);
const results = [];

function row(id, label, expected, check) {
  test(id + ' ' + label, async () => {
    try {
      await check();
      results.push({ id, expected, actual: expected });
    } catch (error) {
      results.push({ id, expected, actual: 'FAIL', reason: error.message });
      throw error;
    }
  });
}

function denies(id, text, reason = /^SP-\d\d:/, mode = 'mock') {
  row(id, 'reject parse-only fixture', 'reject', () => assert.throws(() => inspect(text, mode), { message: reason }));
}

async function temporary(action) {
  // The hosted Windows TEMP can use a short path alias.
  const dir = realpathSync.native(await mkdtemp(path.join(os.tmpdir(), 'aopx-a2-')));
  try { return await action(dir); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

after(() => {
  if (!process.env.AOPX_A2_REAL_ENTRY) results.push({
    id: 'C08-real', expected: 'accept', actual: 'owner-local',
    reason: 'Verified Ableton SDK is available for owner-local compile-only qualification',
  });
  console.log('AOPX_A2_MATRIX=' + JSON.stringify(results.sort((a, b) => a.id.localeCompare(b.id))));
});

// Issue #40 vectors are data passed only to the parser.
const A = [
  'const r = require; r(target);',
  'const l = __require; l("@blocked/pkg");',
  'const { require: q } = module; q(target);',
  '(0, require)(target);',
  '(0, __require)("@blocked/pkg");',
  '[require][0](target);',
  'Reflect.apply(require, null, [target]);',
  'Function.prototype.call.call(require, null, target);',
  'module[`require`]("@blocked/pkg");',
  'globalThis["req"+"uire"]("@blocked/pkg");',
  'require`@blocked/pkg`;',
  'require("node:module").createRequire(__filename)("@blocked/pkg");',
  'require("node:child_process").execSync("id");',
  'module.constructor._load("@blocked/pkg");',
  'eval("req" + "uire(target)");',
  'new Function("r", "return r(\\"x\\")")(require);',
  'process.dlopen(module, "/tmp/x.node");',
  'process.mainModule.require(target);',
  'new require("@blocked/pkg");',
];
A.forEach((text, i) => denies('A' + String(i + 1).padStart(2, '0'), text));
const B = [
  ['arguments[1]("@blocked/pkg");'],
  ['(() => arguments[1])()("@blocked/pkg");'],
  ['process.getBuiltinModule("node:child_process").execSync("id");'],
  ['Reflect.get(module, "require")(target);'],
  ['Object.getOwnPropertyDescriptor(module, "require").value(target);'],
  ['with (module) { this.x = 1; }'],
  ['(() => {}).constructor("return process")().getBuiltinModule("node:vm");'],
  ['Object.getPrototypeOf(async function(){}).constructor("x")();'],
  ['function f(r = require) { return r(target); }'],
  ['class A { r = require; }'],
  ['({ get r() { return require; } }).r(target);'],
  ['require.cache[k] = evil;'],
  ['global.process.mainModule.constructor._load("x");'],
  ['require.main.require(target);'],
  ['({ require }).require(target);'],
  ['module?.["require"](target);'],
  ['module.require(target);'],
  ['// note\u2028require(target);'],
  ['function f(require) { return require(target); }'],
  ['this.require = 1;', 'exports.require = 1;'],
  ['x = 1 <!-- require(target)', '--> require(target)'],
  ['Function.prototype.bind.call(require, null)("x")'],
  ['globalThis[k](target)', 'globalThis?.[k]'],
  ['module["constructor"]', 'module[`_load`]'],
];
B.forEach((cases, i) => cases.forEach((text, j) =>
  denies('B' + String(i + 1).padStart(2, '0') + (j ? '-' + (j + 1) : ''), text)));

const legacy = [
  'require(target);', '__require(target);', 'require();', '__require();',
  'require(...["node:fs"]);', 'require("node:fs", extra);',
  'require(`node:fs`);', 'require("node:" + name);', 'require("fs");',
  '__require("@blocked/package");', 'require("node:not-a-built-in");',
  'var wrap = () => function __require() { require(target); };',
  'function __require() { __require(target); }',
  '// function __require() {}\nrequire /* hidden */ (target);',
  'const decoy = "function __require() {}"; __require /* hidden */ ("@blocked/package");',
  'const decoy = "require(\'node:fs\')"; require /* hidden */ (target);',
  'const decoy = /__require\\(/; __require /* hidden */ ();',
  'const decoy = `text ${require(target)}`;', '(require)(target);', 'requ\\u0069re(target);',
  'module.require /* hidden */ (target);', 'globalThis["require"]("@blocked/package");',
  'require.call(null, target);', '__require.apply(null, [target]);', 'require.bind(null, target)();',
  'require?.(target);', 'import /* hidden */ ("node:fs");',
];
legacy.forEach((text, i) => denies('2.3-' + (i + 1), text, i === 17 ? /^SP-01:/ : undefined));

const helper = [
  'var __commonJS = (cb, mod) => function __require() {',
  '  try {',
  '    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;',
  '  } catch (e) {',
  '    throw mod = 0, e;',
  '  }',
  '};',
].join('\n');
row('C01', 'pinned esbuild helper with inert payload', 'accept', () => {
  assert.deepEqual(inspect(helper + '\nconst probe = __commonJS({ probe() { throw new Error("never execute"); } });'), []);
});
denies('C02', helper.replace('  try {', '  try { require(target);'), /^SP-07:/);
denies('SP-07-shape', helper.replace('throw mod = 0, e;', 'throw mod = 1, e;'), /^SP-07:/);
row('C03', 'direct typeof require', 'accept', () => assert.deepEqual(inspect('var hasReq = typeof require !== "undefined";'), []));
for (const name of new Set(EXTERNAL_POLICIES.mock)) {
  row('C04-' + name, 'literal allowed external', 'accept', () => assert.deepEqual(inspect('require(' + JSON.stringify(name) + ');'), [name]));
}
row('C05', 'reviewed SDK-like local constructor parameter', 'accept', () => {
  inspect('class C { constructor(module) { this.module = module; } get m() { return this.module; } }');
});
row('C06', 'reviewed CommonJS exports', 'accept', () => {
  inspect('module.exports = {x:1}; module.exports.x = 2; exports.x = 1; module.exports = __toCommonJS(values);');
});
row('C07', 'comment, string, regex and cooked template are data', 'accept', () => {
  inspect('const msg = "require(x)"; /* require(x) <!-- */ const rx = /require\\(x/; const cooked = `require(x) -->`;');
});
row('C09-mock', 'mock ambient path', 'accept', () => inspect('globalThis.__t1Mock;'));
denies('C09-real', 'globalThis.__t1Mock;', /^SP-12:/, 'real');
row('SP-01-multiset', 'exact AST calls and metafile agreement', 'reject', () => {
  const expected = EXTERNAL_POLICIES.mock;
  const calls = inspect(expected.map(name => 'require(' + JSON.stringify(name) + ');').join('\n'));
  verifySyntaxExternals(calls, expected);
  assert.throws(() => verifySyntaxExternals(calls.slice(1), expected), /multisets differ/);
});

row('2.5-ambient', 'ambient module and locally bound this', 'accept', () => {
  inspect('module.exports = {}; class X { f() { return this.module.x; } }');
});
denies('2.5-module-shadow', 'function f(module){ module.require(x); }');
row('2.5-local-arguments', 'ordinary function owns arguments', 'accept', () => inspect('function f(){ return arguments[0]; }'));
for (const [id, source] of [
  ['2.5-var', 'var require = 1;'], ['2.5-let', 'let __require;'],
  ['2.5-catch', 'try {} catch (require) {}'], ['2.5-import', 'import { x as require } from "x";'],
  ['2.5-tdz', '{ typeof require; let require; }'], ['2.5-argument-shadow', 'function f(arguments){}'],
  ['2.5-wrapper-arguments', '(() => arguments[0])();'],
]) denies(id, source);

const roots = ['module', 'exports', 'require', '__require', 'globalThis', 'global', 'process', 'this', 'arguments'];
const computed = [
  ['string', '"require"'], ['template', '`require`'], ['substitution', '`req${part}`'],
  ['concat', '"req"+"uire"'], ['variable', 'key'], ['number', '0'], ['symbol', 'Symbol.iterator'],
];
for (const root of roots) {
  for (const [label, key] of computed) denies('2.6-' + root + '-' + label, root + '[' + key + '];');
  denies('2.6-' + root + '-optional', root + '?.[key];');
}
row('2.6-positive', 'enumerated literal computed paths', 'accept', () => {
  inspect('module["exports"].x = 1; exports[`x`] = 2; globalThis["__t1Mock"].context;');
});
denies('SP-03-escaped', 'const { ["req\\u0075ire"]: f } = candidate;', /^SP-03:/);
denies('SP-03-reflected', 'Reflect.get(anyObject, "getBuiltinModule");', /^SP-03:/);

const dynamic = [
  'eval("x")', '(0, eval)("x")', 'globalThis.eval("x")', 'window.eval("x")',
  'new Function("x")', 'new globalThis.Function("x")', '(function(){}).constructor("x")',
  '(() => {}).constructor("x")', '(async function(){}).constructor("x")',
  '(function*(){}).constructor("x")', '(async function*(){}).constructor("x")',
  '(class {}).constructor("x")', 'Object.getPrototypeOf(()=>{}).constructor("x")',
  'Function.bind(null, "x")', 'Reflect.construct(Function, ["x"])',
  'import("node:fs")', 'import.meta', 'export const x = 1;',
];
dynamic.forEach((text, i) => denies('2.7-' + (i + 1), text));
denies('SP-09-annex-b', 'x = 1 <!-- marker', /^SP-09:/);
denies('SP-09-octal', 'module["\\145xports"];');

function fails(id, reason, action) {
  row(id, 'fail closed with a specific reason', 'reject', () => assert.throws(action, { message: reason }));
}
fails('2.8-malformed', /TypeScript rejected/, () => inspect('function {'));
fails('2.8-parser-version', /Wrong TypeScript parser version/, () => inspect('', 'mock', { ...parser, version: '0' }));
for (const api of ['forEachChild', 'isIdentifier', 'createProgram']) {
  fails('2.8-missing-' + api, /API unavailable/, () => inspect('', 'mock', { ...parser, [api]: undefined }));
}
fails('2.8-missing-binder', /binder diagnostics unavailable/, () => inspect('', 'mock', {
  ...parser, createProgram: () => ({ getTypeChecker: () => ({ getSymbolAtLocation() {} }) }),
}));
fails('2.8-missing-diagnostics', /parse diagnostics unavailable/, () => inspect('', 'mock', {
  ...parser, createSourceFile: () => ({ statements: [] }),
}));
fails('2.8-traversal-throws', /AST traversal threw/, () => inspect('require("node:fs");', 'mock', {
  ...parser, forEachChild: () => { throw new Error('fixture traversal'); },
}));
fails('2.8-binder-throws', /binder threw/, () => inspect('', 'mock', {
  ...parser, createProgram: () => { throw new Error('fixture binder'); },
}));
fails('2.8-unknown-kind', /Unknown SyntaxKind/, () => inspect('require;', 'mock', {
  ...parser, forEachChild: (_node, add) => add({ kind: -1 }),
}));
fails('2.8-output-size', /Output byte limit/, () => inspect(' '.repeat(SYNTAX_LIMITS.bytes + 1)));
fails('2.8-depth', /AST depth limit/, () =>
  inspect('('.repeat(SYNTAX_LIMITS.depth + 1) + '0' + ')'.repeat(SYNTAX_LIMITS.depth + 1)));
fails('2.8-node-count', /AST node limit/, () => inspect(';'.repeat(SYNTAX_LIMITS.nodes)));
fails('2.8-NUL', /NUL in output/, () => validateSyntax(Buffer.from([0xef, 0xbb, 0xbf, 0]), parser, 'mock'));
fails('2.8-invalid-utf8', /Invalid UTF-8/, () => validateSyntax(Buffer.from([0xff]), parser, 'mock'));
fails('2.8-surrogate', /Lone surrogate in identifier/, () => inspect('const \\uD800 = 0;'));
row('2.8-parser-hash', 'one-byte-changed parser refused before loading', 'reject', async () => {
  await temporary(async dir => {
    const candidate = path.join(dir, 'typescript.cjs');
    const bytes = await readFile(parserPath);
    bytes[0] ^= 1;
    await writeFile(candidate, bytes);
    await assert.rejects(validateInWorker(Buffer.alloc(0), candidate, 'mock'), /Wrong TypeScript parser file hash/);
  });
});
row('2.8-timeout', 'validator worker deadline fails closed', 'reject', async () => {
  await temporary(async dir => {
    const source = await readFile(new URL('../ci/syntax-policy.mjs', import.meta.url), 'utf8');
    const destination = path.join(dir, 'syntax-policy.mjs');
    const deadline = /timeoutMs:\s*8_000/;
    assert.match(source, deadline);
    await writeFile(destination, source.replace(deadline, 'timeoutMs: 1'));
    const policy = await import(pathToFileURL(destination).href);
    await assert.rejects(policy.validateInWorker(Buffer.alloc(0), parserPath, 'mock'), /Parser worker timeout/);
  });
});

async function checkBundle(entry, meta, mode, hash) {
  const bytes = await readFile(entry);
  const metadata = JSON.parse(await readFile(meta, 'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  assert.deepEqual(Object.keys(metadata.inputs).sort(), INPUT_POLICIES[mode].map(({ id, format }) =>
    'aopx-verified:' + (format === 'esm' && id.endsWith('.ts') ? id.slice(0, -3) + '.mts' : id)).sort());
  const calls = await validateInWorker(bytes, parserPath, mode);
  verifySyntaxExternals(calls, Object.values(metadata.outputs)[0].imports.map(value => value.path));
  assert.deepEqual(calls, [...EXTERNAL_POLICIES[mode]].sort());
  console.log('AOPX_A2_BUNDLE=' + JSON.stringify({ mode, bytes: bytes.length, sha256: hash, syntaxExternals: calls }));
}
const manifest = JSON.parse(readFileSync(path.join(project, 'manifest.trial.json'), 'utf8'));
row('C08-mock', 'full mock bundle and exact closure', 'accept', () =>
  checkBundle(path.join(project, manifest.entry), path.join(project, '.build/bundle-meta.json'), 'mock',
    'ed59403c04517308669f2fc8d6bb6cd931018826730f8f9b28a2beb512866b2a'));
if (process.env.AOPX_A2_REAL_ENTRY) {
  row('C08-real', 'full real bundle, compile-only and never evaluated', 'accept', () =>
    checkBundle(process.env.AOPX_A2_REAL_ENTRY, process.env.AOPX_A2_REAL_META, 'real',
      'be05c8613f4e805065206e622258c05b67366ca069caa8c5af72b8cdc6ec5bd8'));
}


function fixtureMetadata(mode) {
  const snapshots = INPUT_POLICIES[mode].map(({ id, format }, index) => ({
    id, identity: String(index), bytes: Buffer.from('x'),
    compilerId: format === 'esm' && id.endsWith('.ts') ? id.slice(0, -3) + '.mts' : id,
  }));
  const consumed = new Set(snapshots.map(item => item.id));
  const out = path.resolve('controlled-pending.js');
  const metadata = {
    inputs: Object.fromEntries(snapshots.map(item => ['aopx-verified:' + item.compilerId, { bytes: 1 }])),
    outputs: { [out]: { imports: EXTERNAL_POLICIES[mode].map(name => ({ path: name, kind: 'require-call', external: true })) } },
  };
  return { snapshots, metadata, verify: () => verifyBundleMetadata(
    JSON.stringify(metadata), parser, snapshots, consumed, process.cwd(), out, mode) };
}
for (const mode of ['mock', 'real']) {
  row('P-1-' + mode, 'exact 12-input set', 'accept', () => {
    const f = fixtureMetadata(mode);
    assert.equal(f.snapshots.length, 12);
    f.verify();
  });
}
row('P-1-added-zero', 'extra compiler input with zero output bytes is rejected', 'reject', () => {
  const f = fixtureMetadata('mock');
  f.metadata.inputs['aopx-verified:added.mts'] = { bytes: 0 };
  assert.throws(f.verify, /Unexpected.*metadata input/);
});
for (const [name, mutate] of [
  ['missing', data => { delete data.inputs[Object.keys(data.inputs)[1]]; }],
  ['substitute', data => {
    const key = Object.keys(data.inputs)[1];
    data.inputs['aopx-verified:another/' + key.split('/').at(-1)] = data.inputs[key];
    delete data.inputs[key];
  }],
  ['mode-substitution', data => {
    delete data.inputs['aopx-verified:' + INPUT_POLICIES.mock[0].id];
    data.inputs['aopx-verified:sdk:dist/index.cjs'] = { bytes: 1 };
  }],
]) {
  row('P-1-' + name, 'reject altered closure', 'reject', () => {
    const f = fixtureMetadata('mock');
    mutate(f.metadata);
    assert.throws(f.verify, /Unexpected|Missing/);
  });
}
for (const type of ['byte', 'case', 'hardlink', 'descendant-link']) {
  row('P-1-' + type, 'reject changed bytes or path identity', 'reject', async () => {
    await temporary(async dir => {
      const base = path.join(dir, 'ordinary');
      await mkdir(base);
      const input = path.join(base, 'input.ts');
      await writeFile(input, 'verified');
      const relative = { byte: 'ordinary/input.ts', case: 'ordinary/INPUT.ts',
        hardlink: 'ordinary/alias.ts', 'descendant-link': 'linked/input.ts' }[type];
      if (type === 'byte') await writeFile(input, 'Verified');
      if (type === 'hardlink') await link(input, path.join(base, 'alias.ts'));
      if (type === 'descendant-link') {
        await symlink(base, path.join(dir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
      }
      assert.throws(() => snapshotFile(dir, relative, sha('verified')), /hash mismatch|Hardlink|path casing|Unsafe enrolled|ENOENT/);
    });
  });
}
row('P-1-separator', 'reject identical path bytes under unapproved separator spelling', 'reject', async () => {
  await temporary(async dir => {
    await mkdir(path.join(dir, 'dir'));
    await writeFile(path.join(dir, 'dir', 'entry.ts'), 'fixture');
    assert.throws(() => snapshotFile(dir, 'dir\\entry.ts', sha('fixture')), /Invalid enrolled path/);
  });
});
row('P-2-snapshot', 'only copied verified buffers reach onLoad', 'accept', async () => {
  await temporary(async dir => {
    const id = INPUT_POLICIES.mock[0].id;
    const file = path.join(dir, id);
    await mkdir(path.dirname(file), { recursive: true });
    const original = Buffer.from('export const value = "verified";\n');
    await writeFile(file, original);
    const selected = snapshotInputs([{ id, format: 'esm', sha256: sha(original) }], { repo: dir });
    const broker = verifiedInputBroker(selected, file, 'mock');
    await writeFile(file, 'disk changed');
    selected[0].bytes.fill(0);
    assert.deepEqual(broker.load({ path: id, namespace: 'aopx-verified' }).contents, original);
  });
});

const sdkPackage = () => ({
  name: '@ableton-extensions/sdk', version: '1.0.0-beta.1', engines: { node: '>=24.16.0' },
  exports: { '.': { require: { default: './dist/index.cjs', types: './dist/index.d.cts' },
    import: { default: './dist/index.mjs', types: './dist/index.d.mts' } } },
});
function verifyFixture(packageText) {
  const bytes = {
    package: Buffer.from(packageText), runtime: Buffer.from('throw new Error("unexecuted fixture");'),
    declarations: Buffer.from('// ESM declarations\n'), cjsDeclarations: Buffer.from('// CJS declarations\n'),
  };
  return verifySdkIdentity(bytes, parser, Object.fromEntries(Object.entries(bytes).map(([key, value]) => [key, sha(value)])));
}
for (const [id, change] of [
  ['export-condition', pkg => { pkg.exports['.'].node = './dist/index.cjs'; }],
  ['main', pkg => { pkg.main = './dist/index.cjs'; }],
]) {
  row('P-3-' + id, 'reject alternate SDK resolution', 'reject', () => {
    const pkg = sdkPackage();
    change(pkg);
    assert.throws(() => verifyFixture(JSON.stringify(pkg)), /Unexpected beta.1 export surface/);
  });
}
for (const [id, change, reason] of [
  ['duplicate-decoded', text => '{"n\\u0061me":"duplicate",' + text.slice(1), /Duplicate JSON key/],
  ['truncated', text => text.slice(0, -1), /JSON/i],
]) {
  row('P-3-' + id, 'reject invalid raw package JSON', 'reject', () => {
    assert.throws(() => verifyFixture(change(JSON.stringify(sdkPackage()))), reason);
  });
}

row('P-4-mutation', 'mutated launcher is refused while still bytes', 'reject', async () => {
  const installed = verifyCompilerTools(compiler, esbuild);
  await temporary(async dir => {
    const platform = process.platform === 'win32' ? 'win32-x64' : 'linux-x64';
    for (const [id, file] of Object.entries(installed.files)) {
      const relative = id.startsWith('native/') ? '@esbuild/' + platform + '/' + id.slice(7) : id;
      const target = path.join(dir, relative);
      await mkdir(path.dirname(target), { recursive: true });
      const bytes = Buffer.from(file.bytes);
      if (id === 'esbuild/bin/esbuild') bytes[0] ^= 1;
      await writeFile(target, bytes);
    }
    assert.throws(() => verifyCompilerTools(path.join(dir, 'typescript/lib/tsc.js'), path.join(dir, 'esbuild/bin/esbuild')),
      /Enrolled content hash mismatch/);
  });
});
row('P-4-preload', 'parent preload settings are stripped from compiler child', 'reject', async () => {
  await temporary(async dir => {
    const preload = path.join(dir, 'preload.cjs');
    const sentinel = path.join(dir, 'preload-ran');
    await writeFile(preload, 'require("node:fs").writeFileSync(' + JSON.stringify(sentinel) + ', "bad");');
    const oldOptions = process.env.NODE_OPTIONS;
    const oldPath = process.env.NODE_PATH;
    try {
      process.env.NODE_OPTIONS = '--require="' + preload + '"';
      process.env.NODE_PATH = dir;
      const verified = verifyCompilerTools(compiler, esbuild);
      runCompiler(verified.files['typescript/lib/tsc.js'].path, ['--version'], dir);
      await assert.rejects(readFile(sentinel), /ENOENT/);
    } finally {
      if (oldOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = oldOptions;
      if (oldPath === undefined) delete process.env.NODE_PATH;
      else process.env.NODE_PATH = oldPath;
    }
  });
});

row('P-5-checkout-LF', 'all 13 enrolled checkout files retain raw LF bytes', 'accept', async () => {
  const repo = path.resolve(project, '../../..');
  const paths = [...INPUT_POLICIES.mock.map(item => [item.id, item.sha256]),
    ['ableton-offline-processing/spikes/s5-t1/ci/sdk-stub.d.mts',
      '1530613f8ab08e9c0ba9c49d0673872c4b94991c936df1b9474dd6afd157dfaa']];
  for (const [relative, pin] of paths) {
    const bytes = await readFile(path.join(repo, relative));
    assert.equal(sha(bytes), pin, relative);
    assert.equal(bytes.includes(13), false, relative);
  }
});
row('P-5-forced-CRLF', 'manual CRLF change fails the raw LF hash', 'reject', async () => {
  await temporary(async dir => {
    await writeFile(path.join(dir, 'input.ts'), 'export const x = 1;\r\n');
    assert.throws(() => snapshotFile(dir, 'input.ts', sha('export const x = 1;\n')), /hash mismatch/);
  });
});
row('P-6-cli', 'production builder rejects a policy override', 'reject', async () => {
  await temporary(async dir => {
    const ci = path.join(dir, 'ci');
    await mkdir(ci);
    for (const name of ['build.mjs', 'syntax-policy.mjs']) {
      await writeFile(path.join(ci, name), await readFile(new URL('../ci/' + name, import.meta.url)));
    }
    await writeFile(path.join(dir, 'manifest.trial.json'), JSON.stringify({
      entry: '.build/extension.js',
    }));
    const result = spawnSync(process.execPath, [path.join(ci, 'build.mjs'), '--policy', 'test.json'], {
      cwd: dir, env: { ...sanitizedNodeEnv(), AOPX_POLICY: 'test.json' }, encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unrecognized or repeated build option: --policy/);
  });
});


test('A2 each rule mutation is detected by its named acceptance rows', async () => {
  const clean = sanitizedNodeEnv();
  clean.AOPX_OFFLINE_TSC = path.resolve(clean.AOPX_OFFLINE_TSC ?? path.join(project, '../../engine/node_modules/typescript/lib/tsc.js'));
  clean.AOPX_OFFLINE_ESBUILD = path.resolve(clean.AOPX_OFFLINE_ESBUILD ?? path.join(project, '../../engine/node_modules/esbuild/bin/esbuild'));
  delete clean.AOPX_A2_REAL_ENTRY;
  delete clean.AOPX_A2_REAL_META;

  const rules = [
    ['SP-1', ['A12', 'A13', '2.3-9'], [['!externalNames[mode].includes(parent.arguments[0].text)', 'false']]],
    ['SP-2', ['A01', 'A02', 'A04', 'A05', 'A06', 'B09', 'B10', 'B11'], [
      ["reject('SP-02', 'Loader used outside a direct external call or typeof');", 'return;'],
    ]],
    ['SP-3', ['SP-03-escaped', 'SP-03-reflected'], [
      ["if (propertyNames.has(key)) reject('SP-03', 'Reserved property key: ' + key);", ''],
      ["node.arguments.some(arg => propertyNames.has(literalKey(arg, ts)))", 'false'],
    ]],
    ['SP-4', ['A10', 'B01', 'B02', 'B23', 'B23-2'], [
      ["reject('SP-04', 'Ambient root value or nonliteral/optional access: ' + kind);", 'return;'],
      ["if (!keys.length) reject('SP-04', 'Ambient root value escape: ' + kind);", 'if (!keys.length) return;'],
      ["reject('SP-04', 'Unenrolled ambient access path: ' + kind + '.' + keys.join('.'));", 'return;'],
    ]],
    ['SP-5', ['A15', '2.7-1', '2.7-2', '2.7-5'], [
      ["if (dynamicNames.has(name)) reject('SP-05', 'Dynamic-code capability: ' + name);", 'if (dynamicNames.has(name)) return;'],
    ]],
    ['SP-6', ['2.5-var', '2.5-let', '2.5-catch', '2.5-tdz'], [
      ["reject('SP-06', 'Shadowed reserved binding: ' + name);", 'return;'],
    ]],
    ['SP-7', ['SP-07-shape', 'C02'], [['digest(fn.getText(parsed.source)) !== HELPER_SHA256', 'false']]],
    ['SP-8', ['2.3-18'], [["nodes.push(node);\n    try {", "nodes.push(node);\n    if (ts.isTemplateSpan(node)) continue;\n    try {"]]],
    ['SP-9', ['SP-09-annex-b'], [['if (inOperator(node, source, ts))', 'if (false)']]],
    ['SP-10', ['2.8-output-size'], [['if (bytes.byteLength > SYNTAX_LIMITS.bytes)', 'if (false)']]],
    // Reintroduce the previous text-based false positive to test the SP-11 guarantee.
    ['SP-11', ['C07'], [['const parsed = parse(output, ts);', 'if (/\\brequire\\(/.test(output)) reject("SP-11", "Residual text scan");\n  const parsed = parse(output, ts);']]],
    ['SP-12', ['C09-real'], [["if (mode !== 'mock') reject('SP-12', 'Mock ambient path in real mode');", '']]],
    ['P-1', ['P-1-added-zero'], [['    const record = snapshots.find(s => input', '    if (value.bytes === 0) continue;\n    const record = snapshots.find(s => input']]],
    ['P-2', ['P-2-snapshot'], [['contents: Buffer.from(record.bytes),', 'contents: readFileSync(record.path),']]],
    ['P-3', ['P-3-main'], [["Object.hasOwn(pkg, 'main') || ", '']]],
    ['P-4', ['P-4-mutation'], [
      ['if (digest(bytes) !== expectedHash)', "if (relative !== 'bin/esbuild' && digest(bytes) !== expectedHash)"],
    ]],
    ['P-5', ['P-5-forced-CRLF'], [
      ['if (digest(bytes) !== expectedHash)', "if (digest(asText ? bytes.toString('utf8').replace(/\\r\\n/g, '\\n') : bytes) !== expectedHash)"],
    ]],
    ['P-6', ['P-6-cli'], [["'--sdk-runtime', '--sdk-mock']);", "'--sdk-runtime', '--sdk-mock', '--policy']);"]]],
  ];

  const originals = Object.fromEntries(await Promise.all(['build.mjs', 'syntax-policy.mjs'].map(async file =>
    [file, (await readFile(path.join(project, 'ci', file), 'utf8')).replaceAll('\r\n', '\n')])));
  const result = [];
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [rule, ids, changes] of rules) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'aopx-a2-mutation-'));
    try {
      const mutant = { ...originals };
      const syntax = rule.startsWith('SP-');
      const changed = syntax ? 'syntax-policy.mjs' : 'build.mjs';
      for (const [before, after] of changes) {
        assert.equal(mutant[changed].split(before).length, 2, rule + ' mutation must match exactly once');
        mutant[changed] = mutant[changed].replace(before, () => after);
      }
      await mkdir(path.join(dir, 'ci'));
      await mkdir(path.join(dir, 'test'));
      for (const [name, source] of Object.entries(mutant)) await writeFile(path.join(dir, 'ci', name), source);
      const file = 'a2-acceptance.test.mjs';
      await writeFile(path.join(dir, 'test', file), await readFile(path.join(project, 'test', file)));
      const manifest = await readFile(path.join(project, 'manifest.trial.json'));
      await writeFile(path.join(dir, 'manifest.trial.json'), manifest);
      const pattern = '^(' + ids.map(escape).join('|') + ') ';
      const test = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=' + pattern,
        path.join(dir, 'test', file)], { cwd: dir, env: clean, encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024 });
      const matrix = test.stdout?.split(/\r?\n/).find(line => line.startsWith('# AOPX_A2_MATRIX='));
      assert.ok(matrix, rule + ' acceptance rows did not run: ' + (test.stderr || test.stdout));
      const rows = JSON.parse(matrix.slice('# AOPX_A2_MATRIX='.length)).filter(row => ids.includes(row.id));
      assert.equal(rows.length, ids.length, rule + ' selected rows did not all run: ' + (test.stderr || test.stdout));
      const failures = rows.filter(row => row.actual === 'FAIL').map(row => row.id);
      result.push({ rule, tested: rows.length, failures: failures.length, rows: failures });
      if (test.status !== 1 || !failures.length) {
        console.error(rule + ' was not detected by its acceptance rows', rows);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  console.log('AOPX_A2_MUTATIONS=' + JSON.stringify(result));
  assert.equal(result.length, 18);
  assert.ok(result.every(row => row.failures > 0), 'Every rule mutation must fail at least one named acceptance row');

});
