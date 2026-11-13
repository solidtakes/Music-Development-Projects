# TODO — Reset Individual Note Properties or All 64 Steps
Status: OWNER-REQUESTED ROADMAP; NOT IMPLEMENTED
Baseline: frozen Beta 2.3 Test 18. Do not alter accepted build.

## Required scope
- Individual note reset in current edit mode, and bulk reset across all four bars (up to 64 step positions).
- Velocity reset to configurable or defined default.
- Pitch reset to defined default.
- Consider Length reset, Probability reset to 100%, Nudge/microtiming reset to grid, and swing reset, subject to owner approval.
- A bulk reset must act on existing notes, not create missing notes. Preserve all unrelated properties and clip notes.
- Ties and monophonic collisions need explicit policy, especially pitch/length/timing resets.
- Do not silently remove notes or overwrite user edits on other tracks/clips.

## Design and safeguards
- Investigate current parameter-mode controls and chord conflicts before assigning reset gestures.
- Prefer a per-note reset in relevant parameter mode and deliberate protected bulk reset (confirmation or long hold).
- Support Live Undo if feasible; evaluate one atomic note edit per bulk action, not 64 individual API calls.
- Verify 1/2/4 bar loops, four-bar content beyond current playback loop, current page, empty steps, stop/start, probability preservation, clip replacement, and save/reload.
- For sequencer-owned swing, define whether resetting nudge removes only user nudge or also generated swing. Keep swing amount reset separate from note reset unless owner approves otherwise.
- Recommend default pitch/velocity/length values and LED feedback for owner sign-off before implementation.

## Codex deliverable
Produce mapping proposal, default values, data mutation plan, undo strategy, test matrix, and cross-bank conflict assessment. No implementation or merge without owner approval.
