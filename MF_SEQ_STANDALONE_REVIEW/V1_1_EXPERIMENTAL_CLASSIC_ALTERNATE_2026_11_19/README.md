# MF Sequencer v1.1 experimental Classic / Alternate framework

Issue: [#73](https://github.com/solidtakes/Music-Development-Projects/issues/73)

This package is an isolated experimental Remote Script source line based on
research commit `515e99264b68ba09c1f284a960c75365466796de`. It does not modify
the v1.0 Stable source or the three-bank Master build.

The corrective package fixes the shipped constructor defect: mode-state defaults
previously read Classic parameter fields before initialization. That could leave
the intended surface unavailable while ordinary step handling remained active.
The repair uses literal safe defaults and retains the E1/E16 event-consumption
tests.

## Behavior

- Starts in **Classic** mode.
- **Hold E1, tap E16** toggles Classic ↔ **Alternate — MIDI placeholder** once
  per complete chord. Both releases are consumed.
- **Hold E16, tap E1** remains Follow Playback.
- **Hold E1, rotate E16** remains four-detent bar navigation.
- **Hold E13, tap E4** remains bar 4 selection.
- E1-first/E16-first ambiguity, E1-first rotation, third-key interruption,
  release order, disconnect and reconnect are fail-closed in host-only tests.
- Classic parameter/page state and Alternate placeholder state have separate
  remembered page/edit state.
- Alternate mode performs no note, probability, pitch, length or tie edits. It
  displays a clear refusal message. It is **not** Live 13 native Step Sequencer
  support and contains no native API, Push-private import or setter.

## Package/install gate

This is source-only until offline checks pass. The package is not installed
automatically and has no Live or hardware verification. Install only into a
separate User Library `Remote Scripts` folder after owner review; do not replace
`MF_SEQ`, `MF_Build_3banks`, or any stable script.

The intended folder is `MF_SEQ_Experimental_Classic_Alternate` and contains the
three files under `MF_SEQ`. Rename the package folder only if the owner’s
Remote Script chooser requires a different label; do not change the Python
package directory name.

## Verification

From the repository root:

```powershell
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/tests -v
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_EXPERIMENTAL_CLASSIC_ALTERNATE_2026_11_19/tests -v
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/issue72 -p 'test_*.py' -v
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/issue72/push3 -p 'test_*.py' -v
```

The source-only tests use AST extraction and mutation spies; they do not claim
Live runtime behavior. Native integration remains blocked by Issue #72.
