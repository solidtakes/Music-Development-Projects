# CURRENT BETA — Bento VU Module specification

Status: Current Beta DESIGN specification, user approved Selected Track display and requested matching Master display on 2026-11-12. **This document is not an implemented Python build or hardware test result.**

## Shared RGB audio VU (FROZEN)
Four encoder positions E1 top through E4 bottom. Green fills E4 -> E3 -> E2 -> E1. All four green before yellow.

| Stage | E1 top | E2 | E3 | E4 bottom |
|---|---|---|---|---|
| All green | Green | Green | Green | Green |
| Yellow | Yellow | Yellow | Yellow | Green |
| Orange | Orange | Orange | Yellow | Green |
| Peak | Red | Orange | Yellow | Green |

This RGB progression is identical for Selected Track and Master. Do not change without user approval. Exact numeric thresholds are not yet frozen.

## White four-segment ladder
Every encoder white ring is **binary only**, either **0 = OFF** or **127 = ON**. One vertical ladder, bottom to top E4 -> E3 -> E2 -> E1. Never continuous ring fills, partial segments, or four separate meters.

| Ladder | E1 | E2 | E3 | E4 |
|---|---:|---:|---:|---:|
| 0/4 | 0 | 0 | 0 | 0 |
| 1/4 | 0 | 0 | 0 | 127 |
| 2/4 | 0 | 0 | 127 | 127 |
| 3/4 | 0 | 127 | 127 | 127 |
| 4/4 | 127 | 127 | 127 | 127 |

### Selected Track mode
White ladder measures **MIDI activity on the selected track**. This combined Selected Track RGB+white design was explicitly approved and frozen. MIDI event access, conversion to 0–4 activity level, thresholds and decay are not yet implementation-verified.

### Master mode
White ladder measures **Master audio level**, not MIDI activity. Uses same four binary states and same RGB color progression. Requested for next Beta build; no claim of implementation or hardware approval yet.

## Guardrails
- Scope: VU module's Selected Track and Master views; do not silently change frozen Track Mixer controls, separate Master module, or other modules.
- The original frozen RGB design and selected-track combined display remain authoritative; this document consolidates and extends them, without changing their rules.
- Before a release, validate all five white states and RGB stages in both modes, plus source binding (selected MIDI vs Master audio).
- Do not call this a working Beta ZIP or code upload until a real source artifact has been built, uploaded, and verified.

Related records: SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md, VU_RGB_COLOR_V1_FROZEN_2026-11-12.md, SELECTED_TRACK_MIDI_WHITE_LADDER_V1_2026-11-12.md.
