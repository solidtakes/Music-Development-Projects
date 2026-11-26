// Controlled offline compiler + standalone CommonJS bundle. Never imports/executes the SDK or host.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, '../../..');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const lstatMaybe = file => {
  try { return lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
// A1 grants only the observed external capabilities. The broader syntax policy
// remains deferred to A2: this validator is not a JavaScript sandbox.
const builtin = new Set(['fs', 'fs/promises', 'path', 'crypto']);
const expectedSdk = Object.freeze({
  package: '73f16b890dd533a50e2dbbae7db848d0c4528d87259843da6228ce216422e5ed',
  runtime: '691a663878e1bee659a406ba86632fb1fe951fac92f0029e176156d0361b994c',
  declarations: 'b0b6d355c3459c14e7729e3641d26a1592b53f65f65e1664652a8a9b1ad3570a',
  cjsDeclarations: '7128d5b34a865ceef194715998e35a8a947a029e6dd6679b21f36cc8bd35f6f2',
});
const MOCK_HEADER = '/* AOPX_OFFLINE_MOCK_ONLY_v1 */\n';

/** @template T @param {T} value @returns {T} */
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const commonInputs = [
  ['ableton-offline-processing/engine/src/wav.ts', '048827447faadf973ff3407e3fbab73cbeb40a9163d9570dfaeafbc9ad08453f'],
  ['ableton-offline-processing/engine/src/dsp.ts', '39b8ad7017c01b62d0fa6321745dd7daece636a0131d56d16dc6778fbc57efde'],
  ['ableton-offline-processing/spikes/s5-design/fake-host.mjs', 'ef71a7474507c68eb8e3ce4c4e4e1e830edbc9a81896be18c619db52b02d3876'],
  ['ableton-offline-processing/spikes/s5-t1/src/confirm.ts', '8c95c76c397a12dda4ee5733c46f2bc78d2a3c5fe9102bd05270d0473929b06a'],
  ['ableton-offline-processing/spikes/s5-t1/src/flow.ts', 'fe1798e28590995b44d2bc3ce48bb948fb949d691594c232e55cec022aa3fc91'],
  ['ableton-offline-processing/spikes/s5-t1/src/files.ts', '2a68463f1859e7e2b4f1bf74aa27c30e7a6d1858070be45fb71fd1f454753147'],
  ['ableton-offline-processing/spikes/s5-t1/src/live-port.ts', '106e617cdb80a5976e7f79fbb75ed23e51de64de89fcfc6140b743642a837ffe'],
  ['ableton-offline-processing/spikes/s5-t1-trial/src/profile.ts', '11d9c45894e2cf8725f417fe2d6f3540879cc9e9c43a713affbbebb7c631b9b5'],
  ['ableton-offline-processing/spikes/s5-t1-trial/src/consent.ts', 'eddb62fa4aca8a1effdfe9411dd1e53ae613e4dca61844ba9adae46a0d77c134'],
  ['ableton-offline-processing/spikes/s5-t1-trial/src/trial.ts', '1c1f67c8f6f1a586b7bb19fb39ec418319a41c7a0b2506266fd160d000b61fa4'],
  ['ableton-offline-processing/spikes/s5-t1-trial/src/extension.ts', '2000bd63733d1b88a487fc0b2b59fdef0b730decad2dd4b31b22713ca35c6595'],
].map(([id, sha256]) => ({ id, sha256, format: 'esm' }));
export const INPUT_POLICIES = freeze({
  real: [{ id: 'sdk:dist/index.cjs', sha256: expectedSdk.runtime, format: 'cjs' }, ...commonInputs],
  mock: [{ id: 'ableton-offline-processing/spikes/s5-t1/ci/runtime-sdk.mjs',
    sha256: '695316e4386ad7f132c6e967f8661b29c415451f15bd6bc3aeee95e7d78f51b6', format: 'esm' }, ...commonInputs],
});
export const EXTERNAL_POLICIES = freeze({
  real: ['node:fs', 'node:fs/promises', 'node:path', 'node:path', 'node:crypto', 'node:crypto'],
  mock: ['node:fs', 'node:fs/promises', 'node:path', 'node:path', 'node:crypto', 'node:crypto'],
});
/** @type {Readonly<{package: string, runtime: string, declarations: string, cjsDeclarations: string}>} */
export const SDK_POLICY = freeze({ ...expectedSdk });
export const WINDOWS_TOOL_POLICY = freeze({
  typescript: {
    'package.json': '822ef7ca6452205657b6288b066481ecf508bfbf43455d715cf7d3ec457561e6',
    'lib/tsc.js': '2cffde0b8c6760dfb0b5b0382bbb7e00ba6a8b2d981b9205b256a700a481d983',
    'lib/_tsc.js': 'e8f349eabd48486bdb2bf9dc1a00c89d58297270c54b745838879e2859194419',
    'lib/typescript.js': '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675',
  },
  esbuild: {
    'package.json': 'd55d1d19fcc5b6079e4a71dd4111340c79c682bc36835ac7058a0c364c7db58a',
    'bin/esbuild': 'fe9a7b65a540d8df1a0f59941d52e7c1260c36fed9a2af3dd966f15381b6eb76',
    'lib/main.js': '8331fe1d8b3a07381f33cc425fcfaa94776e263113653f80ec3ba433e9657e73',
  },
  native: {
    'package.json': '4a63b84fa1059fef348e29e3a39c26168213bb7f0aa1ac0174e439cc1e62a9f8',
    'esbuild.exe': 'ec02ee9b14ab332416fedd10614dfb80eed5304d94f67745067c011934a8c3c3',
  },
});

// JSON.parse and parser diagnostics alone both silently accept duplicate keys.
// Walk JSON property tokens before constructing any object; never evaluate text.
export function strictJson(text, ts) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 2 * 1024 * 1024 || ts?.version !== '5.9.3') {
    throw new Error('Invalid JSON input or pinned parser');
  }
  const ast = ts.parseJsonText('metadata.json', text);
  if (!ast || !Array.isArray(ast.parseDiagnostics) || ast.parseDiagnostics.length) throw new Error('Invalid JSON syntax');
  let nodes = 0;
  const walk = (node, depth) => {
    if (++nodes > 100000 || depth > 100) throw new Error('JSON complexity limit');
    if (ts.isObjectLiteralExpression(node)) {
      const keys = new Set();
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name)) throw new Error('Invalid JSON property');
        const key = property.name.text;
        if (keys.has(key)) throw new Error('Duplicate JSON key: ' + key);
        keys.add(key);
      }
    }
    ts.forEachChild(node, child => { walk(child, depth + 1); });
  };
  walk(ast, 0);
  return JSON.parse(text);
}

const samePath = (a, b) => path.relative(a, b) === '';
const fileIdentity = stat => `${stat.dev}:${stat.ino}`;
// The root itself may have been explicitly selected through an invocation alias.
// Once canonicalized, no descendant link/reparse or non-file is admitted.
export function snapshotFile(base, relative, expectedHash, maxBytes = 1024 * 1024, asText = true) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash) || typeof relative !== 'string' ||
      relative.includes('\\') || relative.includes(':') || relative.includes('\0') ||
      relative.split('/').some(x => !x || x === '.' || x === '..')) throw new Error('Invalid enrolled path/hash');
  const canonicalRoot = realpathSync(base);
  if (!lstatSync(canonicalRoot).isDirectory()) throw new Error('Invalid enrolled root');
  let current = canonicalRoot;
  const parts = relative.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = lstatSync(current, { bigint: true });
    if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) {
      throw new Error('Unsafe enrolled path: ' + current);
    }
  }
  const before = lstatSync(current, { bigint: true });
  if (before.size > BigInt(maxBytes) || before.ino === 0n) throw new Error('Input size/file identity unavailable');
  const fd = openSync(current, constants.O_RDONLY);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || fileIdentity(opened) !== fileIdentity(before) || opened.size !== before.size) throw new Error('Input changed before read');
    const buffer = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    const bytes = buffer.subarray(0, length);
    const after = fstatSync(fd, { bigint: true });
    if (after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs ||
        bytes.length !== Number(before.size) || fileIdentity(lstatSync(current, { bigint: true })) !== fileIdentity(before) ||
        !samePath(realpathSync(current), current)) throw new Error('Input changed during read');
    if (digest(bytes) !== expectedHash) throw new Error('Enrolled content hash mismatch: ' + relative);
    if (asText) new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { path: current, relative, sha256: expectedHash, identity: fileIdentity(before), bytes };
  } finally { closeSync(fd); }
}

// Explicit .mts virtual names preserve the reviewed package's ESM/Node interop
// for TypeScript without asking esbuild to discover any package.json on disk.
const compilerIdentity = (id, format) => format === 'esm' && id.endsWith('.ts') ? id.slice(0, -3) + '.mts' : id;
/** @param {ReadonlyArray<{id: string, sha256: string, format: string}>} policy @param {{repo: string, sdk?: string}} roots */
export function snapshotInputs(policy, roots) {
  const ids = new Set(), paths = new Set(), identities = new Set();
  return policy.map(item => {
    if (ids.has(item.id)) throw new Error('Duplicate enrolled identity');
    if (!['esm', 'cjs'].includes(item.format)) throw new Error('Unenrolled module format');
    ids.add(item.id);
    const sdk = item.id.startsWith('sdk:');
    const captured = snapshotFile(sdk ? roots.sdk : roots.repo, sdk ? item.id.slice(4) : item.id, item.sha256);
    const key = process.platform === 'win32' ? captured.path.toLowerCase() : captured.path;
    if (paths.has(key) || identities.has(captured.identity)) throw new Error('Duplicate canonical/physical input');
    paths.add(key); identities.add(captured.identity);
    return { ...captured, id: item.id, format: item.format, compilerId: compilerIdentity(item.id, item.format) };
  });
}

// Pure SDK byte verification. Synthetic tests can supply a fixture policy;
// production main always uses SDK_POLICY and exposes no policy override option.
export function verifySdkIdentity(bytes, ts, policy = SDK_POLICY) {
  for (const key of ['package', 'runtime', 'declarations', 'cjsDeclarations']) {
    if (!(bytes[key] instanceof Uint8Array) || digest(bytes[key]) !== policy[key]) throw new Error('SDK hash mismatch: ' + key);
  }
  const pkg = strictJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes.package), ts);
  beta1CjsExport(pkg);
  const branch = pkg.exports?.['.']?.import;
  if (!branch || Object.keys(branch).sort().join(',') !== 'default,types' ||
      branch.types !== './dist/index.d.mts' || branch.default !== './dist/index.mjs' ||
      pkg.engines?.node !== '>=24.16.0') throw new Error('SDK declarations/import/engine identity mismatch');
  return { name: pkg.name, version: pkg.version, hashes: { ...policy } };
}

export function snapshotSdk(runtime, types, ts, policy = SDK_POLICY) {
  const sdkRoot = path.dirname(path.dirname(path.resolve(runtime)));
  if (!samePath(path.resolve(runtime), path.join(sdkRoot, 'dist/index.cjs')) ||
      !samePath(path.resolve(types), path.join(sdkRoot, 'dist/index.d.mts'))) throw new Error('SDK files must belong to the same enrolled package');
  /** @type {Record<string, ReturnType<typeof snapshotFile>>} */
  const files = {};
  for (const [key, relative] of Object.entries({ package: 'package.json', runtime: 'dist/index.cjs',
    declarations: 'dist/index.d.mts', cjsDeclarations: 'dist/index.d.cts' })) {
    files[key] = snapshotFile(sdkRoot, relative, policy[key]);
  }
  const descriptor = verifySdkIdentity(Object.fromEntries(Object.entries(files).map(([key, s]) => [key, s.bytes])), ts, policy);
  return { descriptor, files, root: sdkRoot, canonicalRoot: path.dirname(path.dirname(files.runtime.path)) };
}

// The compiled SDK runtime must be the same physical file whose package identity
// was verified: same canonical path, file identity and digest. No second package.
export function bindSdkRuntime(sdkSnapshot, inputSnapshots) {
  const verified = sdkSnapshot?.files?.runtime;
  const compiled = inputSnapshots.filter(s => s.id === 'sdk:dist/index.cjs');
  if (!verified || compiled.length !== 1 || !samePath(compiled[0].path, verified.path) ||
      compiled[0].identity !== verified.identity || compiled[0].sha256 !== verified.sha256 ||
      digest(compiled[0].bytes) !== verified.sha256) throw new Error('Compiled SDK runtime is not the verified package runtime');
  return compiled[0];
}

export function verifyWindowsTools(tsc, esbuild) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Only the reviewed Windows x64 toolchain is enrolled');
  const locations = {
    typescript: path.resolve(path.dirname(tsc), '..'), esbuild: path.resolve(path.dirname(esbuild), '..'),
    native: path.resolve(path.dirname(esbuild), '../../@esbuild/win32-x64'),
  };
  if (!samePath(path.resolve(tsc), path.join(locations.typescript, 'lib/tsc.js')) ||
      !samePath(path.resolve(esbuild), path.join(locations.esbuild, 'bin/esbuild'))) throw new Error('Unexpected enrolled tool path');
  /** @type {Record<string, ReturnType<typeof snapshotFile>>} */
  const files = {};
  for (const [group, entries] of Object.entries(WINDOWS_TOOL_POLICY)) {
    for (const [relative, hash] of Object.entries(entries)) {
      files[group + '/' + relative] = snapshotFile(locations[group], relative, hash, 16 * 1024 * 1024, !relative.endsWith('.exe'));
    }
  }
  const pkg = group => JSON.parse(files[group + '/package.json'].bytes.toString('utf8'));
  if (pkg('typescript').name !== 'typescript' || pkg('typescript').version !== '5.9.3' ||
      pkg('esbuild').name !== 'esbuild' || pkg('esbuild').version !== '0.28.1' ||
      pkg('native').name !== '@esbuild/win32-x64' || pkg('native').version !== '0.28.1') throw new Error('Tool package identity mismatch');
  return files;
}

export function verifyExternals(imports, mode, policies = EXTERNAL_POLICIES) {
  const expected = policies[mode];
  if (!expected || !Array.isArray(imports) || imports.some(i => i.external !== true || i.kind !== 'require-call' || !expected.includes(i.path)) ||
      JSON.stringify(imports.map(i => i.path).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error('Unexpected external/dynamic dependencies or multiset');
  }
}

// No default package resolver is used. Only these already verified byte buffers
// can enter the compiler; filesystem changes after capture cannot replace them.
export function verifiedInputBroker(snapshots, entry, mode) {
  const records = snapshots.map(s => {
    if (digest(s.bytes) !== s.sha256) throw new Error('Snapshot buffer changed');
    if (!['esm', 'cjs'].includes(s.format) || s.compilerId !== compilerIdentity(s.id, s.format)) throw new Error('Unenrolled compiler identity');
    return { ...s, bytes: Buffer.from(s.bytes) };
  });
  const key = p => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);
  const byPath = new Map(records.map(s => [key(s.path), s]));
  const byId = new Map(records.map(s => [s.compilerId, s]));
  if (byPath.size !== records.length || byId.size !== records.length || !byPath.has(key(entry))) throw new Error('Duplicate broker input or missing entry');
  const sdk = records.find(s => s.id === (mode === 'real' ? 'sdk:dist/index.cjs' : 'ableton-offline-processing/spikes/s5-t1/ci/runtime-sdk.mjs'));
  if (!sdk) throw new Error('Missing selected SDK in broker');
  const loaded = new Set();
  const entryKey = key(entry);
  const resolve = args => {
    let selected;
    if (args.kind === 'entry-point') {
      if (key(args.path) !== entryKey) throw new Error('Unexpected entry point: ' + args.path);
      selected = path.resolve(args.path);
    } else {
      // Import provenance comes from esbuild's importer namespace, not a name match:
      // only modules this broker loaded may import anything, externals included.
      if (args.namespace !== 'aopx-verified' || !byId.has(args.importer)) throw new Error('Unverified importer: ' + args.importer);
      if (EXTERNAL_POLICIES[mode]?.includes(args.path)) return { path: args.path, external: true };
      if (args.path === '@ableton-extensions/sdk') selected = sdk.path;
      else if (args.path.startsWith('./') || args.path.startsWith('../')) {
        selected = path.resolve(path.dirname(byId.get(args.importer).path), args.path);
      } else throw new Error('Unenrolled import: ' + args.path);
    }
    const record = byPath.get(key(selected));
    if (!record) throw new Error('Unexpected input resolution: ' + selected);
    return { path: record.compilerId, namespace: 'aopx-verified' };
  };
  const load = args => {
    const record = byId.get(args.path);
    if (!record || digest(record.bytes) !== record.sha256) throw new Error('Unverified input load');
    loaded.add(record.id);
    return { contents: Buffer.from(record.bytes), loader: record.path.endsWith('.ts') ? 'ts' : 'js', resolveDir: path.dirname(record.path) };
  };
  return { resolve, load, loaded,
    plugin: { name: 'aopx-verified-inputs', setup(build) {
      build.onResolve({ filter: /.*/ }, resolve);
      build.onLoad({ filter: /.*/, namespace: 'aopx-verified' }, load);
    } },
  };
}

export function verifyBundleMetadata(text, ts, snapshots, loaded, cwd, candidate, mode) {
  const metadata = strictJson(text, ts);
  if (!metadata || !metadata.inputs || !metadata.outputs || Array.isArray(metadata.inputs) || Array.isArray(metadata.outputs)) throw new Error('Invalid bundle metadata');
  const remaining = new Set(snapshots.map(s => s.id));
  const seenPaths = new Set();
  for (const [input, value] of Object.entries(metadata.inputs)) {
    if (!input.startsWith('aopx-verified:')) throw new Error('Unexpected metadata namespace');
    const record = snapshots.find(s => input === 'aopx-verified:' + s.compilerId);
    if (!record || !remaining.has(record.id) || seenPaths.has(record.identity) || value.bytes !== record.bytes.length) throw new Error('Unexpected, duplicate or substituted metadata input');
    remaining.delete(record.id); seenPaths.add(record.identity);
  }
  if (remaining.size || loaded.size !== snapshots.length || snapshots.some(s => !loaded.has(s.id))) throw new Error('Missing verified bundle input');
  const outputs = Object.entries(metadata.outputs);
  if (outputs.length !== 1 || !samePath(path.resolve(cwd, outputs[0][0]), candidate)) throw new Error('Unexpected bundle output');
  const imports = outputs[0][1].imports;
  verifyExternals(imports, mode);
  return { metadata, imports };
}

// Pure function: exactly the verified beta.1 conditional CommonJS export, no fallback.
export function beta1CjsExport(pkg) {
  if (pkg?.name !== '@ableton-extensions/sdk' || pkg.version !== '1.0.0-beta.1') {
    throw new Error('Unexpected SDK identity');
  }
  const branch = pkg.exports?.['.']?.require;
  if (!branch || typeof branch !== 'object' || Array.isArray(branch) ||
      Object.keys(branch).sort().join(',') !== 'default,types' ||
      branch.types !== './dist/index.d.cts' || branch.default !== './dist/index.cjs') {
    throw new Error('Unsupported beta.1 conditional CJS export');
  }
  return branch.default;
}

// Parse text only: never load/evaluate the bundle. Keep the conservative text
// checks, excluding only function-name tokens (esbuild emits function __require()).
// Inspect every body and real call before excluding any declaration name.
export function validateBundleRequires(output, ts) {
  if (typeof output !== 'string' || ts?.version !== '5.9.3') {
    throw new Error('Bundle validation requires the pinned TypeScript 5.9.3 parser');
  }
  const parsed = ts.createSourceFile('bundle.js', output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (!parsed || !Array.isArray(parsed.parseDiagnostics) || parsed.parseDiagnostics.length) {
    throw new Error('Bundle syntax parsing failed');
  }
  const loaderNames = new Set(['require', '__require']);
  const functionNames = [];
  const reject = () => { throw new Error('Bundle contains unexpected or nonliteral require()'); };
  const unparenthesized = node => {
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  const loaderName = node => {
    node = unparenthesized(node);
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteral(node.argumentExpression)) {
      return node.argumentExpression.text;
    }
    return null;
  };
  const visit = node => {
    if ((ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) &&
        node.name && loaderNames.has(node.name.text)) {
      functionNames.push([node.name.getStart(parsed), node.name.end]);
    }
    if (ts.isCallExpression(node)) {
      const callee = unparenthesized(node.expression);
      if (callee.kind === ts.SyntaxKind.ImportKeyword) reject();
      // Indirect .call/.apply/.bind must not bypass the literal-call rule.
      if (ts.isPropertyAccessExpression(callee) && ['call', 'apply', 'bind'].includes(callee.name.text) &&
          loaderNames.has(loaderName(callee.expression))) reject();
      if (loaderNames.has(loaderName(callee))) {
        if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) reject();
        const spec = node.arguments[0].text;
        if (!spec.startsWith('node:') || !builtin.has(spec.slice(5))) reject();
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  let checked = output;
  for (const [start, end] of functionNames.sort((a, b) => b[0] - a[0])) {
    checked = checked.slice(0, start) + ' '.repeat(end - start) + checked.slice(end);
  }
  const requires = /\b(?:__require|require)\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g;
  const specs = [...checked.matchAll(requires)].map(m => m[2]);
  if (specs.some(s => !s.startsWith('node:') || !builtin.has(s.slice(5))) ||
      /\b(?:__require|require)\s*\(/.test(checked.replace(requires, ''))) reject();
}

// Controlled outputs are never opened at their final paths. On Windows, an exclusive
// ('wx') open still follows a *dangling* junction or symlink and creates its target.
// So bytes go to new files in a fresh mkdtemp directory; each final path must still
// be absent (anything planted after invalidation is refused); rename then moves the
// staged file into place, which replaces rather than follows a link raced in later.
export function writeControlledOutputs(stageParent, files) {
  const stage = mkdtempSync(path.join(stageParent, '.aopx-stage-'));
  const staged = [];
  try {
    for (const [index, [file, contents]] of files.entries()) {
      const temp = path.join(stage, String(index));
      writeFileSync(temp, contents, { flag: 'wx' });
      const s = lstatSync(temp);
      if (s.isSymbolicLink() || !s.isFile()) throw new Error('Unsafe staged output: ' + temp);
      staged.push([temp, file]);
    }
    for (const [, file] of staged) if (lstatMaybe(file)) throw new Error('Unsafe controlled output already present: ' + file);
    for (const [temp, file] of staged) renameSync(temp, file);
  } finally {
    for (const [temp] of staged) {
      const s = lstatMaybe(temp);
      if (s && s.isFile() && !s.isSymbolicLink()) unlinkSync(temp);
    }
    rmdirSync(stage); // Non-recursive: fails closed if anything unexpected was added.
  }
}

const contained = (base, target) => {
  const rel = path.relative(base, target);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

async function main() {
  const manifest = json(path.join(project, 'manifest.trial.json'));
  const buildDir = path.join(project, '.build');
  const entry = path.resolve(project, manifest.entry);
  const packageScope = path.join(buildDir, 'package.json');
  const metaPath = path.join(buildDir, 'bundle-meta.json');
  const candidate = `${entry}.aopx-pending.js`;
  const config = path.join(project, '.compile.generated.json');
  if (!contained(buildDir, entry) || !contained(project, entry) || path.extname(entry) !== '.js') {
    throw new Error('Manifest entry must be a .js file inside the controlled .build directory');
  }
  // Reject symlinked parents before deleting or writing anything. No recursive deletion.
  const checkParents = () => {
    let dir = buildDir;
    for (const part of ['.', ...path.relative(buildDir, path.dirname(entry)).split(path.sep)]) {
      if (part !== '.') dir = path.join(dir, part);
      {
        const s = lstatMaybe(dir);
        if (!s) continue;
        if (s.isSymbolicLink() || !s.isDirectory()) throw new Error(`Unsafe build directory: ${dir}`);
      }
    }
  };
  const clearOutputs = () => {
    checkParents();
    for (const item of [candidate, entry, packageScope, metaPath]) {
      {
        const s = lstatMaybe(item);
        if (!s) continue;
        if (s.isSymbolicLink() || !s.isFile()) throw new Error(`Unsafe generated artifact: ${item}`);
        unlinkSync(item);
      }
    }
  };
  checkParents();
  clearOutputs(); // Must invalidate a stale entry even if SDK or toolchain validation rejects.
  let madeConfig = false;
  try {
    const args = process.argv.slice(2);
    const allowed = new Set(['--tsc', '--esbuild', '--sdk-types', '--sdk-runtime', '--sdk-mock']);
    const options = new Map();
    for (let i = 0; i < args.length; i++) {
      const key = args[i];
      if (!allowed.has(key) || options.has(key)) throw new Error(`Unrecognized or repeated build option: ${key}`);
      if (key === '--sdk-mock') options.set(key, true);
      else {
        const value = args[++i];
        if (!value || value.startsWith('--')) throw new Error(`Missing path for ${key}`);
        options.set(key, value);
      }
    }
    const isMock = options.has('--sdk-mock');
    if (isMock === options.has('--sdk-runtime')) {
      throw new Error('Select exactly one of --sdk-mock or --sdk-runtime <verified beta.1 dist/index.cjs>');
    }
    if (!isMock && !options.has('--sdk-types')) {
      throw new Error('Real SDK builds require --sdk-types from the same verified beta.1 package');
    }
    const resolveFile = (option, fallback) => path.resolve(options.get(option) ?? fallback);
    const tsc = resolveFile('--tsc', path.join(root, 'ableton-offline-processing/engine/node_modules/typescript/lib/tsc.js'));
    const esbuild = resolveFile('--esbuild', path.join(root, 'ableton-offline-processing/engine/node_modules/esbuild/bin/esbuild'));
    const types = path.resolve(path.dirname(tsc), '../../@types');
    const sdkTypes = resolveFile('--sdk-types', path.join(project, '../s5-t1/ci/sdk-stub.d.mts'));
    const sdkRuntime = isMock ? path.resolve(project, '../s5-t1/ci/runtime-sdk.mjs') : resolveFile('--sdk-runtime');
    const toolFiles = verifyWindowsTools(tsc, esbuild);
    const requireTool = createRequire(import.meta.url);
    const typescript = requireTool(toolFiles['typescript/lib/typescript.js'].path);
    if (typescript.version !== '5.9.3') throw new Error('Pinned parser version mismatch');
    const mode = isMock ? 'mock' : 'real';
    let sdkReceipt, sdkSnapshot;
    if (!isMock) {
      sdkSnapshot = snapshotSdk(sdkRuntime, sdkTypes, typescript);
      sdkReceipt = sdkSnapshot.descriptor;
    } else {
      const stub = path.resolve(project, '../s5-t1/ci/sdk-stub.d.mts');
      if (!samePath(sdkTypes, stub)) throw new Error('Mock declarations must be the enrolled repository stub');
      const declaration = snapshotFile(root, 'ableton-offline-processing/spikes/s5-t1/ci/sdk-stub.d.mts',
        '1530613f8ab08e9c0ba9c49d0673872c4b94991c936df1b9474dd6afd157dfaa');
      sdkReceipt = { name: 'synthetic-mock-only', hashes: { declarations: declaration.sha256 } };
    }
    // The compiled runtime is captured from the canonical root of the verified package.
    const snapshots = snapshotInputs(INPUT_POLICIES[mode], { repo: root, sdk: sdkSnapshot?.canonicalRoot });
    if (!isMock) bindSdkRuntime(sdkSnapshot, snapshots);
    const broker = verifiedInputBroker(snapshots, path.join(project, 'src/extension.ts'), mode);
    const run = (file, command) => {
      const env = { ...process.env };
      delete env.NODE_OPTIONS; delete env.NODE_PATH; delete env.NODE_TEST_CONTEXT;
      const done = spawnSync(process.execPath, [file, ...command], { cwd: root, stdio: 'inherit', env });
      if (done.error) throw done.error;
      if (done.status !== 0) throw new Error(`Offline compiler failed (${done.status ?? 'signal'})`);
    };
    mkdirSync(path.dirname(entry), { recursive: true });
    checkParents();
    if (lstatMaybe(config)) throw new Error('Existing temporary compiler config; refuse to overwrite');
    writeFileSync(config, JSON.stringify({ compilerOptions: {
      target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', lib: ['es2023'],
      strict: true, erasableSyntaxOnly: true, skipLibCheck: true, types: ['node'], typeRoots: [types],
      allowJs: true, checkJs: false, rewriteRelativeImportExtensions: true, allowImportingTsExtensions: true,
      rootDir: root, noEmit: true, paths: { '@ableton-extensions/sdk': [sdkTypes] },
    }, include: [path.join(project, 'src/**/*.ts'), path.join(project, 'test/**/*.ts')], exclude: [sdkTypes] }, null, 2));
    madeConfig = true;
    run(tsc, ['-p', config]);
    const priorBinary = process.env.ESBUILD_BINARY_PATH;
    let built;
    try {
      process.env.ESBUILD_BINARY_PATH = toolFiles['native/esbuild.exe'].path;
      const api = requireTool(toolFiles['esbuild/lib/main.js'].path);
      if (api.version !== '0.28.1') throw new Error('Pinned bundler version mismatch');
      built = await api.build({ absWorkingDir: root, entryPoints: [path.join(project, 'src/extension.ts')],
        outfile: candidate, bundle: true, format: 'cjs', platform: 'node', target: 'node24',
        legalComments: 'none', logLevel: 'warning', metafile: true, write: false,
        tsconfigRaw: { compilerOptions: { target: 'ES2023', useDefineForClassFields: true } },
        plugins: [broker.plugin] });
    } finally {
      if (priorBinary === undefined) delete process.env.ESBUILD_BINARY_PATH;
      else process.env.ESBUILD_BINARY_PATH = priorBinary;
    }
    const metadataText = JSON.stringify(built.metafile, null, 2) + '\n';
    const { imports } = verifyBundleMetadata(metadataText, typescript, snapshots, broker.loaded, root, candidate, mode);
    if (built.outputFiles?.length !== 1 || !samePath(built.outputFiles[0].path, candidate)) throw new Error('Unexpected compiler output files');
    const output = new TextDecoder('utf-8', { fatal: true }).decode(built.outputFiles[0].contents);
    validateBundleRequires(output, typescript);
    if (/^\s*(?:import|export)\s/m.test(output) || /\bimport\s*\(/.test(output)) {
      throw new Error('Bundle contains ESM syntax or dynamic import()');
    }
    checkParents();
    writeControlledOutputs(buildDir, [[metaPath, metadataText], [candidate, (isMock ? MOCK_HEADER : '') + output],
      [packageScope, '{"type":"commonjs"}\n']]);
    renameSync(candidate, entry); // Final manifest entry appears only after complete validation.
    console.log(JSON.stringify({ mode: isMock ? 'mock-sdk' : 'real-beta1-sdk',
      policy: { version: 'A1', sha256: digest(JSON.stringify({ inputs: INPUT_POLICIES[mode], externals: EXTERNAL_POLICIES[mode], sdk: SDK_POLICY, tools: WINDOWS_TOOL_POLICY })) },
      inputs: snapshots.map(({ id, compilerId, format, path, relative, sha256, identity, bytes }) => ({ id, compilerId, format, path, relative, sha256, identity, bytes: bytes.length })),
      toolchain: { node: process.version, typescript: typescript.version, esbuild: '0.28.1',
        platform: process.platform, arch: process.arch, tscSha256: sha256(tsc), esbuildSha256: sha256(esbuild) },
      toolFiles: Object.fromEntries(Object.entries(toolFiles).map(([id, s]) => [id, { path: s.path, sha256: s.sha256 }])),
      sdk: { version: isMock ? 'synthetic-mock-only' : '1.0.0-beta.1',
        ...sdkReceipt, runtimeSha256: snapshots[0].sha256 },
      artifact: { entry: manifest.entry, bytes: readFileSync(entry).length,
        sha256: sha256(entry), packageScopeSha256: sha256(packageScope),
        externalImports: imports.map(i => i.path) } }, null, 2));
  } catch (error) {
    try { clearOutputs(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Build failed and generated output cleanup was unsafe'); }
    throw error;
  } finally {
    if (madeConfig && lstatMaybe(config)) unlinkSync(config);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
