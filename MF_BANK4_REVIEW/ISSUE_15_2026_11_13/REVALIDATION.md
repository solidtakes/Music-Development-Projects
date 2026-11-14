# Issue 15 — current-request revalidation

The requested work already has an isolated audit branch and Draft PR #17. This follow-up rechecked that evidence rather than creating a duplicate PR. **Repair remains blocked by missing Bank 4 source.** Per Issue #15: “If source is missing, report the missing artifact and stop before speculative reconstruction.” No executable candidate, guessed parameter order, mappings or production patch has been created.

## Fresh audit

- Fetched current remote refs. Scanned 29 remote branch heads (excluding origin/HEAD), candidate filenames and Python content for `MFBank4Test`, selected-device controls and Bank 4 CC48 references. No matching Python implementation. `current_inventory.json` records exact refs/commits and candidate paths. The original 26-head inventory is historical evidence and is retained.
- Checked reachable filename history, release list (empty) and available user-material directories (`library-files`, `shared/downloads`, `scratch`; no files). This does not establish that inaccessible external attachments or unreachable Git objects do not exist.
- Re-read Issue #15 and its existing comment, both required research handoffs, shared rulebook and seven mandatory freeze/module references. Current issue authorization supersedes older “Bank 4 reserved” documentation; frozen Bank 1 mappings do not specify Bank 4 controls.
- Verified every original evidence checksum in SHA256SUMS. Reran `verify_protocol.py` using the pinned firmware and older sequencer sources: 7 extracted firmware groups and 4 reference Python groups pass. `retest_results.json` records the rerun. These are not Bank 4 tests.
- Re-fetched pinned comparison files from jeffgca/djtt_twister_16macros and leolabs/ableton-js. Confirmed framework appointed-device registration/on-off/encoder binding versus explicit `Track.view.selected_device`, plus exact object/property/callback listener removal. Use those as design patterns only; preserve the research document's licenses and version limitations.

## Additional accepted-reference evidence

The accepted Beta 3.0 SP1 ZIP is available in repository history and was independently verified again:

- Commit: `372690b15751bbd5bd5c6287cf88fdf89d9dd89e`.
- Archive SHA256: `223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180`.
- MF_SEQ.py SHA256: `f1dff03e7ec0af128a2ae609cd9d1e5cb268888e2ab0d77209c0693063dbfa9a`.
- Actual constants: PUSH_CHANNEL=10, ROT_CHANNEL=11, FIRST_CC=32. Its `_led` / `_white_ring` functions produce RGB `(0xBA, 32+i, 68)` and ring `(0xBB, 32+i, 99)` for i=0..15, suppressing a repeated unchanged frame. Checks pass; results in `sp1_reference_results.json`. Reproduce with `python3 MF_BANK4_REVIEW/ISSUE_15_2026_11_13/verify_sp1_reference.py` from a clone with commit 372690b available.

This confirms the channel convention, **not Bank 4 CC addresses**. Accepted standalone Bank 3 uses CC32–47. The older sequencer reference uses CC48–63. Do not copy either reference's complete mapping into another bank. Bank 4's required CC48–63 must still be verified against its actual .mfs and implementation. The working Bento source remains missing; documentation alone is not a source comparison.

The pinned firmware's RGB zero/inactive-color behavior and ring detent-zero behavior are source-confirmed, but no Bank 4 root cause is confirmed. The reported historical `log_message` exception cannot be repaired or ruled out in the latest diagnostic because both the diagnostic and log remain missing. Successful source extraction or a “sent” message does not establish hardware reception.

## Required recovery and next action

Provide or identify the **complete selected-device Bank 4 source ZIP** first, separately from LED diagnostics. Include its version/install name and existing parameter-order/gesture requirements. Recover diagnostics v0.4.1 and v0.4.2, relevant unedited Live traceback, actual .mfs/firmware identity and accepted comparison baselines. Do not substitute a diagnostic for the full implementation.

Once recovered: hash/inventory the bytes, audit initialization and selection ownership, preserve existing parameter order/power/page semantics, make the smallest local patch, then run target selection/bounds/MIDI/listener/teardown/bank-switch mocks and publish a versioned ZIP. Those Bank 4 tests and Live 12.4.16 / Live 13 beta hardware tests remain NOT RUN.

No new hardware action is needed to resolve this source gate. After recovery, request one owner test at a time. No Banks 1–3, accepted builds, PR #14, sequencer PR #16, routing, palettes, firmware or Utility settings changed. No Native Mode activation or merge. CROSS-BANK REVIEW REQUIRED before shared changes.
