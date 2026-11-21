## CLAUDE — Independent PR #78 audit @ `8c6cfea0` — **BLOCKED** (offline safety PASS; one P1 compatibility defect)

**Reviewed commit:** PR #78 head `8c6cfea03915d901e77355ec9d149e563631c9b6`, tree `46c75e565cbfc6c58f8e897af9c23fd13f4c417a`.
**Base:** `0f069db9e7a97d0dd8b4bfa26615e26d1f146540`, which is the protected PR #75 head.
- PR #78 is 1 commit, 6 files, and the commit is unsigned. Both heads were re-confirmed with `git ls-remote` immediately before posting.
- Reviewed in a clean detached worktree at the exact SHA (`git status --porcelain` empty).

**Scope:** every changed file (workflow, `engine/package.json`, `engine/package-lock.json`, trial `README.md`, `ci/build.mjs`, `test/loader-format.test.ts`) plus the unchanged runtime closure the bundle pulls in: trial `src/*`, `s5-t1/src/{live-port,files,confirm,flow,port}.ts`, `s5-design/fake-host.mjs`, `engine/src/{wav,dsp,contract}.ts`, the manifests, both `package.json` files, and `ci/package.py`.

**Restrictions observed:** no Live, Extension Host, CLI or native binary was launched. No dependency was installed, no Codex file was edited, nothing was merged, and no runtime retry was made. Network use was limited to read-only GitHub API and npm registry metadata. This review is not owner authorization.

### Verdict
| Area | Result |
|---|---|
| Destructive or safety behaviour (P0) | **PASS**: none found |
| Unchanged gates vs protected PR #75 | **PASS** |
| Load-time side effects / registration-only activation | **PASS** (source-level, plus tests) |
| Lockfile / dependency pinning | **PASS** |
| CommonJS packaging vs the beta.1 vendor pattern | **BLOCKED: P1-1** |
| CI coverage / reproducibility | Gaps: P2-1 … P2-4 |
| **Overall** | **BLOCKED.** Fix P1-1 (or produce native evidence for the external-SDK layout) before nominating PR #78 for a registration-only approval request. |

### Personally reproduced (this session; Node 22.23.5, Linux)
| Command | Result |
|---|---|
| `node --test --test-concurrency=1` over `s5-t1-trial/test/*.test.ts` (except `loader-format`), `s5-t1/test/*.test.ts`, `s5-design/fake-host.test.mjs` | **108/108 pass, 0 skipped** |
| `python3 s5-t1-trial/ci/test_package.py` | **3/3 OK** |
| `npm view <pkg>@0.28.1 dist.integrity` for all 27 esbuild lock entries | **27/27 match** the lockfile |
| GitHub `refs/pull/78/merge` tree vs head tree | identical (`46c75e5…`) |
| Synthetic module-type experiment (P2-3) | reproduced: see below |

**Not reproduced: the CommonJS bundle.** esbuild 0.28.1 is not present and installing it is out of scope. So `loader-format.test.ts` (3 tests), the controlled build, and the reported entry hash `6235a456…` (38,457 B) were **not** personally reproduced. TypeScript strict checking was also not re-run with the locked 5.9.3; only 6.0.2 is available here.

### Verified from CI evidence (not re-run)
Run [44699716924](https://github.com/solidtakes/Music-Development-Projects/actions/runs/44699716924): `head_sha 8c6cfea…`.
- Win/Linux × Node 24.14.1 and 26.13.0: all success. The Windows 24.14.1 job log shows loader tests 3/3, the full suite **111/111 with 0 skipped** (my 108 plus the 3 loader tests), and package tests 3/3.
- `npm ci` added 5 packages.
- The jobs tested merge commit `7ed2eb8` (8c6cfea merged into `2be340a`). `2be340a` is an ancestor of the head, so the merge tree is identical to the head tree.

### Comparison with protected PR #75
- `git diff 0f069db 8c6cfea` changes **no file under any `src/`**, and modifies or deletes **no test**; only `loader-format.test.ts` is added.
- Consent (`consent.ts`), one-shot behaviour (`flow.ts` `used`/`busy`, journal `hasPriorOperation`), admission (`flow.ts` `admit`), the import/create boundaries and receipt/timeout handling (`flow.ts` `bounded`, `requested` → `unknown-outcome`), source protection, and the locked default entry (`LIVE_TRIAL_ENABLED = false`) are therefore byte-identical to PR #75.
- `refs/pull/75/head` is still `0f069db`.

### Registration-only evidence
- **Load:** every bundled module has only declarations at top level (frozen constants in `profile.ts:2–12`, arrow and function definitions). There is no I/O, timer, registration or logging at module scope. `export { CONTROLLED_TRIAL_PROFILE }` is data only.
- **Activate** (`s5-t1-trial/src/extension.ts:8–26`) does exactly four things: `initialize`, builds `livePort`/`controlledTrial` closures, makes one `registerCommand`, and makes one `registerContextMenuAction('AudioClip', …)`.
  - `ownedFiles` is lazy (`s5-t1/src/files.ts:53–62`): the first filesystem access is in `hasPriorOperation()`, which only runs inside a command.
  - Mock evidence: `loader-format.test.ts:59–71` and the inherited activation tests (CI).
- **If the menu item is clicked by accident:** the trial profile is enabled (`profile.ts:8`), so clicking would run admission, create the receipt directory in `storageDirectory`, run **`renderPreFxAudio`** (writes a temp WAV), run DSP, and open the consent modal. **Import and create still require the typed consent** (inherited consent tests). A registration-only test must therefore be visibility-only, with no click.

### Findings

**P1-1 — The SDK is marked external, which departs from the official beta.1 example build. Load may fail natively.**
- **Evidence:**
  - `ci/build.mjs` bundles with `--external:@ableton-extensions/sdk`, and the README claims parity with the beta.1 examples.
  - The pristine beta.1 `examples/modal-dialog/build.ts` that Codex recovered (465 B, SHA-256 `9f3643da752b8f92…46d571e04b20`, #7039824295) is **byte-identical** to `onsurbex/clean-silence-extension@9553d62:build.ts`. I hashed it here. That file is `bundle: true, format: "cjs", platform: "node"` with **no `external`**, so the vendor example bundles the SDK into its single entry.
  - Sizes corroborate this: the installed modal-dialog `dist/extension.js` (38,162 B, #7039184873) ≈ the staged SDK `dist/index.cjs` (36,777 B, #7037415873) plus about 1.4 KB of example code.
  - Community guidance, from beta.0 and not re-verified on beta.1: "The Extension Host loads a single standalone file and does NOT resolve node_modules at runtime" (`aker-dev/ableton-extension-skill@250c4b4`, `assets/templates/build.ts:4–5`, `SKILL.md:262`).
- **Why offline tests can't settle it:** Codex's staged load used Node's file-anchored `createRequire` semantics. That is an assumption about the host's `require`, not evidence of it. PR #78 never reached module evaluation natively: the Live 12 attempt timed out before connecting (#7038740006).
- **Impact:** if the host does not resolve `node_modules`, the load fails with module-not-found before activation. This fails closed, with no Set effect, but it would consume another one-shot authorization on a known deviation.
- **Remediation:** match the vendor pattern.
  1. In the local stage build, bundle the real installed SDK (no `--external`, for example a `--sdk-runtime <installed sdk>` option).
  2. In CI, keep a structural bundle with the mock aliased (for example `--alias:@ableton-extensions/sdk=./ci/runtime-sdk.mjs`).
  3. Assert that the emitted entry has **no `require()` other than `node:` built-ins**.
  4. Record the new entry hash.
  The bundle is a local build product, which `package.py:13` excludes from the ZIP, so the SDK is not redistributed. If Codex has beta.1 evidence that the examples resolve the SDK externally, it should be posted instead.

**P2-1 — CI will not run on any new PR #78 commit.**
- `aopx-s5-t1-controlled.yml:3–4` triggers on `pull_request` with `branches: [codex/aopx-s5-t1-build-only]`.
- Run 44699716924 ran only because the PR was opened against `build-only` (merge into `2be340a`) and retargeted to `controlled-candidate` afterwards. The current base no longer matches the filter. The `paths` filter also omits `engine/package*.json`.
- **Impact:** a P1-1 fix, or any other revision, would get no CI or publication gate, and a stale verdict could go unnoticed.
- **Fix:** add `codex/aopx-s5-t1-controlled-candidate` to `branches` (and the engine package paths), or add `workflow_dispatch`.

**P2-2 — The Node matrix drops the actual target's Node.**
- PR #78 replaced `24.22.1` with `24.14.1`.
- Live 12.4.25b2's bundled Extension Host `node.exe` is **v24.22.1** (SHA-256 `d702daa8…`, #7037097079), and that audit says the current Live 13 install carries the same binary.
- Codex's stage tests under 24.22.1 were reported (#7037415873) but are not in CI.
- **Fix:** test 24.14.1, 24.22.1 and 26.13.0, and correct the PR body and README wording "Live embeds 24.14.1".

**P2-3 — The loader tests can pass while native loading is broken.**
- `loader-format.test.ts:36–46` evaluates the bundle in a hand-made CJS wrapper with an injected `require` that returns a mock SDK. That presupposes three things:
  - (a) the host compiles the entry as CJS regardless of the trial `package.json` `"type":"module"`;
  - (b) the host's `require` resolves the SDK (see P1-1);
  - (c) the mocked registration API matches the real one.
- On (a), the Live 13 error "Cannot use import statement outside a module" (#7033396756) is good indirect evidence that the host does ignore `"type"`.
- **Reproduced:** with a synthetic CJS `.js` under a `"type":"module"` package:
  - plain Node `require()` treats it as ESM and fails;
  - the entry-anchored wrapper loads it;
  - adding a generated `.build/package.json` with `{"type":"commonjs"}` makes it load under standard Node semantics too.
- **Fix:** emit that nested `package.json` (harmless to a host that ignores `"type"`), and add a plain `createRequire(entry)` load test. Together with P1-1's "no non-`node:` requires" assertion, this makes the check host-independent.

**P2-4 — The artifact to be loaded natively has a single builder and no CI hash.**
- The entry (`6235a456…`, 38,457 B) was built locally, using `node_modules` copied from another worktree because "the local npm offline cache lacked one reviewed tarball" (#7037415873).
- CI neither prints nor uploads the bundle hash, and I could not reproduce it.
- esbuild's non-minified path comments are relative to the process cwd, and `build.mjs` does not set `cwd`. This is reasoning only; I didn't run esbuild.
- **Fix:**
  - spawn esbuild with `cwd: root`;
  - print the esbuild version and the entry SHA-256 in `build.mjs`;
  - have CI print the mock-bundle hash;
  - require a second builder to reproduce the exact real-bundle hash before the approval request.

**P3-1 — `engine/package.json` gains `esbuild` for spike tooling.**
- The shared engine dev install grows to 27 lock entries; only the platform package is fetched.
- Integrity is verified (27/27), and the version was published 2026-06-11.
- esbuild's `postinstall` (`node install.js`) is suppressed only by `--ignore-scripts`, so a plain `npm ci` in `engine/` would run it.
- Consider moving the bundler to the spike's own package, or documenting `--ignore-scripts`.

**P3-2 — Inconsistent Node declarations.** The trial `package.json:7` declares `engines >=24.16.0` while CI tests 24.14.1.

**P3-3 — Loader tests run twice in CI** (a dedicated step plus the glob). Harmless.

**P3-4 — Inherited from PR #75:** runtime validation is imported from `s5-design/fake-host.mjs` (`trial.ts:3`), a test-fake module, into the shipped bundle. No fake behaviour is reachable.

**P3-5 — The default locked entry still emits unbundled ESM** (`s5-t1/ci/build.mjs` unchanged). It would hit the same loader error if ever loaded. That is acceptable while it is locked, but should be documented.

### Node compatibility assessment
- **Established:**
  - The SDK, CLI and trial package declare `>=24.16.0`.
  - Live 12.4.25b2's host Node is **24.22.1**, which satisfies that (per the Codex audit, hash recorded; not re-measured here).
  - The emitted syntax target is `node24`.
  - The AOPX runtime uses no API newer than Node 20 (for example `AbortSignal.any`, `structuredClone`).
  - CI passes on 24.14.1 and 26.13.0.
- **Not established offline:**
  - whether the SDK's own `dist/index.cjs` or the native module needs anything beyond 24.14.1;
  - why the Live 13 b24 failure printed "Node.js v24.14.1" when the later audit found 24.22.1 in the current Live 13 install (a possible update in between);
  - native SDK behaviour on any Node.
- **Conclusion:** for the current Live 12 target, the 24.14.1-vs-24.16.0 discrepancy does not apply. For any Live 13 retry, re-measure the bundled Node first.

### Remaining native-only unknowns
- The Developer Mode takeover and handshake: PR #78 has never connected (Live 12 timeout).
- How the host compiles the entry and what `require` semantics it provides (P1-1, P2-3).
- SDK initialisation on the host.
- Whether `registerContextMenuAction` resolves and the label is visible.
- The CLI's 10-second timeout and own-child `kill()`.
- All render, import and create behaviour (out of scope for registration).

### Smallest next native experiment (not executed) and gates
1. **First: the pristine modal-dialog registration-only control** under Developer Mode on Live 12.4.25b2, as previously proposed. It proves the transport and the vendor's bundled-SDK layout without AOPX code. Its result also settles P1-1: copy whatever layout succeeds.
2. **Then:** one PR #78-successor registration-only attempt, built with the **SDK bundled**, at a new exact SHA that has passed CI (after P2-1) and fresh review.

Gates for that attempt:
- Developer Mode on, with no Live-managed Host or orphan in the process inventory.
- Exact hashes for the stage, entry, Live executable, Node and native module.
- One foreground CLI run, no `--verbose`, no retry.
- Explicit acceptance of the 10-second timeout and one Ctrl+C own-child kill.
- Context-menu **visibility only**; never invoke the menu item.
- A verified Set backup, and a post-run process and Set check.

### Recommended next approval gate
None yet. Codex should fix P1-1, P2-1 and P2-2 (P2-3/P2-4 recommended) on PR #78 or a successor, then request a fresh exact-SHA review. **An offline PASS on that new SHA would permit only preparing an owner approval request.** It would not authorize native execution. This verdict is stale if PR #78's head changes.

---
_Generated by [Claude Code](https://claude.ai/code)_
