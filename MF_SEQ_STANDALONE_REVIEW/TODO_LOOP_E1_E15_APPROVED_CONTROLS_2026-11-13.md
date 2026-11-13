# MF Sequencer Beta 2 — Approved Loop Window Control Specification
Date: 2026-11-13
Status: OWNER-APPROVED DESIGN, NOT YET IMPLEMENTED
Baseline: owner-confirmed stable Test 16.

## Gesture assignment
- Hold E1 + press E15: cycle loop length 1 -> 2 -> 4 -> 1 bars, skipping lengths invalid for current loop start.
- Hold E1 + twist E15 clockwise: advance loop start by one bar, subject to current length fitting within 4-bar content.
- Hold E1 + twist E15 counterclockwise: retreat loop start by one bar.
- Preserve E1 + twist E16 page navigation, E1+E13 NOTES/PARAM and E1+E14 parameter cycling.
- Suppress accidental E1/E15 note, tie, probability-preset and normal encoder edits during modifier combinations.

## Hard constraints
- Loop start is 1-based bar index 1..4.
- Length is one of 1, 2, 4 bars.
- Start + length - 1 <= 4; never wrap or exceed four bars.
- Start=1 permits 1,2,4; start=2 permits 1,2; start=3 permits 1,2; start=4 permits 1.
- For invalid start rotation, block movement and leave loop unchanged.
- For length cycle, skip invalid choices; if only one valid length, leave unchanged.
- Four-bar note content is preserved while playing a shorter loop. Re-expand without losing notes.
- On activation initialize loop to start bar 1, unless an existing Live loop should be retained; verify current clip semantics before coding.

## Implementation/testing
- Use Live 12.4.16 clip loop_start and loop_end carefully; investigate start_marker/end_marker and playback position interaction.
- Show bar start and loop length in status feedback.
- Hardware tests: each allowed start/length, invalid boundary, playback and restart, 4-bar content retention, note edits outside active loop, saved/reopened clip.
- Cross-bank review required if global routing or button behavior changes. No Native Mode or LED brightness changes.
- No auto-merge. Stable Test 16 ZIP remains rollback.
