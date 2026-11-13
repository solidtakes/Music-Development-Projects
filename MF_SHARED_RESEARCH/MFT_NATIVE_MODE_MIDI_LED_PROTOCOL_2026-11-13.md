# MIDI Fighter Twister — Shared MIDI LED Protocol Research (all banks)
Date: 2026-11-13
Status: RESEARCH ONLY — no changes to any bank, routing, or accepted build.

## Scope and caution
Owner confirms use of experimental firmware with Native Mode. Native Mode is **paused** for implementation here; experimental integration thread will investigate. The protocol below is from the DJ TechTools open-source firmware documentation, and must be hardware-verified against the exact experimental firmware. Native Mode changes the input message mapping, so DO NOT send its activation command from an existing Bank 1–4 script without a cross-bank review and input compatibility plan.

Primary source: https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/blob/master/doc/NativeMode.md

## Native Mode activation / lifecycle
SysEx: F0 00 01 79 06 <command> <content> F7
- Enable: F0 00 01 79 06 00 01 F7
- Disable: F0 00 01 79 06 00 00 F7
- Two bottom side buttons together also toggle Native Mode.
- Native-specific configuration is intentionally lost after disconnect.

## Input MIDI in Native Mode (1-based channel numbers)
- Knob twist: channel 1, CC 0–15 (row-by-row), 63 left / 65 right.
- Knob press: channel 2, CC 0–15, 127 press / 0 release.
- Side buttons: channel 3, CC 0–5, 127 press / 0 release.
These differ from current per-bank custom mappings (e.g. experimental sequencer Bank 3 rotary CC32–47 ch12 and push CC32–47 ch11). Do not assume ordinary bank-selection/side-button behavior survives.

## LED ring position
CC on channel 1, controller 0–15, value 0–127.
Example: B0 00 7F sets E1 ring position to 127.

## Ring type and center detent SysEx
Command ID 01 00, payload: ii tt dd cc
- ii: encoder index 00–0F, row-by-row.
- tt: 00 Dot; 01 Bar; 02 Blended Bar; 03 Spread Bar.
- dd: 00 detent off; 01 detent on.
- cc: 00–7F crossfade red (00) to blue (7F), ignored when detent off.
Example E1 Bar, no detent: F0 00 01 79 06 01 00 00 01 00 00 F7
Example E1 Dot, blue detent: F0 00 01 79 06 01 00 00 00 01 7F F7

## RGB LED SysEx / intensity
Command ID 01 01, payload: ii rr gg bb
- ii encoder 00–0F; each RGB component 00–7F.
- E1 bright red: F0 00 01 79 06 01 01 00 7F 00 00 F7
- E1 dim red:    F0 00 01 79 06 01 01 00 20 00 00 F7
- E1 off:        F0 00 01 79 06 01 01 00 00 00 00 F7
RGB component intensity is a plausible route to actual dimming, distinct from selecting a darker palette hue; visible brightness response has NOT yet been confirmed on owner's unit.

## Standard-mode / experimental palette observations
- Expanded Color Mode is enabled on owner's sequencer Bank 3.
- Prior Test 12/13 fixed channel-3 RGB brightness attempts showed no visible dimming. The channel-3 commands were not proven to be compatible with experimental Native Mode.
- Test 14/15 replaced brightness attempts with contrasting palette shades. Owner reports different shades, **not proven dimming**.
- Existing Bank 3 white rings and note editing worked; Test 15 owner-confirmed native note Chance and monophonic length-overlap removal work.
- Standard/expanded color feedback is separate from Native Mode's direct RGB SysEx. Do not conflate these protocols.

## Proposed isolated hardware diagnostics (experimental thread only)
1. Save existing settings and preserve Test 15; establish exact firmware version and utility settings.
2. Isolate Native Mode enable/disable; capture MIDI traffic and confirm input mapping changes.
3. E1 only: send same hue at RGB 7F and 20, check true brightness; test off.
4. E1 only: Dot, Bar, Blended, Spread; detent off/red/blue; ring CC position.
5. Confirm side-button/bank behavior and disconnect/reconnect recovery.
6. Only after evidence: propose a cross-bank adapter for LED ownership, input routing and lifecycle.

## Cross-bank constraints
CROSS-BANK REVIEW REQUIRED for any global Native Mode activation, input channel remapping, side-button handling, LED rendering, or integration into combined script. Bank 1 Bento and other frozen modules must remain unchanged. No auto-merge. Research applies to Banks 1–4; no bank implementation is authorized here.

## Open questions
- Whether the exact experimental firmware implements this protocol unchanged.
- Whether RGB 7F vs 20 yields visibly different intensity on hardware.
- Whether ring type/detent settings can be changed live without interfering with control messages.
- How Native Mode interacts with four-bank switching and current relative encoder settings.
- Whether individual white ring LEDs can be independently addressed (not established by this documentation).
