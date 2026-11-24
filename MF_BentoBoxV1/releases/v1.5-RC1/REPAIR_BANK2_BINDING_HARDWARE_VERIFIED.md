# MF BentoBox v1.5 RC1 — Bank 2 push-button binding repair (owner hardware verified)

**Checkpoint date:** 2026-11-23 (America/Vancouver). **Scope:** Bank 2 button releases only. **Status:** owner-tested working candidate; **not v1.5 Stable**, no merge approved.

## Symptom
All Bank 2 push actions stopped executing in combined v1.5 RC1, while rotations, row-module switching, LEDs and white rings operated. User reproduced failure on Windows and Mac. Changing push rows to Arm, Solo, Mute, Clip Launch did not help.

## Evidence and diagnosis
- MIDIView captured E13 CC28 ch11 and E9 CC24 ch11 with press=127/release=0.
- First instrumented build established Twister MIDI reached the shared host, Bank 2, and _push().
- Release-rejection diagnostic: 27 of 27 releases rejected; 24 had matching scalar binding fields; all 27 had Python wrapper identity mismatch. Example: module=Mute, binding_ok=False, generation=34/34, identity=(False, False, True), fields_equal=True, consumed=True.
- Root cause: _press_binding_current() compared Live Object Model track/device proxies with `is`. Equivalent LOM references may be returned using distinct Python wrappers, so valid releases were consumed.

## Repair
In `MF_BentoBoxV1/FourTrack_Bank2.py`, replace identity comparison for the first three saved/current LOM binding objects with a guarded equality helper. Use `is` fast path; reject either None; use `bool(left == right)` with AttributeError/RuntimeError/TypeError/ValueError caught as mismatch. **Keep existing layout-generation, scalar-field, missing-press and track-change safeguards.** See accompanying patch specification.

Only installable file changed: `MF_BentoBoxV1/FourTrack_Bank2.py`. Other installable sources unchanged from RC1. Remove temporary diagnostic logging.

## Verification
- Python syntax and ZIP-integrity checks passed.
- Reported previous regression run: 223/223 existing offline tests; six focused binding checks (equivalent wrappers accepted, changed track rejected, generation change rejected, layout change rejected, missing press rejected, None handling). These are offline tests, not hardware results.
- **Owner confirmed on real Live/Twister:** Bank 2 pushes returned. Arm PASS; Solo PASS; Mute PASS; Clip Launch PASS; multiple Arm/Solo gestures PASS; Clip Stop PASS; double-tap functions PASS.
- No explicit owner regression sign-off yet for Bank 1, Bank 3, every Bank 2 Device/Sends utility, or cross-bank lifecycle tests.

## Local exact build
`MF_BentoBox_v1.5_RC1_Bank2_Binding_Equality_FIX_EXPERIMENTAL_TEST.zip`
SHA-256: `1d5fb275842d9b59b5f3a094181a2a871e6fd68adbcd7f11f55dcc4a8bbcd05b`
`MF_BentoBoxV1/FourTrack_Bank2.py` SHA-256: `e0b78aba73fd7ae41c5b18406bd6d8743e7a75c8ad15eaf77df0af8160d60def`

**Publication boundary:** This GitHub branch contains repair documentation and patch text, **not the installable ZIP or full source tree**. The exact working ZIP remains a separate local artifact; do not advertise this documentation branch as an installable GitHub release. Keep rollback copy and original v1.4.29 RC1 archive.

## Frozen boundaries
Preserve Bank 1 and Bank 3, frozen VU contract (#86), 30ms/35ms press guards (#90), colors, MIDI CC/channel mapping, startup animation and gestures. No automated merge, stable-release promotion, or reprogramming of the Twister. Related RC1 checkpoint: #91.
