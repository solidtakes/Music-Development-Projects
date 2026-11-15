# Ableton Offline Processing Extension

A separate project to bring a non-destructive, history-based offline audio editor to Ableton Live, inspired by Pro Tools AudioSuite and Cubase Offline Process History.

## Product goal

Select one audio clip in Live, open a focused editor, apply offline operations, inspect and edit the processing history, and return a new processed audio file to Live without overwriting the original.

The differentiator is editable processing history: changing or removing an early operation invalidates and re-renders only that operation and affected downstream operations. Earlier unaffected outputs are reused from cache.

## Alpha 0.1 proof

Prove the core workflow before investing in a full editor or plugin host:

1. Work on one audio clip and the whole clip only.
2. Preserve the source audio as immutable.
3. Open a compact SDK modal Webview with source waveform and operation list.
4. Apply Reverse and Gain as two ordered operations.
5. Record operation parameters and render metadata.
6. Remove Reverse while preserving Gain.
7. Re-render Gain from the original source and produce the correct forward-playing, gain-adjusted result.
8. Display per-operation render time, cache hit/miss, generated file size and total cache footprint.
9. Import the result into Live as a new clip on a separate track, preserving the original.

The engine can also run in a standalone Node test harness while the Live SDK round-trip is being validated. Do not block core engine work on Centercode or beta installation.

## Architecture principles

- The supplied Extensions SDK runs JavaScript/TypeScript in Node.js and supports npm packages; the Alpha 0.1 audio engine can run inside the Extension Host. A separate native companion app is not required for the first proof.
- Use the SDK for Live context-menu integration, clip metadata, pre-FX audio acquisition, modal Webview UI, progress, project import and new-clip creation.
- The first UI is a modal Webview, not an always-on background editor. Use it to configure the operation list; run processing after it returns the operation list.
- Keep audio processing in small, deterministic, testable modules.
- Preserve immutable source audio and immutable render outputs.
- Model the processing history as a versioned graph/DAG from day one, even if Alpha 0.1 exposes only a linear list.
- Cache each valid intermediate result. A change at node N invalidates N and downstream dependents only.
- Cache keys must include source fingerprint, normalized operation parameters, operation/engine version and relevant environment details.
- Use the Extension storage directory for persistent manifests/cache and temp directory for disposable renders.
- Record disk usage and render timing as first-class diagnostics.
- Never silently overwrite the source or original Live clip.
- Do not bundle or commit Ableton's SDK binaries, licensed components, user audio or plugin binaries.

## Important SDK limits

- The documented `renderPreFxAudio` API renders an AudioTrack's pre-FX signal over an Arrangement beat range, not a documented raw single-clip file and not the Live device chain. The first test must use an isolated track with one clip and verify the result.
- The SDK's `AudioClip` API does not document clip-level transpose or gain. Reverse and Gain are rendered audio operations in Alpha 0.1.
- Basic warp/loop properties are available, but arbitrary warp-marker writes are not documented.
- `AudioTrack.insertDevice` inserts built-in Live devices only; it does not load third-party plugins.
- The SDK archive does not document post-FX offline rendering or VST3/AU/ARA hosting.

See [SDK Archive Review](SDK_ARCHIVE_REVIEW_BETA_1.md) and [SDK Access Notes](SDK_ACCESS_NOTES.md).

## Explicitly deferred

Third-party VST3/AU hosting, Ableton stock-device offline rendering, ARA integration research, selection/range processing, time stretching, pitch-shifting rendered audio, time-changing edits, multi-clip/batch operations, advanced branching UI and destructive consolidation.

## Project status

- Branch: `ableton-offline-processing/alpha-0.1`
- Baseline: `main`
- Current milestone: Alpha 0.1 architecture and proof-of-concept
- No production Live installation should be modified for SDK experiments.
- SDK archive inspected; runtime integration and working prototype are not yet verified.

See [Project Status](PROJECT_STATUS.md), [Alpha 0.1 specification](ALPHA_0_1_SPEC.md), [Codex handoff](CODEX_HANDOFF.md), [SDK Access Notes](SDK_ACCESS_NOTES.md), and [SDK Archive Review](SDK_ARCHIVE_REVIEW_BETA_1.md).
