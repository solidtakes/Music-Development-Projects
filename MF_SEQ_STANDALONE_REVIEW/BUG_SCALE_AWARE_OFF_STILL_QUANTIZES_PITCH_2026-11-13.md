# Regression — Scale Awareness OFF still quantizes pitch
Reported 2026-11-13 by owner on frozen Beta 2.3 Test 18.
Status: SOURCE-VERIFIED CAUSE, FIX NOT YET IMPLEMENTED.

## Evidence
Exact frozen MF_SEQ/MF_SEQ.py:
- Lines 26-38: SCALE_ROOT=0, SCALE_NAME='MAJOR', SCALE_INTERVALS constant.
- Lines 947-956: _next_scale_pitch() always walks pitches until ((candidate - SCALE_ROOT)%12) in SCALE_INTERVALS.
- Line 971: _adjust_pitch() unconditionally calls _next_scale_pitch().
No runtime branch for Live Scale Awareness OFF in this pitch-edit path.

## Expected
When Ableton's Scale Awareness is OFF, twist pitch editing in semitone increments (chromatic), bounded MIN_PITCH/MAX_PITCH. When ON, follow Live's current musical scale/root if accessible, or explicitly document supported fallback. Switching the setting while running must update without reloading the script. Existing notes must not be retuned by merely toggling awareness.

## Codex instructions
- Investigate exact Ableton Live 12.4.16 API property for the Scale Awareness toggle and scale/root, and any relevant clip/song listener, using supported APIs and existing older build behavior. Do not invent Live Object Model properties.
- Produce a small isolated patch based on verified frozen source; no changes to accepted E1/E13/E16 chords, Follow, LED colors, loop boundaries or pitch range.
- Test OFF: C,C#,D,D#... and ON: selected scale steps, including toggling while clip plays, clip changes, and near pitch bounds. Preserve note metadata.
- If API isn't exposed, report blocker and propose explicit controller mode rather than silently hardcoding C major.
- Deliver experimental ZIP and diff, owner tests before promotion; leave Beta 2.3 frozen.
