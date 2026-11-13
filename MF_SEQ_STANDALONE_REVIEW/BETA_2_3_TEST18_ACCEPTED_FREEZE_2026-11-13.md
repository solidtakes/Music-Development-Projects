# MF Sequencer Beta 2.3 — Owner-Accepted Milestone Freeze
Date: 2026-11-13
Status: OWNER HARDWARE-ACCEPTED; FREEZE FUNCTIONS AND DEFINITIONS
Baseline ZIP: MF_SEQ_BETA_V2_2_TEST18_BAR_SELECT_FOLLOW_TEST.zip
ZIP SHA-256: 38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c
MF_SEQ/MF_SEQ.py SHA-256: 270460564e5fb765ef4e7d86e4fefb5c2b69926445d9bec66358160c69d6c1a8
Owner confirmation: "ok this is great beta v2.3 milestone build, update git, and freeze this for now".

## Frozen Beta 2.3 additions
- E13 held first + tap E1/E2/E3/E4: select editing bar 1/2/3/4 directly.
- E16 held first + tap E1: toggle Follow Playback ON/OFF.
- Follow defaults OFF. When enabled, editing page follows playback bar, including shortened loop wrap.
- Manual bar selection temporarily pauses following until next playback start; explicit follow toggle resets manual pause.
- Modifier press order distinguishes E13/E16 held-first from frozen E1 held-first chords.
- Suppress accidental note/tie/parameter actions in these chord gestures.

## Preserve Beta 2.1 frozen controls
- E1+press E13 cycles Velocity/Pitch/Length/Probability.
- E1+twist E13 slowly scrolls parameters in either direction.
- E1+press E14 toggles Notes/Parameter.
- E1+press E15 cycles 1/2/4 bar loop length, skipping invalid.
- E1+twist E15 shifts loop start, bounded within four bars.
- E1+twist E16 navigates edit pages.
- Note entry, ties, pitch/velocity, monophonic length collision edits, Probability/Chance presets, LED colors/rings, and four-bar note content preserved.
- CC1 automation remains unresolved and excluded from normal parameter cycle.
- No Native Mode, brightness or color development in this frozen baseline.

## Next development roadmap (NOT implemented)
1. MIDI CC sequencing / automation: explore Live Remote Script limitations; consider Max for Live MIDI device as a separate integration. Explicitly verify whether automation persists and is editable before claiming success.
2. Modulation: per-step stepped CC/modulation with optional smoothing, parameter targets, and modulation range; specify ownership/feedback and compatibility with existing modes.
3. Note-timing nudge: fine shift earlier/later within step/bar and tie/monophonic collision constraints; preserve duration, velocity, probability and clip content. Test page boundaries and loop start shifts.
4. Build isolated prototypes and regress against frozen Beta 2.3 before promotion.

## Freeze governance and provenance
This is a GitHub milestone/documentation freeze; **the exact ZIP/source bytes are not uploaded to GitHub by this commit**. SHA-256 values identify the owner-accepted artifact in the conversation. Do not claim GitHub source reproducibility until bytes are deposited and verified. Preserve Test 18 ZIP as rollback. Do not auto-merge or alter other banks. CROSS-BANK REVIEW REQUIRED before integrating standalone Bank 3 experimental sequencer into combined script, given Bank 3 Session View assignment.
