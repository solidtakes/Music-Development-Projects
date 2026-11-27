# NCC-1337 LCARS — APPROVED PANEL FREEZE

**Status:** Approved visual baseline. Do not alter its appearance without explicit owner approval.

**Date frozen:** 2026-11-26
**Frozen Git branch:** `ncc1337/approved-panel-frozen-20261126`
**Working system:** v0.8 OSC backend + v1.0/v1.0.1 touch UI and Android pairing fix.

## Files that make up the approved panel

- `ncc1337-lcars-v063-card.js` — original approved Home Assistant LCARS base card (archived unchanged from supplied reference).
- `ncc1337-direct-osc-addon.js` — currently working live direct-OSC fader extension (already in baseline commit).
- `android_mixer.html` and `android_proxy.py` — working Samsung Android multi-touch companion.
- `loop_test.py` — known-working Windows TotalMix OSC backend (v0.8); retain without audio-path changes.

## Visual elements to preserve

- Existing LCARS/Vector Blue theme choices and approved desktop/mobile structure.
- Ten detailed **vertical** LCARS input faders (desktop single bank; Android responsive grouping).
- One visible control for stereo-linked **OB TEO5** and **DMX 1 / DJ**.
- MAIN / PHONES / MON 2 destination tabs; MAIN and MON 2 linked in TotalMix.
- Approved TV remote visuals and existing non-audio Home Assistant panels.

## Do not change in a graphics-only pass

- OSC ports, fader indices, normalized dB mapping, transmit rate, feedback loop protection.
- Multi-touch pointer handling, Android QR pairing, CORS, local-only or LAN restrictions.
- Master/Speaker A volume safety policy; the planned -14 dB output ceiling is **not enforced by this controller**.
- Local working app files, original Git baseline branch or this frozen branch.

## Graphics agent handoff

Create **a new branch from this frozen reference**. Make purely visual changes there and show a preview for owner approval. Preserve all inputs, destinations, touch targets, labels, fader controls and accessibility behavior. No deployment or merging until approved.

## Existing proof points

Owner-tested: multiple faders and destinations, stereo-linked pairs, two-finger Android multi-touch and TotalMix-originated feedback visible in Windows and Android. The working source snapshot was captured in draft PR #93.
