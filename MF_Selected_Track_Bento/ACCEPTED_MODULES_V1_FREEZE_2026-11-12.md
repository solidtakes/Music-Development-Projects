# Bento — CURRENT WORKING MODEL / v1 freeze registry

Updated 2026-11-12 at user's explicit direction. This registry is the authoritative **current working behavior baseline** for subsequent builds. Freeze means preserve the current user-accepted functionality, NOT a claim of complete edge-case certification or a new code artifact. Source code/ZIP has not been uploaded by this documentation commit.

## FROZEN v1 — Track Mixer (working)
- E3 single press = Mute.
- E4 single press = Record Arm.
- Hold E4 + tap E3 = Pan Reset.
- Hold E3 + tap E4 = Solo.
- No unintended release actions.
- Preserve current colors, track switching, hold/twist behavior, and current working controls; don't silently remap.

## FROZEN v1 — Device Controls (working)
- Power button yellow on/off.
- E2 (second from top) press = next bank of four parameters.
- E3 press = previous device.
- E4 press = next device.
- Preserve current encoder positions, parameter mapping, colors, and existing bank behavior.
- Prior 32/33 banking label concern remains a test/repair item; do not silently change the parameter stride or mapping. Fix labeling only after verification.

## FROZEN v1 — FX Sends (working)
- Startup light-purple LED color MIDI value 104.
- Unavailable sends off.
- Shared consecutive assignment and current working banking behavior across track changes.
- Preserve colors, offsets and button behavior. Edge-case offset clamping remains eligible for regression-tested bug repair without redesign.

## BETA — Clip Launcher (near acceptance, NOT frozen)
- Preserve working launch-on-release behavior, clip colors and cross-track safety.
- User confirmed that holding a clip, switching tracks, and releasing does NOT launch on the new track.
- Proposed stop gesture hold E3 + tap E4 in Clip module remains pending hardware verification. Reverse order is not a stop gesture; no accidental launch on release after consumed chord.
- Freeze only after explicit user signoff.

## BETA — VU display (DESIGN approved, NOT hardware tested/frozen as a working build)
- **Selected Track VU**: approved RGB color progression plus white four-segment binary (0/127) ladder representing selected-track MIDI activity.
- **Master VU**: same RGB color progression and white four-segment binary (0/127) ladder, but white follows Master AUDIO level.
- RGB stages for both: all green first; top 3 yellow; top 2 orange; top 1 red; bottom remains green at higher stages.
- White ladder bottom E4 -> E3 -> E2 -> E1; each ring strictly 0 or 127, never partial.
- Exact calibration thresholds, true MIDI event capture and hardware behavior remain to be tested. Do NOT label these working modules as v1 frozen until user tests and approves.
- Detailed approved designs: SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md; MASTER_VU_V1_FROZEN_NEXT_BUILD_2026-11-12.md. 'FROZEN' in these design document names refers to approved DESIGN, not hardware acceptance.

## EXPERIMENTAL — Transport 1 / Transport 2
- Transport 1 under testing; Transport 2 E2 gestures approved for development but not yet implemented.
- Neither is a frozen working v1 module.

## Change control / no regression
1. The three working v1 modules (Track Mixer, Device Controls, FX Sends) are FROZEN. No gesture, mapping, color, or behavioral redesign without explicit user approval.
2. Clip Launcher and VU remain BETA; retain approved designs while testing and repairing.
3. Future builds must start from the last verified working source, preserve the current working model, and compare against this registry before release.
4. Record every intentional change and regression result; distinguish source ZIP, code commit, design approval, and hardware verification.
5. Never claim a GitHub documentation commit uploads the current Python script or ZIP. No automatic merges.

## Baseline provenance and caveat
Previously documented source snapshot: Bento_v2.1_EXP_Transport1_Repairs.zip, previously reported SHA-256 44b58be9a12a2ef4bd7afa35e594ccc63914726f2d5d950db93b1b9137fa6672. This hash/source was not independently reverified in this update. The previously frozen v0.1.32 Beta v2.0 baseline remains separately documented. Source availability must be verified before building.
