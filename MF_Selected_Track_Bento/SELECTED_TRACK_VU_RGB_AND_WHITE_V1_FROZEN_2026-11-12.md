# FROZEN / APPROVED — Selected Track Mixer VU Display v1

User approved the combined RGB + white LED preview on 2026-11-12. This file is the authoritative specification for the **Selected Track Mixer VU display**. It supersedes speculative visual previews and guesses. It does not change script code.

## 1. RGB audio VU: approved progressive colors
One vertical four-encoder display, E1 top through E4 bottom. At low levels green fills upward E4 → E3 → E2 → E1; **all four must be green before any turn yellow**.

| Stage | E1 top | E2 | E3 | E4 bottom |
|---|---|---|---|---|
| Fully green | Green | Green | Green | Green |
| Yellow | Yellow | Yellow | Yellow | Green |
| Orange | Orange | Orange | Yellow | Green |
| Red peak | Red | Orange | Yellow | Green |

Do not change this progression. Exact numeric thresholds were illustrative in the approved preview and are NOT frozen as numeric values.

## 2. White MIDI activity: four-step binary ladder
One MIDI-activity meter for the selected track, distributed across E1–E4 white rings. Every ring has only two possible output values: **0 (OFF)** or **127 (ON)**. No partial-ring fill and no 0–127 continuous per-encoder meter. Fill E4 bottom → E3 → E2 → E1 top.

| Activity level | E1 top | E2 | E3 | E4 bottom |
|---|---:|---:|---:|---:|
| 0/4 | 0 | 0 | 0 | 0 |
| 1/4 | 0 | 0 | 0 | 127 |
| 2/4 | 0 | 0 | 127 | 127 |
| 3/4 | 0 | 127 | 127 | 127 |
| 4/4 | 127 | 127 | 127 | 127 |

RGB and white ladders operate independently. Exact MIDI activity measurement, decay, and thresholds were not specified; do not invent them as user-approved. Verify Live API event access before claiming true MIDI activity detection.

## 3. Scope and change control
- Selected Track Mixer display, as explicitly approved by user. The VU module's separate RGB freeze remains valid; this document is not authorization to modify other modules.
- Preserve the frozen Track Mixer v1 gestures (E3 Mute; E4 Arm; hold E4 + tap E3 Pan Reset; hold E3 + tap E4 Solo), module switching, and other frozen functions.
- Do not redesign RGB colors, white LED distribution, or binary semantics without explicit user approval.
- Future builds must compare against this document and test all four RGB stages and all five white ladder states.
- **Approval is for design only; code implementation and hardware validation are not claimed.**

## Provenance
User confirmed after interactive preview: 'ok thats it for vu on selected track, can you save this definition and remmeber it? how can i be assured'.
Earlier separate records: VU_RGB_COLOR_V1_FROZEN_2026-11-12.md and SELECTED_TRACK_MIDI_WHITE_LADDER_V1_2026-11-12.md.
