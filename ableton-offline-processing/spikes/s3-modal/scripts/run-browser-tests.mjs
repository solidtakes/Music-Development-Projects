// Runs the S3 browser suite with AOPX_REQUIRE_BROWSER=1 so it fails instead of skipping without Playwright.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', join(root, 'test', 'browser-probe.test.ts')], {
  cwd: root, stdio: 'inherit', env: { ...process.env, AOPX_REQUIRE_BROWSER: '1' },
});
if (result.error) { console.error(result.error); process.exit(1); }
process.exit(result.status ?? 1);
