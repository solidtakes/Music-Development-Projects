# MF Sequencer v1.1 R1 — owner-approved mode gesture

Date: 2026-11-18. Status: DESIGN DECISION ONLY; no code implementation authorized by this record.

## Gesture
- Hold E1, tap E16: toggle Classic ↔ Alternate Sequencer.
- Hold E16, tap E1: existing Follow Playback toggle remains unchanged.
- Hold E1, rotate E16: existing editing-bar navigation remains unchanged.
- Hold E13, tap E4: existing jump to bar 4 remains unchanged.
- E1+E4 is NOT the mode chord: stable source can interpret E1-held/E4-press as note extension in Notes mode.

## Required event precedence and tests
- Detect the E1-held/E16-press chord before E16's ordinary press handler; consume the chord's relevant press/release events.
- Preserve the reverse-order E16-held/E1-press gesture and rotation under E1 hold; avoid accidental bar navigation or follow toggle.
- Prevent press-induced encoder rotation from changing notes or navigating unexpectedly; check event timing and both release orders.
- Keep a single owner of input dispatch and LED output across modes, with separate Classic and Alternate mode state.
- For native Sequencer Clips or unknown clip types, default to read-only / no-edit guard. No automatic conversion to MIDI Notes.
- Runtime evidence reported by Codex: Live 13.0b24 clip-type detection works; tested public lane/step paths failed. Preserve the precise probe logs and distinguish tested failures from claims of universal API absence.

## Safety / integration gates
- Do not modify owner-accepted MF Sequencer v1.0 Stable or three-bank Master Beta 1.2.
- No Native Mode SysEx, no firmware changes, no automatic merge.
- Before implementation, inspect Codex's uncommitted R1 work and preserve evidence, diff and source provenance. Do not overwrite it.
- First deliverable: research + input/output architecture and non-destructive gesture test plan. Editing engine deferred.
