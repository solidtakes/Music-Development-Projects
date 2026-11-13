# Owner Decision — Sequencer-Owned Swing Timing
Date: 2026-11-13
Decision: Use sequencer-owned swing timing; do NOT control Ableton Groove Pool swing.
Supersedes the unresolved architecture choice in CODEX_ADDENDUM_SWING_AWARE_PLAYHEAD_AND_SWING_CONTROL_2026-11-13.md.
Applies to the Beta 2.3 Codex investigation branch only. Frozen Beta 2.3 unchanged.

## Functional target
- Swing is generated and managed by the sequencer itself. It must affect audible note timing and the blue playback indicator consistently, not merely animate LEDs.
- Start with straight 16th notes at zero swing. Define a mathematically explicit 16th swing curve with a user-facing amount and bounded max; do not assume percentage convention without specifying it. Consider 8th swing later.
- Prefer a nondestructive representation: canonical unswung step/note timing + applied offset, so repeated swing edits do not accumulate drift. Reversible at zero; preserve note pitch, velocity, duration, probability, ties and note ordering.
- Since this is a clip-writing sequencer, investigate updating MIDI note start times through the Live API. Account for edits made externally in Live, undo, reload, clip replacement, duplicate notes, and preserving user-authored microtiming.
- Investigate clip note collision handling (monophonic policy), loop boundaries, ties, and how swing interacts with proposed note nudging. Define precedence of base step + user nudge + swing offset.
- Indicator timing must be based on the SAME swing timing model as emitted/stored notes. Acknowledge display polling limits and measure actual LED latency rather than promising sample accuracy.
- Avoid double swing: do not add Groove Pool adjustments on top; detect/report incompatible external groove where feasible, but do not alter user groove settings.
- Select Twister gesture after full conflict audit; E13-first+E1-E4 direct bar, E16-first+E1 Follow toggle and all frozen E1 modifier chords are reserved.
- Prototype in a separate experimental branch/ZIP with disposable clip tests. Do not modify frozen Beta 2.3, other banks, or auto-merge.

## Required Codex deliverables
1. Swing formula, amount units, timing example at 0/mid/max, and handling of odd 16ths.
2. Design for canonical unswung positions, idempotent apply/remove and recovery from external edits.
3. Note-timing nudge interaction and monophonic overlap policy.
4. Live API feasibility, benchmark, playback indicator accuracy and regression tests.
5. Proposed controller gesture and LED feedback for owner approval.
