# Next engineering assignment

**Updated:** November 9, 2026  
**Coordination branch:** `codex/aira-m9p-integration-plan`  
**Current purpose:** recover provenance and missing evidence before new native implementation.

## Active priority order

### A — Recover the exact v3.4 Stage 5 repair (highest priority)
- Obtain Claude 2's repaired source ZIP, complete patch/diff, test logs, exact commands, environment and SHA-256.
- Confirm the repaired ZIP is not the original `DEMORA_v3_4_STAGE5_WORK.zip`.
- Have Claude 3 review the exact repaired hash, not an earlier source or pasted summary.
- Reproduce in an isolated scratch directory; preserve v3.3 and original v3.4 unchanged.
- If the repair cannot be recovered, mark it MISSING_UNCONFIRMED and continue only from source that is actually available.

### B — Recover raw USB evidence and native source
- Inventory Mac `AIRA_MODULAR_PROJECT`, `MultiRolandDriver`, Downloads and dated backups.
- Inventory Windows `C:\DEMORA-Analysis`, USBPcap capture directories and related backups.
- Recover `DEMORA-final.pcap`, `DEMORA-clean.pcap`, the 96 kHz capture, `aira_iso_probe_v7_1.m`, `aira_iso_probe_v7_2.m`, and the complete native source tree if present.
- Do not delete, move or rename originals during discovery. Hash each source and create a manifest first.
- Keep raw/private capture bytes out of public-safe GitHub; commit a metadata/hash index only.

### C — Continue the G1 synthetic layout fixture
The G1 task in PR #2 comment 6717868274 remains an offline-only assignment unless a verified completion packet is found. First inspect the repository and local workspaces for an existing implementation; do not duplicate it. The fixture must distinguish requested-stride and packed-offset synthetic layouts and must not be presented as proof of DriverKit's real memory contract.

### D — Native compile-only preparation
Continue only from the actual current native source tree and an explicit bounded task. Keep StartIO/streaming disabled. Do not wire unverified v3.4 ownership behavior into native runtime.

## Required completion criteria

Every task must have:
- Unique task ID, owner, base commit and allowed file paths.
- Input file list and SHA-256 hashes.
- Exact deliverables committed to a dedicated branch, or explicitly marked LOCAL_ONLY with path and hash.
- Exact commands, toolchain/environment and complete test output.
- A clear distinction between agent-reported, owner-reported and independently reproduced results.
- Reviewer sign-off against the exact deliverable hash.
- A status/register update and next task ID.

## Safety / no-go rules

No merge, force-push, overwrite, installation, signing, activation, hardware access, nonzero output or stable-branch edits without separate explicit approval. Do not claim a driver works from simulator or compile-only evidence. Do not infer a file was deleted because it is unavailable in a chat. Follow [RECOVERY_AND_HANDOFF_POLICY.md](RECOVERY_AND_HANDOFF_POLICY.md) and [ARTIFACT_REGISTER.md](ARTIFACT_REGISTER.md).
