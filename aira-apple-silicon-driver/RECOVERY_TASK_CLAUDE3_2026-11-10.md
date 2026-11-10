# Claude 3 recovery assignment — artifact provenance only

**Date:** November 10, 2026  
**Project phase:** RECOVERY_AND_SYNC — owner-approved engineering freeze  
**Repository:** `solidtakes/Music-Development-Projects`  
**Coordination:** PR #2, branch `codex/aira-m9p-integration-plan`

## Assignment

You are Claude 3. Your task is limited to recovering and documenting existing Stage 5 repair artifacts and their provenance. The owner has explicitly paused all engineering tests, builds, stress tests, sanitizers, benchmarks, new technical research, implementation and hardware operations until recovery and GitHub synchronization are complete.

### Questions to answer

1. In the files supplied to you, is there an actual repaired v3.4 Stage 5 source package, or only the original v3.4 source, review/reproduction harnesses and scratch design prototype?
2. Is the exact v3.4.1 R1/R2 candidate patchset present? The previously recorded expected SHA-256 is `d90c88c9748cdcb4bb90e38ba5430e4938c356f1f854cf2c274715aef7b972e1`. Do not assume this file exists merely because a report describes it.
3. Is there a Claude 2 repaired Stage 5 ZIP, complete diff, logs and hash?
4. Was any Claude 3 review performed against the exact repaired source hash? If so, identify the reviewed hash and the actual source artifact.
5. Which artifacts are duplicates, prototypes, original baselines, reports or reproduction harnesses?

### Required output

Return a concise recovery report containing:
- Exact filename and relative archive path for each artifact.
- SHA-256 and byte size only where you can calculate them from supplied bytes; label values you cannot calculate as unavailable.
- Classification: ORIGINAL_BASELINE, SCRATCH_PROTOTYPE, REPRO_HARNESS, REVIEW_REPORT, REPAIRED_CANDIDATE, DUPLICATE, or MISSING_UNCONFIRMED.
- A clear statement of which source hash, if any, was actually reviewed.
- A list of missing artifacts and the exact evidence needed to close each gap.

Do not recreate missing files from pasted text, reports or remembered summaries. Do not modify any source or archive.

## Files expected to be supplied

1. `DEMORA_Claude3_Independent_Review_Package.zip` — original-source review/reproduction package.
2. `stage5_design_prototype.zip` — scratch R1/R2 design prototype.
3. `DEMORA_v3_4_STAGE5_WORK.zip` — original v3.4 Stage 5 source archive.
4. `V34_1_R1_R2_OFFLINE_CANDIDATE_REPORT.md` — candidate report; report is not source.
5. `OFFLINE_RECOVERY_VERIFICATION_2026-11-09.md` — independent original-source reproduction record.
6. `CLAUDE2_REVIEW_RESPONSE.md` and `DEMORA_CLAUDE2_V3_REVIEW.md`, if available — historical Claude 2 review context, not presumed to be the repair.

The owner should also supply the expected v3.3 baseline archive if it is already available and can be identified without searching or modifying anything. Do not block the report if it is unavailable.

## Hard no-go rules

- Do not run or recommend running any tests, builds, scripts, stress tests, sanitizers or benchmarks during this assignment.
- Do not perform new technical research or implementation.
- Do not access hardware, SDKs, USB, DriverKit or audio devices.
- Do not extract and execute archive contents. Static inspection of supplied archive listings and documents only.
- Do not merge, commit, overwrite, rename, move or delete anything.
- Do not claim a repaired artifact exists unless its actual bytes and hash are present.

## Current known facts

- The Claude 3 review ZIP has owner-reported SHA-256 `7fa9ca571a968c5f28846578fc9c9aa9648609a948ba655aef16ac34dac8c48a`. It contains the original Stage 5 ZIP, a pasted review report, R1/R2/R4 reproduction sources, `RUN.sh` and `mut_owner.py`. It reviews original v3.4 Stage 5, not a known repaired source.
- The Stage 5 design prototype ZIP has owner-reported SHA-256 `35223ac088b9c5f7cb2af968bea99ab9a342db6375b89ddca9774d6543789968`. Its README labels it SCRATCH / not production code.
- Original Stage 5 ZIP SHA-256: `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6`.
- Standalone `bq.hpp` owner-reported SHA-256: `aba4734a4c4ea27490f472b151544012b20bb61b695c9be46433dbe9c8ae3680`.
- The v3.4.1 candidate report is documentation, not proof that its described patch ZIP is present.
- v3.3 remains the frozen offline baseline. No native 10x10 CoreAudio driver is demonstrated.
- PR #2 is open and unmerged. The authoritative phase is RECOVERY_AND_SYNC.

**Return findings only. Wait for the owner to approve any work beyond this recovery assignment.**
