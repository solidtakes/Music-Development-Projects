# MF BUILD 2 — SHARED RULEBOOK & THREAD HANDOFF (v1)

**Authority:** owner-approved specifications and current working source, not speculative design. **Scope:** all three active threads: Bank 1 Bento, Bank 2 Sequencer, Experimental Integration. Read this FIRST and follow links to module specifications before editing.

## Development ownership and future banks
- **Thread 1 — Bank 1 Selected Track Bento:** develop Bank 1 only. Frozen v1: Track Mixer, Device Controls, FX Sends. Beta: Clip Launcher, VU. Experimental: Transport.
- **Thread 2 — Bank 2 Step Sequencer:** develop Bank 2 only. Do not edit Bank 1; preserve its exact mappings, behavior and LED protocol. Existing sequencer specifics must be recovered from its own accepted code/spec; do not assume Bank 4's older mapping is Bank 2's mapping.
- **Thread 3 — Experimental Integration:** only place for copying modules between banks and assembling a combined ZIP. Preserve independent modules, test both banks and bank switching, and never silently replace accepted code.
- **Bank 3:** future Session View; **Bank 4:** future Device Specific. Both reserved; no build authorized yet.

## Shared color vocabulary (MIDI Fighter Twister LED values)
These are **shared color identities**, not blanket instructions to recolor modules. Preserve existing frozen per-module color assignments.

| Color | MIDI value | Notes |
|---|---:|---|
| Red | 72 | approved palette |
| Green | 76 | approved palette |
| Light orange / yellow | 108 | approved palette |
| Light blue | 68 | approved palette |
| Pink | 52 | approved palette |
| Teal | 32 | approved palette |
| Purple | 96 | approved palette |
| Light purple | 104 | FX startup accepted |
| Dim green | 88 | approved palette |

Other colors/brightness values require module-specific verification. **Do not conflate color identity with state/brightness.** Expanded Color Mode is bank-specific: do not globally change device firmware settings for all banks. White outer rings have their own semantics; do not apply RGB values to white rings.

## Shared interaction and LED rules
1. A button action must obey its module's approved press/release/hold/combination behavior; consume releases following a handled chord. Do not trigger accidental single actions after a combination.
2. On track, module or bank switch, clear stale held-button context and LED output; never let a release act on a newly selected track/clip.
3. LED states must reflect actual Live state, and transitions must not leave stuck colors/rings. Avoid redundant MIDI output only after verifying behavior/latency is unchanged.
4. Encoder rotary/push CC/channel and relative mode are **bank-specific**. Never copy another bank's CC mapping without checking the target bank's actual device configuration.
5. One build = one reproducible ZIP plus source/hash/changelog/test checklist; source and GitHub manifest must be distinguishable. Never claim binary uploaded or feature tested unless verified.
6. Preserve last user-tested combined ZIP and independent bank sources. No auto-merge. Changes to frozen v1 modules require explicit user approval.

## Authoritative Bank 1 module rules
**Track Mixer v1 — FROZEN:** E3 press mute; E4 press arm; hold E4+tap E3 pan reset; hold E3+tap E4 solo; no release side effects. Preserve existing colors/monitor behavior.
**Device Controls v1 — FROZEN:** yellow power; E2 press next four-parameter bank; E3 previous device; E4 next device. Preserve positions, mappings, and colors; 32/33 bank-label issue is not permission to alter stride.
**FX Sends v1 — FROZEN:** light purple 104 at startup, unavailable sends off, shared consecutive banking; preserve track-switch behavior.
**Clip Launcher — BETA:** launch on release and safe held-track changes. Hold E3+tap E4 stop gesture is experimental pending user hardware confirmation.
**VU — BETA:** approved designs below, hardware acceptance pending. Never label VU module frozen v1 merely because its visual design is approved.
**Transport — EXPERIMENTAL:** not frozen.

## VU RGB stages — approved design for both Selected Track and Master
E1 top, E4 bottom. Fill all green E4→E1 before any yellow. Stages:

| Stage | E1 | E2 | E3 | E4 |
|---|---|---|---|---|
| Fully green | Green | Green | Green | Green |
| Yellow | Yellow | Yellow | Yellow | Green |
| Orange | Orange | Orange | Yellow | Green |
| Peak | Red | Orange | Yellow | Green |

## VU white rings — approved binary four-step ladder
Each ring is **0 (off)** or **127 (on)**, never partial. Fill E4→E3→E2→E1.

| Level | E1 | E2 | E3 | E4 |
|---|---:|---:|---:|---:|
| 0/4 | 0 | 0 | 0 | 0 |
| 1/4 | 0 | 0 | 0 | 127 |
| 2/4 | 0 | 0 | 127 | 127 |
| 3/4 | 0 | 127 | 127 | 127 |
| 4/4 | 127 | 127 | 127 | 127 |

**Selected Track VU:** RGB = selected track audio, white = selected track **MIDI activity**, independent. Current experimental ZIP's audio proxy does NOT meet final approved MIDI requirement. **Master VU:** RGB and white both driven by Master **audio**. Numeric thresholds/decay not yet approved.

## Mandatory GitHub source-of-truth references
Read exact current files on branch `bento/beta-v2-freeze-20261112` in `solidtakes/Music-Development-Projects`:
- `MF_Selected_Track_Bento/ACCEPTED_MODULES_V1_FREEZE_2026-11-12.md`
- `MF_Selected_Track_Bento/SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md`
- `MF_Selected_Track_Bento/MASTER_VU_V1_FROZEN_NEXT_BUILD_2026-11-12.md`
- `MF_Selected_Track_Bento/CURRENT_WORKING_MODEL_AND_V22_PLAN_2026-11-12.md`
- `MF_Selected_Track_Bento/TWO_BANK_BENTO_SEQUENCER_INTEGRATION_HANDOFF_2026-11-12.md`
- `MF_Selected_Track_Bento/THREE_THREAD_FOUR_BANK_HANDOFF_2026-11-12.md`
- `MF_Selected_Track_Bento/BENTO_V22_EXPERIMENTAL_BUILD_MANIFEST_2026-11-12.md`

## Mandatory handoff protocol for ALL threads
At the start of a new thread, fetch this rulebook and linked module files from GitHub. Confirm actual source ZIP availability and version; do not assume docs equal code. At every handoff, record bank, modules changed, module statuses, color/LED effects, source hash, exact tests passed/failed, and known limitations. At integration, compare Bank 1 frozen behavior and Bank 2 source against the latest user-tested combined ZIP before replacing anything. GitHub access may vary by thread/connector; if inaccessible, request the file or paste rather than claiming it was read.
