# Codex Handoff — Ableton Offline Processing Extension

Repository: `solidtakes/Music-Development-Projects`  
Branch: `ableton-offline-processing/alpha-0.1`  
Project: **Ableton Offline Processing Extension**  
Milestone: **Alpha 0.1 — one clip, editable two-step history, incremental re-render**

Read these first:
- `ableton-offline-processing/README.md`
- `ableton-offline-processing/ALPHA_0_1_SPEC.md`
- `ableton-offline-processing/SDK_ACCESS_NOTES.md`

## Global rules

- Work only on this branch. Do not merge automatically.
- Do not modify other project folders or their branches.
- Do not change the user's production Ableton installations or Live Sets.
- Do not commit the Extensions SDK, private SDK packages, plugin binaries, user audio, licenses, credentials or secrets.
- Do not claim SDK access, API support, successful Live integration or test results without direct evidence.
- If SDK files are unavailable, continue SDK-independent work and record the exact blocker; do not fabricate SDK stubs and call them a real integration.
- Preserve immutable source audio. Never overwrite the source or original Live clip.
- Use small commits with clear messages. Record commit SHA, tests, limitations and next action.
- Do not add VST3/AU hosting or third-party plugin support in Alpha 0.1.

## Assignment 1 — SDK compatibility and minimal integration spike

Issue: see the GitHub issue titled `[AOPX-01] Verify Extensions SDK access and build a minimal Live clip integration spike`.

Tasks:
1. Read current official Ableton Extensions SDK docs and FAQ.
2. Establish the exact Live version/edition requirements. Current public documentation identifies Live 12 Suite beta 12.4.5 or later; do not assume Live 13 or stable Live 12.5 is compatible.
3. Document Centercode navigation/eligibility and required SDK download. Do not guess hidden UI paths.
4. If SDK package is available locally, build the smallest official example and test in a disposable compatible Live installation.
5. Determine whether an Extension can identify one selected audio clip, obtain needed clip metadata, open or hand off to a companion editor, and safely return a processed file as a new clip.
6. Verify API limits for file access, launching a companion process, UI lifetime, clip insertion, Arrangement position, warp settings and source preservation.
7. Produce an evidence-based integration report with tested version, SDK version, exact commands, screenshots/logs if available, and explicit unsupported/unknown items.

No dependency on this task for the audio engine prototype.

## Assignment 2 — Offline audio engine proof

Issue: see `[AOPX-02] Build the incremental WAV processing/history engine proof`.

Tasks:
1. Propose the smallest maintainable implementation stack before committing to a framework. Compare a quick standalone test harness with a path that can later support a polished desktop UI and VST3/AU hosting. Record the decision and trade-offs.
2. Implement WAV import/metadata and immutable source handling.
3. Implement two deterministic whole-file operations: Reverse and Gain.
4. Represent processing as versioned operation nodes. Expose a linear list, but keep the internal model branch-capable.
5. Store normalized parameters and content-addressed cache keys.
6. Render each operation to a separate immutable intermediate file.
7. Support changing/removing an earlier operation and re-render only affected downstream nodes.
8. Preserve valid upstream cache and support cache hits for an identical chain.
9. Save/load the operation graph/manifest and restore it on reopen.
10. Add tests for stereo frame alignment, mono/stereo, source immutability, exact operation order, invalidation, cache hits, branch isolation and stale-render cancellation.

Core proof: Original -> Reverse -> Gain; remove Reverse; output must equal a direct Gain render from the original within a documented numeric tolerance.

## Assignment 3 — Minimal GUI and diagnostics

Issue: see `[AOPX-03] Build the Alpha 0.1 editor GUI and storage/performance panel`.

Tasks:
1. Build a compact, polished editor window around the engine API.
2. Display source name, waveform, duration, sample rate, bit depth and channel count.
3. Display ordered history with Add Reverse, Add Gain, edit Gain, bypass and remove.
4. Display render state/progress, cancellation, audition and current output.
5. Display per-operation render duration, cache hit/miss, generated output size, source size, active output size, cache size and total disk footprint.
6. Ensure all disk figures are actual measured filesystem sizes, not estimated values. Distinguish logical audio bytes from allocated disk bytes if available.
7. Ensure render timing uses a monotonic clock and reports cache-hit latency separately.
8. Keep the interface responsive while processing. Never publish stale results from superseded render requests.

## Assignment 4 — Live round-trip validation

Begin only after Assignment 1 identifies a supported and working route.

Tasks:
1. Use one disposable Live Set and one selected audio clip.
2. Pass source audio or a safe working copy to the editor.
3. Return the processed result as a new clip/file at the correct Arrangement position.
4. Verify source preservation and report which clip properties/warp settings can and cannot be preserved.
5. Do not replace or overwrite the original clip automatically.

## Completion report

For each assignment, report:
- Commit SHA and changed files
- Build/test commands and actual results
- Test counts and failures
- Supported Live/SDK/OS versions
- Measured render times and cache sizes where relevant
- Screenshots or a short demo recording if practical
- Known limitations and next recommended task

The user wants to see a working, basic demonstration before committing significant time to the full product. Prioritize the end-to-end proof and honest evidence over breadth.
