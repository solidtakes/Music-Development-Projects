# Codex Handoff — MF Sequencer Beta 3.0 → Next Experimental Build
Date: 2026-11-13
Owner: approved autonomous debugging, optimization and experimental test builds; no automatic merges.

## Source of truth
- Accepted milestone: `MF_SEQ_STANDALONE_REVIEW/BETA_3_0_SP1_OWNER_ACCEPTED_FREEZE_2026-11-13.md`, commit `c95615b3b4149faf76b3728c9f2e1d62775280da`.
- Exact accepted SP1 artifact at review commit `372690b15751bbd5bd5c6287cf88fdf89d9dd89e`: `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip`.
- Reported SP1 SHA-256: `223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180`; verify bytes independently before deriving new build.
- Beta 2.3 Test18 rollback SHA-256: `38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c`.
- Draft PR #14 remains unmerged; never merge automatically.
- Standing authorization: `MF_SEQ_STANDALONE_REVIEW/CODEX_STANDING_AUTHORIZATION_DEBUG_OPTIMIZE_EXPERIMENTAL_2026-11-13.md` (`f85b40c`).
- Owner clarification: `MF_SEQ_STANDALONE_REVIEW/BETA_3_NEXT_BUILD_FOLLOW_PLAYBACK_DEFAULT_ON_2026-11-13.md` (`c999477`).

## First next-build change (approved)
- Set **Follow Playback default ON** on script initialization, with **hold E16 + press E1** continuing to toggle it ON/OFF.
- ON: editing page follows playing bar, including loop wrap.
- Manual bar selection suspends follow until next playback start, as accepted.
- Do not interpret "banking through bars" as changing MFT physical banks; preserve Bank 3 standalone MIDI assignments and all mappings.
- Add tests for initialization, ON/OFF gesture, manual override, playback stop/start, loop wrap, clip changes, and accidental note-edit suppression.
- Keep Beta 3.0 itself unchanged; implement only on a separate next-experimental branch.

## Ongoing work permitted
- Investigate and fix reproducible regressions, particularly runtime scale context/lifecycle and playback display issues.
- Optimize redundant rendering, note reads and LED submissions with before/after evidence and preserved musical behavior.
- Run automated tests, prepare experimental ZIPs, write changelogs, rollback instructions and hardware test checklist.
- Research sequencer-owned swing, note nudging, CC modulation, individual/all-64 note property reset, and non-destructive tie/length restoration as separately reviewable designs; no assumption that roadmap equals authorization to ship.
- Preserve Scale Awareness OFF chromatic / ON live root and scale type, no note retuning from notifications.

## Guardrails
- Preserve exact accepted Beta 3.0 SP1 ZIP and Beta 2.3 rollback.
- No auto-merge, stable overwrite, force-push, destructive clip/Set edits, firmware or MIDI Utility changes, Native Mode activation, or silent shared-routing changes.
- Keep frozen gestures, colors, CC assignments, playback semantics and other banks intact.
- CROSS-BANK REVIEW REQUIRED before any combined-bank integration, shared listener/LED refresh or routing changes.
- Hardware acceptance only for what owner reported: SP1 "works"; no blanket checklist/CPU/latency certification.
- If source/API access missing, report blocker rather than inventing fixes.

## Deliverables
1. Exact provenance and verification of SP1 archive.
2. Isolated next experimental ZIP with Follow Playback ON by default, source diff and automated regression results.
3. Concise GitHub report with known limitations, owner hardware checklist and rollback.
4. Optional subsequent optimization/research proposals separated from first change.
