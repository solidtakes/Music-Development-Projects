# MF Sel Track v1.6 — hardware-tested milestone

Date: 2026-11-11

Source artifact: MF_Sel_Track_v1_6.zip (retained in ChatGPT conversation; ZIP binary not uploaded to GitHub in this commit).
SHA-256 ZIP: 252e3abfdb0b4eca94f8e97f14c62be534f5df65c70e468e1914c6aae942b61b
Source Python SHA-256: 0e0f9ee717b05b89c0e63b800d3db8d01c65ff33f1351d218b9b1b701f34e37e

## Confirmed on hardware
- Record Arm: calibrated red (88).
- FX Sends: calibrated purple (120).
- E3 VU/Beat toggle works; VU and white MIDI velocity rings on column 3.
- Solo flashes blue; E16 navigation LED dark.
- Device banking currently on E4 in device mode; navigation and device controls work.

## Known issues / proposed v1.7 (NOT in v1.6)
- E9 monitor hold/rotate remains too sensitive; proposed 5x slower than v1.6.
- Device bank status text too brief/overwritten; send bank message missing.
- Proposed device push layout: E1 power, E2 bank, E3 previous device, E4 next device; momentary yellow on E2–E4 press (not yet implemented/tested).
- Purple FX LEDs remain on E10/E14 when leaving FX mode; clear stale LED ownership.
- Track scroll proposed 25% less sensitive.
- Beat/Bar counter: playing green, recording red, queued yellow requested; preserve existing timing and animation.

This milestone documents the tested baseline. Do not silently replace it with v1.7 changes.
