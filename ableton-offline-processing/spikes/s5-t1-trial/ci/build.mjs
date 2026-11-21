// Controlled offline compiler + standalone CommonJS bundle. Never imports/executes the SDK or host.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
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
const builtin = new Set(builtinModules.map(x => x.replace(/^node:/, '')));
const expectedSdk = Object.freeze({
  package: '73f16b890dd533a50e2dbbae7db848d0c4528d87259843da6228ce216422e5ed',
  runtime: '691a663878e1bee659a406ba86632fb1fe951fac92f0029e176156d0361b994c',
  declarations: 'b0b6d355c3459c14e7729e3641d26a1592b53f65f65e1664652a8a9b1ad3570a',
});
const MOCK_HEADER = '/* AOPX_OFFLINE_MOCK_ONLY_v1 */\n';

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

const contained = (base, target) => {
  const rel = path.relative(base, target);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

function main() {
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
    const resolveFile = (option, fallback) => realpathSync(path.resolve(options.get(option) ?? fallback));
    const tsc = resolveFile('--tsc', path.join(root, 'ableton-offline-processing/engine/node_modules/typescript/lib/tsc.js'));
    const esbuild = resolveFile('--esbuild', path.join(root, 'ableton-offline-processing/engine/node_modules/esbuild/bin/esbuild'));
    const types = path.resolve(path.dirname(tsc), '../../@types');
    const sdkTypes = resolveFile('--sdk-types', path.join(project, '../s5-t1/ci/sdk-stub.d.mts'));
    const sdkRuntime = isMock ? realpathSync(path.join(project, '../s5-t1/ci/runtime-sdk.mjs')) : resolveFile('--sdk-runtime');
    const tscPackage = json(path.resolve(path.dirname(tsc), '../package.json'));
    const esbuildPackage = json(path.resolve(path.dirname(esbuild), '../package.json'));
    if (tscPackage.name !== 'typescript' || tscPackage.version !== '5.9.3') {
      throw new Error(`Expected locked TypeScript 5.9.3, found ${tscPackage.name}@${tscPackage.version}`);
    }
    if (esbuildPackage.name !== 'esbuild' || esbuildPackage.version !== '0.28.1') {
      throw new Error(`Expected locked esbuild 0.28.1, found ${esbuildPackage.name}@${esbuildPackage.version}`);
    }
    if (!isMock) {
      const sdkRoot = path.dirname(path.dirname(sdkRuntime));
      const pkgFile = path.join(sdkRoot, 'package.json');
      const pkg = json(pkgFile);
      const publishedCjs = beta1CjsExport(pkg);
      if (sha256(pkgFile) !== expectedSdk.package ||
          realpathSync(path.resolve(sdkRoot, publishedCjs)) !== sdkRuntime ||
          !contained(sdkRoot, sdkRuntime) || !contained(sdkRoot, sdkTypes) ||
          sdkTypes !== realpathSync(path.resolve(sdkRoot, './dist/index.d.mts')) ||
          sha256(sdkRuntime) !== expectedSdk.runtime ||
          sha256(sdkTypes) !== expectedSdk.declarations) {
        throw new Error('SDK runtime/declarations identity or approved beta.1 hashes mismatch');
      }
    }
    const run = (file, command) => {
      const done = spawnSync(process.execPath, [file, ...command], { cwd: root, stdio: 'inherit' });
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
    run(esbuild, [path.join(project, 'src/extension.ts'), `--outfile=${candidate}`,
      '--bundle', '--format=cjs', '--platform=node', '--target=node24',
      `--alias:@ableton-extensions/sdk=${sdkRuntime}`, `--metafile=${metaPath}`,
      '--legal-comments=none', '--log-level=warning']);
    const metadata = json(metaPath);
    const inputs = Object.keys(metadata.inputs ?? {});
    const sdkInput = isMock ? 's5-t1/ci/runtime-sdk.mjs' : 'dist/index.cjs';
    if (!inputs.some(x => x.replaceAll('\\', '/').endsWith(sdkInput))) {
      throw new Error('Build dependency closure omits the selected SDK runtime');
    }
    const imports = Object.values(metadata.outputs ?? {}).flatMap(output => output.imports ?? []);
    const badImports = imports.filter(i => !i.external || !i.path?.startsWith('node:') || !builtin.has(i.path.slice(5)));
    if (badImports.length) throw new Error(`Unexpected external/dynamic dependencies: ${JSON.stringify(badImports)}`);
    const output = readFileSync(candidate, 'utf8');
    const requires = /\b(?:__require|require)\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g;
    const specs = [...output.matchAll(requires)].map(m => m[2]);
    if (specs.some(s => !s.startsWith('node:') || !builtin.has(s.slice(5))) ||
        /\b(?:__require|require)\s*\(/.test(output.replace(requires, ''))) {
      throw new Error('Bundle contains unexpected or nonliteral require()');
    }
    if (/^\s*(?:import|export)\s/m.test(output) || /\bimport\s*\(/.test(output)) {
      throw new Error('Bundle contains ESM syntax or dynamic import()');
    }
    if (isMock) writeFileSync(candidate, MOCK_HEADER + output);
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(packageScope, '{"type":"commonjs"}\n');
    renameSync(candidate, entry); // Final manifest entry appears only after complete validation.
    console.log(JSON.stringify({ mode: isMock ? 'mock-sdk' : 'real-beta1-sdk',
      toolchain: { node: process.version, typescript: tscPackage.version, esbuild: esbuildPackage.version,
        platform: process.platform, arch: process.arch, tscSha256: sha256(tsc), esbuildSha256: sha256(esbuild) },
      sdk: { version: isMock ? 'synthetic-mock-only' : '1.0.0-beta.1',
        runtimeSha256: sha256(sdkRuntime), declarationsSha256: sha256(sdkTypes) },
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
