# DEMORA Recovery & Synchronization Handoff

**Date:** November 10, 2026  
**Phase:** `RECOVERY_AND_SYNC` — owner-approved freeze  
**Repository:** `solidtakes/Music-Development-Projects`  
**Coordination:** PR #2, branch `codex/aira-m9p-integration-plan`

## Owner's current instruction

Pause all engineering tests, stress tests, sanitizers, benchmarks, new technical research and implementation until the recovery audit, local cleanup and GitHub synchronization are complete.

This instruction supersedes previous task assignments that requested continued engineering work.

## Hard no-go rules

Until the owner explicitly lifts this freeze, do not:
- run tests, builds, sanitizers, benchmarks or reverse-engineering experiments;
- start new technical research or implement driver/simulator changes;
- access or operate DEMORA/BITRAZER hardware;
- install, sign, activate or load any driver;
- perform USB transfers, firmware changes or nonzero audio output;
- merge PRs, force-push, overwrite files, delete branches or delete/move/rename original local files;
- recreate missing source from summaries or reports and present it as recovered original work.

Preserve v3.3 as the frozen offline baseline. Keep original v3.4 Stage 5 and v3.4.1 R1/R2 experimental and unpromoted. No working native 10x10 CoreAudio driver has been demonstrated.

## Current GitHub coordination record

- PR #2 remains open and unmerged.
- The branch above contains the recovery/status documents.
- `PROJECT_STATUS.md` and `NEXT_TASK.md` declare `RECOVERY_AND_SYNC`.
- The R1/R2 report is documentation only. The actual patchset is not committed as source.
- PR documentation is not equivalent to mainline merge or a verified local backup.

## Recovery work order

1. **Reconcile GitHub:** report current branch/PR/worktree state and identify any unrecorded existing deliverables. Do not change source or merge.
2. **Recover exact packages:** locate the actual `DEMORA_v3_4_1_R1_R2_OFFLINE_CANDIDATE_PATCHSET.zip` (expected SHA-256 `d90c88c9748cdcb4bb90e38ba5430e4938c356f1f854cf2c274715aef7b972e1`), its patch/manifest, Claude 2's repaired Stage 5 ZIP/diff/logs, and Claude 3's review of that exact repaired hash.
3. **Inventory local stores non-destructively:** Mac project folder, Downloads, MultiRolandDriver workspace and backups; Windows `C:\DEMORA-Analysis`, USBPcap captures, project folders and backups; Claude/Codex workspaces. Record paths, sizes, timestamps and SHA-256. Do not move originals.
4. **Register each artifact** as one of: `COMMITTED`, `PR_ONLY`, `CONVERSATION_ARCHIVE`, `LOCAL_ONLY`, `REPORTED`, `VERIFIED`, or `MISSING_UNCONFIRMED`.
5. **Create one canonical manifest and handoff** and verify remote retrieval of every item claimed as committed.
6. **Owner approval:** only the owner may authorize resuming tests, research or implementation.

## Required response from every agent

Acknowledge this freeze. Report only existing work:
- current repository, branch and commit/worktree state;
- exact paths or GitHub refs for existing deliverables;
- SHA-256 and file size where available;
- test reports/logs already generated (do not rerun tests);
- missing or uncertain items.

Do not perform new tests or research. Do not claim an artifact is recovered without the actual bytes and a matching hash. Mark uncertain items `MISSING_UNCONFIRMED`.

## Canonical status files

- `aira-apple-silicon-driver/PROJECT_STATUS.md`
- `aira-apple-silicon-driver/NEXT_TASK.md`
- `aira-apple-silicon-driver/ARTIFACT_REGISTER.md`
- `aira-apple-silicon-driver/RECOVERY_AND_HANDOFF_POLICY.md`
- `aira-apple-silicon-driver/OFFLINE_RECOVERY_VERIFICATION_2026-11-09.md`
- `aira-apple-silicon-driver/V34_1_R1_R2_OFFLINE_CANDIDATE_REPORT.md`

**This handoff is a coordination instruction, not permission to modify engineering source.**
