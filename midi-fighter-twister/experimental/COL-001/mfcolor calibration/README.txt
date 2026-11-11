COL-001 v0.1 — RGB CALIBRATION — BANKS 1 & 3

No controls. Sends static RGB override values on Live Control Surface startup.
Bank 1 E1..E16: 1,5,9,13,17,21,25,29,33,37,41,45,49,53,57,61
Bank 3 E1..E16: 65,69,73,77,81,85,89,93,97,101,105,109,113,117,121,125
MIDI output: channel 2 (status B1), bank 1 CC 0..15, bank 3 CC 32..47.
No MIDI input handling, encoder actions, or bank switching.

Extract folder 'mfcolor calibration' into Ableton MIDI Remote Scripts.
Restart Live; select 'mfcolor calibration' as Control Surface and Twister as MIDI Output.
MIDI Input can be None. Switch hardware between Bank 1 and Bank 3.
Compare Standard and Expanded modes in MF Utility; reselect surface after changing settings.
Disable competing LED feedback scripts during testing.

Experimental; not hardware validated. Palette sends on startup only.
