COL-001 v0.2 — RGB CALIBRATION — BANKS 1 & 3

No controls. Sends color values on startup after ~1 second and repeats approximately every 8 seconds.
Bank 1 E1..E16: 1,5,9,13,17,21,25,29,33,37,41,45,49,53,57,61
Bank 3 E1..E16: 65,69,73,77,81,85,89,93,97,101,105,109,113,117,121,125
MIDI output: channel 2 (status B1), bank 1 CC 0..15, bank 3 CC 32..47.
No MIDI input handling, encoder actions, or bank switching.

Extract folder 'mfcolor calibration' into Ableton MIDI Remote Scripts, replacing only the earlier experimental folder.
Restart Live; select 'mfcolor calibration' as Control Surface and Twister as MIDI Output.
MIDI Input may be None. Disable competing Twister Control Surface outputs.
Check Ableton Log.txt for 'COL-001 v0.2 loaded' and 'palette transmission'.
If no color appears, share whether those log lines are present before changing MIDI mappings.

Experimental; hardware unverified. This version intentionally repeats LED feedback.
