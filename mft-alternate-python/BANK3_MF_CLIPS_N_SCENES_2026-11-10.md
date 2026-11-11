# Bank 3 — MF Clips n Scenes
Updated 2026-11-10. Development handoff; do not overwrite stable Main Build.

## Identity and source
Separate Ableton MIDI Remote Script named `MF_Clips_n_Scenes` (internal folder and Python module), designed to appear under that name in Ableton Control Surface list. Test archive named `MF_Clips_n_Scenes_v0.1_TEST_Ableton.zip`. Conversation test package reported created, but archive/source has NOT been committed to this GitHub repository; hardware/Live test results are pending. Reference source supplied by user: `MFT_Test_Build_v0_23_4_YELLOW_ROLLBACK(1).zip` (also not committed here). Preserve originals.

## Bank 3 hardware (user confirmed applied)
- Expanded Color Mode for Bank 3 only; other banks unchanged.
- E1–E16 rotary CC32–47, channel 12, Relative ENC 3FH/41H, sensitivity 360.
- E1–E16 push CC32–47, channel 11, CC Hold.
- No rotary actions on initial launcher page.

## Page 1 v0.1 contract
- E1–E12: 4 tracks x 3 scenes clip launch.
- E13–E16: stop tracks 1–4.
- Trigger launch/stop on button RELEASE, not press; no intentional wait timer, no double-click timer.
- Press-and-hold combinations consume both gesture participants and must not accidentally launch a clip or stop a track. Ignore rotary changes while push is held.
- Empty clips dark; stopped populated clips solid actual Ableton clip color; playing flashes clip color at 1/8; recording flashes red at 1/16; queued launch/stop flashes orange at 1/16.
- White outer rings show clip loop-length-aware playback progress; track stops should have white flashing feedback.
- Prioritize event handling; throttle redundant LED updates, no parameter resets.

## Later scope (NOT v0.1)
- Session Box highlighted in Live, relative scrolling one track/scene per tick; pause nonessential animations during scrolling and resume ~100–150ms after idle (visual-only).
- Pages: Clips Only, Clips + Scenes, Scenes Only, possibly Clips + Mixer/Devices.

## Validation needed
Verify Ableton recognizes `MF_Clips_n_Scenes`; E1–E12 launch only on release; E13–E16 stop only on release; color and animation mapping in Expanded mode; progress loop scaling; chord suppression; no regression to other banks. Earlier packaging/syntax claims in chat are not independently reproducible from GitHub until source is committed.
