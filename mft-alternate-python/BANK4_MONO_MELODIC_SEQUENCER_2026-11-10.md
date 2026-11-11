# Bank 4 — Mono Melodic Sequencer
Updated 2026-11-10. Development handoff; independent from Bank 3 launcher and Main Build.

## Hardware mapping supplied by user
- Encoders E1–E16 rotary CC48–63 on MIDI channel 12, Relative ENC 3FH/41H, sensitivity 360, center detent and Dot indicator.
- Buttons E1–E16 CC48–63 on MIDI channel 11; CC Hold recommended for press/release and hold+rotate note duration.
- Verify final device settings and available button action options before assuming all recommendations applied.

## Current design and recent test feedback
- Mono MIDI step sequencer, one 16-step bar per page; press to place/edit note, rotation adjusts pitch and potentially duration via hold+rotate. Exact gesture details should be verified against latest local source.
- v1.51 reported by user: double-click switching seems to work; testing paging to bar 2; bar 2 notes can be entered and clip loop extends.
- User reached up to 8 bars unexpectedly; CAP maximum to 4 bars (64 steps) in subsequent build. This is a requested fix, not verified implemented.
- User asked whether note-entry lag can be reduced without harming double-click detection. Investigate tradeoff; do not silently change double-click semantics.
- Intermittent combination press E1+E15 or possibly E1+E16 appeared to move clip position down one slot; user could not reproduce later. Keep as observation, not confirmed bug.
- User requested adding handling of multiple simultaneous button presses to TODO (exact behavior to reconfirm).
- Older v0.1 initial test had E1 toggling without note insertion and E2–E16 unresponsive; do not treat as current v1.51 behavior.
- Source and tests for v1.51 have not been committed/verified in this GitHub repository.

## Guardrails and next checks
Preserve independently working banks and stable script. Verify double-click switching, bar paging and loop extension; enforce 4-bar cap; characterize note-entry responsiveness vs double-click window; investigate intermittent chord/navigation interaction without inventing a reproduction. No changes to Bank 3 launcher or stable Main Build.
