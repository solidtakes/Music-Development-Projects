# AIRA Modular project status

**Updated:** November 9, 2026  
**Target:** native Apple Silicon macOS CoreAudio/CoreMIDI driver for Roland AIRA Modular DEMORA (USB 0582:01AF), initially 96 kHz, 10 inputs / 10 outputs.

## Source-of-truth and coordination

- Repository: `solidtakes/Music-Development-Projects`.
- `main` audit head: `2cc50a06fb2cc0a87947d4af571123f67e3a42b2`.
- PR #1: open/unmerged, M9K/M9N-B CPU-only simulator branch; head `c437e0977e0b9d13ce4dbba39e31fbbc1eba5ed8`.
- PR #2: open/unmerged, M9P integration design/readiness branch. Its four design documents are committed on the PR branch; the earlier statement in `NEXT_TASK.md` that they were uncommitted is corrected.
- PR #3: merged; 15-minute PR #2 discussion monitor only. It does not synchronize local files or run agents.
- Additional experiment branch `chatgpt/demora-offline-artifacts-2026-11-08`: two commits ahead of main, no PR found. It contains an F2 completion-reuse probe and README. The probe requires `core/v3/diag_engine.hpp`, which is not in that branch.

Read [ARTIFACT_REGISTER.md](ARTIFACT_REGISTER.md) for exact repository refs, recovered conversation artifacts, missing/unconfirmed files and recovery order. Read [RECOVERY_AND_HANDOFF_POLICY.md](RECOVERY_AND_HANDOFF_POLICY.md) for mandatory synchronization, provenance and handoff rules.

## Offline engine baseline and experimental work

- v3.3 remains the frozen offline baseline. Prior handoff records 89 C++ tests / 450 checks and 61 Python tests, with sanitizer pass. These results are host/offline evidence, not native driver qualification.
- v3.4 Stage 5 original source archive is recovered outside GitHub in the ChatGPT Library/consolidation archive. SHA-256: `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6`.
- Original v3.4 Stage 5 is experimental and has reported/reproduced shutdown ownership, queue/mailbox and ordering concerns. Original test counts (94 tests / 511 checks, 61 Python tests) do not establish safety.
- Claude 1 and Claude 3 original-source reviews and R1/R2/R4 reproduction sources are in the conversation consolidation archive. Claude 3's recovered review is of the original Stage 5 source, not a repaired ZIP. Fresh Linux x86_64 verification on November 9 reproduced v3.3 make check (89/450, Python 61), original v3.4 make check (94/511, Python 61), all five standalone Stage 4/5 programs, and the R1/R2/R4 defects. See [OFFLINE_RECOVERY_VERIFICATION_2026-11-09.md](OFFLINE_RECOVERY_VERIFICATION_2026-11-09.md). ASan/UBSan passed on v3.3; TSan did not complete within the 120-second limit.
- Claude 2 repaired Stage 5 ZIP, repair diff, complete logs/hash manifest, and Claude 3 review of that exact repair have not been found in accessible Library/GitHub material. Status: MISSING_UNCONFIRMED, not assumed deleted.
- The 31-file consolidation ZIP is a recovery convenience copy only. It is not a GitHub commit and has not yet been verified on the user's Mac/Windows backups.

## Native macOS driver status

The repository's published simulator work is CPU-only. It does not contain a working USB backend, HAL device, installer, driver activation or MIDI implementation. The separate native 10x10 CoreAudio preparation has previously been described as compile-only/inactive, with StartIO refusing streaming. No functioning native 96 kHz audio driver has been demonstrated.

Blockers remain:
1. Authoritative USB isochronous descriptor packing, DMA/coherency and callback/completion/cancellation contracts.
2. Supported AudioDriverKit + USB provider topology, both-interface ownership and entitlement feasibility.
3. Native lifecycle, failure, disconnect and resource-release correctness.
4. Measured clock, buffer geometry, startup lead and FIFO stability.
5. Signed host/extension activation and rollback.
6. Physical output mapping and separately approved safe playback testing.

The raw Windows USB captures, v7.1/v7.2 probe source, complete `MultiRolandDriver` tree and complete `02_Mac_Driver` tree were not recovered from accessible conversation/Library sources during the November 9 consolidation. They may still exist locally; see the register. Do not recreate source from a summary.

## Current authorized next work

1. Recover Claude 2's exact repaired Stage 5 ZIP, diff, logs and hash; ask Claude 3 to review that exact artifact.
2. Inventory Mac and Windows project folders and backups without moving or deleting originals.
3. Recover the raw USB captures and probe sources; record hashes and metadata. Keep raw/private evidence out of public GitHub.
4. Independently reproduce offline tests against exact input hashes.
5. Continue isolated compile-only native preparation only after source recovery and task scope are explicit. Streaming remains disabled.

## Safety constraints

No automatic merge, force-push, overwrite of stable code, driver installation/activation, USB hardware operation or nonzero output. No raw captures, proprietary binaries, credentials or NDA material in public-safe repository files. Each completed task must have a task ID, base commit, exact file list, SHA-256, test commands/logs, environment and unresolved limitations.


## Recovery and synchronization freeze — November 10, 2026

**Owner-approved direction:** pause engineering tests, stress tests, new technical research and implementation until artifact recovery, local cleanup and GitHub reconciliation are complete.

### Current phase
- **PHASE: RECOVERY_AND_SYNC — ACTIVE**
- No new test runs, sanitizer runs, benchmarks, reverse-engineering experiments or technical research.
- No driver implementation, simulator changes, native integration, signing, installation, activation, hardware access or nonzero output.
- No merge, force-push, overwrite, branch deletion or deletion/movement of original local files.
- Existing GitHub monitoring may continue as read-only notification; it is not file synchronization or agent execution.
- Research and daily development-handoff automations have been paused during this phase.

### Recovery work order
1. Reconcile GitHub refs, PR contents, comments and authoritative status.
2. Recover the exact R1/R2 candidate ZIP, patch and manifest; recover Claude 2's repaired Stage 5 package/logs if they exist.
3. Inventory Mac, Windows, Claude and backup locations non-destructively; preserve originals.
4. Hash and register each recovered artifact; distinguish COMMITTED, PR_ONLY, CONVERSATION_ARCHIVE, LOCAL_ONLY, REPORTED, VERIFIED and MISSING_UNCONFIRMED.
5. Publish a single synchronized handoff to GitHub and provide the same handoff to Codex and Claude.
6. Resume engineering only after the owner approves completion of the recovery audit.

### Source-of-truth reminder
The PR #2 documentation branch is not main. The R1/R2 candidate report is documentation only; the candidate patchset itself remains a conversation/archive artifact until its exact bytes and hash are recovered and verified. v3.3 remains the frozen offline baseline; original v3.4 Stage 5 and the v3.4.1 R1/R2 candidate are not promoted. No native 10x10 CoreAudio driver has been demonstrated.


## Recovery inventory finding — Stage 5 prototype (November 10, 2026)

A Mac inventory located `stage5_design_prototype.zip` (SHA-256 `35223ac088b9c5f7cb2af968bea99ab9a342db6375b89ddca9774d6543789968`). Its own README explicitly labels it SCRATCH / not production code. It contains a proposed `session_p.diff`, queue/mailbox/wakeup model, deterministic tests and stress/mutation harnesses. It patches a copy of the Claude 1 Stage 5 Review V2 `session.hpp`; `atomic_lease.hpp` is reused unmodified. The README states the full DiagEngine cannot build because `core/demora_ledger.hpp` is missing and `driver.hpp` is only a minimal skeleton.

This is recovered R1/R2 design history, **not** the final v3.4.1 candidate patchset or a complete repaired Stage 5 source. The expected candidate patchset hash beginning `d90c88c9` remains unrecovered. Claude 2's November 7 source bundle is an M7B/M7C review bundle, not a Stage 5 repair. Claude 2's review response also contains a November 8 review of Claude 1 v3 with F-1 ownership/reclaim concerns, which must not be conflated with the Stage 5 prototype.

The artifact register records exact local paths and hashes. Recovery freeze remains in force; no tests or scripts were run.


## Recovery manifest update — November 10, 2026

Claude 3's metadata-only inventory confirms the original Stage 5 ZIP, scratch design prototype and three historical/candidate reports are present in its upload set with exact byte sizes and SHA-256 hashes recorded in `ARTIFACT_REGISTER.md`. The original work ZIP's directory listing does not include the candidate's reported `completion_ingress.hpp` or `test_completion_ingress.cpp`; the candidate source/patch and validation logs remain unrecovered. The prototype is a partial scratch design archive, not a full repaired tree. Claude 3 has no evidence of reviewing a repaired-source hash.

Test-count reports remain distinct: original Stage 5 review says 94 tests / 511 checks / 61 Python tests; candidate report says 94 tests / 514 checks / 61 Python tests. No reconciliation is possible without the underlying candidate logs.

Recovery freeze remains active. No engineering work resumes until the owner approves completion of the artifact recovery and synchronization audit.


## Claude 1 v3.5 EXP1 implementation status — November 10, 2026

Owner supplied Claude 1's latest conversation transcript. It records a later explicit authorization to begin a bounded, offline experimental implementation after the read-only audit. Claude 1 reported starting a new disposable tree named DEMORA_v3_5_EXP1_STAGE5_REPAIR from the original v3.4 Stage 5 archive and excluding stale arm64 binaries/dSYMs. Its last visible action was to inspect current finish() test assumptions before making deliberate test changes; the session then hit its usage limit.

This changes the prior blanket recovery freeze only for the specifically authorized isolated source-repair task. It does not authorize tests/builds beyond the task's explicit scope, GitHub writes by Claude, merges, installation, activation, USB hardware access or physical output. Preserve v3.3 and original v3.4. Claude 1's transcript does not establish that any source edit, test run, repaired ZIP, diff, output hash or report was completed. Recover the actual DEMORA_v3_5_EXP1_STAGE5_REPAIR worktree/session state first; do not recreate or assume progress.

Keep Claude 1's v3.5 EXP1 work distinct from Claude 2's earlier repair assignment and the partial scratch stage5_design_prototype.zip. The native 10x10 CoreAudio driver remains non-operational; this offline repair is not native driver readiness.


## GitHub second-audit reconciliation — November 10, 2026

Owner supplied Claude's read-only PR #2 audit transcript. Scope caveat: all 92 comments were loaded, but only about 16 assignment comments were read in full and the rest as excerpts; no PR reviews/inline threads existed; long Codex technical reports were not read line-by-line. All comments are authored by the repository owner, so agent attribution is based on comment headings, not authenticated GitHub authorship.

PR #2 head is `11feab2d`, 31 commits ahead / 2 behind current main. The two later main commits are `2cc50a06` (PR #3 workflow merge) and `071c2ad0` (recovery task file); neither changes PR #2's ten files and GitHub reports cleanly mergeable. Base SHA `6381fcc1` is the frozen main tip when PR #2 opened, so the earlier suspected base discrepancy is resolved. Current main is `071c2ad0`; older references to `2cc50a06` are stale. PR #2 contains ten Markdown files, not nine; its body needs correction.

No repaired Stage 5 source, patch, logs or hash manifest was found on the refs inspected (PR #2 head, main and F2 branch). Specifically absent there: completion_ingress.hpp, test_completion_ingress.cpp, session_p.*, core/v3/* and test logs. This is not proof of absence from every branch or external workspace. Claude 1 v3.5 EXP1 remains a reported worktree start with state/output unverified; Claude 2 repair outputs remain MISSING_UNCONFIRMED.

Do not conflate reported test totals: original v3.4 Stage 5 94 tests/511 checks; candidate report 94/514; another comment 100/561 with 2,420 interleavings. Underlying logs are not recovered. No native 10x10 CoreAudio driver readiness is established.

Recovery next: recover Claude 1 EXP1 actual state; recover Claude 2 Stage 5 repair and Bridge v3.1 artifacts; have Claude 3 review the exact recovered source hash; locate candidate patchset and reconcile report copies; back up/hash local-only artifacts; inventory Mac/Windows capture/probe/driver trees without uploading raw captures; have Codex close out or supersede G/H/I and compile-only CoreAudio task; then clean stale documentation. Keep recovery-first restrictions and owner approval for publication/implementation. No merges, hardware or installation are authorized by this audit.


## Claude 1 retrieval checkpoint — November 10, 2026

Claude 1 reports successful read access to PR #2 files at head `4e21550b`, but its PR-comment attempt failed with `403 Resource not accessible by integration`. It reports no writes were made. Claude's GitHub connector therefore has read access but currently lacks PR/issue comment permission; other write scopes have not been established.

Claude reports the original EXP1 task text is not on GitHub (only summarized there); it remains in owner-supplied transcript `Pasted text(20261110-014705).txt`. It found no `DEMORA_v3_5_EXP1_STAGE5_REPAIR` worktree, upload, ZIP, patch or matching branch in its sandbox/repository view. It states it made no source changes and ran no tests. No repaired source, logs or hashes are verified. EXP1 status: **NOT RECOVERED / NO SOURCE DELIVERABLE VERIFIED**.

There is a documentation mismatch: PROJECT_STATUS.md describes a narrow Claude 1 EXP1 exception to the recovery freeze, but NEXT_TASK.md and RECOVERY_SYNC_HANDOFF_2026-11-10.md omit it. Reconcile the authorization before fresh implementation. Owner decision: recover/upload original EXP1 worktree artifacts, or explicitly authorize a newly named disposable repair from original v3.4. Do not recreate it while calling it recovered. Preserve v3.3 and original v3.4; no hardware/install/activation/merge.
