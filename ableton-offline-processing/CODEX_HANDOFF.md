# Codex Handoff — Ableton Offline Processing Extension

Repository: `solidtakes/Music-Development-Projects`  
Canonical branch: `ableton-offline-processing/alpha-0.1`  
Working product name: **Offline Processing Suite for Ableton Live**  
Development target: **Live Suite / SDK-compatible Suite beta**  
Milestone: **Alpha 0.1 — one clip, editable two-step history, incremental re-render**

## Read first

- `ableton-offline-processing/PRODUCT_ARCHITECTURE.md` — product layers, cache identity, GUI design language, future plugin boundary and milestone roadmap
- `ableton-offline-processing/README.md`
- `ableton-offline-processing/PROJECT_STATUS.md`
- `ableton-offline-processing/ALPHA_0_1_SPEC.md`
- `ableton-offline-processing/SDK_ACCESS_NOTES.md`
- `ableton-offline-processing/SDK_ARCHIVE_REVIEW_BETA_1.md`

The user supplied the actual `extensions-sdk-1.0.0-beta.1.zip`; the detailed archive review is committed. Do not commit the SDK archive or its licensed package contents.

## Product direction

This is intended to become a full offline processing suite for Live, not a one-off Reverse/Gain utility. Alpha 0.1 is deliberately narrow to prove the key technology first: editable history and incremental rendering.

Keep the system layered:
1. Ableton Live integration adapter.
2. Modal editor UI.
3. Edition-independent versioned operation graph/cache engine.
4. Native DSP operation suite.
5. Future third-party VST3/AU offline processor adapter.
6. Future advanced clip/range/time/ARA integrations.

The user selected Live Suite as the initial development target. Keep the processing engine and DSP modules edition-neutral wherever possible. The actual license/account entitlement and exact SDK-compatible Live beta remain to be verified. Do not assume stable Live 12.5 or Live 13 support from the archive.

Future plugin hosting is important to the product direction but **not part of Alpha 0.1**. The supplied Extensions SDK does not document VST3/AU hosting, post-FX rendering or ARA. Design a clean processor adapter boundary and cache identity that can accommodate plugins later; do not build or claim plugin support now.

## GUI visual direction — owner requirement

The editor is intentionally a **floating window** launched from Ableton Live. It does not need to dock into Arrangement View or replace Live's main interface. It should feel like a natural Live utility/device window, not a generic web application.

Use Live's broad interface conventions while keeping the Offline Processing Suite's own identity. Do not copy Live's logo, proprietary icons, fonts or artwork; do not claim pixel-perfect imitation.

- Compact DAW utility-window proportions, fitted to the actual SDK modal size. Live/the OS owns the native outer title bar and frame where the SDK does not expose them; do not fake a second title bar.
- Dark charcoal/graphite surfaces, slightly lighter control panels, darker inset waveform areas and subtle grey separators.
- Restrained orange/amber for selected, active, focused and primary-action states; use other clip colours sparingly and semantically.
- Dense, precise alignment, compact readable typography, tabular numeric values, tight spacing and small square/rectangular controls.
- Waveform should resemble an Arrangement audio clip lane with horizontal time/bar ruler, grid, clip bounds, waveform and playhead.
- History should resemble a Live device chain: compact device-like blocks with activator/bypass, title strip, operation name, concise parameter summary, selected state and remove/menu affordance.
- Selected device gets orange focus treatment; bypassed device is visibly dimmed.
- Parameter controls resemble Live devices: compact knobs/sliders, aligned labels and numeric readouts, not large web forms.
- Slim footer for audition/render/cancel/progress and cache/storage diagnostics.
- Avoid generic SaaS cards, oversized rounded corners, excess whitespace, gradients, decorative shadows and oversized headings.
- Use explicit labels/icons as well as colour for processing, bypass, completion, cache-hit and error states.

### Alpha 0.1 floating-window layout
1. Narrow header: product identity, source clip name and duration/sample-rate/bit-depth/channel metadata.
2. Arrangement-style waveform lane with compact time ruler, clip bounds and playhead. Whole-clip only; do not imply range editing.
3. Device/history area with ordered Reverse and Gain modules, activator/bypass, concise summaries and selected state.
4. Contextual device controls: Gain gets a compact dB readout and slider/knob; Reverse gets a clear enabled state.
5. Slim footer: audition if supported, render/cancel, progress, per-step time, cache hit/miss, source/output bytes and cache footprint.

The SDK documents a modal Webview flow; treat this as the floating utility window for Alpha 0.1. Do not build a docked panel or separate desktop app. Verify actual modal dimensions and available window controls. Do not draw fake native window chrome. Default to the dark Live-inspired palette; host theme detection must be verified before use. A light theme can be added later.

## Global rules

- Work only on the issue-specific Codex child branch. AOPX-01: `codex/aopx-01-sdk-feasibility`; AOPX-02: `codex/aopx-02-engine-proof`. PRs must target `ableton-offline-processing/alpha-0.1`, never `main`.
- These child branches were created before the latest SDK review/spec/architecture commits. Fetch and merge/rebase the canonical branch before coding; preserve local work and do not hard-reset.
- Do not modify other project folders or branches.
- Do not change the user's production Live 12.5 or Live 13 installations or Sets. Use only a confirmed SDK-compatible side-by-side Live Suite beta and a disposable Set, with explicit user approval before installation or Set changes.
- Do not commit SDK packages, plugin binaries, user audio, licenses, credentials or secrets.
- Do not claim API support, successful integration or test results without direct evidence.
- Preserve immutable source audio and never overwrite the original clip.
- Use small commits and report SHA, exact commands, tests, limitations and next action.
- No third-party VST3/AU hosting or ARA in Alpha 0.1.

## Assignment 1 — SDK compatibility and Live clip round-trip

Issue: [#30 — AOPX-01](https://github.com/solidtakes/Music-Development-Projects/issues/30)  
Branch: `codex/aopx-01-sdk-feasibility`

Use the supplied beta.1 archive and its examples. Verify:
1. Exact compatible Live Suite Beta build for this SDK release; do not assume stable Live 12.5 or Live 13 support.
2. Node version: bundled npm package manifests require Node >=24.16.0.
3. Build/run the official minimal Extension using Developer Mode (Live Settings → Extensions).
4. Register an `AudioClip` context-menu action and resolve its handle/parent AudioTrack.
5. On a disposable Set, test `renderPreFxAudio(track, clip.startTime, clip.endTime)` on a track with exactly one isolated clip. Confirm WAV format, content, duration, sample rate, channels and frame count. Test/report whether overlaps, take lanes, fades or automation alter the output.
6. Use `importIntoProject` for the processed output, then `Song.createAudioTrack()` and `AudioTrack.createAudioClip()` to create a new clip on a separate track at the original Arrangement start/duration. Preserve the original.
7. Verify which warp/loop properties can be copied. The generated API docs do not show a warp-marker write method.
8. Verify modal Webview result flow and cancellable progress dialog.
9. Record filesystem restrictions: only Extension storage/temp; use host import API for project import.
10. Report that `renderPreFxAudio` is pre-FX and does not render the Live device chain; `insertDevice` only inserts built-in devices and cannot load third-party plug-ins.

Do not build a companion app unless a tested limitation makes it necessary. Do not install a beta or modify the user's Sets without explicit approval.

## Assignment 2 — Node/TypeScript offline engine proof

Issue: [#31 — AOPX-02](https://github.com/solidtakes/Music-Development-Projects/issues/31)  
Branch: `codex/aopx-02-engine-proof`

The SDK runs Extension code in Node.js and supports npm packages. Implement the Alpha 0.1 engine as TypeScript/Node modules that can run inside the Extension Host. A standalone Node test harness is welcome; a native C++/JUCE companion app is not a prerequisite.

Tasks:
1. Propose the smallest reliable WAV library/stack and document trade-offs.
2. Implement WAV metadata/read/write and immutable source handling.
3. Implement whole-file Reverse and editable Gain.
4. Represent operations as versioned nodes in a branch-capable graph, while exposing a simple linear list.
5. Store normalized parameters and content-addressed cache keys.
6. Render immutable intermediate outputs; record monotonic render duration, cache hit/miss, actual output bytes and format metadata.
7. Changing/removing operation N invalidates N and dependent downstream nodes only. Keep unaffected upstream cache.
8. Reuse cache when an exact prior configuration is revisited.
9. Persist manifest/cache under a configurable storage root suitable for the SDK's `storageDirectory`; use temp for disposable renders.
10. Save/reopen graph and cache references.
11. Test stereo frame alignment, mono/stereo, source immutability, numerical output, invalidation, cache hits, branch isolation, cancellation and stale-render prevention.
12. Define the future processor-adapter interface and document which plugin state/version fields must enter cache identity, but do not implement plugin hosting.

Core proof: Original -> Reverse -> Gain; remove Reverse; final output must match direct Gain applied to Original within a documented numeric tolerance. Report real measurements.

## Assignment 3 — GUI (after engine contract is stable)

Issue: [#32 — AOPX-03](https://github.com/solidtakes/Music-Development-Projects/issues/32)

Build the first UI as a polished **modal Webview** using the SDK's `showModalDialog`, not a standalone desktop window. It must follow the GUI visual direction above: Live-inspired dark/light theme, charcoal panels, amber/orange action accent, restrained clip colours, compact flat controls, waveform/timeline, compact processing rows, contextual parameter inspector and narrow diagnostics/status strip. Avoid generic dashboard cards.

Show source metadata/waveform, operation list, Reverse/Gain controls and measured diagnostics. The documented Webview protocol returns the operation list and closes; do not assume persistent UI or general bidirectional messaging. Use `withinProgressDialog` for processing and cancellation, then show a result/diagnostics dialog.

Do not build a second audio engine; consume AOPX-02's API.

## Completion report

For each task, report:
- Commit SHA and changed files
- Exact build/test commands and actual results
- Test counts/failures
- Tested Live/SDK/Node/OS versions
- Render-time/cache-size measurements
- Screenshots/demo where practical
- Known limitations and next action

The user wants to see a working basic demonstration before investing significant time in the full product. Prioritize the end-to-end proof and honest evidence over breadth.
