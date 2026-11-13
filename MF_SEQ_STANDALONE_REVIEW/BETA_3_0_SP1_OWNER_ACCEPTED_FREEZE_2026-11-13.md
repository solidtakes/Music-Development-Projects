# MF Sequencer Beta 3.0 — Owner-accepted SP1 baseline
Date: 2026-11-13
Status: OWNER HARDWARE ACCEPTED (reported); freeze designation. No automatic merge.

## Owner acceptance
Owner reports: "performance mode works this is beta v3 now".
Promote **SP1 Scale + Performance** review candidate to **Beta 3.0** accepted baseline. S1 scale-only remains a diagnostic predecessor, not the accepted Beta 3.0 build.

## Exact immutable artifact provenance
Source review PR: https://github.com/solidtakes/Music-Development-Projects/pull/14
Review commit: 372690b15751bbd5bd5c6287cf88fdf89d9dd89e
Artifact: MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip
SHA-256 (Codex report): 223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180
Original Beta 2.3 Test18 ZIP SHA-256: 38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c

## Included changes (from PR #14)
- Scale Awareness OFF chromatic; ON uses observed root/scale intervals; runtime scale context and listener/poll fallback; no silent C-major fallback.
- Playback/render work optimization: shared timing reads, selective display invalidation, avoid redundant full renders and duplicate touched-ring resend.
- Existing frozen gestures/mappings, palettes and musical editing behavior retained by design.

## Verification limits
Owner reports SP1 "works" on hardware; do not expand this into a claim that every checklist case or quantitative performance test passed. Live API exposure across versions, scale edge cases, sustained performance, CPU and latency measurements remain unverified until separately tested.

## Freeze and development rules
- Preserve exact SP1 ZIP bytes as Beta 3.0 immutable rollback; do not rebuild/relabel source in a way that changes archive identity without documenting it.
- Beta 2.3 Test18 remains prior rollback; S1 remains scale-only comparison.
- Continue new features only in isolated post-Beta 3 experimental branches; no merges, stable overwrites, or controller mapping/LED changes without owner approval.
- Future roadmap: swing, note nudging, CC/modulation, per-note/all-64 resets, non-destructive tie/length restoration. These are NOT in Beta 3.0.
- CROSS-BANK REVIEW REQUIRED for integrating standalone Bank3 sequencer into combined multi-bank setup.
