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


## Independent offline verification added November 9

[OFFLINE_RECOVERY_VERIFICATION_2026-11-09.md](OFFLINE_RECOVERY_VERIFICATION_2026-11-09.md) records fresh Linux x86_64 reproduction from the exact recovered archive hashes:
- v3.3 `make check`: 89 tests / 450 checks, 0 failures; Python 61 passed; 154,500-line parity and engine logs passed.
- v3.3 ASan/UBSan: 89 / 450 passed. TSan did not finish within a 120-second execution limit; no TSan result is claimed.
- Original v3.4 core `make check`: 94 tests / 511 checks, 0 failures; Python 61 passed; parity and logs passed.
- Five standalone Stage 4/5 programs compiled and passed their assertions.
- R1 and R2 deterministic defect reproductions passed; R4 ran 20,000 iterations and reproduced 9,700 shutdown cases with Pinned session state despite all leases Free.

This does not validate the absent Claude 2 repair or any Apple DriverKit/USB/DMA/HAL behavior. The report records exact source hashes, toolchain, commands, outputs and limitations.


## v3.4.1 R1/R2 isolated candidate — conversation archive only

A local patchset was assembled from the original v3.4 SHA recorded above:
- `DEMORA_v3_4_1_R1_R2_OFFLINE_CANDIDATE_PATCHSET.zip`, SHA-256 `d90c88c9748cdcb4bb90e38ba5430e4938c356f1f854cf2c274715aef7b972e1`.
- Patch SHA-256 `26f46765525ba7a06237abbe8c0ad4f6d62195e8fd273f51fc3d89ca7b9d2e6b`.
- Report: [V34_1_R1_R2_OFFLINE_CANDIDATE_REPORT.md](V34_1_R1_R2_OFFLINE_CANDIDATE_REPORT.md).

Candidate includes an R1 finish deferral fix and a host-only R2 ingress model (Pending-vs-Empty queue result, serial-drain clear/recheck, no mailbox fallback, N-sized queue, bounded sequence reorder). Applied to a disposable copy of the exact original archive, `make check` passed 94/514 and Python 61; ASan/UBSan passed; R1/R4 stress checks passed. This is **CONVERSATION_ARCHIVE**, not a GitHub source commit. The native scheduler adapter, TSan, ARM64 macOS and Apple DriverKit contracts remain unverified. Do not promote or wire into native code.


## Mac recovery inventory update — Stage 5 prototype identified (November 10, 2026)

User-provided Terminal output establishes these local artifacts and hashes:

| Artifact | Local path | SHA-256 | Classification |
|---|---|---|---|
| Original Stage 5 ZIP | `~/Desktop/DEMORA_v3_4_STAGE5_WORK.zip` and `~/Downloads/DEMORA_v3_4_STAGE5_WORK.zip` | `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6` (both identical) | LOCAL_ONLY / original experimental source |
| Claude 2 M7B/M7C review source bundle | `~/Downloads/AIRA_CLAUDE2_REVIEW_SOURCE_BUNDLE_20261107.zip` | `4702d8ab2f0f375495fb231cbdd896cd678db2e80953d5649763d2591689c5b0` | LOCAL_ONLY / M7B-M7C review package, not Stage 5 repair |
| Stage 5 design prototype | `~/Downloads/stage5_design_prototype.zip` | `35223ac088b9c5f7cb2af968bea99ab9a342db6375b89ddca9774d6543789968` | LOCAL_ONLY / scratch design prototype |
| Candidate report | `~/Downloads/V34_1_R1_R2_OFFLINE_CANDIDATE_REPORT.md` | `6172dad98505a2a6eff50f12675dc269af6272da7465b5c940c092068b9e46ce` | LOCAL_ONLY / report only |

### Stage 5 prototype interpretation

The prototype README explicitly labels the package **SCRATCH — not production code**. It says:
- `session_p.hpp` is a patched copy of `core/v3/session.hpp`; `session_p.diff` is the exact patch.
- `atomic_lease.hpp` is used unmodified from the Claude 1 Stage 5 Review V2 tree.
- `DiagEngine` itself cannot be built because `core/demora_ledger.hpp` is missing; `driver.hpp` is only a minimal engine skeleton.
- It contains an explicit-state wake/rescan model, queue/mailbox/coalesced-wake proposal, a three-valued finish proposal, deterministic tests, stress harnesses and mutation/policy scripts.
- README instructs Apple Silicon and multi-core follow-up, but owner freeze prohibits running these tests now.

Therefore this is useful design and patch history for R1/R2, but it is **not established as the final v3.4.1 patchset**, not a repaired complete Stage 5 source package, and not evidence that the expected candidate ZIP hash `d90c88c9...` has been recovered.

### Claude 2 review evidence

`CLAUDE2_REVIEW_RESPONSE.md` records earlier classifier/native-preparation work and a November 8 review of Claude 1 v3. It identifies a separate F-1 ownership/reclaim concern and other native-backend assumptions. The November 7 Claude 2 source bundle contains M7B/M7C reports and accepted baselines, not this Stage 5 prototype.

The user-provided output contains no Claude 2 Stage 5 repaired ZIP, no exact candidate patchset ZIP, and no Claude 3 review of a repaired package. Mark those items `MISSING_UNCONFIRMED`; do not infer they never existed.

**No tests, builds, scripts, technical research, hardware access or source modifications were performed as part of this recovery update.**


## Prototype source-file search result — November 10, 2026

The owner searched `~/Desktop/AIRA_MODULAR_PROJECT`, `~/Desktop` and `~/Downloads` for the prototype's component filenames. The only standalone match was:

- `~/Downloads/bq.hpp`

No standalone copies were found for `session_p.hpp`, `session_p.diff`, `wake_model.py`, `bq_stall.hpp`, `tests_det.cpp` or `stress.cpp`.

Classification: `LOCAL_ONLY`, exact bytes/hash not yet recorded. This is one component file only and does not constitute recovery of the full Stage 5 prototype source. The other components remain available only inside the previously inventoried `stage5_design_prototype.zip`, unless found in another archive or backup.

No files were moved or modified; no tests, scripts, builds or research were run.


## Follow-up filename search — prototype component source (November 10, 2026)

The user searched `~/Desktop/AIRA_MODULAR_PROJECT`, `~/Desktop` and `~/Downloads` for the seven prototype filenames documented in the Stage 5 design prototype README. The only matching file found was:

- `~/Downloads/bq.hpp` — LOCAL_ONLY, **hash and contents not yet inspected**.

The other six named components were not found by this search:
- `session_p.hpp`
- `session_p.diff`
- `wake_model.py`
- `bq_stall.hpp`
- `tests_det.cpp`
- `stress.cpp`

This does not prove they are absent from other archives, Library/attachments, Claude/Codex workspaces, or backups. Do not reconstruct them from the prototype README or pasted diff. The search command was repeated and returned the same single result; this is one located file, not two copies.

Next recovery action: inspect and hash the single `bq.hpp` file only. Do not compile, execute, test, move, rename or delete it.


## Standalone `bq.hpp` recovered — November 10, 2026

The owner inspected `~/Downloads/bq.hpp` without compiling or executing it.

- Size: 2,341 bytes.
- Modified: November 9, 2026 03:43:18 (Mac local time).
- SHA-256: `aba4734a4c4ea27490f472b151544012b20bb61b695c9be46433dbe9c8ae3680`.
- Classification: `LOCAL_ONLY` — one standalone prototype component; not yet committed or copied to a verified backup.

The file contains a templated bounded queue implementation using per-cell sequence counters, atomic enqueue/dequeue positions, acquire/release operations, and a power-of-two capacity assertion. Its structure matches the `bq.hpp` component named in the Stage 5 design prototype README. The README says the prototype's `bq.hpp` is copied verbatim from Stage 5 test lines 20–112.

This single component does not recover the missing `channel.hpp`, `session_p.hpp`, `session_p.diff`, `wake_model.py`, `bq_stall.hpp`, `tests_det.cpp` or `stress.cpp`. It is not the complete R1/R2 patchset and does not establish a repaired Stage 5 package.

No compilation, execution, testing, technical research, file movement or source modification was performed. The owner supplied the file contents and hash in Terminal output; no independent hash recomputation has been performed in this chat.
