# MF Build 2 — Mandatory Approved Color Palette Rule v1

**Owner approval:** 2026-11-12. **Applies to:** Bank 1 Selected Track Bento, Bank 2 Step Sequencer, Bank 3 Session View, Bank 4 Device Specific, and Experimental Integration, for all future development.

## Mandatory rule
Always use the owner's existing approved MIDI Fighter Twister color palette. Do not invent, approximate, or substitute new MIDI color values in code, specifications, or test builds without explicit owner approval. Preserve existing frozen module-specific assignments and semantics; a shared color identity is not authorization to recolor an existing module. Do not conflate RGB color identity with brightness or white-ring output. Expanded Color Mode remains bank-specific; do not globally change it.

| Approved color | MIDI value |
|---|---:|
| Red | 72 |
| Green | 76 |
| Light orange / yellow | 108 |
| Light blue | 68 |
| Pink | 52 |
| Teal | 32 |
| Purple | 96 |
| Light purple | 104 |
| Dim green | 88 |

Other previously approved module-specific values remain valid only where their approval is documented; verify before reuse. New colors require explicit owner approval and documented update to this registry.

## Bank 4 Device Specific v0.1 owner-approved LED test
- EQ Eight selected: all 16 encoder RGB LEDs **light blue 68**.
- Auto Filter selected: top eight encoder RGB LEDs **yellow 108**, bottom eight **off**.
- Other device/no device: all 16 test RGB LEDs **off**.
- Switching device: clear stale test LED states; no hanging LEDs.
- This is an authorized standalone test design, not proof of implementation, MIDI mapping verification, hardware test, or integration approval.

## Cross-bank review and delivery
Any proposed change to shared color semantics, brightness conventions, MIDI CC/channel routing, LED reset/animation, or shared helpers is **CROSS-BANK REVIEW REQUIRED** before implementation. Send Bank 4 standalone tested source and exact mapping, version, SHA256, tests, and limitations to Experimental Integration; do not merge or overwrite the accepted combined build automatically.

## Thread handoff instruction
Every bank owner and Experimental Integration must read this rule alongside SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md and HANDOFF_ALL_THREADS_V1_2026-11-12.md before future color/LED work. This document supplements those frozen specifications; it does not modify frozen v1 modules or authorize cross-bank changes.
