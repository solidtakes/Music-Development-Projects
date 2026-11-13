# Codex addendum — Swing-aware playback indicator and swing amount control
Date: 2026-11-13
Applies to: CODEX_HANDOFF_BETA_2_3_PERFORMANCE_CC_MODULATION_NUDGE_2026-11-13.md
Status: NEW OWNER FEATURE REQUEST; INVESTIGATION FIRST, NO FROZEN BETA 2.3 MODIFICATIONS

## Goals
1. The blue step/playback indicator should reflect the effective timing of swung steps when Ableton applies groove/swing, rather than advance exclusively on a straight sixteenth grid.
2. Provide a MIDI Fighter Twister gesture to adjust swing amount. Do not assign a gesture yet: first audit existing E1/E13/E16 chords, four bank mappings, parameter modes and unused controls.
3. Prefer one source of truth for audio/MIDI timing and visual display. Avoid double-applying swing to notes already grooved by Live.

## Technical questions and experiments
- Inspect Ableton Live 12 Groove Pool and clip groove/swing controls for accessible, documented Live Object Model properties and Remote Script APIs. Do not assume the groove's timing offsets are exposed.
- Determine whether clip.playing_position, song current_song_time, and clip note start times expose straight musical time or post-groove event timing. Groove Pool may alter playback without changing note positions.
- Compare groove-applied note-on timestamps (or external MIDI capture) against blue LED transition times at several swing amounts (0%, moderate, strong), tempos (90/120/160 BPM), and 8th vs 16th swing templates.
- Establish whether the user means Live Groove Pool swing or a standalone sequencer-owned swing amount; recommend a control architecture only after proving feasibility.
- Investigate an optional visual swing model (offbeat delay) if Live timing cannot be queried, but label it approximate, require explicit groove template/amount synchronization, and avoid pretending to read Live's actual Groove Pool setting.
- Swing-aware step transition should use musical step boundary scheduling without expensive note rereads/full LED redraws. Respect playhead wrapping, nonzero loop starts, 1/2/4 bar loops, Follow Playback, stop/restart, tempo changes and clip switches.
- Quantify visual timing error, missed steps and MIDI send volume; prioritize accuracy and stable display over cosmetic animation.
- Explore MIDI mapping for swing amount with coarse/fine increments and feedback, without changing frozen controls. If using Live groove controls is unsupported, propose Max for Live bridge vs sequencer-owned swing as alternatives.

## Deliverables
- Feasibility matrix: native Groove Pool/Live API, Live clip note-event observation, Max for Live bridge, internal swing model.
- Documented or measured swing event timing, API limitations and repeatable tests.
- Proposed user gesture and LED indication, flagging CROSS-BANK REVIEW REQUIRED for any shared mapping.
- Independent experimental prototype only after owner review; do not modify or merge frozen Beta 2.3.
