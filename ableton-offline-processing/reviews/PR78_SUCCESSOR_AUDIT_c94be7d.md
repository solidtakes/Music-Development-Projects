## CLAUDE — PR #78 successor audit @ `c94be7dd` — **BLOCKED** (packaging unverified; design/safety PASS)

**Exact target:** `c94be7dd895fa2ed8b6fd136ee7eba523a26ce32` on `codex/aopx-pr78-loader-remediation-offline-20261120`, tree `720d1e696df47b97671e2f1969faf14e127e0c47`.
- Parent: `8c6cfea03915d901e77355ec9d149e563631c9b6` (protected PR #78).
- Protected PR #75: `0f069db9e7a97d0dd8b4bfa26615e26d1f146540`.
- All three were re-confirmed with `git ls-remote`.

**Inputs read:** Issue #40 #7058176662 (Codex handoff) and my prior audit #7056404004.

**Restrictions observed:** no Live, Extension Host, SDK CLI, native execution, import/create, media or Set change, process action, or dependency install. No implementation file was edited, nothing was merged or force-pushed, and no fix was applied. Network use was limited to read-only GitHub inspection. This review is not authorization.

### Verdict by gate
| # | Gate | Result |
|---|---|---|
| 1 | Commit, tree, parent and 5-file inventory | **PASS** |
| 2 | Protected runtime source and guards vs PR #75 / PR #78 | **PASS** |
| 3 | Build-script design (SDK alias, export validation, closure guard, CJS scope, cwd) | **PASS** (static), with P3 notes |
| 4 | **Real beta.1 SDK-inclusive bundle, hash, cross-cwd and independent-command reproduction** | **BLOCKED: not produced** |
| 5 | Mock bundle hash | **BLOCKED: not produced** |
| 6 | Inherited offline regression and package tests | **PASS** (108/108, 3/3; Node 22.23.5) |
| 7 | Loader / negative-test design | **P2-A** (tests 4–6 can execute a non-mock artifact); boundary test valid |
| 8 | CI matrix, triggers and publication gate | Static **PASS**; **no CI execution exists** for `c94be7d` |
| 9 | `OWNER_APPROVAL.md` not weakened | **PASS** |
| 10 | CLI never invoked | **PASS** |
| | **Overall** | **BLOCKED.** No full packaging PASS: no verified real beta.1 bundle and no pinned-toolchain build exists. |

**Why gates 4–5 are blocked:**
- This container has none of the required inputs: no beta.1 SDK, TypeScript 5.9.3, esbuild 0.28.1 or Node 24.22.1. It has Node 22.23.5 and a global TypeScript 6.0.2.
- `list_computer_folders` shows **no attachable owner computer**, and installing dependencies is not authorized.
- Codex's handoff states the same gap ("NO real beta.1 SDK bundle was produced").
- So **no mock or real bundle SHA-256 exists from any party** for `c94be7d`.

### 1. Provenance and changed files (reproduced)
- Clean detached worktree at the exact SHA, with an empty `git status --porcelain`.
- `git diff --name-status 8c6cfea c94be7d` shows exactly 5 modified files, and their blob IDs match the handoff:
  - `289cd98a…` `.github/workflows/aopx-s5-t1-controlled.yml`
  - `4f01690f…` `spikes/s5-t1-trial/ci/build.mjs`
  - `21e63e50…` `spikes/s5-t1-trial/test/loader-format.test.ts`
  - `39c2fd1a…` `spikes/s5-t1-trial/README.md`
  - `826508da…` `spikes/s5-t1-trial/OWNER_APPROVAL.md`
- The commit is unsigned.
- `git diff 0f069db c94be7d -- '*/src/*' engine/src spikes/s5-design` and `git diff 8c6cfea c94be7d -- '*/src/*'` are both **empty**. Runtime source, consent, one-shot behaviour, admission, the import/create boundaries, receipt and recovery guards, and the locked default entry are unchanged from PR #75.

### 2. Build script (`ci/build.mjs`) — static review
**Modes**
- Exactly one of `--sdk-mock` or `--sdk-runtime` is required (`:24–27`), and real mode also needs `--sdk-types` (`:28–30`).
- Unknown or repeated options are rejected (`:14–23`).
- There is no implicit external fallback.

**Toolchain pinning:** TypeScript must be `5.9.3` and esbuild `0.28.1`, read from their `package.json` files (`:40–47`).

**Real SDK validation (`:52–62`)**
- Requires `name @ableton-extensions/sdk` and `version 1.0.0-beta.1`.
- The published CJS export (`exports['.'].require` → `exports.require` → `main`) must realpath to `--sdk-runtime`.
- The declarations must lie inside the SDK package root.
- The SDK is bundled through `--alias` (`:90`) and is **read, never imported or executed**.

**Closure guard**
- Uses the metafile (`:92–96`). Every output import must be `external`, `node:`-prefixed, and in `builtinModules`.
- A text scan rejects non-literal or unexpected `require(` calls (`:97–103`).
- An ESM/`import(` scan follows (`:104–106`).

**CJS scope:** `.build/package.json` is set to `{"type":"commonjs"}` (`:107`), and only after the guards pass.

**Working directory**
- `tsc` and esbuild are spawned with `cwd: root` (`:74–78`), so esbuild's path comments don't depend on the caller's directory.
- User paths are resolved against the caller's directory before use (`:31`). This is correct.

**CLI and host:** the only child processes are `process.execPath` running tsc or esbuild. Neither the CLI nor the SDK runtime is referenced.

**Reproduced locally:**
- `node --check build.mjs` passes.
- A scan of the bundled runtime closure (trial `src`, `s5-t1/src`, `s5-design/fake-host.mjs`, `engine/src`) found **no bare built-in imports**, so the mock build should satisfy the `node:`-only guard.

**Real-SDK closure risk (unverifiable here):** if beta.1 `dist/index.cjs` contains a bare `require("events")`, a computed `require(x)`, or the literal text `require(` / a line starting `import ` inside a string, the guard **rejects** the build. That would be fail-closed, not unsafe. This check is part of gate 4.

### 3. Tests
**Reproduced (Node 22.23.5, Linux):**
| Command | Result |
|---|---|
| `node --test --test-concurrency=1` over all `s5-t1-trial/test/*.test.ts` except `loader-format`, `s5-t1/test/*.test.ts`, `s5-design/fake-host.test.mjs` | **108/108, 0 skipped** |
| `python3 s5-t1-trial/ci/test_package.py` | **3/3 OK** |

**Loader tests (7) against an esbuild bundle: NOT RUN** (no bundle). I exercised the shipped harness against hand-written synthetic fixtures in the scratch worktree's untracked `.build/`, which was removed afterwards. This is evidence about the harness only:
- **Fixture A, mock-like** (contains `__t1Mock`, registers via `globalThis.__t1Mock`): **7/7 pass**. The filesystem-write, unexpected-package and injected-ESM negatives each behave as intended.
- **Fixture B, non-mock** (top level throws `REAL_SDK_TOPLEVEL_EXECUTED`): tests 1–3 fail on the marker guard as designed. **Tests 4, 5 and 6 executed the artifact's top-level code** (the sentinel surfaced in their failures). Test 7 only parses.
- **Package boundary is load-bearing.** On Node 22.23.5, a CJS `.js` under the `"type":"module"` parent:
  - without `.build/package.json`: `import()` fails ("require is not defined in ES module scope") and `require()` returns `{}` (`typeof activate === 'undefined'`);
  - with `{"type":"commonjs"}`: `typeof activate === 'function'`.
  Test 3's `activate` assertion is therefore a genuine check.
- **Mock vs real:** every activation and effects assertion runs against the mock SDK (`ci/runtime-sdk.mjs`, the only non-test file containing `__t1Mock`). None of it is evidence of real SDK or native behaviour.

**P2-A — Loader tests 4–6 can evaluate a real-SDK artifact.**
- **Evidence:** the marker guard (`loader-format.test.ts:82, 94, 103`) is per-test. `loadWithDeniedEffects` (`:26–75`) and tests `:110–132` lack it.
- **Impact:** if someone runs the loader tests in a real-SDK stage, the real SDK's top-level code and the AOPX `activate` run inside the deny-sandbox. Effects are blocked and the run fails, but this breaks the stated invariant ("MUST only evaluate the mock-backed CI entry").
- **Fix:** one guard at module scope, right after reading `source` (for example `if (!source.includes(mockMarker)) throw new Error('loader tests are mock-only');`), or the same guard at the top of `loadWithDeniedEffects`.

### 4. CI
**Static review**
- The trigger now covers base `codex/aopx-s5-t1-controlled-candidate` and the `s5-t1`, `s5-design`, engine `src` and engine package paths.
- The matrix is Win/Linux × `24.14.1` (labelled diagnostic, below the SDK minimum), `24.22.1` (the Live 12 target) and `26.13.0`.
- The mock build uses `--sdk-mock`. The publication gate is unchanged.

**Actual execution:** `GET actions/runs?head_sha=c94be7d…` returns **0 runs**, and no PR exists for the branch. **Nothing has run in CI.**

**Caveat:** a successor PR based on PR #78's branch (`codex/aopx-s5-t1-loader-compat`) would **not** match the `branches` filter. Base it on `codex/aopx-s5-t1-controlled-candidate`, or add that branch to the filter.

**P3, pre-existing:** the publication gate accepts any comment by login `solidtakes` that starts with "## Independent controlled T1 review — PASS". The agents post as that login, so an agent comment could open it. It does not prove the owner wrote it. This review's heading deliberately avoids that prefix.

### 5. `OWNER_APPROVAL.md`
Only staging step 4 changed. "Make the installed SDK resolvable" is replaced by "embed the verified SDK via `--sdk-runtime`/`--sdk-types`, stage `.build/package.json`, record hashes". It adds "CLI only after separate native authorization" and keeps STOP-before-mutation. **No authorization, recovery or stop requirement is weakened.**

### 6. Minimal corrective actions before an approval request
1. **C1 (P2-A):** hoist the mock-marker guard to module scope in `loader-format.test.ts`. One line, within the five-file scope.
2. **C2:** open the successor as a draft PR based on `codex/aopx-s5-t1-controlled-candidate` so the 6-cell CI matrix runs. Report the run ID and logs, including loader tests 7/7 and the mock entry SHA-256 printed by `build.mjs`.
3. **C3 (gate 4), on the owner's Windows fixture with the already verified inputs** (Node 24.22.1 `d702daa8…`; SDK `dist/index.cjs` `691a6638…`; TypeScript 5.9.3; esbuild 0.28.1; no installs):
   - (a) run `build.mjs --sdk-runtime … --sdk-types …` from **two different caller directories** and compare entry SHA-256;
   - (b) run an **independent direct esbuild command** outside the script with identical flags (`--bundle --format=cjs --platform=node --target=node24 --alias:@ableton-extensions/sdk=<index.cjs> --legal-comments=none`, cwd = repo root) and compare;
   - (c) record whether the closure guard accepts the real SDK, listing any bare or dynamic requires;
   - (d) run the full regression under Node 24.22.1.
   Alternatively, attach that machine to a reviewer session so these can be reproduced independently.
4. **C4 (P3):** on any guard failure in `build.mjs`, delete the emitted entry (and any stale `.build/package.json`), so a rejected bundle cannot remain at the manifest path.

### Remaining native-only risks (unchanged)
- The Developer Mode takeover and handshake (PR #78 has never connected).
- The host's entry compile and `require` semantics; SDK initialisation on the host.
- Context-menu registration and visibility.
- The CLI's 10-second timeout and own-child kill.
- All render, import and create behaviour.
- The pristine modal-dialog registration-only control is still recommended first.

**STOP.** No native test or merge is authorized. This verdict is stale if the branch head changes.

---
_Generated by [Claude Code](https://claude.ai/code)_
