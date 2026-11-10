# First test-build change requests

Status: proposed; not implemented or hardware tested.

## CR-001 Pan encoder sensitivity
- Problem: turning SAC-2K pan encoder takes too many revolutions to traverse the pan range in Ableton Live.
- Target: initial 8x relative delta scaling, adjustable after testing (4x, 8x, 12x, 16x options).
- Only scale pan encoder input; do not alter sends, EQ, device encoder, jog wheel or fader sensitivity.
- Preserve clockwise/counterclockwise direction, center behavior, state and LED/display feedback; avoid wrapping and clip at valid parameter bounds.
- Inspect actual Live script's relative MIDI decoder and parameter mapping first; avoid applying scaling twice or modifying a global decoder shared with other modes.

## CR-002 Marker-area button mappings (user-confirmed desired functions)

| SAC-2K label | Desired Ableton action |
|---|---|
| STORE MARKER | Create Arrangement locator at current playhead position (or insertion position when stopped, where supported) |
| FROM | Jump to previous Arrangement locator |
| TO | Jump to next Arrangement locator |
| RECALL MARKER | Toggle Arrangement Loop on/off |

- Jog/scrub wheel rotation is **perfect**: do not modify its mapping or sensitivity.
- SHIFT currently appears inactive; investigate separately, do not depend on it for these four buttons.
- Need actual SAC-2K MIDI note IDs / script handlers before implementing. The physical labels are not proof of standard MCU note values.
- Clarify whether STORE MARKER should target playhead versus current scrub/insertion position if they differ; default playhead when running.

## Acceptance criteria
- Existing script backed up; new test build only.
- Pan reaches left/right limits much faster without erratic steps, reversal or parameter jumps.
- Other rotary controls unchanged; transport and motorized faders unaffected.
- Each changed jog-area button verified against physical label and actual incoming MIDI message.
