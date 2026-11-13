# Handoff — Bank 2 Step Sequencer (separate development thread)

Read [shared rulebook](SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md), [all-thread handoff](HANDOFF_ALL_THREADS_V1_2026-11-12.md), and [Bank 1 freeze registry](ACCEPTED_MODULES_V1_FREEZE_2026-11-12.md).

## Scope
Own **Bank 2** step sequencer ONLY: note entry, pitch, velocity, duration/ties, multi-bar paging, playhead and LED behavior, responsiveness. The user reports a working two-bank experimental build. **Do not assume older Bank 4 sequencer CC/channel values apply to Bank 2.** Verify the actual Bank 2 MIDI Fighter Utility mapping and source before changing routing. Preserve current tested behavior; avoid redesign of approved sequencer gestures or colors without explicit owner approval.

## Independence
Bank 1 Selected Track Bento remains owned by its own thread: frozen Track Mixer v1, Device v1, FX v1; Beta VU and Clip Launcher; experimental Transport. Never edit Bank 1 code or reassign its CCs in this thread. Bank 3 Session View and Bank 4 Device Specific reserved, not in development.

## Build handoff to Experimental Integration
For each sequencer iteration provide source ZIP/patch, version, SHA256, exact files and Bank 2 mapping touched, behavior changes, test checklist and known bugs. Integration combines changes with last verified two-bank ZIP, not by overwriting Bank 1.

## Conflict escalation
Flag **CROSS-BANK REVIEW REQUIRED** before changing shared color semantics, LED output/refresh, MIDI channel/CC dispatch, button press/release or hold logic, bank-switch cleanup, global Live listeners, or shared Python helpers. Explain other-bank impact and await owner approval. Different CCs are helpful but do not prove bank isolation.
