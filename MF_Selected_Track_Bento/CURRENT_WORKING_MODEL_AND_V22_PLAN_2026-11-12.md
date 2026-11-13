# Bento — Current Working Model & Next Build Baseline

Date: 2026-11-12. Owner-confirmed status. This is a **status and design ledger**, not a source-code upload or proof of hardware implementation.

## Current working model
- **Track Mixer v1 — FROZEN:** E3 mute; E4 arm; hold E4 + tap E3 pan reset; hold E3 + tap E4 solo. Preserve exact gestures and LEDs.
- **Device Controls v1 — FROZEN:** yellow power on/off; E2 next four-parameter bank; E3 previous device; E4 next device. Preserve paging behavior; investigate bank label discrepancy without silently changing stride.
- **FX Sends v1 — FROZEN:** startup light-purple MIDI color 104; unavailable sends off; existing consecutive banking and track-switch behavior. Preserve.
- **Clip Launcher — BETA, CLOSE TO ACCEPTANCE:** existing clip launch behavior and cross-track held-release protection. Next test candidate: hold E3 + tap E4 stops selected track's clip, with both releases consumed and no reverse-order special action. Do not freeze until user tests.
- **VU module — BETA, AWAITING USER HARDWARE TEST:** selected-track and Master display designs are approved and documented; do not label code hardware-accepted or module v1 frozen.
- **Transport 1 — EXPERIMENTAL. Transport 2 — DESIGN APPROVED, NOT IMPLEMENTED.**

## Approved VU design requirements (not yet accepted implementation)
- RGB for Selected Track and Master VU: E4->E1 green fills all four before yellow; then E1-E3 yellow, E4 green; then E1-E2 orange, E3 yellow, E4 green; peak E1 red, E2 orange, E3 yellow, E4 green.
- White ladder: each E1-E4 white ring only 0 or 127, filling bottom E4->E3->E2->E1; five states 0/4 to 4/4.
- Selected Track VU white source: selected-track MIDI activity. Master VU white source: Master audio level. RGB is audio VU in both.
- Source availability and numeric thresholds must be validated; do not fake MIDI event monitoring.

## Next experimental build proposal — v2.2
1. Implement approved VU displays in existing VU module, with truthful fallback/report if selected-track MIDI events are not available via Live API.
2. Clip Launcher repair: hold E3 + tap E4 stop selected track; no accidental release launch, no action on reverse order; cancel stale held state on track/module change.
3. VU refinement: clear stale LED states on mode/track switches.
4. Device bank label correction only, no change to frozen paging.
5. Measure LED output traffic before/after suppression of unchanged values, preserving required feedback latency.
6. Regression test frozen Track Mixer, Device, FX, Clip context safety, RGB stages and five white states.

## Provenance and constraints
- The last user-tested working model is the baseline. Preserve its source ZIP and SHA; do not claim source is uploaded to Git without verification.
- Earlier registry references Bento_v2.1_EXP_Transport1_Repairs.zip SHA-256 44b58be9a12a2ef4bd7afa35e594ccc63914726f2d5d950db93b1b9137fa6672; this hash has not been independently reverified here.
- GitHub is the durable reference for decisions. No auto-merge. No frozen-module changes without explicit approval.
- Detailed freezes: ACCEPTED_MODULES_V1_FREEZE_2026-11-12.md; SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md; MASTER_VU_V1_FROZEN_NEXT_BUILD_2026-11-12.md.
