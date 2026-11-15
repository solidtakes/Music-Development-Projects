# Alpha 0.1 — Editable Offline Processing Proof

## Goal

Demonstrate that a user can change or remove the first operation in a processing chain without manually rebuilding later operations, while reusing valid cached intermediate audio.

This milestone is a technical proof, not a feature-complete commercial editor.

## User workflow

1. Select one audio clip in Ableton Live.
2. Invoke the project integration command, if the Extensions SDK access and handoff are available.
3. Open the simple editor and display the selected clip's waveform and metadata.
4. Apply Reverse.
5. Apply Gain (initial default: -3 dB; editable).
6. Render and audition the result.
7. Remove the Reverse operation from the history.
8. Re-render the remaining chain.
9. Confirm the final audio is the original forward-playing audio with Gain applied.
10. Return the result to Live as a new clip/file; do not overwrite the source.

If SDK access is blocked, run steps 3–9 against a user-selected WAV fixture in the standalone test harness. Continue SDK research separately.

## Required history model

Each operation record should include:
- Stable operation ID
- Operation type and schema/version
- Enabled state
- Ordered position / graph relationships
- Normalized parameters
- Input node reference
- Output/cache reference
- Render status and duration
- Output format, sample rate, channels, frames and byte size
- Error information, if any

Alpha 0.1 may present a linear list, but the underlying representation must permit multiple output branches and alternate versions without redesigning the data model.

## Incremental cache rules

- Original source is immutable.
- Each operation's output is immutable.
- Cache identity is content-addressed, not based only on a mutable filename.
- Cache key includes source fingerprint, upstream node identity, operation type/version, normalized parameters, processing engine version and relevant environment details.
- Removing/changing operation N invalidates N and downstream dependent nodes only.
- Upstream valid nodes remain cached.
- If a prior exact configuration is revisited, its valid cached result may be reused.
- A cache hit must never be returned if source, parameters, engine version or relevant plugin state differs.
- A render from an obsolete parameter revision must not replace a newer requested render.

## GUI requirements

A compact, attractive desktop window:
- Source filename and basic audio metadata
- Waveform display
- Ordered history list
- Add Reverse / Add Gain controls
- Editable Gain parameter
- Enable/bypass and remove operation
- Render / cancel / audition controls
- Clear render status and progress
- Per-operation render time and output size
- Cache hit/miss indicator
- Original, active render, cache and total disk usage

Avoid elaborate editing tools in this milestone. The GUI should feel like a focused audio utility, not a generic debug form.

## Audio correctness

- Reverse must reverse complete interleaved sample frames, preserving channel alignment.
- Gain must apply the requested linear gain consistently to all channels.
- Define and test clipping behaviour; do not silently normalize.
- Preserve sample rate, channel count and frame count for both operations.
- Test mono and stereo, multiple supported PCM input formats, silence, peak values and short files.
- Include deterministic fixtures and numerical/sample comparisons.

## Live integration gate

Before claiming the Extension integration works:
- Confirm the SDK's actual supported Live version/edition and required beta.
- Build and install a minimal Extension using the official SDK.
- Confirm it identifies exactly one selected audio clip and reports reliable clip metadata.
- Verify the documented and permitted file handoff path.
- Return a rendered file as a new clip at the intended Arrangement position.
- Preserve warp/tempo/clip context where possible; explicitly report anything the API cannot preserve.
- Test against a disposable Live Set, never the user's production Set.

Do not assume that the Extension SDK can host a persistent UI, launch arbitrary processes, read arbitrary file paths or perform audio DSP. Prove each capability from the official API/docs or a minimal experiment.

## Acceptance tests

1. Original fixture hash remains unchanged.
2. Original -> Reverse -> Gain renders correctly.
3. Remove Reverse -> Gain rerenders from original and matches a direct Gain render within the documented numeric tolerance.
4. The unchanged source node is reused.
5. An unrelated branch (once branch fixture exists) is not invalidated by edits to another branch.
6. Repeating the exact same operation chain produces cache hits.
7. Changing Gain invalidates Gain and downstream only.
8. Render cancellation and superseded render requests cannot publish stale output.
9. GUI reports real file sizes and render durations from filesystem/engine measurements.
10. Project/history can be saved, closed and reopened with operation parameters and valid cache references restored.
11. No original Live media or project file is overwritten.

## Out of scope

Third-party plugin hosting, Ableton stock effects as offline processors, time stretching, time-changing operations, range selections, multi-clip processing, batch processing, advanced spectral editing and commercial packaging.
