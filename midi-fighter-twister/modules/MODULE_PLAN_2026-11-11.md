# MF Sel Track — Module Plan (2026-11-11)

## Milestone baseline

MF Sel Track v1.6 is the user-confirmed hardware-tested milestone baseline. Keep its original ZIP unchanged. Source archive upload is not established by this planning document.

## Module boundaries

- **Column 1 — Mixer module**: extract working functionality from the milestone; make physical placement configurable.
- **Column 3 — Switchable VU / Beat Counter module**: four logical controls, VU by default, push on logical control 1 toggles Beat Counter; preserve white stepped MIDI rings, inner meter colors, animation and timing. This is one combined module, not separate active modules.
- **Device 8**: eight controls, canonical two-column logical layout; orientation/physical placement determined by host.
- **Device 4**: four controls, canonical single-column logical layout; orientation/physical placement determined by host.
- **Device Slots**: four device on/off toggles, Yellow ON / Blue OFF / dark empty, pending implementation.

## Proposed device navigation (not yet hardware-tested)

- Logical control 1: Device On/Off
- Logical control 2: Parameter Bank
- Logical control 3: Previous Device
- Logical control 4: Next Device
- Controls 2–4: Blue resting, momentary Yellow while pressed.
- Parameter bank status message should show the selected range and starting device/parameter as appropriate; test in Ableton before adopting across modules.

## Shared rules

- A module owns only its mapped LED addresses and releases them on mode exit.
- Keep source logic and test evidence separate; do not claim planned behavior has passed hardware testing.
- Clip and Scene flash timing standards are separate from the Beat Counter: recording 1/2 note, playing 1/4 note, waiting 1/8 note.
- Do not modify v1.6 milestone while extracting modules.
