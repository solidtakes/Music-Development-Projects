# Bank 1 — Selected Track Bento: Native Mode LED research handoff

Shared source: `MF_SHARED_RESEARCH/MFT_NATIVE_MODE_MIDI_LED_PROTOCOL_2026-11-13.md` on branch `research/mft-native-midi-led-protocol-20261113` (commit `0ffb05d`). Research only. Native Mode activation changes MIDI input mapping; no activation or routing changes authorized. CROSS-BANK REVIEW REQUIRED before integrating. Test 15 sequencer: Note Chance and monophonic length collision removal confirmed; CC1 automation unresolved; RGB dimming unverified. Keep existing working scripts unchanged.

## Bank-specific implications
Preserve frozen Bento controls, colors, VU/monitor and column switching. Do not send Native Mode activation or remap current channels. Future possible dynamic ring type, detent and RGB intensity require an isolated diagnostic and shared integration approval.

## Next action
Read the shared protocol document; record any bank-specific collision or desired use in the experimental integration thread. Do not implement until isolated hardware evidence and owner-approved cross-bank review.
