# Alpha 0.1 — Editable Offline Processing Proof

## Goal

Demonstrate that a user can change or remove the first operation in a processing chain without manually rebuilding later operations, while reusing valid cached intermediate audio.

This milestone is a technical proof, not a feature-complete commercial editor.

## User workflow

1. In a supported SDK-compatible Live beta, right-click one audio clip and invoke **Offline Process**.
2. Resolve that AudioClip and read its basic metadata and parent track.
3. For the first integration test, require the clip to be the only audio material in its track over the target range. Render that track range pre-FX to WAV using the SDK resource API.
4. Open a compact modal Webview showing source details/waveform and an editable ordered operation list.
5. Apply Reverse and Gain (initial default: -3 dB; editable).
6. Submit the operation list. The modal closes and returns the operation description to the Extension.
7. Run the Node/TypeScript processing engine with persistent history/cache in the Extension storage directory and disposable renders in the temp directory.
8. Remove Reverse while retaining Gain, then re-render the remaining chain.
9. Confirm the result is the original forward-playing audio with Gain applied.
10. Import the processed WAV into the Live project and create a new clip on a separate audio track at the original Arrangement start position and duration. Never overwrite or automatically replace the original.
11. Show a result/diagnostics dialog and report render time, cache hits, generated file sizes and cache footprint.

If SDK runtime setup is not yet available, run the same engine workflow against deterministic WAV fixtures in a standalone Node test harness. Do not make SDK access a blocker for engine development.

## SDK constraints that shape Alpha 0.1

The supplied `extensions-sdk-1.0.0-beta.1.zip` was inspected. See `SDK_ARCHIVE_REVIEW_BETA_1.md` and `SDK_ACCESS_NOTES.md`.

- Extensions run in Node.js and can use npm packages, so the first audio engine can be TypeScript/Node modules hosted by the Extension. A separate native companion application is not required for the proof.
- The documented audio acquisition API is `renderPreFxAudio(AudioTrack, startBeat, endBeat)`. It renders a track's **pre-FX** audio for an Arrangement beat range, not a documented raw single-clip file and not the Live device chain. Prove the isolated-clip case; explicitly test/report overlaps, take lanes, fades and automation.
- The render format follows Live's Record File Type setting. Alpha 0.1 requires WAV; verify the setting before rendering.
- Use `storageDirectory` for persistent manifests/cache and `tempDirectory` for temporary files. Do not access arbitrary filesystem paths.
- The UI is a modal Webview. The documented result mechanism closes the modal and returns a string. Use it to collect the operation list; use Live's progress dialog for processing feedback. Do not assume a persistent editor or live bidirectional Webview messaging.
- Import processed output with `importIntoProject`, then create a new clip with `AudioTrack.createAudioClip` on a separate output track.
- The documented AudioClip API exposes warping/warp mode and basic loop properties, but not per-clip transpose or gain. Warp-marker data is readable; no warp-marker write method is documented. Reverse and Gain are rendered audio operations.
- `renderPreFxAudio` does not process Live track effects. `insertDevice` supports built-in Live devices only and does not load third-party plugins. Plugin hosting and post-FX rendering are future research, not Alpha 0.1 capabilities.

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
- Persist manifests and retained cache under the Extension storage directory; use the Extension temp directory only for disposable render files.

## GUI requirements

A compact, polished modal Webview:
- Source filename and basic audio metadata
- Waveform display
- Ordered history list
- Add Reverse / Add Gain
- Editable Gain parameter
- Enable/bypass and remove operation
- Apply/Process and Cancel
- Clear operation order and source/output identity
- After processing, a result/diagnostics dialog or Live progress/result UI
- Per-operation render time and output size
- Cache hit/miss indicator
- Original, active output, cache and total disk usage

The Webview is modal and returns the final operation list when closed. Do not design Alpha 0.1 around an always-on desktop window or undocumented bidirectional host messaging. The GUI should feel like a focused audio utility, not a generic debug form.

## Audio correctness

- Reverse must reverse complete interleaved sample frames, preserving channel alignment.
- Gain must apply the requested linear gain consistently to all channels.
- Define and test clipping behaviour; do not silently normalize.
- Preserve sample rate, channel count and frame count for both operations.
- Test mono and stereo, supported WAV PCM/float formats, silence, peak values and short files.
- Include deterministic fixtures and numerical/sample comparisons.

## Live integration gate

Before claiming the Extension integration works:
- Confirm exact SDK package and supported Live beta build.
- Confirm Node.js package engine requirement; the supplied beta.1 npm packages specify Node >=24.16.0.
- Build and run a minimal Extension using the official SDK.
- Confirm the AudioClip context menu resolves exactly one clip and its parent AudioTrack.
- Verify pre-FX render output for a one-clip isolated track matches the intended clip audio.
- Verify returned file format is WAV and document sample rate/channel/frame metadata.
- Import processed output into the project and create a new clip on a separate track at the correct Arrangement position/duration.
- Preserve basic warp mode/loop settings where the API permits; document that arbitrary warp-marker restoration is not currently exposed in the generated API reference.
- Test against a disposable Live Set, never the user's production Set.

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
12. Live round-trip creates a new output clip/track and leaves the original clip untouched.
13. Live pre-FX render is tested on an isolated one-clip track; limitations for overlapping material are documented.

## Out of scope

Third-party VST3/AU hosting, Ableton stock effects as offline processors, ARA integration, time stretching, time-changing operations, range selections, multi-clip processing, batch processing, advanced spectral editing and commercial packaging.
