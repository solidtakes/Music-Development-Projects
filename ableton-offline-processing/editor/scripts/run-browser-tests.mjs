/*
 * Cross-platform runner for the mandatory browser suite (npm run test:browser).
 * Sets AOPX_REQUIRE_BROWSER=1 in-process instead of using shell syntax such as
 * `VAR=1 cmd`, which fails in Windows CMD and PowerShell. With the flag set, the
 * suite fails (rather than skips) if Playwright/Chromium is unavailable.
 * Lives outside test/ so plain `node --test` discovery does not pick it up.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath,
  ['--test', join(root, 'test', 'browser-reorder.test.mjs'), join(root, 'test', 'browser-host-contract.test.mjs'), join(root, 'test', 'browser-waveform.test.mjs')],
  { cwd: root, stdio: 'inherit', env: { ...process.env, AOPX_REQUIRE_BROWSER: '1' } },
);
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
