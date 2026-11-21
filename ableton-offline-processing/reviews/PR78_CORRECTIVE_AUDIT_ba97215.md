## CLAUDE — PR #78 corrective commit audit @ `ba97215a` — **BLOCKED** (prior findings fixed; new P2; real-SDK build and CI still absent)

**Exact SHA:** `ba97215a04b0acf07d86b6d257a960927ea7800a` on `codex/aopx-pr78-corrective-negative-control-20261121`, tree `18daa5b642ab2996e96db1610bd9bf2023703906`.
- Parent: `c94be7dd895fa2ed8b6fd136ee7eba523a26ce32`.
- Protected heads are unchanged: PR #78 `8c6cfea03915d901e77355ec9d149e563631c9b6`, PR #75 `0f069db9e7a97d0dd8b4bfa26615e26d1f146540` (`git ls-remote`, re-checked before posting).
- Inputs: the Codex handoff #7058890940, the Codex re-audit #7058379349 (real build rejected at `c94be7d`), and my prior audit #7058420942.
- **Restrictions observed:** read-only review and isolated offline tests only. No edits, merges, installs, Live, Extension Host, SDK CLI or native runs. This is not authorization.

### Verdict
| Check | Result |
|---|---|
| Two-file scope; no runtime, workflow, publication-gate, `OWNER_APPROVAL` or `package.py` change | **PASS** |
| Strict beta.1 conditional-export handling | **PASS** |
| SDK package/runtime/declaration identity and hash pins | **PASS** (static; real files not available here) |
| Mock-only gate before any artifact evaluation | **PASS** (fixes my P2-A) |
| Negative control: sentinel, isolation, cleanup | **PASS** |
| Rejected-artifact cleanup; unrelated files preserved | **PASS** (fixes my C4) |
| **`build.mjs` main-module guard** | **P2-B: silent no-op with exit 0 via a symlinked path** |
| Real beta.1 SDK-inclusive bundle and hash | **BLOCKED: not produced** (by anyone) |
| CI | **BLOCKED: 0 runs**, no PR |
| **Overall** | **BLOCKED** |

### Scope and provenance (reproduced)
- `git diff --name-status c94be7d ba97215` lists exactly 2 files, and both hashes match the handoff:
  - `ci/build.mjs`: blob `6b267d72…`, SHA-256 `0bc55b6b…7713`
  - `test/loader-format.test.ts`: blob `05024d1a…`, SHA-256 `e7236213…acfadb`
- The commit is unsigned.
- `git diff c94be7d ba97215 -- .github '*/src/*' '*/OWNER_APPROVAL.md' '*/package.py'` is **empty**.
- Runtime `src` is unchanged vs PR #75 `0f069db`. The workflow and publication gate are unchanged.

### Code review
**Conditional export (`build.mjs:26–37`)**
- `beta1CjsExport` requires `name @ableton-extensions/sdk` and `version 1.0.0-beta.1`.
- `exports['.'].require` must be a plain object whose keys are exactly `default,types`, with `types === './dist/index.d.cts'` and `default === './dist/index.cjs'`. There is no `main` and no string fallback.
- This matches the real beta.1 shape that the Codex re-audit reported. It resolves that P1.

**Identity (`:116–129`)**
- The SDK `package.json`, `dist/index.cjs` and `dist/index.d.mts` SHA-256 values are pinned (`:18–22`): `73f16b89…`, `691a6638…`, `b0b6d355…`. The first two match the earlier, independently staged values in #7037415873.
- The runtime must realpath to the export and sit inside the package root. The declarations must be exactly `dist/index.d.mts`, which is correct: TypeScript uses the `import` condition for the trial's ESM sources.

**Atomic output (`:50, :146, :172`)**
- esbuild writes to `<entry>.aopx-pending.js`. Only after the closure, require and ESM guards pass is it renamed to the manifest entry.
- The mock header is prepended only in mock mode (`:169`).
- The metafile must include the selected SDK input (`:151–155`).

**Cleanup (`:56–79, :181–186`)**
- `clearOutputs` deletes only four named regular files (candidate, entry, `package.json` scope, metafile). It refuses symlinks and non-files, and refuses symlinked or non-directory parents. There is no recursive delete.
- It runs before argument parsing (so it always invalidates stale output) and on any failure.
- An existing compiler config is refused rather than overwritten (`:137`).

**Mock-only gate (`loader-format.test.ts:17–22`)**
- At module scope, before any test, VM compile or `require()`: the source must start with `/* AOPX_OFFLINE_MOCK_ONLY_v1 */\n` **and** contain `__t1Mock`.
- A real bundle never gets the header, so every test, including the synthetic negatives, is unreachable for real-SDK input.

**Negative control (`:197–276`)**
- With the gate present, a child run against a non-mock fixture must report exactly 1 failed test (module load), exit 1, show `REFUSED`, and the sentinel file must stay absent.
- The guard-removed copy runs from a unique OS-temp project at `test/unguarded-control.ts`, which is outside the repo and doesn't match `*.test.ts`. It must reach `REAL_SDK_TOPLEVEL_EXECUTED`, and the sentinel must read `executed`, which proves the control isn't vacuous.
- The child clears `NODE_TEST_CONTEXT`, so it can't be silently skipped as a recursive test run.
- The `finally` block removes only the temp root.

**Cleanup test (`:282–367`):** in a scratch tree with synthetic tsc/esbuild stubs (no real tools, no SDK), an early (argument) failure and a late (closure-guard) failure both remove all four stale outputs and the compiler config, while `unrelated.keep` survives.

### Reproduced tests (this session; Linux, Node 22.23.5)
No esbuild bundle exists, so the loader file ran against a **hand-written mock-shaped fixture** (header plus `__t1Mock`) at the manifest entry with a `.build/package.json`. It was removed afterwards.

| Command | Result |
|---|---|
| `node --test test/loader-format.test.ts` | **11/11 pass, 0 skipped** (includes the negative control and cleanup tests) |
| CI-style glob `s5-t1-trial/test/*.test.ts s5-t1/test/*.test.ts s5-design/fake-host.test.mjs` (default concurrency) | **119/119 pass, 0 skipped** |
| Two simultaneous `node --test test/loader-format.test.ts` runs | **11/11 each**; no leftover in `test/` and no leftover temp roots |
| `python3 ci/test_package.py` | **3/3 OK** |

These match Codex's reported 11/11, two concurrent runs, and 3/3. **The mock-fixture runs are harness evidence only, not a built bundle.**

### Findings
**P0 / P1:** none.

**P2-B — `build.mjs` can silently skip the whole build and exit 0.**
- **Evidence:** `build.mjs:189` runs `main()` only if `path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)`. Node gives `argv[1]` as the resolved, *not realpath'd*, path. The ESM main-module URL is realpath'd.
- **Reproduced:**
  - Real path with `--bogus`: exit 1, and the stale entry is cleared (correct fail-closed behaviour).
  - The **same script through a symlinked directory** with `--bogus`: **exit 0, nothing printed, stale entry untouched**.
  - Through the symlink with `--sdk-mock` (which must fail here because tsc is absent): **exit 0**.
- **Impact:** a qualification build run through a symlink (or on Windows a junction, a mapped or `subst` drive, or a different path spelling) reports success while leaving an old artifact at the manifest path. That is fail-open on "did the build happen".
- **Fix (one line, within scope):** compare `realpathSync(process.argv[1])` to `realpathSync(fileURLToPath(import.meta.url))`, and add a test that runs the script through a symlink and expects exit ≠ 0 with `--bogus`. Alternatively, move `beta1CjsExport` into its own module so `build.mjs` needs no guard.
- **Until fixed:** qualification operators must invoke the canonical non-symlinked path **and** require the success JSON line plus a changed entry SHA-256.

**P3-1 —** `existsSync` is imported but unused (`build.mjs:5`).

**P3-2 —** `AOPX_LOADER_TEST_ENTRY` (`loader-format.test.ts:15`) lets the environment point the loader tests at any file. The mock gate still applies, but a mock-shaped file elsewhere would let the tests pass without testing the built entry. Restrict it to the child runner, or assert that it's unset outside the negative-control child.

**P3-3 (operational) —** because cleanup runs before argument parsing, any mistaken invocation in a stage (a typo'd flag, say) deletes the reviewed entry and `.build/package.json`. This is fail-closed by design; it should be documented in the qualification protocol.

**P3-4 (unverified) —** the child runner passes `--experimental-strip-types`. That's fine on Node 22.23.5 here, but it hasn't been exercised on the CI matrix (24.14.1, 24.22.1, 26.13.0). The first CI run must show the negative-control test passing on all six cells.

**Carried, pre-existing —** the CI publication gate trusts any `solidtakes`-login comment that starts with the review-PASS prefix, and agents post as that login. This review avoids the prefix.

### Unavailable checks (not claimed)
- No real beta.1 SDK-inclusive bundle, artifact SHA-256, cross-cwd or independent-command reproduction. The SDK, TypeScript 5.9.3, esbuild 0.28.1 and Node 24.22.1 aren't in this container; no owner computer is attachable; installs are unauthorized.
- No mock bundle built with esbuild, and no pinned `tsc` strict check.
- **CI:** `actions/runs?head_sha=ba97215…` = **0**, and no PR exists.
- No Windows run.

### Recommendation on pinned Windows qualification
- **Fix P2-B first.** It is one line within the two-file scope. Then open a draft PR based on `codex/aopx-s5-t1-controlled-candidate` so the six-cell CI runs, including the negative control.
- After that, **pinned Windows offline qualification is recommended** (offline only). Run the real-SDK build with the verified inputs:
  1. two caller directories, plus one independent direct-esbuild command, and compare entry SHA-256;
  2. capture the success JSON;
  3. record the closure-guard result against the real SDK;
  4. run the full suite under Node 24.22.1.
- If the owner wants to proceed before P2-B is fixed, the operator controls above (canonical path, success JSON, changed hash) are mandatory.
- **No native, registration or publication step is authorized by this review.** It is stale if the branch head changes. STOP.

---
_Generated by [Claude Code](https://claude.ai/code)_
