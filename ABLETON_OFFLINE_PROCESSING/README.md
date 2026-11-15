# Ableton Offline Processing Extension

A non-destructive, history-based offline audio editor integrated with Ableton Live.

## Goal

Build a polished offline audio editing workflow for a selected Live audio clip. The editor will support an editable processing history: revise or remove an earlier operation and automatically re-render only the affected downstream chain while reusing valid cached intermediate audio.

The first milestone is deliberately small: prove this behavior on one whole audio clip before investing in a large feature set.

## Alpha 0.1 proof

1. Identify one selected audio clip in Live.
2. Open a simple editor UI and display the clip's waveform.
3. Apply two deterministic operations: Reverse and Gain.
4. Persist the ordered operation list and its parameters.
5. Remove or change the first operation.
6. Re-render the affected downstream operations from the earliest changed node.
7. Preserve the original audio and previous version.
8. Display per-operation render time, cache hit/miss, output size, and total cache footprint.
9. Return/import the final processed WAV into Live without overwriting the source.

## Architecture direction

- **Live integration adapter:** use the Ableton Extensions SDK where supported to identify the selected audio clip and coordinate handoff.
- **Editor/processing companion:** owns waveform UI, operation list, project persistence, audio processing, render scheduling, and cache.
- **Audio engine:** start with deterministic built-in operations; keep plugin hosting behind a future processor interface.
- **Storage:** immutable source, immutable render outputs, operation graph/manifest, and content-addressed cache.

The Extensions SDK is documented as a discrete task framework, not a continuous audio processor. Do not assume it can host a persistent editor, launch a companion process, or access arbitrary audio files until the SDK documentation and a working compatibility test establish that behavior.

## Initial scope

- One audio clip at a time.
- Whole-clip operations only; range selection comes later.
- Reverse and Gain as first operations.
- Linear history UI, but branch-capable internal data model.
- Basic attractive GUI with waveform, operation list, operation parameters, render status, and storage/performance diagnostics.
- No third-party plugin hosting in Alpha 0.1.
- No ARA integration, time stretching, pitch/time editing, multi-clip batches, or destructive source edits in Alpha 0.1.

## Future roadmap

- Editable history: modify, bypass, remove, reorder, duplicate.
- Branches and alternate versions.
- Range-based processing.
- Normalize, fades, trimming, silence, DC offset and other built-in operations.
- VST3/AU plugin hosting and reliable plugin-state recall.
- Research ARA integration separately; ARA is not interchangeable with ordinary VST3/AU hosting.
- Time stretching, pitch shifting, warp-aware edits and time-changing operations.
- Batch processing and broader Live integration.

## Safety rules

- Never modify or overwrite the source audio.
- Render to unique temporary/output files and atomically publish completed results.
- Keep the previous valid render available while a new render is running.
- Never silently replace a Live clip; provide an explicit return/replace/insert choice.
- Do not change the user's Live installations or install beta software without explicit approval.
- No automatic merge to main.

## Coordination

- Main project plan: [PROJECT_PLAN_ALPHA_0.1.md](PROJECT_PLAN_ALPHA_0.1.md)
- Codex task assignments: [CODEX_TASKS_ALPHA_0.1.md](CODEX_TASKS_ALPHA_0.1.md)
- SDK compatibility findings: [SDK_COMPATIBILITY.md](SDK_COMPATIBILITY.md)
- Architecture decisions: [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)

Current development branch: `ableton-offline-processing/alpha-0.1-foundation`
