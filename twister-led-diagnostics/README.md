# Twister LED Diagnostics — independent experimental script

## Version history
- v0.2.0: MIDI input and local white ring movement observed; no visible script-controlled RGB change.
- v0.3.0: custom Bank 1 channel mapping; user confirmed rotating encoders displays changing RGB colors.
- v0.4.0: proposed color calibration with independently adjustable encoder LEDs; not built/verified.

## Verified test context
Custom mapping: rotary MIDI channel 12, CC0–15; push MIDI channel 11, CC0–15; RGB feedback MIDI channel 11, CC0–15. Use only one Twister control surface script at a time.

## Safety
Keep this diagnostic separate from the Four-Channel Mixer and stable Main Build. This commit is a status manifest; ZIP binaries have not yet been uploaded to GitHub.
