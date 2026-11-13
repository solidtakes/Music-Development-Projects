# EXP1 owner hardware checklist — all items pending

Use a disposable copy of a Live Set. Record Live version, OS, MFT configuration, clip meter/loop and outcome. Keep existing MIDI Utility/firmware settings and Bank 3 mappings.

- [ ] Load the experimental MF_SEQ folder and restart/reload the control surface. Without toggling, verify editing pages follow the playing bar.
- [ ] Hold E16, press E1: Follow OFF. Repeat: ON. Try both release orders. Check notes, ties and parameters remain unchanged by these chords.
- [ ] With Follow ON, select a bar using E13 then E1–E4. Verify selection holds through playback and loop wrap; stop/start resumes Follow.
- [ ] Repeat using hold E1 + twist E16 (four increments per bar). Verify bounds and existing manual selection behavior.
- [ ] Stop/start with Follow OFF: it stays OFF. Reload: it starts ON again.
- [ ] Check 1-, 2-, 4-bar loops, nonzero loop origin, loop wrap, existing loop start/length gestures and 3/4 meter. Verify page, playhead and ring/color feedback.
- [ ] Replace/select clips during playback, select an empty slot, then return. Verify Follow and LEDs recover. Test while manually suspended: preserve SP1 behavior until playback restart or explicit toggle.
- [ ] Test notes and velocity/pitch/length/probability modes, ordinary taps/ties/held turns. No accidental edits from navigation/toggles.
- [ ] Scale Awareness OFF edits chromatically; ON uses current root/type. Change scale, root, clip and selection; notifications do not retune existing notes.
- [ ] Confirm other physical banks and routing behave as before. This standalone build does not integrate shared listeners or banks.
- [ ] Run sustained playback; record any LED glitches, lag, CPU or note timing issues. No CPU/latency certification has been performed.
- [ ] Restore exact accepted SP1 if needed and confirm rollback. Report results before any stable promotion.
