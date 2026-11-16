/*
 * Assemble the AOPX S3 live-probe folder that becomes the downloadable ZIP.
 *
 *   node ci/assemble.mjs <outDir>            -> <outDir>/aopx-s3-probe  (what the owner downloads)
 *   node ci/assemble.mjs <outDir> --ci-build -> the same, plus a CI variant at <outDir>/ci-build that
 *                                               uses the SDK stub instead of the SDK .tgz files
 *
 * The ZIP holds sources only: no node_modules, no dist, no SDK files. The shared harness files are
 * copied from the canonical repo sources, so they cannot drift from what CI tests.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const repoAop = join(pkg, '..', '..');
const [outDir, flag] = process.argv.slice(2);
if (!outDir) { console.error('usage: node ci/assemble.mjs <outDir> [--ci-build]'); process.exit(2); }

const FILES = [
  ['manifest.json', join(pkg, 'manifest.json')],
  ['package.json', join(pkg, 'package.json')],
  ['tsconfig.json', join(pkg, 'tsconfig.json')],
  ['build.ts', join(pkg, 'build.ts')],
  ['run.ps1', join(pkg, 'run.ps1')],
  ['README.txt', join(pkg, 'README.txt')],
  ['src/extension.ts', join(pkg, 'src', 'extension.ts')],
  ['src/probe-core.mjs', join(pkg, 'src', 'probe-core.mjs')],
  ['src/html.d.ts', join(pkg, 'src', 'html.d.ts')],
  ['src/delivery.mjs', join(repoAop, 'spikes', 's3-modal', 'delivery.mjs')],
  ['src/probe.html', join(repoAop, 'spikes', 's3-modal', 'probe.html')],
  ['src/interface.html', join(repoAop, 'editor', 'interface.html')],
  // The product result parser, so G2-apply is checked by the real contract code inside Live.
  ['src/product/host/src/modal.ts', join(repoAop, 'host', 'src', 'modal.ts')],
  ['src/product/engine/src/contract.ts', join(repoAop, 'engine', 'src', 'contract.ts')],
];

async function listFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(p)));
    else out.push(p);
  }
  return out.sort();
}

const target = join(outDir, 'aopx-s3-probe');
await rm(target, { recursive: true, force: true });
for (const [rel, src] of FILES) {
  await mkdir(dirname(join(target, rel)), { recursive: true });
  await cp(src, join(target, rel));
}
const sums = [];
let total = 0;
for (const f of await listFiles(target)) {
  const bytes = await readFile(f);
  total += (await stat(f)).size;
  sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${relative(target, f).split('\\').join('/')}`);
}
await writeFile(join(target, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log(`assembled ${FILES.length} files (${total} bytes) into ${target}`);

if (flag === '--ci-build') {
  const ci = join(outDir, 'ci-build');
  await rm(ci, { recursive: true, force: true });
  await cp(target, ci, { recursive: true });
  const p = JSON.parse(await readFile(join(ci, 'package.json'), 'utf8'));
  // The real SDK .tgz is not available in CI: depend on the stub instead (declared, so npm keeps it).
  p.dependencies['@ableton-extensions/sdk'] = 'file:./ci-sdk-stub';
  delete p.devDependencies['@ableton-extensions/cli']; // `npm start` / Live connection is not run in CI
  await writeFile(join(ci, 'package.json'), JSON.stringify(p, null, 2) + '\n');
  await cp(join(here, 'sdk-stub'), join(ci, 'ci-sdk-stub'), { recursive: true });
  console.log(`CI build variant (SDK stub) at ${ci}`);
}
