# MIDI Fighter Twister — Reusable Modules

This directory is for independent, mix-and-match functional modules. Module behavior and LED logic are separate from physical encoder/button placement; host builds map logical controls to MFT banks, rows, columns, or individual buttons.

## Planned modules

- Device Controls — 8-control two-row and two-column layouts, derived from the verified MF Sel Track E1–E8 implementation.
- Audio VU Meter — reusable four-control column/row, with calibrated LED levels.
- Beat Counter — reusable four-control column/row, preserving the working animation.
- FX Sends — four controls.
- Mixer / Track controls.
- Clips, Scenes, Transport, and I/O.
- Single-button functions as needed.

## Rules

1. Keep modules position-independent; physical encoder IDs are assigned by the host script.
2. Preserve proven behavior and source references when extracting a module.
3. Avoid conflicting LED ownership, duplicate listeners, and unnecessary polling.
4. Do not treat this directory as implemented modules: source extraction and hardware validation are separate future steps.
5. Do not change working builds without explicit approval.
