# MF4TRKBento v1.5 EXP test and rollback

## Offline verification

With Python 3.14, run from the archive root:

```text
python -B tests/test_v1_5.py
python -B tests/test_matrix.py
python -B tests/benchmark.py /path/to/exact/v1.4/MF4TRKBento/MF4TRKBento.py
```

The exact v1.4 archive's original smoke/animation test passed. The adapted v1.5 smoke/animation test and nine matrix tests passed. The matrix exercises all rows and module choices, exclusive and multi Arm/Solo, vertical chords in both directions, Sends, monitoring and mute, per-track and global Stop, inactive and remapped targets, Pan/Master Pan, clip releases, independent scrolling, cache retry and disconnect. The timing harness also compares complete MIDI streams in four workloads.

## Live 13 Beta and Twister checklist — pending

1. Close Live. Back up the working MF4TRKBento folder. Install only this ZIP's MF4TRKBento folder and start Live with the same ports, Utility settings and controller mode. Use a disposable Set with at least eight tracks, a folded group, an audio track, a silent MIDI track and at least two returns.
2. Cycle all seven modules on each row. Confirm only one Arm and one Solo. Try nonadjacent RClip rows and move Live's selected track. Confirm the highlight follows only the independent offsets. Test E1 held + E16 or E12 turn (four same-direction detents), reversal, and E16 held first + E1 for alternate mode. Verify no unintended action on release.
3. On each row, verify single Arm and Solo activation clears other regular tracks, active taps toggle off, and same-row hold+press adds tracks with either release order. Repeat with Live's exclusive preferences both ways. Verify red Arm and blue Solo and their solid-to-flash transitions. With Arm in rows 2–4, test both vertical directions and check that the other row's normal press does not fire. In alternate mode, check fourth Arm/Solo is dark and inactive.
4. Put Sends on two or more rows. Verify top-to-bottom assignments and reassignment, purple RGB on a silent MIDI track with a send, rotary adjustment and inert press. Check missing send and inactive alternate fourth control. Verify the Mute module on audio and MIDI tracks, with Auto/Off yellow and In blue, and the ring tracking mute without changing monitoring. Verify Pan reset and alternate fourth Master Pan.
5. In each Stop row, use a scrolled window and start clips on a target track and an off-grid track. Confirm a short press only acts on release. Normal mode stops the addressed track. Alternate mode fourth stops the entire Set, including the off-grid clip. Try holding for at least 0.5 seconds, switching modules, horizontal and vertical navigation, alternate toggle, vertical chord and a changed target while held. Check that none of these releases stop clips. Test an empty control and the right edge.
6. In alternate RClip rows check off/solid yellow/green flash/pink flash/red flash and white-ring progress from a playing clip. Use a scene with off-grid clips and test launch on release. Observe steady stopped LEDs, moving playback rings, and Live log errors. Switch away and back in Live's Control Surface preferences and check for duplicate callbacks or repaint errors.

## Rollback

Close Live, replace only the installed MF4TRKBento folder with the saved working v1.4 folder, and restart Live. Keep all earlier ZIPs, including v1.2/v1.3. The v1.5 artifact uses CC0–15, rotary channel 12 and push channel 11, as in the supplied build. Mapping migration remains pending physical capture.
