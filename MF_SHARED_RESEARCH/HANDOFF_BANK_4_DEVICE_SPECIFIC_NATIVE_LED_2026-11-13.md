# Bank 4 — Device Specific: Native Mode LED research handoff

Shared source: `MF_SHARED_RESEARCH/MFT_NATIVE_MODE_MIDI_LED_PROTOCOL_2026-11-13.md` on branch `research/mft-native-midi-led-protocol-20261113` (commit `0ffb05d`). Research only. Native Mode activation changes MIDI input mapping; no activation or routing changes authorized. CROSS-BANK REVIEW REQUIRED before integrating. Test 15 sequencer: Note Chance and monophonic length collision removal confirmed; CC1 automation unresolved; RGB dimming unverified. Keep existing working scripts unchanged.

## Bank-specific implications
Preserve existing device control, bank selection and LED feedback. Native Mode ring types and RGB intensity are potential future enhancements only; investigate separately before changing the global listener or bank routing.

## Next action
Read the shared protocol document; record any bank-specific collision or desired use in the experimental integration thread. Do not implement until isolated hardware evidence and owner-approved cross-bank review.
