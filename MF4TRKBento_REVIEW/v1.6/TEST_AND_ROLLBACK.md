# MF4TRKBento v1.6 EXP test and rollback

Python 3.14 from the archive root:

```
python -B tests/test_smoke.py
python -B tests/test_matrix.py
python -B tests/benchmark.py /path/to/verified/v1.5/MF4TRKBento/MF4TRKBento.py
```

## Hardware checklist (pending)

1. Back up the working MF4TRKBento folder and close Live. Install only the ZIP's MF4TRKBento folder. Keep the existing ports, 222.mfs, MIDI mappings and controller mode.
2. With duplicate Pan rows and two Sends rows, test an empty MIDI-only track, a silent instrument, and an audio track. Remove and add an instrument and a return. Verify both LEDs go dark when unavailable, then restore within the normal polling cadence. Turn and press on missing controls. Confirm Pan presses reset eligible tracks, Sends presses are inert, and master Pan remains in the alternate fourth slot. Confirm Send A/B follow top-to-bottom order.
3. Capture the existing RGB feedback with a passive monitor. Verify one addressed channel-11 CC with value 48 on Sends color transitions and separate channel-12 ring output. Check for subsequent writers to the same address, and confirm violet and black on the physical Twister with its present profile. The zero value can restore a configured inactive color.
4. Test all five directed chords with both release orders. An unregistered reverse order can execute the normal button actions. Use a disposable Set when testing Stop. Confirm there is no wrap, the fourth alt Arm/Solo/Mute encoder cannot act as modifier, and a defined but non-armable Record Arm chord leaves the track unchanged. With eligible modifiers held above and below, the first held owns the chord. Confirm red Arm and blue Solo 68, exclusive singles, and same-row multi gestures.
5. Exercise all four rows, Master Pan, scroll both axes at four detents, selected-track independence, E16-first alternate toggle, scene states and white ring, Stop release safety and whole-Set Stop outside the grid.

Quit Live and restore your previous v1.5 MF4TRKBento folder to roll back. PR #25 and its verified ZIP remain the rollback baseline.
