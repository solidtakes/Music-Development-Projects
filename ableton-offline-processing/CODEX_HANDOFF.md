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

## Workstream ownership and execution order

Three Codex workstreams divide research, core engineering and UI implementation. They may proceed in parallel within the boundaries below.

| Workstream | Responsibility | Branch | Parallel-work rule |
|---|---|---|---|
| **AOPX-01 — SDK research + Live adapter** | Research exact SDK/Live Suite beta compatibility; build and test the minimal Extension; prove clip context, isolated-track audio render, modal Webview result, import and new-clip creation. | `codex/aopx-01-sdk-feasibility` | Independent of the audio engine. Complete offline API research even if the user has not installed the compatible beta. |
| **AOPX-02 — audio engine** | Build the Node/TypeScript WAV engine, Reverse/Gain DSP, versioned DAG, immutable renders, cache, incremental invalidation, persistence and tests. | `codex/aopx-02-engine-proof` | Start immediately; no Live runtime or GUI dependency. This is the critical-path engineering deliverable. |
| **AOPX-03 — floating GUI** | Build the Ableton-inspired floating Webview: waveform/timeline, device-style history modules, parameter controls and measured storage/render diagnostics. | `codex/aopx-03-floating-gui` | Start the visual shell and UI interactions in parallel using typed mock data only. Do not implement DSP, cache/history engine or duplicate AOPX-02. Integrate with the real engine only after AOPX-02 publishes a stable API contract and passing core tests. |

### Required coordination gates

1. **First:** each workstream fetches the canonical `ableton-offline-processing/alpha-0.1` branch and checks its current ahead/behind status. All child branches may lag subsequent canonical documentation updates; inspect and preserve local/uncommitted work before merging or fast-forwarding. Never hard-reset or discard work. AOPX-03 was created from the canonical branch but must also check for later canonical commits.
2. **AOPX-01 and AOPX-02:** work independently and report concrete evidence. AOPX-01 must not block AOPX-02.
3. **AOPX-03:** may build the floating-window shell, design tokens, waveform presentation and mock Reverse/Gain controls immediately. Use a narrow typed adapter/interface placeholder. Do not create fake render/cache behaviour; mark mock values as mock. Once AOPX-02 provides the real engine API, replace the mock adapter and add integration tests.
4. **Integration:** agree the engine request/result types and operation schema between AOPX-02 and AOPX-03 before wiring UI. AOPX-01 supplies the host adapter and Live-specific lifecycle.
5. Each workstream opens a draft PR targeting `ableton-offline-processing/alpha-0.1`, not `main`. No automatic merge.
6. Keep the first demo narrow: one whole clip, Reverse -> Gain -> remove Reverse -> re-render Gain, then import as a new Live clip without modifying the original.

### Who does what

- **Codex AOPX-01:** SDK research, compatibility report and minimal Live integration implementation.
- **Codex AOPX-02:** core audio processing/history/cache implementation and automated tests.
- **Codex AOPX-03:** floating GUI implementation and visual polish; initially with mock adapter, then real engine integration.
- **Project coordinator / user:** architecture and scope decisions, review PRs and test evidence, provide the compatible Live beta/hardware environment when needed, and perform final in-Live acceptance testing. Codex must not change production Live installations or Sets.

The three issues and branches are the task handoffs. A GitHub issue comment is not proof that a Codex agent has been launched or assigned; report the actual Codex run/branch/commit when execution begins.

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
