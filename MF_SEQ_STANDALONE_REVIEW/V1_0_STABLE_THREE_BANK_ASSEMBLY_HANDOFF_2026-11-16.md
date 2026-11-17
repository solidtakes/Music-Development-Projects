# MF Sequencer v1.0 Stable — Standalone Source & Three-Bank Assembly Handoff
Owner promotion: 2026-11-16

## Status and provenance
Owner promotes the accepted Beta 3.0 SP1 Scale + Performance implementation to **v1.0 Stable**, for use as a source module in a future three-bank combined script. This is a **version designation, not a new executable code change**.
- Source snapshot: commit `372690b15751bbd5bd5c6287cf88fdf89d9dd89e` (PR #14 review snapshot).
- Original owner acceptance record: `c95615b3b4149faf76b3728c9f2e1d62775280da`.
- Frozen installable ZIP: `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip`
- ZIP SHA-256 as recorded by Codex: `223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180`
- Prior rollback: Beta 2.3 Test18 SHA-256 `38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c`.

## Standalone source package — required together
- `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/combined/MF_SEQ/MF_SEQ.py`
- `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/combined/MF_SEQ/scale_sync.py`
- `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/combined/MF_SEQ/__init__.py`
The `combined/` folder name in the review means **scale + renderer candidate**, not a finished three-bank controller. Do not treat it as a three-bank integration.

## Assembly contract
- Standalone sequencer mapping: MFT Bank 3, rotary CC32–47 channel 12, push/RGB CC32–47 channel 11, relative 3FH/41H. These are existing mappings, not new assignments.
- Maintain sequencer E13/E16 modifier chords, Follow Playback behavior, notes/parameter modes, loop operations, RGB and ring semantics.
- v1.0 retains SP1's exact current Follow Playback default; **Follow Playback default ON** is an approved *future experimental* change only, not silently part of v1.0.
- Preserve dynamic Scale Awareness and scale_sync listener lifecycle; ensure initialization, disconnect, output ownership, timer callbacks, refresh and MIDI channel isolation when composing surfaces.
- For 3-bank integration, obtain exact accepted source versions and MIDI mappings for the other two banks. Do not guess or overwrite their code.
- CROSS-BANK REVIEW REQUIRED before shared MIDI routing, LEDs, listener ownership, bank switching or combined package changes.
- Test each bank individually and switching repeatedly, shared output feedback and no duplicated surfaces before declaring the combined package working.

## Limits and next steps
- Owner reported SP1 works on hardware; quantitative latency/CPU, full scale edge-case checklist and combined-bank hardware validation are not claimed.
- Preserve frozen artifact and source. Do not auto-merge PR #14 or modify other banks.
- Integration work belongs on a new isolated branch and requires source-level review and hardware acceptance.
