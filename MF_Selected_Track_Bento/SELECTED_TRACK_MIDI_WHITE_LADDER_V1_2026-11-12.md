# Selected Track Mixer — White MIDI Activity Ladder v1 (User-specified)

Status: SPECIFICATION CONFIRMED by user, 2026-11-12. Hardware behavior not yet implemented or verified.

## Scope
Selected Track Mixer mode ONLY. Independent of VU module RGB color progression (separately frozen).

## Four binary white LED rings
- Four encoders E1 (top), E2, E3, E4 (bottom) form ONE vertical four-segment MIDI activity meter for the selected track.
- Each encoder's white ring has exactly TWO output values: **0 = fully off** or **127 = fully on**. Never intermediate values or partial rings.
- Ladder fills bottom-to-top: first E4, then E3, then E2, then E1.
- Activity levels:
  - 0 segments: E1=0 E2=0 E3=0 E4=0
  - 1 segment: E1=0 E2=0 E3=0 E4=127
  - 2 segments: E1=0 E2=0 E3=127 E4=127
  - 3 segments: E1=0 E2=127 E3=127 E4=127
  - 4 segments: E1=127 E2=127 E3=127 E4=127
- This is one four-segment ladder, NOT four separate 0–127 meters, NOT four analog-style rings, NOT a velocity editor.
- The underlying MIDI-activity measurement/thresholds/decay are not defined by this specification and must not be invented as approved. Determine technical feasibility of observing actual selected-track MIDI events in Ableton Live's Remote Script API before claiming functionality.
- Preserve frozen Track Mixer gesture mappings and existing RGB indications. Do not change the VU module color freeze.

## Regression requirements
Check binary-only 0/127 outputs, correct bottom-to-top fill, no gaps in ladder, correct selected-track binding, no unintended changes to Track Mixer controls or VU module.
