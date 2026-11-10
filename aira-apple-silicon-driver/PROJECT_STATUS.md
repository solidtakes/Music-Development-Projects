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
