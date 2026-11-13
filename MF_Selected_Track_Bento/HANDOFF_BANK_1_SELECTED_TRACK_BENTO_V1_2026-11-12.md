# Handoff — Bank 1 Selected Track Bento (this development thread)

Read [shared rulebook](SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md), [all-thread handoff](HANDOFF_ALL_THREADS_V1_2026-11-12.md), [freeze registry](ACCEPTED_MODULES_V1_FREEZE_2026-11-12.md), [selected-track VU spec](SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md), [Master VU spec](MASTER_VU_V1_FROZEN_NEXT_BUILD_2026-11-12.md).

## Scope
Own Bank 1 ONLY. **Frozen working v1:** Track Mixer E3 mute, E4 arm, hold E4+tap E3 pan reset, hold E3+tap E4 solo; Device power yellow, E2 next bank of four, E3 previous device, E4 next device; FX startup light purple 104, unavailable sends off, preserve banking. Preserve all existing accepted colors and LED behavior. Do not redesign or remap frozen modules.

**Beta:** Clip Launcher launch on release; cross-track held-button safety; hold E3+tap E4 stop selected clip experimental pending test. **Beta:** VU RGB approved all green before yellow, top 3 yellow, top 2 orange, top 1 red; white binary 0/127 E4->E1. Selected Track white MUST be true MIDI activity (audio proxy is incomplete); Master white = audio. **Experimental:** Transport.

## Next work
Test/repair VU source and Master display; test Clip stop; clean stale LEDs; preserve frozen v1. Confirm actual installed source ZIP/version before claiming changes. Send a Bank 1 patch or ZIP plus SHA, change list and test results to Experimental Integration for combining.

## Cross-bank protection
Do not change Bank 2 CC mapping, sequencer listeners, bank-switch logic, shared LED protocol, or common helpers without CROSS-BANK REVIEW REQUIRED in GitHub and owner approval. Bank 3 Session View and Bank 4 Device Specific remain reserved. Different CCs do not excuse shared MIDI/LED conflicts.
