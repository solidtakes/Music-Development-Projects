# Next task — recovery and synchronization only

**Updated:** November 10, 2026  
**Coordination branch:** `codex/aira-m9p-integration-plan`  
**Phase:** RECOVERY_AND_SYNC  
**Engineering tests/research:** PAUSED by owner until cleanup and GitHub synchronization are complete.

## Active task order

### R0 — Reconcile shared GitHub state
- Treat this branch and PR #2 as coordination documentation, not mainline source.
- Review all current relevant branches and PR comments before changing records.
- Keep all PRs unmerged. Do not force-push, overwrite, delete branches or modify driver/simulator source.
- Record exact refs and hashes in the artifact register.

### R1 — Recover candidate and repair deliverables
- Locate the exact `DEMORA_v3_4_1_R1_R2_OFFLINE_CANDIDATE_PATCHSET.zip`, expected SHA-256 `d90c88c9748cdcb4bb90e38ba5430e4938c356f1f854cf2c274715aef7b972e1`, and its patch/manifest.
- Locate Claude 2's repaired Stage 5 ZIP, complete diff, logs and SHA-256, if they exist.
- Locate Claude 3's review of that exact repaired hash.
- Do not run tests or recreate missing source from prose. Record MISSING_UNCONFIRMED where appropriate.

### R2 — Non-destructive local inventory
- Mac: `~/Desktop/AIRA_MODULAR_PROJECT`, `MultiRolandDriver`, Downloads, dated backups and relevant working directories.
- Windows: `C:\DEMORA-Analysis`, USBPcap capture directories, project folders, Downloads and backups.
- Claude/Codex workspaces: locate source packages, patches, logs and reports.
- Inventory only. Do not move, rename or delete originals. Record paths, sizes, timestamps and SHA-256 before any later consolidation.

### R3 — Synchronize every agent
- Publish one canonical handoff containing phase, current Git refs, artifact status, no-go rules and exact next recovery task.
- Give the identical handoff to ChatGPT, Codex Web/Desktop and Claude agents.
- Require each agent to acknowledge the freeze and report only existing artifact locations/hashes; no new research or tests.

### R4 — Close recovery audit
- Confirm each expected artifact is either remotely committed, PR-only, in a named conversation archive, local-only with path/hash, or missing-unconfirmed.
- Verify a dated backup by hash without deleting prior copies.
- Owner explicitly approves before any tests/research/implementation resume.

## No-go rules during this phase
No test execution, stress tests, sanitizer runs, benchmarks, technical research, implementation, hardware access, driver install/activation/signing, nonzero audio output, merge, force-push, overwrite, or destructive cleanup. Preserve v3.3 and original v3.4 unchanged. The existing read-only GitHub commit monitor may continue; it does not synchronize local files or execute agents.
