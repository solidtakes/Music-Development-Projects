# MF Sequencer Beta 2.1 — Accepted Freeze
Date: 2026-11-13
Status: OWNER HARDWARE-CONFIRMED / FROZEN
Source baseline: Beta 2 Test 17, derived from owner-accepted Test 16.
ZIP filename: `MF_SEQ_BETA_V2_TEST17_LOOP_E1_E15_PARAM_REMAP_TEST.zip`
ZIP SHA-256: `c7f6297ecca5766a33d05f90f7d8f32572e04cb862b63d20f2decb21d237eb5d`
MF_SEQ/MF_SEQ.py SHA-256: `22a8ed13128593e0b5c9d7c72da27f6ba0b74dedd784b6c85eb1af90916819c1`

## Frozen E1 modifier gestures — owner reports ALL GOOD
| Gesture | Frozen behavior |
|---|---|
| E1 + press E13 | Cycle Velocity → Pitch → Length → Probability |
| E1 + twist E13 | Slowly scroll available parameters in either direction (8 relative ticks per step in Test 17 implementation) |
| E1 + press E14 | Toggle Notes / Parameter mode |
| E1 + press E15 | Cycle active loop length 1 → 2 → 4 bars, skipping invalid choices |
| E1 + twist E15 | Move active loop start backward/forward one bar (4 relative ticks per move) |
| E1 + twist E16 | Existing edit-page/bar navigation |

## Loop boundary definition
Underlying clip content extent up to four bars; loop lengths permitted: 1, 2, 4. Loop start is bar 1–4. Start + length - 1 must not exceed bar 4; no wrapping. Start bar 4 permits length 1 only; start bar 3 permits 1 or 2; start bar 2 permits 1 or 2; start bar 1 permits 1, 2, or 4. Notes outside shortened playback loop must be retained.

## Other accepted behaviors to preserve
Notes/PARAM modes, note entry, ties, velocity and pitch editing, monophonic length collision handling, Chance/Probability presets and rotary fine editing, four-bar page navigation, existing LED colors/rings, standalone experimental Bank 3 mapping (rotary CC32–47 ch12, push CC32–47 ch11). CC1 removed from active parameter cycle; CC1 automation NOT fixed. Native Mode RGB/brightness experimentation remains separate.

## Freeze and integration rules
No changes to frozen functions/definitions, gestures, MIDI mapping, colors, or other banks without explicit owner approval. CROSS-BANK REVIEW REQUIRED before integrating this standalone Bank 3 sequencer into the four-bank combined project, since Bank 3 is reserved for Session View in the shared plan. Do not auto-merge. Use Beta 2.1 Test 17 as rollback for next experimental build.

## Source artifact availability
This GitHub commit stores the accepted manifest and exact SHA-256 identifiers, **not the ZIP/source bytes**. The ZIP is retained as a ChatGPT conversation artifact and must be copied into an accessible source repository before claiming a reproducible source freeze in GitHub. Do not reconstruct or silently replace it from older source.