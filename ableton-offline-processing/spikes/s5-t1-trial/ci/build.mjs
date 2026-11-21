// Controlled offline compiler + standalone CommonJS bundle. Never imports/executes the SDK or host.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';
import { readFileSync, writeFileSync, unlinkSync, realpathSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, '../../..');
const argv = process.argv.slice(2);
const allowed = new Set(['--tsc', '--esbuild', '--sdk-types', '--sdk-runtime', '--sdk-mock']);
const options = new Map();
for (let i = 0; i < argv.length; i++) {
  const key = argv[i];
  if (!allowed.has(key) || options.has(key)) throw new Error(`Unrecognized or repeated build option: ${key}`);
  if (key === '--sdk-mock') options.set(key, true);
  else {
    const value = argv[++i];
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
const sdkRuntime = isMock
  ? realpathSync(path.join(project, '../s5-t1/ci/runtime-sdk.mjs'))
  : resolveFile('--sdk-runtime');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const tscPackage = json(path.resolve(path.dirname(tsc), '../package.json'));
const esbuildPackage = json(path.resolve(path.dirname(esbuild), '../package.json'));
if (tscPackage.name !== 'typescript' || tscPackage.version !== '5.9.3') {
  throw new Error(`Expected locked TypeScript 5.9.3, found ${tscPackage.name}@${tscPackage.version}`);
}
if (esbuildPackage.name !== 'esbuild' || esbuildPackage.version !== '0.28.1') {
  throw new Error(`Expected locked esbuild 0.28.1, found ${esbuildPackage.name}@${esbuildPackage.version}`);
}
const contains = (base, target) => {
  const relative = path.relative(base, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
if (!isMock) {
  const sdkRoot = path.dirname(path.dirname(sdkRuntime));
  const pkg = json(path.join(sdkRoot, 'package.json'));
  const publishedCjs = pkg.exports?.['.']?.require ?? pkg.exports?.require ?? pkg.main;
  if (pkg.name !== '@ableton-extensions/sdk' || pkg.version !== '1.0.0-beta.1' ||
      typeof publishedCjs !== 'string' ||
      realpathSync(path.resolve(sdkRoot, publishedCjs)) !== sdkRuntime ||
      !contains(sdkRoot, sdkTypes)) {
    throw new Error('SDK runtime and declarations must match the verified beta.1 CJS package export');
  }
}
const manifest = json(path.join(project, 'manifest.trial.json'));
const entry = path.resolve(project, manifest.entry);
if (!contains(project, entry) || !contains(path.join(project, '.build'), entry) || path.extname(entry) !== '.js') {
  throw new Error('Manifest entry must be a .js file inside controlled .build/');
}
const buildDir = path.join(project, '.build');
const packageScope = path.join(buildDir, 'package.json');
const metaPath = path.join(buildDir, 'bundle-meta.json');
const config = path.join(project, '.compile.generated.json');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const builtin = new Set(builtinModules.map(x => x.replace(/^node:/, '')));
const run = (file, args) => {
  const done = spawnSync(process.execPath, [file, ...args], { cwd: root, stdio: 'inherit' });
  if (done.error) throw done.error;
  if (done.status !== 0) throw new Error(`Offline compiler failed (${done.status ?? 'signal'})`);
};
mkdirSync(buildDir, { recursive: true });
writeFileSync(config, JSON.stringify({ compilerOptions: {
  target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', lib: ['es2023'],
  strict: true, erasableSyntaxOnly: true, skipLibCheck: true, types: ['node'], typeRoots: [types],
  allowJs: true, checkJs: false, rewriteRelativeImportExtensions: true, allowImportingTsExtensions: true,
  rootDir: root, noEmit: true, paths: { '@ableton-extensions/sdk': [sdkTypes] },
}, include: [path.join(project, 'src/**/*.ts'), path.join(project, 'test/**/*.ts')], exclude: [sdkTypes] }, null, 2));
try {
  run(tsc, ['-p', config]);
  run(esbuild, [path.join(project, 'src/extension.ts'), `--outfile=${entry}`,
    '--bundle', '--format=cjs', '--platform=node', '--target=node24',
    `--alias:@ableton-extensions/sdk=${sdkRuntime}`, `--metafile=${metaPath}`,
    '--legal-comments=none', '--log-level=warning']);
  const metadata = json(metaPath);
  const imports = Object.values(metadata.outputs).flatMap(output => output.imports ?? []);
  const badImports = imports.filter(i => !i.external || !i.path?.startsWith('node:') ||
    !builtin.has(i.path.slice(5)));
  if (badImports.length) throw new Error(`Unexpected external/dynamic dependencies: ${JSON.stringify(badImports)}`);
  const output = readFileSync(entry, 'utf8');
  const requires = /\b(?:__require|require)\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g;
  const specs = [...output.matchAll(requires)].map(m => m[2]);
  if (specs.some(s => !s.startsWith('node:') || !builtin.has(s.slice(5))) ||
      /\b(?:__require|require)\s*\(/.test(output.replace(requires, ''))) {
    throw new Error('Bundle contains an unexpected or nonliteral require()');
  }
  if (/^\s*(?:import|export)\s/m.test(output) || /\bimport\s*\(/.test(output)) {
    throw new Error('Bundle contains ESM syntax or dynamic import()');
  }
  writeFileSync(packageScope, '{"type":"commonjs"}\n');
  console.log(JSON.stringify({ mode: isMock ? 'mock-sdk' : 'real-beta1-sdk',
    toolchain: { node: process.version, typescript: tscPackage.version, esbuild: esbuildPackage.version,
      platform: process.platform, arch: process.arch, tscSha256: sha256(tsc), esbuildSha256: sha256(esbuild) },
    sdk: { version: isMock ? 'synthetic-mock-only' : '1.0.0-beta.1',
      runtimeSha256: sha256(sdkRuntime), declarationsSha256: sha256(sdkTypes) },
    artifact: { entry: manifest.entry, bytes: readFileSync(entry).length,
      sha256: sha256(entry), packageScopeSha256: sha256(packageScope),
      externalImports: imports.map(i => i.path) } }, null, 2));
} finally {
  unlinkSync(config);
}
