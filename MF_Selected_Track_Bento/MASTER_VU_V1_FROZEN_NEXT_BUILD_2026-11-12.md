# FROZEN — Master VU v1, Bento VU Module

**Status:** USER APPROVED / DESIGN FROZEN on 2026-11-12. **Implementation:** required in next experimental build, not yet claimed as implemented or hardware tested.

## Scope
Master VU view **inside the VU module** only. Do not change the separate Master module, Selected Track Mixer controls, or other frozen modules.

## Source
Both RGB VU color progression and four-segment white LED ladder represent **Master audio level**. White does NOT represent MIDI activity in this view.

## Frozen RGB progression (same as approved Selected Track VU)
Green fills from E4 bottom toward E1 top. All four become green before yellow appears.

| Stage | E1 top | E2 | E3 | E4 bottom |
|---|---|---|---|---|
| Fully green | Green | Green | Green | Green |
| Yellow | Yellow | Yellow | Yellow | Green |
| Orange | Orange | Orange | Yellow | Green |
| Peak | Red | Orange | Yellow | Green |

## Frozen white ladder
Each encoder white ring is binary: **0 = OFF** or **127 = fully ON**. One four-step Master audio meter fills E4 -> E3 -> E2 -> E1. No partial ring, per-encoder 0–127 sweep, or independent white meters.

| Master audio ladder | E1 | E2 | E3 | E4 |
|---|---:|---:|---:|---:|
| 0/4 | 0 | 0 | 0 | 0 |
| 1/4 | 0 | 0 | 0 | 127 |
| 2/4 | 0 | 0 | 127 | 127 |
| 3/4 | 0 | 127 | 127 | 127 |
| 4/4 | 127 | 127 | 127 | 127 |

## Implementation instructions for NEXT BUILD
- Implement this exact Master VU design in the existing VU module.
- Preserve the separately frozen Selected Track VU design (RGB same, white MIDI activity for selected track).
- Preserve frozen Track Mixer gestures and all other module mappings.
- Ensure proper Master audio source binding and cleanup when switching modes.
- Regression test RGB stage ordering and five white ladder states, binary-only white output, both views, and no stale LEDs.
- Numeric thresholds and decay are not explicitly approved; use a documented test calibration and request feedback rather than claiming threshold freeze.
- No merge without user approval; do not call it implemented until code and tests are verified.

Reference: CURRENT_BETA_VU_MODULE_TRACK_AND_MASTER_2026-11-12.md and SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md.
