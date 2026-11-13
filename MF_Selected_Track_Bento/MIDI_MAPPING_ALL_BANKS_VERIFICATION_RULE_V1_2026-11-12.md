# MF Build 2 — Mandatory MIDI Mapping Provenance and Bank 4 Handoff v1

**Owner directive:** 2026-11-12. Applies to Bank 1, Bank 2, Bank 3, Bank 4 and Experimental Integration. This supplements SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md and HANDOFF_ALL_THREADS_V1_2026-11-12.md; it does not change frozen behavior or authorize a merge.

## Mandatory cross-thread rule
1. Before any build, read the shared rulebook, all-thread handoff, approved palette registry, and this mapping provenance document.
2. Derive each bank's MIDI encoder rotation CC/channel, push CC/channel, relative mode, button action, and LED output routing from **that bank's verified MIDI Fighter Utility .mfs configuration**, not from historical notes or another bank's mapping.
3. Record per-bank encoder E1–E16 mapping, MIDI channel numbering convention (1–16 versus zero-based), input/output direction, LED control values, firmware color mode, source .mfs filename, SHA-256, date, and validation method. Never label an inferred mapping as verified.
4. Preserve existing working bank source and behavior. If shared CC/channel dispatch, LED reset, bank switching, held-button handling, listeners, or common helpers could change, flag **CROSS-BANK REVIEW REQUIRED** before implementation and obtain owner approval.
5. Each thread hands a tested, versioned ZIP/patch, source hash, changed modules, exact test results and known limitations to Experimental Integration. No automatic merges or overwrite of the last working build.

## Newly provided device configuration evidence
The owner supplied a MIDI Fighter Utility configuration attachment named `2026 all rel cchold(1).mfs` in the Bank 4 conversation. File size: **2312 bytes**. Independently computed file SHA-256: `3ab457f9c427d8933340119cf4cd960f87d98b183f12af0cb406c7902a7694f4`.

**IMPORTANT:** This GitHub document records the attachment's provenance, but does **not** upload the .mfs binary bytes. Its proprietary binary format has not been conclusively decoded or validated against MIDI Fighter Utility; do not invent its per-bank CC/channel assignments. Obtain the actual .mfs bytes from the owner or a verified upload before using it as a reproducible source. Do not assume the historic Bank 4 sequencer mapping CC48–63, rotary channel 12 / push channel 11 is still the new Bank 4 Device Specific mapping.

## Bank 4 Device Specific test v0.1
Owner authorized a standalone device-selection LED test. EQ Eight: all sixteen RGB encoder LEDs light blue **68**. Auto Filter: top eight RGB encoder LEDs yellow **108**, bottom eight off. Other/no selected device: all sixteen off. Clear previous states on device switch, without stale LEDs. No parameter control in this test. Bank 4 actual CC/channel and LED addressing remain **PENDING HARDWARE CONFIGURATION VERIFICATION**. No source code or hardware test claimed.

## Required handoff for every thread
Reference the exact approved palette document `APPROVED_COLOR_PALETTE_ALL_BANKS_V1_2026-11-12.md` and this mapping document in all future implementation notes. If mappings cannot be verified, stop before coding routing and report the missing evidence. Experimental Integration must compare against the last user-tested combined build and verify bank switching and LED isolation.
