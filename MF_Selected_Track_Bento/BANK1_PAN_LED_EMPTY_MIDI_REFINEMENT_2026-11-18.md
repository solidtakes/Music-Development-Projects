# Bank 1 — Pan LED suppression for MIDI tracks without instruments

**Owner-requested change:** 2026-11-18. **Status:** approved requirement for next experimental build; not yet implemented or hardware tested.

## Behavior
- When the selected/controlled track is a MIDI track **without an instrument and without audio output**, suppress/clear the Pan encoder LED indication.
- When the track has audio output (including instrument-bearing MIDI tracks and audio tracks), preserve existing Pan LED behavior.
- Update the LED on track selection, instrument/device chain changes, and module switching; do not leave stale Pan LEDs lit.
- This is an **LED-only** change: do not remap Pan rotation/push, change existing Track Mixer gestures, change global LED colors, or alter other frozen modules.

## Technical caution
- Do not infer instrument presence solely from track type. Verify Live 12/13 API support for track audio-output detection (e.g. has_audio_output), and test nested device/instrument racks, empty MIDI tracks, and instrument removal/insertion.
- Confirm exact target Pan LED in the current working Bank 1 source; avoid blanket clearing of other LEDs or MIDI channels.
- Cross-bank review only if implementing requires changing shared MIDI routing, LED helper logic, or Bank 2 behavior. Otherwise keep this Bank 1-local.

## Test checklist
1. Empty MIDI track: Pan LED off.
2. MIDI track with instrument: Pan LED normal.
3. Audio track: Pan LED normal.
4. Add/remove instrument while track remains selected: LED follows available audio output.
5. Switch rapidly between these tracks: no stuck Pan LED.
6. Regression: Track Mixer mute, arm, pan reset, solo, FX and Device behavior unchanged; Bank 2 untouched.

**Reference:** ACCEPTED_MODULES_V1_FREEZE_2026-11-12.md; SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md.
