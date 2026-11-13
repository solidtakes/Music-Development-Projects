# Bento accepted module freeze registry — 2026-11-12

## Provenance
Reference complete-script snapshot: `Bento_v2.1_EXP_Transport1_Repairs.zip`, SHA-256 `44b58be9a12a2ef4bd7afa35e594ccc63914726f2d5d950db93b1b9137fa6672`. This document **does not** upload the source ZIP or isolate independently installable modules. Keep the full ZIP separately as the reproducible reference. Frozen v0.1.32 Beta v2.0 baseline remains unchanged.

## Track Mixer v1 — ACCEPTED / FROZEN
Hardware accepted: E3 single press = Mute; E4 single press = Record Arm; hold E4 + tap E3 = Pan Reset; hold E3 + tap E4 = Solo. No unintended release actions. Future work must preserve exact gestures. Cross-track held-button regression passed. E1+E16 navigation with Mixer in column four is not yet explicitly hardware-confirmed.

## Device Controls v1 — FROZEN (USER CONFIRMED)
Accepted existing behavior to preserve: power yellow on/off, second encoder press next bank of four parameters, third encoder previous device, fourth next device. Codex audit found no skipped parameter at 32/33; bank labels disagree with overlapping four-parameter paging. Correct labels without silently changing parameter stride/indexing. Further hardware boundary testing required.

## FX Sends v1 — FROZEN (USER CONFIRMED)
Preserve startup light-purple color 104, unavailable sends off, working bank behavior, and shared consecutive assignment. User reported no issues with FX banking after track changes on v2.1. Codex found offset clamping defect in v0.1.32; verify corrected behavior on edge cases before final acceptance.

## Regression and change-control rules
- Preserve all frozen mappings and LEDs unless user explicitly authorizes change.
- Repair safety bugs without changing expected user-facing gestures; test chords in both press/release orders, track/module changes while held, and Mixer in column four.
- Test Device banks near 29–36, one/multiple Device columns, short/final banks, device selection.
- Test FX track changes with different send counts and module-column reassignment.
- New experimental builds: one new feature, one fine-tune, safe regression-tested repairs, and one measured optimization when feasible.
- Transport 1 remains experimental; Transport 2 and Scene Launcher are v2 scope; VU/Beat is existing and needs repair.
- These are hardware-accepted behaviors or provisional freeze notes, **not claims that the modules are independently isolated or all edge cases certified**.

## Current status clarification — user decision 2026-11-12
- **Track Mixer v1, Device Controls v1, FX Sends v1: FROZEN**, preserving behavior of the last accepted build. These freezes supersede prior provisional status labels. They are frozen for now, not claims of exhaustive hardware edge-case certification.
- **VU meter: BETA / NOT FROZEN AS AN IMPLEMENTATION.** Selected Track and Master VU display designs are documented and approved, but user requires hands-on testing before accepting or freezing the VU module as a v1 working build. Do not describe VU as hardware-accepted/frozen code. Design records remain reference requirements for beta testing.
- Do not silently change any frozen v1 module. Any changes require explicit user authorization. Preserve existing script snapshot and keep source ZIP status distinct from documentation commits.
