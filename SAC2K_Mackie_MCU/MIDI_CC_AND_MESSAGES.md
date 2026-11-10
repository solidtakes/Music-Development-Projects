# MCU MIDI CC, pitch bend, SysEx and LED reference

**Standard MCU reference only. Not yet verified on Radikal SAC-2K.** Channels below use zero-based numbering in hex; MIDI user-facing channel 1 = status nibble 0.

## CC map
| Function | CC decimal | CC hex | Typical status |
|---|---:|---|---|
| V-Pot 1–8 rotation | 16–23 | 10–17 | B0 |
| V-Pot 1–8 LED rings | 48–55 | 30–37 | B0 |
| Jog wheel | 60 | 3C | B0 |
| Timecode / assignment digits | 64–75 | 40–4B | B0 (some implementations use BF) |

V-Pots typically use signed relative increments; clockwise vs counterclockwise is encoded in the value (commonly 01 and 41 for one step). Verify acceleration and direction on hardware. LED-ring values include mode and position bitfields; do not assume a raw 0–127 absolute position.

## Faders
14-bit pitch bend, LSB first: `E0 ll hh` = fader 1, through `E7 ll hh` = fader 8; `E8 ll hh` = master. Position = ll + 128*hh (0–16383). Bidirectional motor control requires avoiding feedback loops.

## Buttons and LEDs
- `90 2E 7F` = PLAY note-on / LED-on in standard MCU mappings.
- `90 2E 00` = PLAY release / LED-off.
- `90 2F 7F` = RECORD press / LED-on.
- Some implementations use note-on velocity `01` to request flashing; **test SAC-2K LED behavior**.
- MIDI note names differ across DAWs' octave conventions; use numeric note IDs.

## LCD / SysEx
MCU LCD text uses manufacturer SysEx (Mackie ID 00 00 66) with device/model identifiers and a display command (commonly 12), position, text bytes, F7 terminator. Exact model ID, display size and accepted command set MUST be checked against the SAC-2K; don't send arbitrary SysEx until confirmed.

## Other feedback
Timecode display often uses CC 64–75; meter feedback may use channel pressure. Fader touch is represented by dedicated notes in MCU maps, but SAC-2K touch detection must be captured before implementation.

## Source
https://github.com/NicoG60/TouchMCU/blob/main/doc/mackie_control_protocol.md
https://htlab.net/computer/protocol/mackie-control/Mackie_Control_MIDI_Map.pdf
