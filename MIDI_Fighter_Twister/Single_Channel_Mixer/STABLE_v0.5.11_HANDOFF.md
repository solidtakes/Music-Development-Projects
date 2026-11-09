# MIDI Fighter Twister — Single Channel Mixer v0.5.11

**Status:** USER HARDWARE-CONFIRMED STABLE / frozen reference. Built from v0.5.10, which was built from v0.5.8 stable. This is the Single Channel Mixer, **not** the separate Four-Channel Mixer, Main Build v0.20.7.2, or Test Build.

## Final changes confirmed in v0.5.11
- Start in **Effects/Sends** submode.
- **E15 push alone** toggles Effects/Sends ↔ Device Controls. E15 resting RGB = calibrated FX Send purple (47) in Effects; light blue (68) in Device. E11 push is no longer a mode selector; preserve E11 rotary/routing behavior.
- Keep the existing two-bar Device-mode beat counter: **E12 bar 1, E16 bar 2**, repeating across bars 3/4. Green for playback and red for recording. Their push actions remain FX Returns and Tracks respectively.
- **E13 white VU ring** works in Device mode as in FX mode; preserve its Volume rotation, single-press exclusive Arm, double-press Mute and Monitor/Arm RGB logic.
- **E1–E8 device parameter LEDs and white rings** are on only for available/visible parameters. Clear unused slots, including when there is no device or only one visible rack Macro. Refresh on script load, selected track/device and submode changes, and detectable parameter visibility changes. E1 push controls device power, yellow ON / blue OFF; E2 previous device, E3 next device. Preserve E4 existing push behavior and **E8 global Master selection**.
- Never reset, zero or jump device or mixer parameters when changing modes, devices or tracks.
- Preserve E9 Pan and push+rotate Monitor (IN/AUTO/OFF), double-click exclusive Solo; Solo flashes blue at fixed ~2 Hz even with transport stopped and must not interfere with E13.
- Preserve E12 push FX Returns, E16 push Tracks, E8 push Master, 300ms E16 track-selection guard, and no Master scrolling.
- Device-less MIDI tracks: hide Pan, Sends, Volume and unmapped device feedback, preserving MIDI activity where supported.

## Calibrated RGB values **from v0.5.11 source** (do not conflate with other Twister projects)
| Source constant | Value | Meaning |
|---|---:|---|
| RGB_FX_SEND | **47** | FX Sends and E15 FX mode |
| RGB_LIGHT_BLUE / RGB_SOLO_BLUE / RGB_PAN_BLUE | **68** | Device parameters, Solo, Pan |
| RGB_GREEN | **76** | Playback counter |
| RGB_RED | **72** | Recording counter |
| RGB_ORANGE / RGB_YELLOW | **108** | Orange and device power ON |
| RGB_DIM_GREEN | **88** | Low VU |
| RGB_CLIP_ORANGE_RED | **60** | Near clipping |
| RGB_LIGHT_PURPLE | **104** | Light purple |
| RGB_MAGENTA | **116** | Magenta |
| RGB_BLUE | **16** | Resting counter blue |
| RGB_CYAN | **32** | Teal |
| RGB_PINK | **52** | Navigation pink |
| RGB_PURPLE | **100** | Legacy constant; do not assume this is FX Send purple |

**Important:** Earlier color-calibration discussions for other builds cite purple 96 and different yellow values; for this archived build use the actual source constants above. White rings are distinct from inner RGB indicators.

## Encoder grid
```
E1   E2   E3   E4
E5   E6   E7   E8
E9   E10  E11  E12
E13  E14  E15  E16
```

## Regression checklist before adapting to Four-Channel Mixer
1. Script loads in FX mode; E15 toggles both ways, purple 47 ↔ blue 68.
2. No-device track: all E1–E8 parameter indicators dark; one visible rack Macro: only mapped indicators active.
3. Change device/track/mode repeatedly: no stale blue indicators or white rings, no parameter jumps.
4. E1 device power; E2/E3 device navigation; E8 Master; E12 Returns; E16 Tracks.
5. E13 VU and Volume/Arm/Mute; E9 Pan/Monitor/Solo; transport-independent Solo blink.
6. Device mode E12/E16 two-bar counter, no push conflicts.
7. Effects mode existing four-bar counter, Sends and routing unchanged.

## Release / preservation
- User confirmed v0.5.10 hardware working, then confirmed v0.5.11 **"works perfect"** and designated it final stable Single Track Mode.
- Freeze v0.5.11. Use a **new branch/version** for Four-Channel Mixer; do not modify this archive or overwrite the other Twister projects.
- The local deliverable is `MFT_v0511_SINGLE_BUTTON_TOGGLE_TEST.zip` containing `MidiFighterTwister_Custom/MidiFighterTwister_Custom.py` and `__init__.py`. The ZIP is available as a conversation artifact; this documentation commit does **not** claim the ZIP/source has been uploaded to GitHub.
