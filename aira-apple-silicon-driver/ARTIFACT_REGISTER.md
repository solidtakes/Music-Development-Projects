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


## External-volume search result — November 10, 2026

The owner searched the mounted macOS volumes under `/Volumes` for the seven prototype component filenames plus `channel.hpp`. The search was repeated six times and returned no matches each time.

No standalone copies were located on currently mounted external volumes for:
- `session_p.hpp`
- `session_p.diff`
- `wake_model.py`
- `channel.hpp`
- `bq_stall.hpp`
- `tests_det.cpp`
- `stress.cpp`

This result applies only to mounted volumes visible to the command at the time of the search. It does not rule out files inside differently named archives, unmounted drives, Library/conversation attachments, cloud-synced folders, or Claude/Codex workspaces. Keep these components `MISSING_UNCONFIRMED` outside the known prototype ZIP; do not recreate them from the README or pasted diff.

The standalone `bq.hpp` remains the only individually located prototype component outside the ZIP. No files were moved or modified; no tests, builds, scripts or research were run.


## ZIP archive-content search — prototype files confirmed nested (November 10, 2026)

The owner ran a read-only ZIP directory listing search across ZIP files under Desktop, Downloads, Documents and mounted volumes. It found:

### `~/Downloads/stage5_design_prototype.zip`
The archive contains all seven previously searched prototype components:
- `stage5_design_prototype/wake_model.py`
- `stage5_design_prototype/channel.hpp`
- `stage5_design_prototype/bq_stall.hpp`
- `stage5_design_prototype/session_p.hpp`
- `stage5_design_prototype/session_p.diff`
- `stage5_design_prototype/tests_det.cpp`
- `stage5_design_prototype/stress.cpp`

Therefore these seven files are **recovered inside the existing prototype ZIP**, not missing. Their standalone copies were not found by filename search. Keep the archive classified LOCAL_ONLY until copied to a verified repository/backup; do not extract or execute during the freeze.

### `~/Downloads/DEMORA_Claude3_Independent_Review_Package.zip`
The archive search found at least `r4_stress.cpp`. The user's pasted terminal output is truncated after an initial `s`, so the complete matching-entry list and full archive inventory remain unconfirmed. Do not infer additional filenames.

### Standalone `bq.hpp`
The separately located `~/Downloads/bq.hpp` remains LOCAL_ONLY, 2,341 bytes, owner-reported SHA-256 `aba4734a4c4ea27490f472b151544012b20bb61b695c9be46433dbe9c8ae3680`. The prototype README says its bundled `bq.hpp` is verbatim from Stage 5 test lines 20–112; byte identity between standalone and bundled copies has not been checked.

No ZIP extraction, tests, builds, scripts, research, file movement or modification were performed.


## Claude 3 review archive fully inventoried — November 10, 2026

Owner-provided Terminal output confirms:

- Path: `~/Downloads/DEMORA_Claude3_Independent_Review_Package.zip`
- Size: not yet recorded.
- SHA-256: `7fa9ca571a968c5f28846578fc9c9aa9648609a948ba655aef16ac34dac8c48a`
- Classification: `LOCAL_ONLY` — full archive recovered; not yet committed or copied to a verified backup.

Exact ZIP entries:
1. `DEMORA_v3_4_STAGE5_WORK.zip` — embedded original Stage 5 archive.
2. `Pasted text(20261109-214223).txt` — report/source text; contents not yet inspected.
3. `r1_pinned_after_owner_release.cpp` — R1 reproduction source.
4. `r2_queue_mailbox_ordering.cpp` — R2 reproduction source.
5. `r4_stress.cpp` — R4 stress reproduction source.
6. `RUN.sh` — execution script; do not run during recovery freeze.
7. `mut_owner.py` — mutation script; do not run during recovery freeze.

The archive is more than a report: it preserves the original v3.4 Stage 5 ZIP and the three R1/R2/R4 repro source files plus their runner/mutation harness. This is Claude 3's independent review/reproduction package for the original Stage 5 source. It is **not** the missing repaired v3.4.1 candidate package and does not establish that a repaired source was reviewed.

The prototype archive remains:
- Path: `~/Downloads/stage5_design_prototype.zip`
- SHA-256: `35223ac088b9c5f7cb2af968bea99ab9a342db6375b89ddca9774d6543789968`
- Entries include all seven prototype components confirmed in the prior recovery note.

No archive extraction, test, build, script, technical research, file movement or modification was performed. Hashes are as reported by the owner's Terminal; not independently recomputed in this chat.


## Claude 3 archive report contents recovered — November 10, 2026

The owner supplied the complete output of reading `Pasted text(20261109-214223).txt` from the Claude 3 review ZIP. This is the detailed **“DEMORA v3.4 Stage 5: Independent Review (Claude 1)”** report embedded in Claude 3's package. It is a review of the **original v3.4 Stage 5**, not a review of a repaired v3.4.1 source.

### Findings recorded in the recovered report
- R1: callback-owned lease at shutdown can leave the session permanently Pinned; reproduced under Pin and Free policies. After callback release, leases can all be Free while restart remains refused.
- R2: the Vyukov queue algorithm is assessed PASS on x86 only, but `pop()==false` may mean a producer has claimed but not published a cell; one-shot mailbox scan can strand an event; mailbox recovery can reorder events and the strict ledger rejects late sequence delivery.
- Queue capacity >= pool size is presented as an inferred argument for avoiding push failures, not as a universal proof for additional event classes.
- Stage 5 overflow tests are single-threaded; their TSan result does not exercise concurrent mailbox publication/consumption.
- Owner-path mutation coverage: 9 of 12 mutants killed; report identifies genuine gaps for `move()` ignoring owner bit and `release_owned` without owner check.
- Apple DriverKit contracts include multiple UNRESOLVED/BLOCKED items: synchronous abort completion semantics, payload placement, frame-vs-microframe entry, DMA visibility, descriptor retention, OSAction lifetime/cancel ordering, disconnect-safe reclamation, interface ownership, entitlements actually granted.
- USB isochronous 10x10 packet-layout evidence is BLOCKED because no captures were supplied to that review.
- Reported environment: Linux x86_64, GCC 13.3, Python 3.12.3, one CPU core; ARM64 macOS not run.
- Reported original Stage 5 results: 94 tests / 511 checks / 0 failures, 61 Python tests; Stage 5 TSan is explicitly called vacuous because its test is single-threaded.
- The report recommends, only when implementation is authorized: defer Session::finish() while callback-owned leases remain, use a bounded owner-stall deadline ending in Pinned with a distinct fault, update tests that encoded the defect, add concurrent R4 and owner mutants, and leave the mailbox out pending the real DriverKit dispatch model.
- The report states nothing was committed, pushed, merged, installed or signed and v3.3 was untouched.

### Provenance and distinction
- Container: `~/Downloads/DEMORA_Claude3_Independent_Review_Package.zip`, owner-reported SHA-256 `7fa9ca571a968c5f28846578fc9c9aa9648609a948ba655aef16ac34dac8c48a`.
- Embedded report filename: `Pasted text(20261109-214223).txt`.
- Reproduction source entries in the same archive: `r1_pinned_after_owner_release.cpp`, `r2_queue_mailbox_ordering.cpp`, `r4_stress.cpp`, `mut_owner.py`, `RUN.sh`.
- This confirms the report and reproduction package are preserved locally. It does not establish that any repaired candidate was reviewed.
- The report's own reproduction figures and the separate later candidate report's figures are distinct test contexts; do not combine them into one result.

The owner freeze remains active. No tests, builds, scripts, extraction, implementation, research, hardware operations, or file movement were performed in this recovery update.


## Claude 3 consolidated inventory response — owner supplied, November 10, 2026

Claude 3 reports that its current upload directory contained five files: the original Stage 5 ZIP, the Stage 5 design prototype ZIP, the v3.4.1 R1/R2 candidate report, `CLAUDE2_REVIEW_RESPONSE.md`, and `DEMORA_CLAUDE2_V3_REVIEW.md`. It did not inspect either ZIP, compute hashes, extract files, or run tests/builds/scripts. Its ZIP-content conclusions are therefore explicitly **NOT VERIFIED BY CLAUDE 3**.

### Claude 3 conclusions (limited to its current session view)
- Repaired v3.4 Stage 5 source: **not established as present**.
- Exact v3.4.1 R1/R2 patchset: report present; source patch/ZIP and logs not established as present.
- Claude 2's two supplied review documents concern earlier adjacent work and do not validate the later Stage 5 ingress/queue/mailbox design.
- Claude 3 has no record of reviewing a specific repaired-source hash.
- It requests authorization to list and hash the five uploads and list ZIP contents without extracting them.

### Reconciliation against owner-provided Mac terminal evidence
Earlier in this conversation, the owner directly ran `unzip -Z1` against `~/Downloads/stage5_design_prototype.zip`. That terminal output confirmed the archive contains:
`wake_model.py`, `channel.hpp`, `bq_stall.hpp`, `session_p.hpp`, `session_p.diff`, `tests_det.cpp`, and `stress.cpp`.
The owner also supplied its SHA-256: `35223ac088b9c5f7cb2af968bea99ab9a342db6375b89ddca9774d6543789968`.
The prototype README was previously read by the owner and explicitly labels it SCRATCH / not production code. Thus the files are recovered inside the local ZIP even though Claude 3's current session did not inspect its contents. Do not mark those seven components missing from the Mac inventory.

Earlier owner-provided Mac terminal output also confirmed the Claude 3 review ZIP contains the original Stage 5 ZIP, the Claude 1 review text, R1/R2/R4 repro sources, `RUN.sh` and `mut_owner.py`. The ZIP SHA-256 supplied by the owner is `7fa9ca571a968c5f28846578fc9c9aa9648609a948ba655aef16ac34dac8c48a`. Claude 3's current-session upload inventory is a separate access snapshot and must not overwrite the Mac recovery evidence.

### Candidate report claims — preserve as reported, not independently verified
Claude 3 transcribed the report's stated scope:
- Candidate changes reportedly touched `core/v3/session.hpp`, `core/v3/test_v3.cpp`, and added `core/v3/completion_ingress.hpp` and `core/v3/test_completion_ingress.cpp`.
- Report-stated results: 94 tests / 514 checks / 61 Python tests.
These figures differ from other historical reports (including the original Stage 5 report's 94 tests / 511 checks and 61 Python tests). Keep each figure attached to its own report; do not merge or silently reconcile them.

### Outstanding items
- Actual final v3.4.1 candidate patch/source package and its exact hash: `MISSING_UNCONFIRMED`.
- Claude 2 repaired Stage 5 source ZIP, complete diff and logs: `MISSING_UNCONFIRMED`.
- Evidence that Claude 3 reviewed the exact repaired-source hash: `MISSING_UNCONFIRMED`.
- Claude 3's requested metadata-only inspection of the five currently supplied files: pending owner approval in that Claude session.

This entry records Claude 3's report and reconciles it with the owner's earlier Mac terminal evidence. It does not authorize tests, builds, scripts, extraction, implementation, research or hardware operations.


## Claude 3 metadata-only ZIP manifest — 2026-11-09/10

Claude 3 supplied the following exact metadata for the five files in its upload directory. It reports that hashes were computed over the five uploaded files; ZIP contents were inspected only through central-directory listings, not extracted. These values agree with the owner-provided Mac hashes previously recorded for the original Stage 5 ZIP, prototype ZIP and candidate report.

| File | Bytes | SHA-256 | Classification |
|---|---:|---|---|
| `DEMORA_v3_4_STAGE5_WORK.zip` | 4,023,544 | `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6` | ORIGINAL_BASELINE |
| `stage5_design_prototype.zip` | 22,332 | `35223ac088b9c5f7cb2af968bea99ab9a342db6375b89ddca9774d6543789968` | SCRATCH_PROTOTYPE |
| `V34_1_R1_R2_OFFLINE_CANDIDATE_REPORT.md` | 5,712 | `6172dad98505a2a6eff50f12675dc269af6272da7465b5c940c092068b9e46ce` | REVIEW_REPORT / candidate description |
| `CLAUDE2_REVIEW_RESPONSE.md` | 5,405 | `8d4afc33a7d313a87b12546628e506963843544fb002605737816e5331c5856d` | REVIEW_REPORT |
| `DEMORA_CLAUDE2_V3_REVIEW.md` | 7,863 | `bd175c5f31adfa40f3bd3515f42b489ad85cadf063c374d831092d522d69a890` | REVIEW_REPORT |

### Original Stage 5 archive directory inventory
Claude 3 reports 149 entries and 23,564,445 uncompressed bytes. The archive contains the v3.3-era source, reports, binaries, logs, Stage 4 tests and Stage 5 overflow test. It has no nested archives. Specifically, the reported `core/v3/` inventory contains `atomic_lease.hpp`, `diag_engine.hpp`, `ledger2.hpp`, `parity_v3.cpp`, `session.hpp` and `test_v3.cpp`; Stage 5 includes `test_callback_overflow.cpp` and a byte-identical `test_callback_overflow_STAGE5_PASS.cpp`. It does not contain `completion_ingress.hpp` or `test_completion_ingress.cpp`. The report states no repaired full source tree or candidate patch is present in this archive.

### Prototype archive directory inventory
Claude 3 reports 13 entries and 55,036 uncompressed bytes:
- `README.md` (2,179 bytes)
- `wake_model.py` (4,003)
- `channel.hpp` (2,252)
- `bq.hpp` (2,341)
- `bq_stall.hpp` (2,539)
- `session_p.hpp` (12,423)
- `session_p.diff` (5,836)
- `driver.hpp` (4,206)
- `tests_det.cpp` (9,730)
- `stress.cpp` (5,404)
- `policy_guard.hpp` (1,078)
- `cf_run.sh` (1,504)
- `mutation_run.sh` (1,541)

This corroborates the earlier Mac directory listing and the README already read by the owner, which labels the prototype SCRATCH / not production. Claude 3's current metadata-only pass did not read the prototype file contents. The archive has no filenames in common with the original work ZIP. It is a partial design prototype, not a complete repaired Stage 5 tree.

### Candidate status
- The candidate report is present, but its described candidate source package/patch and supporting logs are not in the five uploaded files.
- The original work ZIP's reported inventory lacks `completion_ingress.hpp` and `test_completion_ingress.cpp`.
- The only `.diff` identified in the supplied material is prototype `session_p.diff`; its content has not been inspected in Claude 3's current metadata-only pass. The owner previously read a pasted diff excerpt from the prototype README context, but that excerpt does not establish the final candidate patch.
- Claude 3 has no evidence that it reviewed a specific repaired-source hash.
- The exact v3.4.1 candidate source/patch remains `MISSING_UNCONFIRMED`; Claude 2's final repaired Stage 5 ZIP/diff/logs remain `MISSING_UNCONFIRMED`.

### Duplicate and test-count cautions
Claude 3's ZIP central-directory CRC/size analysis identified likely duplicate groups within the original archive, including the three 7,294,567-byte vector outputs, duplicate CSV logs, duplicate Python tests, duplicate handoff and duplicate Stage 4/Stage 5 test source files. CRC-32 plus size is not cryptographic proof; do not describe these as SHA-256-verified duplicates.
The candidate report's stated results are 94 tests / 514 checks / 61 Python tests. The original Stage 5 review reported 94 tests / 511 checks / 61 Python tests. These are separate report-stated figures and must remain distinct until their underlying logs are recovered and reconciled.

### Evidence boundaries
Claude 3's report explicitly says it did not extract or read ZIP member contents in this metadata-only pass. It inferred prototype roles from filenames and prior notes; content-level validation of `session_p.diff` and the prototype source remains outstanding and is not authorized during the current freeze. Its five-file upload list is a snapshot of that Claude session and does not override the owner's broader Mac inventory, which includes the separate Claude 3 review ZIP and its repro harnesses.

No tests, builds, scripts, extraction, implementation, research or hardware operations were performed in this recovery update.


## Claude 2 last known Stage 5 implementation assignment — owner supplied, November 10, 2026

The owner supplied the last known Claude 2 task text and its listed input attachments. This establishes that Claude 2 had previously been assigned an **isolated experimental implementation**, not merely a review:

### Inputs listed in Claude 2's session
- `DEMORA_v3_4_STAGE5_WORK.zip`
- `RUN.sh`
- `mut_owner.py`
- `r4_stress.cpp`
- `r2_queue_mailbox_ordering.cpp`
- `r1_pinned_after_owner_release.cpp`

These are the original Stage 5 source and Claude 1's reproduction/mutation harness inputs. Their presence in Claude 2's prior session is owner-reported. The listing does **not** establish that Claude 2 completed or exported a repaired source package.

### Original requested work
Claude 2 was asked to work in a disposable copy, preserve v3.3 and original v3.4 Stage 5, and implement an isolated experimental repair:
1. Fix permanent Pinned shutdown defect.
2. Correct queue publication and consumer wakeup handling.
3. Remove emergency mailbox only if queue-capacity invariant can be formally established.
4. Preserve strict sample-ledger ordering.
5. Add concurrent regression tests based on R1/R2/R4.
6. Run complete suite and sanitizers.

### Required deliverables requested from Claude 2
- Complete repaired source ZIP.
- Exact source hashes.
- Full test results.
- Before/after defect reproductions.
- Changed-file list.
- Remaining risks.
- New experimental version identifier.
- Explicit no-native-driver-readiness claim.

Claude 2 was explicitly told not to modify GitHub, commit, push, merge, install, activate or access USB hardware.

### Current recovery interpretation
This is evidence of the **scope and inputs** of Claude 2's previous implementation assignment. It is not evidence that the requested repair was completed. The repaired ZIP, changed files, exact output hashes, full logs and before/after results remain `MISSING_UNCONFIRMED` until recovered from Claude 2's prior response/session or actual files.

### Doorbell/wakeup note
The owner also supplied Claude's correction: the test sampled `bells` after the first ring, so exactly one additional ring after Idle was expected. The observed post-Idle re-ring was considered correct behavior. Preserve this as a test-accounting correction, not a new defect or a validated production wakeup protocol.

The owner reports Claude 2 is currently rate-limited for another hour. No new work is authorized during the wait. Do not restart implementation or tests until the existing output artifacts and session state are recovered and the owner explicitly resumes work.


## Claude 1 latest session transcript — experimental implementation handoff (owner supplied, November 10, 2026)

Source: owner-uploaded transcript Pasted text(20261110-014705).txt (281 lines). This is a conversation transcript, not a source package or build log.

### Assignment and review completed
Claude 1's November 9 assignment was initially read-only: independently audit Stage 5 ownership/concurrency, review DriverKit contracts and packet-layout evidence, preserve v3.3/v3.4, and return findings. Its report reproduced the original permanent-Pinned shutdown defect, identified queue/mailbox and ordering risks, and reported 94 tests / 511 checks / 61 Python tests on its stated Linux x86-64 environment. USB packet-layout analysis was blocked because captures were not supplied; DriverKit contract items remained mixed/unresolved.

### Later authorization and new worktree
The transcript then records: “Implementation is now authorized” and Claude 1 began an isolated experimental repair in a new tree named DEMORA_v3_5_EXP1_STAGE5_REPAIR, starting from the original baseline archive. Claude 1 stated it would leave the original upload untouched and exclude stale arm64 binaries and dSYMs because they would not correspond to the new source.

The last visible progress message says Claude 1 was about to inspect existing finish() test assumptions to identify tests requiring deliberate changes. It then hit a usage limit. The transcript does not show any completed source edits, test execution, output ZIP, diff, source hashes or final report for v3.5 EXP1.

### Status and provenance
- DEMORA_v3_5_EXP1_STAGE5_REPAIR: WORKTREE START REPORTED; CONTENT/COMPLETION UNVERIFIED.
- Repaired source ZIP: MISSING_UNCONFIRMED.
- Changed-file list/diff: MISSING_UNCONFIRMED.
- Test/sanitizer logs for EXP1: MISSING_UNCONFIRMED.
- Output source hashes: MISSING_UNCONFIRMED.
- No evidence in this transcript of a commit, push, merge, install, activation or USB access.
- Do not confuse this Claude 1 v3.5 EXP1 worktree with Claude 2's separate requested repair, or with the partial stage5_design_prototype.zip.

### Authorization boundary
The transcript contains a later, explicit authorization to begin isolated experimental implementation. That authorization is limited to a disposable experimental source tree based on the original v3.4 Stage 5 baseline. Preserve v3.3 and original v3.4; no GitHub writes by Claude 1, no merge, no installation/activation, no USB hardware, no physical output, and no native-driver-readiness claim. No tests are evidenced as having started in the transcript; resume by recovering the existing worktree state and reporting exact files before repeating or extending work.


## Claude GitHub second-audit findings — owner supplied transcript, 2026-11-10

Source: owner-uploaded `Pasted text(20261110-021958).txt` (129 lines). Claude reports that it loaded all 92 PR #2 conversation comments, read full text for about 16 assignment comments and only excerpts (400–1,400 characters) of the remainder; it reviewed no submitted PR reviews or inline threads (none existed). All 92 comments are authored by the repository owner, so agent-role attribution in comment headings is not independently authenticated. Long Codex technical reports were not read line-by-line. Treat this as a useful but bounded audit, not a complete forensic review.

### PR #2 / branch reconciliation
- PR #2 is open and unmerged; head `codex/aira-m9p-integration-plan` at `11feab2d6ba78a16c2b46d87ce6199b300c1193f`.
- It is 31 commits ahead and 2 behind current `main`. The two later `main` commits are `2cc50a06` (PR #3 monitor workflow merge) and `071c2ad0` (Claude 3 recovery task file). Neither touches PR #2's ten changed files; GitHub reports the PR cleanly mergeable.
- The base SHA `6381fcc1` is the frozen main tip when PR #2 opened on Nov 7, not an unexplained mismatch. PRs #1, #2 and #3 share that original base. This resolves the earlier suspected base-SHA discrepancy; parent linkage was inferred, not directly proven by the audit.
- PR #2 has 10 changed Markdown files, not source code. The PR body says nine files and is stale/incomplete.
- Current `main` is `071c2ad0`, not the older `2cc50a06` cited in prior status/register text. The PR branch's documentation needs refresh.

### Engineering history and attribution caveat
- Claude 1's Stage 5 review exists only embedded in the locally held Claude 3 review package; it reviews original v3.4, not a repaired hash.
- Claude 1 later reported starting `DEMORA_v3_5_EXP1_STAGE5_REPAIR`; actual worktree/output remains unverified. The separate earlier Claude 1 approval-gate assignment (`aira-bridge/approval_gate.py`, `test_approval_gate.py`) has no delivery evidence.
- Claude 2's isolated Stage 5 repair outputs remain MISSING_UNCONFIRMED. Claude 2's Bridge v3.1 design is also reported delivered in conversation but absent from refs checked.
- Claude 3's v3.1 pin scratch candidate is reported as `DEMORA_Offline_v3.1_pin_scratch.zip` hash prefix `c2a6f4f3`, patch prefix `4101df6a`, 56 tests / 298 checks / 42-of-42 mutants; actual package provenance and validation logs need artifact recovery.
- Codex tasks G (synthetic isochronous fixture), H (RME-inspired diagnostics spec), I (Mac readiness checklist), and compile-only CoreAudio plan have no completion evidence in the audited comments.
- Reported completed but not committed/local-only work includes M9R mock source/logs and an `aira-bridge/` tree; publication was not authorized. Do not publish without owner approval.

### No repair source or test evidence on refs inspected
The audit reports no repaired Stage 5 source, patch, logs or hash manifest on PR #2 head, `main`, or the F2 experiment branch it inspected. Specifically absent on those refs: `completion_ingress.hpp`, `test_completion_ingress.cpp`, `session_p.*`, `core/v3/*`, and test logs. PR #1 contains older M9K/M9N-B simulators; F2 contains a probe dependent on missing `core/v3/diag_engine.hpp`. This is limited to refs examined, not every branch or external workspace.

### Important inconsistencies requiring reconciliation
- Main SHA references in docs are stale; refresh to `071c2ad0`.
- Register's “four M9P docs” and PR body “nine files” conflict with actual ten changed files.
- Register is append-only and contains superseded/contradictory entries (prototype files alternately missing/found; bq.hpp status; Claude 3 ZIP inventory).
- Freeze / Claude 1 EXP1 exception is inconsistent across PROJECT_STATUS, NEXT_TASK and handoff docs.
- Old “current authorized next work” still lists compile-only native preparation despite recovery freeze.
- Test totals conflict: original v3.4 Stage 5 94 tests / 511 checks; v3.4.1 candidate report 94 / 514; another workflow comment claims 100 / 561 with 2,420 interleavings. Underlying logs are not recovered; do not combine or treat these as equivalent.
- Embedded review title says Claude 1 but was filed in Claude 3 package; attribute by report title, not container name.
- v3.3 archive hash is present in offline verification report (prefix `1853630d`), contrary to earlier register claim that no hash was recorded.
- Committed candidate report is 3,218 bytes, while local report is 5,712 bytes and not byte-identical.
- RECOVERY_AND_HANDOFF_POLICY says do not edit main directly, but `071c2ad0` was committed directly to main.
- Conflicting agent-dependent / agent-free workflow documents and overlap between F2 README and register should be reconciled.

### Recovery priorities
1. Claude 1: recover actual v3.5 EXP1 worktree state; separately resolve approval-gate assignment.
2. Claude 2: recover original Stage 5 repaired ZIP, diff, logs, hashes and before/after R1/R2/R4 evidence; recover Bridge v3.1 design.
3. Claude 3: review the exact hash of whichever repair is actually recovered.
4. Owner: locate candidate patchset (reported patchset prefix `d90c88c9`, patch prefix `26f46765`); reconcile local/committed candidate report versions; back up and hash-verify local-only packages; inventory Mac/Windows capture, probe and driver trees. Raw captures must not be committed to GitHub.
5. Codex: either provide evidence for G/H/I and compile-only CoreAudio task or mark them superseded; owner approval required before publishing M9R/Bridge local source.
6. Documentation cleanup: refresh refs/counts, resolve stale/contradictory sections, clarify EXP1 exception and task freeze, and reconcile test counts.

Claude states it made no write calls during this audit. No source, test, build or hardware activity is evidenced by this transcript.


## Claude 1 GitHub retrieval checkpoint — 2026-11-10

Source: owner-supplied Claude 1 response after authenticated GitHub read attempt.

Claude reports it successfully read the PR #2 head files at commit `4e21550b`: `PROJECT_STATUS.md` (blob `fa11ab67`), `NEXT_TASK.md` (blob `56d2cc5b`), `ARTIFACT_REGISTER.md` (blob `ccc2baf7`), `RECOVERY_SYNC_HANDOFF_2026-11-10.md`, and `RECOVERY_AND_HANDOFF_POLICY.md`. It reports the handoff and policy were unchanged from `11feab2d`. These are Claude-reported observations, not independently re-audited here.

### Access limitation
Claude's GitHub connector successfully read repository files but its attempt to post a PR comment failed with `403 Resource not accessible by integration`. Claude reports no GitHub writes were made. The connector currently has read access but lacks permission for PR/issue comments. This does not establish whether all other write scopes are absent.

### EXP1 recovery result
- Original EXP1 instructions are not in the GitHub files; only a summary is present. The original instructions remain in the owner-supplied conversation transcript `Pasted text(20261110-014705).txt`.
- Claude reports no `DEMORA_v3_5_EXP1_STAGE5_REPAIR` worktree, uploaded files, ZIPs or patches in its sandbox, and no matching branch.
- Claude explicitly reports it produced no repaired source, made no source modifications and ran no tests. No EXP1 logs or output hashes exist in the inspected environment.
- Therefore EXP1 remains **NOT RECOVERED / NO SOURCE DELIVERABLE VERIFIED**. Do not describe it as an active implementation or completed repair.

### Authorization/documentation mismatch
Claude reports `PROJECT_STATUS.md` describes a narrow exception allowing Claude 1's isolated offline v3.5 EXP1 repair, while `NEXT_TASK.md` and `RECOVERY_SYNC_HANDOFF_2026-11-10.md` do not mention that exception. The governing scope should be reconciled before any fresh implementation is authorized.

### Next decision
Owner must choose between (a) locating and uploading the original EXP1 worktree/ZIP/diff from the Mac, or (b) explicitly authorizing a new, separately named disposable repair from the original v3.4 Stage 5 archive. Do not silently recreate EXP1 or conflate a new repair with recovered prior work. Preserve v3.3 and original v3.4; no hardware, installation, activation or merge.
