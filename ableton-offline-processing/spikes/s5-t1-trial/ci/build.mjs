// Explicit separate trial static check + CommonJS bundle. No SDK runtime/CLI import or host launcher.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, '../../..');
const args = process.argv.slice(2);
const option = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const tsc = realpathSync(option('--tsc') ?? path.join(root, 'ableton-offline-processing/engine/node_modules/typescript/lib/tsc.js'));
const esbuild = realpathSync(option('--esbuild') ?? path.join(root, 'ableton-offline-processing/engine/node_modules/esbuild/bin/esbuild'));
const types = path.resolve(path.dirname(tsc), '../../@types');
const sdk = realpathSync(option('--sdk-types') ?? path.join(project, '../s5-t1/ci/sdk-stub.d.mts'));
const config = path.join(project, '.compile.generated.json');
const manifest = JSON.parse(readFileSync(path.join(project, 'manifest.trial.json'), 'utf8'));
const entry = path.resolve(project, manifest.entry);
if (path.relative(project, entry).startsWith('..') || path.extname(entry) !== '.js') {
  throw new Error('Manifest entry must be a .js file inside the controlled trial directory');
}
writeFileSync(config, JSON.stringify({ compilerOptions: {
  target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', lib: ['es2023'],
  strict: true, erasableSyntaxOnly: true, skipLibCheck: true, types: ['node'], typeRoots: [types],
  allowJs: true, checkJs: false, rewriteRelativeImportExtensions: true, allowImportingTsExtensions: true,
  rootDir: root, noEmit: true,
  paths: { '@ableton-extensions/sdk': [sdk] },
}, include: [path.join(project, 'src/**/*.ts'), path.join(project, 'test/**/*.ts')], exclude: [sdk] }, null, 2));
try {
  const checked = spawnSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit' });
  if (checked.error) throw checked.error;
  if (checked.status !== 0) process.exitCode = checked.status ?? 1;
  else {
    const bundled = spawnSync(process.execPath, [esbuild, path.join(project, 'src/extension.ts'),
      `--outfile=${entry}`, '--bundle', '--format=cjs', '--platform=node', '--target=node24',
      '--external:@ableton-extensions/sdk', '--legal-comments=none', '--log-level=warning'],
    { stdio: 'inherit' });
    if (bundled.error) throw bundled.error;
    process.exitCode = bundled.status ?? 1;
  }
} finally { unlinkSync(config); }
