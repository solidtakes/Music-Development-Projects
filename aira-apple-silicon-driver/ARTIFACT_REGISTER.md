# DEMORA artifact register and recovery ledger

**Updated:** 2026-11-09  
**Repository:** `solidtakes/Music-Development-Projects`  
**Coordination:** PR #2  
**Purpose:** distinguish committed source, experimental branches, conversation attachments, local-only evidence, and genuinely missing artifacts.

This register is deliberately provenance-aware. A mention in a chat, a handoff, a test summary, or a file name is not proof that the underlying artifact is present or reproducible.

## GitHub state checked 2026-11-09

| Ref | State | What it contains | Important limitation |
|---|---|---|---|
| `main` | Current head `2cc50a06fb2c` | Repository coordination and merged PR #3 monitor | Not a mirror of every working tree or chat attachment |
| PR #1 `codex/aira-m9n-b-source-only` | Open, unmerged; head `c437e0977e0b` | M9K/M9N-B CPU-only simulator work | Does not establish a native driver |
| PR #2 `codex/aira-m9p-integration-plan` | Open, unmerged; head `b2de9418961b` at audit | Four M9P design/readiness documents | Documentation only; no native streaming implementation |
| PR #3 `automation/aira-pr2-15m-monitor` | Merged | 15-minute PR #2 handoff monitor | Reads PR #2 discussion; does not sync local files, execute Codex, or wake ChatGPT |
| `chatgpt/demora-offline-artifacts-2026-11-08` | Two commits ahead of main; no PR found | `experiments/README.md` and F2 normal-completion reuse probe | Probe requires `core/v3/diag_engine.hpp`, which is not in this branch |

The previous `NEXT_TASK.md` statement that the four M9P documents were uncommitted is stale: GitHub reports them as the four changed files in open PR #2. They are committed to the PR branch, not merged into `main`.

## Recovered conversation/Library artifacts

A 31-file local consolidation archive was assembled on 2026-11-09:
- Archive: `DEMORA_PROJECT_CONSOLIDATED_2026-11-09.zip`
- SHA-256: `0a8e51b1d457393fd4db9341a1b3d196603e3e431096efc431f3abade2b1301e`
- Size: 4,540,239 bytes
- Contents include source ZIPs, patches, reports, R1/R2/R4 harnesses, handoffs, and a SHA-256 manifest.
- The archive is a conversation-generated artifact, not yet a GitHub commit or a verified copy on the user's Mac/Windows backup.

### Offline engine versions

| Artifact | SHA-256 | Status / evidence |
|---|---|---|
| `DEMORA_Offline_v3_core.zip` | `4a8a59f26375fa25d3c56f8e46e71ffaf363d7bb34a678397c64a92632b135e1` | Recovered in consolidation archive; historical host-only baseline |
| `DEMORA_Offline_v3.1_pin_scratch.zip` | `c2a6f4f3aa8eb76fa0a5bbd3fc4c9da1d3d02739a99448650a3d3c8660429091` | Recovered; experimental pin-policy scratch |
| `DEMORA_Offline_v3_2_pin_nocancel_scratch.zip` | Not independently recorded in prior handoff | Recovered; experimental |
| `DEMORA_Offline_v3_3_finish_race_scratch.zip` | Not independently recorded in prior handoff | Recovered; v3.3 is the designated offline baseline, not a native driver |
| `DEMORA_v3_1_to_v3_2_nocancel.patch` | Recovered in archive manifest | Recovered |
| `DEMORA_v3_1_to_v3_3_cumulative.patch` | Recovered in archive manifest | Recovered |
| `DEMORA_v3_2_to_v3_3_finish_race.patch` | Recovered in archive manifest | Recovered |
| `DEMORA_v3_4_STAGE5_WORK.zip` | `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6` | Original experimental Stage 5 source recovered; not repaired or promoted |
| `DEMORA_v3_4_stage1_callback_ownership.patch` | Recovered in archive manifest | Recovered |
| `DEMORA_v3_4_stage2_engine_ownership.patch` | Recovered in archive manifest | Recovered |

### Reviews and test evidence

- Claude 1 native ownership evidence report and Stage 5 handoff: recovered.
- Claude 1 Stage 5 reproduction/design kit: recovered.
- Claude 2 v3 review: recovered; this is an earlier review, **not** proof of a repaired Stage 5 ZIP.
- Claude 3 original Stage 5 review: transcribed from the user's pasted report; it reviewed the original Stage 5 source, not a Claude 2 repair.
- R1 pinned-after-owner-release, R2 queue/mailbox ordering, R4 stress sources, runner and mutation script: recovered.
- v3.3 handoff records 89 C++ tests / 450 checks and 61 Python tests as the prior validated baseline.
- Original v3.4 Stage 5 94 tests / 511 checks and 61 Python tests were reported/reproduced in earlier agent/user reports. The original source has known reproduced ownership/shutdown/queue concerns. Do not treat passing suite counts as a safety qualification.
- v3.4 Stage 5 overflow result (8 checks) was owner-reported in a prior handoff; it was single-threaded and did not prove concurrent mailbox safety.

## Missing or not currently accessible

These are missing from the accessible conversation/Library/GitHub evidence checked for this register. They may still exist on the user's Mac, Windows PC, another agent's workspace, or an external backup. Do not label them physically lost until those locations are inventoried.

| Artifact | Current finding | Recovery source |
|---|---|---|
| Claude 2 repaired v3.4 Stage 5 ZIP and complete repair diff | Not found in accessible Library or GitHub | Claude 2 workspace / downloads / handoff |
| Claude 2 repair test logs and SHA-256 manifest | Not found | Same workspace |
| Claude 3 review of the repaired ZIP | Not found; only original-source review recovered | Claude 3 workspace |
| `DEMORA-final.pcap`, `DEMORA-clean.pcap`, `DEMORA-96k.pcapng` and related raw USB captures | Not recovered here | Windows `C:\DEMORA-Analysis`, capture folders and external backups |
| `aira_iso_probe_v7_1.m`, `aira_iso_probe_v7_2.m` | Not recovered here | Mac project tree / earlier probe workspace |
| Complete `MultiRolandDriver` source tree | Not recovered here | Mac development directory / Git checkout |
| Complete `02_Mac_Driver` tree and native 10x10 CoreAudio source | Not recovered here | Mac `AIRA_MODULAR_PROJECT` |
| Full M9N-A design source artifact | Searchable project knowledge was found, but raw-byte export was unavailable in this recovery | Project knowledge / originating thread |
| Full original SDK/header evidence packages and build logs | Not all recovered as raw files | Mac SDK research folder / earlier uploads |
| F2 probe's required `core/v3/diag_engine.hpp` dependency | Explicitly absent from the F2 experiment branch | v3.1 source archive |

## Do not confuse these states

- **COMMITTED:** exact file exists in a named Git ref and can be fetched.
- **PR_ONLY:** committed on an unmerged PR branch, not in main.
- **BRANCH_ONLY:** committed on a non-main branch without a PR.
- **CONVERSATION_ARCHIVE:** attachment or Library artifact, not a GitHub commit.
- **LOCAL_ONLY:** present only on a user's machine or agent workspace, with location and hash recorded.
- **REPORTED:** result described in a message but not independently reproduced from the identified source.
- **VERIFIED:** source hash, exact command, environment, output and result are preserved and independently reproduced.
- **MISSING_UNCONFIRMED:** not found in searched sources; physical loss has not been established.
- **SUPERSEDED:** retained for history but not an active baseline.

Never collapse these labels into a generic "done" or "saved" status.

## Recovery order

1. Obtain Claude 2's repaired Stage 5 source ZIP, patch/diff, exact test commands/logs and SHA-256.
2. Have Claude 3 review that exact hash, not a remembered version or the original ZIP.
3. Inventory Mac `AIRA_MODULAR_PROJECT`, `MultiRolandDriver`, and all related downloads/backups.
4. Inventory Windows `C:\DEMORA-Analysis`, USBPcap captures and related source/log directories.
5. Copy verified files into a dated recovery staging directory; never move/delete originals during discovery.
6. Generate SHA-256 manifests and compare against handoff hashes.
7. Commit public-safe source/docs to a dedicated branch. Keep raw captures, proprietary binaries and private data outside Git; commit only a metadata/hash index.
8. Update this register only after each artifact is actually fetched or verified.
