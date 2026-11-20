// Explicit separate trial STATIC compilation. No SDK runtime/CLI import or host launcher.
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.resolve(project, '../../..');
const args = process.argv.slice(2);
const option = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const tsc = realpathSync(option('--tsc') ?? path.join(root, 'ableton-offline-processing/engine/node_modules/typescript/lib/tsc.js'));
const types = path.resolve(path.dirname(tsc), '../../@types');
const sdk = realpathSync(option('--sdk-types') ?? path.join(project, '../s5-t1/ci/sdk-stub.d.mts'));
const config = path.join(project, '.compile.generated.json');
writeFileSync(config, JSON.stringify({ compilerOptions: {
  target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', lib: ['es2023'],
  strict: true, erasableSyntaxOnly: true, skipLibCheck: true, types: ['node'], typeRoots: [types],
  allowJs: true, checkJs: false, rewriteRelativeImportExtensions: true,
  rootDir: root, outDir: path.join(project, '.build'), noEmitOnError: true,
  paths: { '@ableton-extensions/sdk': [sdk] },
}, include: [path.join(project, 'src/**/*.ts'), path.join(project, 'test/**/*.ts')], exclude: [sdk] }, null, 2));
try {
  const result = spawnSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { unlinkSync(config); }
