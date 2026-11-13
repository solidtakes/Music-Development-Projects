# Bento accepted module baselines — 2026-11-12

Source reference: `Bento_v2.1_EXP_Transport1_Repairs.zip` (experimental full-script package). These are **behavioral freeze specifications**, not extracted standalone installable modules. Do not conflate them with acceptance of Transport 1 or the entire experimental build.

## Track Mixer v1 — user accepted / frozen
Hardware-accepted controls:
- E3 single press: Mute
- E4 single press: Record Arm
- Hold E4 + tap E3: Pan Reset
- Hold E3 + tap E4: Solo
- Chord releases must not trigger unintended singles.

User reported Test 1 passed. Keep gesture precedence, track-context isolation and module-switch interaction regression tests, including E1+E16 with Mixer in column 4 (not yet explicitly confirmed).

## Device Controls v1 — working behavior preserved, partial acceptance
Preserve:
- Device power yellow on/off.
- Second encoder press banks to next four parameters.
- Third encoder press selects previous device.
- Fourth encoder press selects next device.
- Existing parameter assignments and column banking stride, unless the user explicitly approves a mapping change.

Codex audit of frozen v0.1.32: no skipped parameter 32/33 reproduced; overlapping four-parameter paging and inconsistent bank labels. Correct labels independently; do **not** change index arithmetic speculatively. Test boundary banks, multiple Device columns, device selection, and hold/rotation.

## FX Sends v1 — working behavior preserved, partial acceptance
Preserve:
- Purple/light-purple 104 feedback for available sends; unavailable sends off.
- Existing consecutive/shared FX window assignment and encoder actions.
- User reports v2.1 FX bank behavior after track changes and LED test showed no visible problems.

Codex audit: stale offsets after topology/track change were possible in v0.1.32; retain clamping/revalidation and regression tests for fewer sends and repeated FX columns.

## Additional v2.1 user observations
- Clip held -> selected track changes -> release: no unwanted launch observed.
- Master bottom white and RGB VU, upper LED clearing, FX purple 104 and banking after switching tracks: no visible issues.
- Transport 1 remains experimental and needs layout/LED revisions.

## Freeze and change policy
1. These are module behavior contracts; not a blanket certification of all code paths.
2. Never silently remap accepted gestures, parameter mapping, LED colors, or column rules.
3. Bug fixes may change internal code, but must pass targeted regression and be hardware-confirmed.
4. For every experimental build, document fixed/added/optimized/deferred, compare against accepted baselines, and obtain owner acceptance before promoting.
5. Keep the full-script v0.1.32 baseline and v2.1 experimental provenance distinct. This document does **not** upload the source ZIP or claim GitHub contains a binary backup.
6. Codex source audit: https://github.com/solidtakes/Music-Development-Projects/issues/11#issuecomment-6843820822
