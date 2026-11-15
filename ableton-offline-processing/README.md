# Ableton Offline Processing Extension

A separate project to bring a non-destructive, history-based offline audio editor to Ableton Live, inspired by Pro Tools AudioSuite and Cubase Offline Process History.

## Product goal

Select one audio clip in Live, open a clean editor, apply offline operations, inspect and edit the processing history, and return a new processed audio file to Live without overwriting the original.

The differentiator is editable processing history: changing or removing an early operation invalidates and re-renders only that operation and affected downstream operations. Earlier unaffected outputs are reused from cache.

## Alpha 0.1 proof

Prove the core workflow before investing in a full editor or plugin host:

1. Work on one selected audio clip and the whole clip only.
2. Preserve the source audio as immutable.
3. Display a waveform in a simple, polished GUI.
4. Apply Reverse and Gain as two ordered operations.
5. Record operation parameters and render metadata.
6. Remove Reverse while preserving Gain.
7. Re-render Gain from the original source and produce the correct forward-playing, gain-adjusted result.
8. Display per-operation render time, cache hit/miss, generated file size and total cache footprint.
9. Preserve the original and allow a new processed file to be returned to Live.

The test engine may run independently of Live until the SDK round-trip is proven. Do not block the audio-engine proof on Centercode access.

## Architecture principles

- Treat the Ableton Extension as a Live integration/command layer, not as the audio DSP engine.
- Validate whether the SDK can safely hand off to a companion editor and exchange files; do not assume it can host a persistent editor or arbitrary external process.
- Keep audio processing in a separate, testable engine.
- Preserve immutable source audio and immutable render outputs.
- Model the processing history as a versioned graph/DAG from day one, even if Alpha 0.1 exposes only a linear list.
- Cache each valid intermediate result. A change at node N invalidates N and downstream dependents only.
- Cache keys must include source fingerprint, normalized operation parameters, operation/engine version and any relevant plugin identity/state.
- Record disk usage and render timing as first-class diagnostics.
- Never silently overwrite the source or an existing Live clip.
- Do not bundle or commit Ableton's SDK binaries, licensed components, user audio or plugin binaries.

## Explicitly deferred

VST3/AU hosting, Ableton stock-device offline rendering, selection/range processing, time stretching, pitch-shifting rendered audio, time-changing edits, multi-clip/batch operations, advanced branching UI and destructive consolidation.

Clip-level Live properties (such as clip transpose, gain and warp settings) are distinct from rendered audio operations. Do not conflate them with Reverse, which creates transformed audio.

## Project status

- Branch: `ableton-offline-processing/alpha-0.1`
- Baseline: `main`
- Current milestone: Alpha 0.1 architecture and proof-of-concept
- No production Live installation should be modified for SDK experiments.
- No SDK access or working prototype is claimed until independently verified.

See [Project Status](PROJECT_STATUS.md), [Alpha 0.1 specification](ALPHA_0_1_SPEC.md), [Codex handoff](CODEX_HANDOFF.md), and [SDK access notes](SDK_ACCESS_NOTES.md).
