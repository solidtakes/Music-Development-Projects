# MF Clips n Scenes — Bank 3 v0.1 test feedback
Date: 2026-11-10

User-confirmed working:
- Ableton Session Box appears.
- Rows 3 and 4 seem to work; precise individual row 4 behavior not yet itemized.
- Row 3 E9–E12 detects populated clips and displays actual clip colors.
- Playing clip LEDs flash; recording indication is red.
- White outer LED rings display playback position and scale correctly to loop length for looping clips.

Known issue (also present in older build): Non-looping clips do not show white-ring clip progression. Investigate playhead progression against clip start/end markers when looping is disabled; do not assume fix is implemented.

Still to verify: Rows 1–2 E1–E8, all E13–E16 stop actions, button-release semantics, waiting/queued LED exact color and behavior, chord suppression. Preserve confirmed working looping progress and LED feedback.
