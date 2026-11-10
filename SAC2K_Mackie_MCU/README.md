# Radikal SAC-2K / Ableton Live Mackie MCU customization

Research snapshot: 2026-11-09. **Research only; no Ableton script modifications or hardware validation yet.**

Goal: customize Ableton Live Mackie Control remote script for Radikal Technologies SAC-2K running Mackie emulation. Preserve original script and working motor faders, displays, MIDI feedback, and transport.

## Files
- [MIDI_NOTE_MAP.csv](MIDI_NOTE_MAP.csv): standard MCU button note numbers, decimal and hexadecimal.
- [MIDI_CC_AND_MESSAGES.md](MIDI_CC_AND_MESSAGES.md): CC, pitch bend, SysEx, LED, and message examples.
- [MANUALS_AND_SOURCES.md](MANUALS_AND_SOURCES.md): links to manuals and protocol research, with provenance and caveats.

## Verification levels
- **MCU reference**: documented standard Mackie behavior; not SAC-2K verified.
- **SAC-2K documented**: physical or DAW-specific mappings in Radikal/Logic manuals; not necessarily Mackie emulation output.
- **Hardware verified**: requires actual SAC-2K MIDI capture; none collected yet.

## Next steps
1. Obtain the user's actual Ableton Mackie Control script ZIP and inspect its implementation and Live version.
2. Capture SAC-2K MIDI input/output, including mode changes, button press/release, rotary direction, touch, fader motor and display responses.
3. Build a SAC-2K physical-control-to-MCU map; distinguish emulation from native Logic mappings.
4. Fork script into stable baseline and test build; never overwrite original.

Copyright: Manuals and third-party source code are **linked, not copied** into this repository. Obtain redistribution permission before adding PDFs or copied code.
