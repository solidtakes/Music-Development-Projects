# Bank 2 — Step Sequencer (historical assignment): Native Mode LED research handoff

Shared source: `MF_SHARED_RESEARCH/MFT_NATIVE_MODE_MIDI_LED_PROTOCOL_2026-11-13.md` on branch `research/mft-native-midi-led-protocol-20261113` (commit `0ffb05d`). Research only. Native Mode activation changes MIDI input mapping; no activation or routing changes authorized. CROSS-BANK REVIEW REQUIRED before integrating. Test 15 sequencer: Note Chance and monophonic length collision removal confirmed; CC1 automation unresolved; RGB dimming unverified. Keep existing working scripts unchanged.

## Bank-specific implications
The standalone Beta 2/Test 15 sequencer is experimentally running on Bank 3; this conflicts with historical Bank 3 Session View reservation. Do not treat this note as a bank reassignment. Preserve existing step editing and white rings. Note Chance and length collision behavior are owner-confirmed; CC1 and actual brightness remain unverified.

## Next action
Read the shared protocol document; record any bank-specific collision or desired use in the experimental integration thread. Do not implement until isolated hardware evidence and owner-approved cross-bank review.
