# Claude Code Handoff — AOPX-02 Audio Engine

> **Superseded: historical handoff, kept for context.** The instructions and branch state below describe the start of AOPX-02. They are **not** current branch instructions. Current status, verified 15 Nov 2026:
> - PR #36 (contract only, `7c169c8`) is **merged** into canonical `ableton-offline-processing/alpha-0.1` at `a4f1404`, and is frozen.
> - The engine implementation is on `claude/aopx-02-engine-proof` ([PR #41](https://github.com/solidtakes/Music-Development-Projects/pull/41)), which Claude owns. PR #41 is **open and draft, not merged**, and targets canonical. Its head was `a3868d0` when the runtime checks ran.
> - Engine check passes 50/50 tests and the demo passes 15/15 checks on standalone Node 22.23.4 / npm 10.9.9 and on Node 24.22.1 / npm 11.19.1 on Linux. The editor passes 24/24 tests and 10/10 browser tests on both. The Node 24 run was **not inside Ableton Live's Extension host**.
> - **Windows is untested.** The Extension host adapter and the Live round trip are not built or verified.
> - Current assignments, decisions and gates live on [Issue #40](https://github.com/solidtakes/Music-Development-Projects/issues/40). Where this file disagrees with Issue #40, Issue #40 wins. In particular, the "Branch base" and "Current Codex PR" lines below are historical, and only the owner authorizes merges.
**Project:** Offline Processing Suite for Ableton Live  
**Repository:** `solidtakes/Music-Development-Projects`  
**Issue:** [#31 — Incremental WAV processing and editable history engine](https://github.com/solidtakes/Music-Development-Projects/issues/31)  
**Canonical target:** `ableton-offline-processing/alpha-0.1`  
**Claude working branch:** `claude/aopx-02-engine-proof`  
**Branch base:** `codex/aopx-02-engine-proof` at `7c169c8ac25427b49c4afd1bf81e237a7881048e`  
**Current Codex PR:** [#36 — operation-plan and render diagnostics contract](https://github.com/solidtakes/Music-Development-Projects/pull/36)

## Why this handoff exists

Codex is temporarily unavailable for approximately three days. Claude Code is taking over the AOPX-02 implementation during that interval. Work must remain isolated from Codex's branch so Codex can resume later without branch collisions.

The Codex branch currently has one commit ahead of canonical and no commits behind. Its draft PR #36 adds the shared contract at `ableton-offline-processing/engine/src/contract.ts`. That commit is the starting point for this Claude branch. PR #36 currently contains the contract only; it is not evidence that the processing engine or acceptance tests are complete.

**Do not push to, reset, rebase destructively, or otherwise modify `codex/aopx-02-engine-proof`.** Work only on `claude/aopx-02-engine-proof`. Preserve the existing contract and its history.

## Read these sources first

1. `ableton-offline-processing/README.md`
2. `ableton-offline-processing/ALPHA_0_1_SPEC.md`
3. `ableton-offline-processing/PRODUCT_ARCHITECTURE.md`
4. `ableton-offline-processing/SDK_ARCHIVE_REVIEW_BETA_1.md`
5. `ableton-offline-processing/PROJECT_STATUS.md`
6. `ableton-offline-processing/CODEX_HANDOFF.md`
7. `ableton-offline-processing/engine/src/contract.ts`
8. GitHub Issue #31 and PR #36.

Treat those repository sources as the requirements baseline. If implementation details are missing, state the gap and propose the smallest defensible decision; do not silently change the product scope.

## Your responsibility

Build and prove the **edition-independent Node.js/TypeScript audio engine**. This is the critical-path component and must run in the Ableton Extensions Node host. The supplied SDK beta.1 package metadata requires Node >=24.16.0. The user reported that the installed Live 12 beta's bundled Node reports v24.22.1; a separate system Node v26.13.0 is also available. Verify the actual runtimes in your environment and prioritize compatibility with Node 24.22.1.

Do not build the GUI, Ableton SDK adapter, companion app, or third-party plugin host in this task.

## Alpha 0.1 acceptance demonstration

The central proof must be executable and automated:

1. Load a deterministic mono or stereo WAV fixture as an immutable source.
2. Render **Original → Reverse → Gain** as separate immutable processing outputs.
3. Remove/disable the Reverse operation while retaining Gain.
4. Re-render the active chain from the original source.
5. Verify that the resulting audio matches **direct Gain applied to Original** within a documented numeric tolerance.
6. Prove that the original source hash is unchanged.
7. Prove that unaffected upstream/source data is reused and only affected downstream nodes are invalidated/recomputed.
8. Re-run an identical chain and prove cache hits.
9. Save and reopen the project/history and prove the graph and cache references remain valid.
10. Report actual render times, cache lookup times, output bytes, total cache bytes and project footprint.

A runnable demo script plus deterministic tests is more valuable than a large amount of speculative infrastructure.

## Required engineering scope

### 1. Inspect before implementing
- Inspect the current repository tree, package manager, TypeScript configuration, existing tests, and the shared contract.
- Run existing tests before editing and record the baseline.
- Do not assume an earlier local working tree is clean; report its status.
- Avoid unnecessary dependencies. Choose the smallest maintainable WAV stack and document why.

### 2. WAV I/O and DSP
- Read and write WAV files with explicit metadata: channels, sample rate, bit depth, encoding, frame count and duration.
- Support at least the PCM/float formats required by the selected library; document unsupported formats.
- Reverse **complete interleaved frames**, never individual channel samples.
- Apply Gain in dB using the correct linear amplitude conversion and apply it consistently to all channels.
- Define clipping behaviour explicitly. Do not silently normalize or change sample format without documenting it.
- Preserve sample rate, channel count and frame count for Reverse and Gain.
- Cover mono, stereo, silence, peaks, short files and representative PCM/float formats.

### 3. Versioned, branch-capable history
- Use a DAG/version graph internally, even though Alpha 0.1's first UI presents a linear operation list.
- Each operation needs stable identity, schema/version, enabled state, normalized parameters, upstream input identity and immutable output/cache reference.
- Support branching from an earlier node and switching between alternate versions without mutating another branch.
- Persist the project manifest with a schema version and a migration strategy appropriate to this prototype.
- A linear history list must be a projection of the graph, not the underlying storage model.

### 4. Content-addressed cache and incremental invalidation
Cache identity must include every output-affecting input, at minimum:
- Source content fingerprint.
- Upstream node/output identity.
- Operation type and operation implementation/schema version.
- Normalized operation parameters.
- Engine version.
- Output format/sample representation and other relevant render settings.

Rules:
- Source audio and every render are immutable.
- Changing/removing node N invalidates N and dependent descendants only.
- Preserve valid upstream cache entries.
- Re-entering an exact prior configuration should reuse its valid cached output.
- Separate cache lookup/verification time from original render time.
- Never return a cache entry whose key or metadata does not match the request.
- Prevent stale or cancelled renders from publishing over a newer requested revision.
- Persist manifests and retained cache in a configurable storage root suitable for the Extension's `storageDirectory`; use temp storage for disposable intermediate work.
- Report real byte counts from filesystem metadata, not estimates.

### 5. Future processor boundary (design only)
Define a small processor-adapter contract that can later support native processors and VST3/AU offline plugins. Cache identity must have a place for processor format/unique ID, binary and version identity, serialized state, normalized parameters, sample rate, channel layout and quality settings. **Do not implement plugin hosting in Alpha 0.1.**

## Existing shared TypeScript contract

Inspect `ableton-offline-processing/engine/src/contract.ts` before designing APIs. It defines:
- `Operation` (`reverse` or `gain`, stable ID, enabled state)
- `AudioMetadata`
- `SourceInfo`
- `WaveformPeak`
- `RenderProgress`
- `RenderStep` (hit/miss/bypassed, render time, lookup time, bytes, cache key, format)
- `RenderReport` (source/output/cache/project byte counts)
- `OperationPlan`

Treat this as the current cross-workstream contract. If it needs changes, explain the compatibility reason, update it in your own branch, add tests, and report the exact change. Do not silently fork a competing schema.

## Quality and verification gates

- Unit tests for WAV parsing/writing and metadata round-trips.
- Numeric DSP tests for Reverse and Gain.
- Stereo frame/channel alignment test using deliberately different left/right signals.
- Source immutability/hash test.
- Cache-key determinism and parameter sensitivity tests.
- Incremental invalidation test for changing/removing an early operation.
- Exact-chain cache hit test.
- Branch isolation and alternate-version recall test.
- Save/reopen test.
- Cancellation/stale-render race test.
- Corrupt/truncated input and cache corruption handling.
- `git diff --check`, type-check/build and full test suite.

For the acceptance comparison, document whether equality is bit-exact or tolerance-based. If conversion/quantization occurs, choose and justify a numeric tolerance; never loosen it merely to make tests pass.

## Work sequence

**Phase A — baseline and design (first short pass)**
1. Confirm branch and commit.
2. Inspect project files and run current tests.
3. Review shared contract.
4. Post a short plan on Issue #31 before large changes, including library choice and proposed module layout.

**Phase B — working audio proof**
1. Implement WAV I/O and immutable source fingerprinting.
2. Implement Reverse and Gain.
3. Implement deterministic demo and correctness tests.
4. Make Original → Reverse → Gain → remove Reverse → Gain work end-to-end.

**Phase C — history and cache**
1. Add versioned DAG and linear projection.
2. Add content-addressed immutable cache.
3. Add downstream-only invalidation and exact cache reuse.
4. Add branch isolation, persistence and save/reopen.
5. Add cancellation/stale-render protection.

**Phase D — diagnostics and integration readiness**
1. Populate the shared `RenderReport` with measured times and bytes.
2. Add concise CLI/demo output showing each operation's cache status and storage cost.
3. Document the processor adapter seam for future plugins.
4. Write exact setup, build, test and demo commands.

Keep commits small and coherent. Do not spend the first day building a generalized framework; prioritize a narrow, correct, demonstrable proof.

## Git rules

- Work only on `claude/aopx-02-engine-proof`.
- Do not change the canonical branch directly.
- Do not modify Codex's `codex/aopx-02-engine-proof` branch.
- Do not merge PR #36 or any other PR.
- Once there is meaningful implementation and passing evidence, open a **draft PR** targeting `ableton-offline-processing/alpha-0.1`, referencing Issue #31 and noting that it continues from the shared contract commit `7c169c8`.
- If the PR includes the same contract commit as PR #36, explicitly note that PR #36 is the contract-only precursor and should be reviewed together; do not silently close or merge either PR.
- Never push SDK archives, SDK package binaries, plugin binaries, user audio, credentials, licenses or secrets.
- Never modify production Live installations or user Sets.

## Reporting cadence and stop conditions

- Work autonomously between checkpoints. Do not stop for approval on routine implementation decisions that fit this handoff.
- Send concise progress updates on Issue #31 at meaningful milestones: baseline complete, first DSP proof, graph/cache complete, acceptance tests complete, and any blocker.
- Keep the user-facing updates low-frequency and evidence-based; do not emit a message for every command.
- If a blocker requires user access, a missing SDK/runtime, a destructive action, or a product decision, stop only that dependent task, explain exactly what is needed, and continue independent work.
- Do not claim completion until the acceptance demonstration and required tests have actually passed.

## Required completion report

Include:
- Branch and final commit SHA.
- Changed-file summary.
- Exact install/build/type-check/test/demo commands and results.
- Test count and any skipped/failed tests.
- WAV formats supported and limitations.
- Numeric tolerance and correctness results.
- Cache-key composition and invalidation behaviour.
- Branch/save/reopen/cancellation results.
- Render time, cache lookup time, output bytes and cache footprint measurements.
- Known limitations and the next integration step.
