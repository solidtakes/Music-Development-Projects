# MF Build 3 — Master Architecture

Status: approved design baseline, not yet implemented or hardware-tested.
Version: v0.1 planning baseline (2026-11-12).

## Physical bank assignments
1. **Selected Track Bento** — selected-track mixer, sends, monitoring, device controls, switchable VU/Beat.
2. **4-Track Bento** — four-track mixer, sends, device controls; no audio VU.
3. **Step Sequencer** — melodic sequencing, ties, velocity, pitch, paging. Migrates from former physical Bank 4.
4. **Device Aware** — selected Ableton device determines a custom 16-encoder layout (initial targets EQ Eight, Auto Filter, generic fallback).

Clip/Scene Launcher remains available as an optional module or software page, not assigned a dedicated physical bank.

## Proposed hardware mapping (must verify in MIDI Fighter Utility)
- Bank 1: CC 0–15
- Bank 2: CC 16–31
- Bank 3: CC 32–47
- Bank 4: CC 48–63
- Rotary channel 12, relative ENC 3FH/41H, sensitivity 360.
- Push channel 11, CC Hold.
- Remap existing sequencer source from CC 48–63 to CC 32–47 before Bank 3 hardware testing.

## Shared implementation standards
- Blue 16; Yellow 64; Red 88; Purple FX Sends 120 (hardware-tested Selected Track references).
- Reliable LED ownership: clear on mode exit; invalidate caches and refresh on entry.
- Device navigation logical E1 On/Off, E2 parameter bank, E3 previous device, E4 next device; 8-parameter pages, up to 32 when available.
- Preserve reliable send-banking, track/return/master, and device status messages.
- Preserve E9 monitoring's improved slow switching and reduced track-scroll sensitivity where relevant.
- Single-click Solo is planned but not yet validated.
- Beat Counter four-step white ring animation is planned but not yet validated.
- Do not copy the v1.8 device-LED refresh regression into the new build.
- Treat physical assignments and mode toggles as conflicts to audit before implementation, particularly 4-track E4's old mode-switch assignment.

## Safety and provenance
Preserve MF Build 2 releases and working baselines without overwrite. Build 3 is separate. Test each bank independently and validate full integration on Ableton Live hardware before calling a feature working.
