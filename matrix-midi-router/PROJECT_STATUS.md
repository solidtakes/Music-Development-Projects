# Matrix MIDI Router — Max for Live

Type: Max for Live / Ableton Live MIDI routing patch.

## Verified baseline
- Earlier iterations successfully routed MIDI channel 1 and channel 2 to distinct receiving instruments.
- Version 6 was previously reported as in progress with Codex, but its exact source/version and behavior have not been independently verified.
- At the last repository inspection, this folder contained this status document but no Max patch / AMXD source. Do not claim the requested changes are implemented or tested.

## Latest requested work — November 6, 2026

### Selection-following track volume controls
- Encoders 13, 14 and 15 are dedicated volume controls for the first, second and third tracks represented by the currently selected Matrix selection box.
- Their track assignments must follow the selection box whenever it moves.
- These are fixed bottom-row controls, not dependent on which encoder is selected.

### Display behavior
- In the normal state, each encoder display shows a white VU meter for its assigned track.
- Use fast peak metering: no RMS mode, no RMS averaging or smoothing; respond to peaks as quickly as possible.
- When an encoder changes volume, freeze/stop that encoder's VU display and temporarily show the corresponding track's volume value in dB.
- After approximately one second without further encoder movement, return to the live VU display.
- When the selection box moves, update both the volume target and VU source for all three encoders.

## Next steps
1. Obtain/import the actual Max patch or AMXD source and any current Codex version 6 work.
2. Confirm exact version and inspect the existing selection-box-to-track mapping.
3. Implement encoders 13–15 as selection-following track volume controls.
4. Implement the temporary dB readout and return to the live white peak-VU display.
5. Test selection changes, track-volume writes, peak response, display timeout and MIDI feedback in Ableton Live.
6. Record source/version, commit SHA and actual test results here.

Rule: Do not represent the earlier channel-routing tests as validation of version 6 or of these new volume/VU features.
