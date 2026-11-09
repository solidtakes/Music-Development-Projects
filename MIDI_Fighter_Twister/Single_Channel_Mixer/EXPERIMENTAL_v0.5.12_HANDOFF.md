# Single Channel Mixer v0.5.12 — EXPERIMENTAL
Based on hardware-confirmed stable v0.5.11. **Do not replace or merge stable v0.5.11 until hardware testing.**

## Changes prepared
- Device Mode: E5 push advances E1–E8 parameter mappings by banks of 8 (1–8, 9–16, 17–24, etc.). Wrap to 1–8 after last available bank. Rack macro visibility still applies. Unmapped controls stay dark.
- FX/Sends Mode: E5 push retains existing Send Bank Down.
- After push: 400 ms per-encoder rotation suppression, except E9 hold+rotate Monitor gesture. Existing E16 selection guard retained.
- E13 inner LED priority: Solo flashing blue > Mute off > Arm red > normal monitor/track identity. White volume/VU ring unchanged.
- E13 volume sensitivity and existing absolute CC mapping unchanged. Log diagnostic message when E13 receives CC 0 or 1, including current volume and track name.

## Important test notes
- Confirm Device E5 bank switching and wrap, including 9–12 partial bank and Rack macro visibility.
- Check E13 muted+armed, solo+muted, unmute and unsolo LED transitions.
- Check E13 volume jumps after returning from idle; inspect Live Log.txt for `MFT E13 VOLUME LOW MIDI CC` entries.
- Confirm E9 Monitor hold+rotate still works and E15 mode toggle is unchanged.
- The source ZIP and two-page PDF were generated in the ChatGPT session, but are **not yet uploaded to GitHub** by this commit. GitHub contains this handoff and the textual diagram, not the Python source.
- This is offline syntax-checked only, not hardware-tested.
