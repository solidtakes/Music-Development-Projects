# First test-build change requests

Status: proposed; not implemented or hardware tested.

## CR-001 Pan encoder sensitivity
- Problem: turning SAC-2K pan encoder takes too many revolutions to traverse the pan range in Ableton Live.
- Target: initial 8x relative delta scaling, adjustable after testing (4x, 8x, 12x, 16x options).
- Only scale pan encoder input; do not alter sends, EQ, device encoder, jog wheel or fader sensitivity.
- Preserve clockwise/counterclockwise direction, center behavior, state and LED/display feedback; avoid wrapping and clip at valid parameter bounds.
- Inspect actual Live script's relative MIDI decoder and parameter mapping first; avoid applying scaling twice or modifying a global decoder shared with other modes.

## CR-002 Scrub/jog wheel surrounding button mappings
- Problem: some SAC-2K physical labels near scrub wheel do not match Ableton MCU script actions.
- Inventory physical labels, actual transmitted MIDI notes/CCs, current Live actions and desired actions before changing assignments.
- Keep scrub wheel rotational input and existing transport working.
- Request from user: specific button labels and intended replacements, or a labeled photo plus MIDI capture.

## Acceptance criteria
- Existing script backed up; new test build only.
- Pan reaches left/right limits much faster without erratic steps, reversal or parameter jumps.
- Other rotary controls unchanged; transport and motorized faders unaffected.
- Each changed jog-area button verified against physical label and actual incoming MIDI message.
