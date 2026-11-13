# Handoff — ALL THREE MF BUILD 2 THREADS

**Read first:** [Shared Rulebook](SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md) and [freeze registry](ACCEPTED_MODULES_V1_FREEZE_2026-11-12.md). This is an active development protocol, not a source ZIP.

## Threads and bank ownership
- Selected Track Bento thread: **Bank 1**; frozen v1 Track Mixer, Device Controls, FX Sends; Beta VU and Clip Launcher; experimental Transport.
- Step Sequencer thread: **Bank 2**; owns sequencer behavior and source; preserve Bank 1 unchanged.
- Experimental Integration thread: owns **combined two-bank ZIP**, version/hash, regression tests, module imports, and conflict review.
- Bank 3 **Session View** and Bank 4 **Device Specific** are reserved and not being built.

## Common rulebook
All threads use the same approved palette (red 72, green 76, yellow/orange 108, light blue 68, pink 52, teal 32, purple 96, light purple 104, dim green 88), but preserve bank/module-specific color meaning. Shared rules: no accidental release actions after chords, held state cleared on bank/track/module changes, no stale LEDs, no silent edits to frozen v1 modules, preserve last tested source, test before promotion.

## Cross-bank conflict gate (MANDATORY)
Before editing a shared convention, file a **CROSS-BANK REVIEW REQUIRED** note in the GitHub integration ledger or handoff, describing: proposed change, bank and module, affected CC/channel and LED output, whether shared rule changes, other bank impact, compatibility test, and owner decision. **Do not implement a conflicting change until the owner approves.**
Triggers: shared color/brightness convention, bank switch and encoder push/rotate routing, CC/channel overlap, LED reset/animation, held-button handling, Live API event/listener ownership, shared helper edits, frozen-module behavior, source ZIP overwrites.
Different CCs reduce direct collision but do not prove isolation; inspect actual device configuration and script listeners. Each thread must surface conflict proposals to Experimental Integration; integration must notify owner before merge. This is a review workflow, **not an autonomous notification guarantee**.

## Source and Git rules
Read linked specs from branch `bento/beta-v2-freeze-20261112` of `solidtakes/Music-Development-Projects`. Record source ZIP/commit, SHA256, changed modules, tests and limitations. GitHub spec commits are not proof of binary upload. No automatic merge. Preserve all user-accepted behavior.

## Required integration test
Verify both banks independently, switching while held, no wrong-bank clip/note actions, no stuck LEDs, no cross-bank MIDI output, frozen Bank 1 controls, and sequencer regression. Record pass/fail.
