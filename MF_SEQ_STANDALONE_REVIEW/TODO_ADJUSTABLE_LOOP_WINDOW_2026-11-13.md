# MF Sequencer Beta 2 TODO — Adjustable Loop Window
Status: PROPOSED / NOT IMPLEMENTED
Baseline: Test 16 accepted stable (commit 342aecb documentation)

## User request
After creating four bars of notes, allow choosing a shorter active playback loop (one or two bars, ideally 1–4 bars) and choosing which bar the loop starts on. Preserve all existing notes across the four-bar clip so expanding the loop restores their playback.

## Examples
- Start bar 1, length 1 => play bar 1.
- Start bar 2, length 2 => play bars 2–3.
- Start bar 3, length 2 => play bars 3–4.
- Start bar 1, length 4 => play all four bars.

## Proposed controls (not approved)
Hold modifier + twist one encoder for loop start; another for loop length. Choose gestures that do not conflict with E1+E16 page navigation, E1+E13 NOTES/PARAM, E1+E14 parameter cycling, note editing, and existing bank controls.

## Engineering requirements
- Separate underlying note-content extent (up to 4 bars) from active Live clip loop window.
- Never delete notes outside selected loop.
- Constrain loop start + length to content extent, unless explicitly approved to wrap.
- Preserve song position and avoid unexpected clip/view jumps.
- Account for Live clip loop_start/loop_end and start_marker/end_marker semantics; verify exact Live 12.4.16 behavior before implementation.
- Show current start and length in Live status feedback; consider white-ring display only without changing approved colors.
- Hardware regression tests: 4-bar note content; 1/2/3/4-bar loops; start at bars 1/2/3/4; restore full loop; edit pages while loop shortened; stop/restart playback; save/reload.
- CROSS-BANK REVIEW REQUIRED for shared modifier/routing changes. No auto-merge.

## Next action
Prototype on Test 16 copy, isolated to standalone sequencer; owner hardware tests before acceptance.
