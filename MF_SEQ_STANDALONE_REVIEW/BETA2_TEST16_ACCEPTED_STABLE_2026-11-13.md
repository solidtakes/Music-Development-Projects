# MF Sequencer Beta 2 — Test 16 Accepted Stable Baseline
Date: 2026-11-13
Status: OWNER HARDWARE-ACCEPTED / stable standalone baseline
Branch: research/mft-native-midi-led-protocol-20261113

## Accepted build
`MF_SEQ_BETA_V2_TEST16_CHANCE_PRESETS_CC1_QUARANTINE.zip`
Derived from Test 15, which owner previously confirmed for note Chance and monophonic note-length collision editing.
Owner explicitly reported on 2026-11-13: "ok this is new stable, beta 2 for this build works good".

## Test 16 changes
1. Probability parameter: press/release an occupied note-start encoder to cycle chance presets 100%, 75%, 50%, 25%, 0%, returning to 100%. Rotary probability fine editing remains.
2. Remove nonworking CC1 from active parameter cycle (Velocity → Pitch → Length → Probability → Velocity). Retain legacy code for later investigation; do not represent CC1 automation as fixed.
3. Avoid redundant probability writes at limits and remove duplicate held-edit reset.

## Preserve
Existing note entry, ties, velocity/pitch, monophonic length collision behavior, four-bar navigation, Bank 3 standalone CC32–47 channel 12 rotary and channel 11 push, existing LED colors and rings. No Native Mode activation. No cross-bank routing edits.

## Validation and provenance
Build packaging previously passed Python compilation and ZIP integrity checks. Owner subsequently tested Test 16 on hardware and accepted it as stable. This document is a milestone manifest; the ZIP/source bytes are not committed in this change, so the repository alone cannot reproduce this build. Preserve the owner's ZIP as rollback artifact and request/upload source before any implementation work requiring exact baseline bytes.

## Open work
- CC1 clip automation remains unsupported/unresolved; not part of normal parameter cycle.
- RGB intensity/brightness and Native Mode ring/detent protocol research is delegated to Experimental Integration; see `MF_SHARED_RESEARCH/MFT_NATIVE_MODE_MIDI_LED_PROTOCOL_2026-11-13.md`.
- Standalone Bank 3 experimental sequencer assignment differs from the shared Bank 3 Session View plan; CROSS-BANK REVIEW REQUIRED before combined integration.
- No auto-merge and no changes to frozen Bank 1 Bento or other banks.

## Next development
Use Test 16 ZIP as the baseline for Test 17. Develop note-editing features in isolation; keep a rollback copy and require fresh owner hardware confirmation before promoting another stable build.
