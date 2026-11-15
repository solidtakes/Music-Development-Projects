# Product Architecture — Offline Processing Suite for Ableton Live

Working product name: **Offline Processing Suite for Ableton Live**  
Development target: **Ableton Live Suite / SDK-compatible Suite beta**  
Architecture goal: edition-neutral processing engine, Suite-first Live integration.

## Product promise

A clip-focused offline editor inside Ableton Live that lets users build, revise, reorder, bypass, remove and branch processing chains without destructively replacing the source.

Its defining feature is **editable processing history with incremental re-rendering**:
- Each operation is a versioned node.
- Each node consumes an immutable upstream audio result.
- The output is immutable and cacheable.
- Changing an early operation invalidates only that node and dependent downstream nodes.
- Unchanged upstream results and exact previously rendered configurations can be reused.
- Alternate versions branch from any prior node without overwriting another branch.

The initial interface may show a simple linear list. The data model must support a directed acyclic graph (DAG) from the beginning.

## Product layers

### 1. Ableton Live integration adapter

Responsibilities:
- Identify selected AudioClip and its parent track.
- Capture clip timing and supported warp/loop metadata.
- Obtain source audio through a verified SDK-supported render/import path.
- Open the editor UI and submit operation plans.
- Show progress and cancellation.
- Import the final render into the Live project.
- Create a new output clip while leaving the source untouched.

The SDK is a host integration layer, not the audio engine or plugin host.

**Known beta SDK constraints:** the supplied beta.1 archive documents pre-FX AudioTrack range rendering, not post-FX device-chain rendering or raw per-clip file access. This route must first be proven with one isolated clip on its own track. The AudioClip API does not document per-clip gain/transpose or arbitrary warp-marker writes. Third-party plugin hosting and ARA are not documented in this SDK.

### 2. Editor UI

Alpha 0.1:
- Compact SDK modal Webview.
- Source filename, duration, sample rate, channel count and waveform.
- Ordered operation list.
- Add Reverse / Add Gain.
- Edit Gain, bypass, remove.
- Process, cancel and progress.
- Result details: render time, cache hit/miss, output bytes and cache footprint.

Later:
- Reorder and duplicate operations.
- Branch/version browser.
- A/B audition between versions.
- Range/selection editing.
- Preset chains and reusable processing macros.
- Searchable operation suite and plugin parameter panels.

Do not assume a persistent always-open Webview; the supplied SDK documents a modal dialog/result flow.

### 3. Processing graph and cache engine

Must remain independent of the UI and Ableton-specific code.

Core concepts:
- Immutable source asset.
- Versioned operation nodes.
- Branch-capable DAG.
- Render jobs and immutable output assets.
- Content-addressed cache.
- Persistent project manifest and version references.
- Cancellation and stale-job protection.
- Storage accounting and render telemetry.

A node cache identity must incorporate:
- Upstream content hash / node identity.
- Operation type and operation schema version.
- Normalized parameter values.
- DSP implementation / engine version.
- Relevant audio format and processing settings.
- For future plugins: plugin format, unique ID, binary/version identity, full serialized plugin state, parameter values, sample rate, channel layout, offline-quality mode and any other output-affecting settings.

Do not cache a plugin render as deterministic unless the processor can be treated as deterministic. If a processor uses randomness, external side effects, time-dependent modulation or untracked state, require a deterministic seed/state contract or mark it non-cacheable.

### 4. Native DSP operation suite

Alpha 0.1 only:
- Reverse.
- Gain.

Later core operations (priority order to be validated):
- Normalize (peak first; loudness normalization later).
- Fade in / fade out.
- Trim / crop / silence removal.
- DC offset removal.
- Polarity invert.
- Channel operations (mono/stereo conversion, swap, balance).
- Time and pitch processing after the history/cache engine is proven.

Each operation must declare:
- Stable operation ID and schema version.
- Input/output format contract.
- Parameters and normalized parameter ranges.
- Whether it changes frame count, sample rate or channel layout.
- Determinism/cacheability.
- Latency or offline quality requirements where applicable.
- Cancellation/progress behaviour.

### 5. Third-party plugin processing (future milestone)

The supplied Extensions SDK beta.1 does not document VST3/AU hosting, post-FX Live rendering or loading third-party plugins through `insertDevice`. Therefore plugin hosting must be a separate, researched subsystem, not falsely attributed to the Extensions SDK.

Future architecture should define a processor adapter boundary so built-in DSP and plugin processors use the same operation-graph contract. Evaluate a dedicated offline plugin-host worker/bridge for VST3 and AU, including platform support, licensing, plugin state recall, automation, sandboxing, crash isolation, latency compensation, sidechain/channel layouts and deterministic cache identity.

Do not begin plugin-host implementation until the Alpha 0.1 graph/cache and Live round-trip are proven. Do not commit plugin binaries or vendor SDK packages.

### 6. Ableton-specific clip properties and ARA

- Preserve original clip and basic supported warp/loop settings.
- The SDK archive documents readable warp-marker data but no warp-marker write API.
- Do not assume clip transpose/gain setters exist.
- Evaluate ARA separately as a later integration route for richer audio/clip context; it is not a capability established by this Extensions SDK archive.
- Time-stretch and pitch operations must be explicit audio operations with quality settings and frame-count semantics, not guessed clip-property writes.

## Version roadmap

### Alpha 0.1 — prove the differentiator
- One whole AudioClip, isolated on its own audio track.
- Reverse -> Gain -> remove Reverse -> render Gain from source.
- Branch-capable graph, linear UI.
- Immutable source/intermediates and persistent content-addressed cache.
- Measured render time and actual disk usage.
- Import result as a new clip on a separate track.
- No plugin hosting, ARA, selection processing or time stretching.

### Alpha 0.2 — complete the core operation suite
- Normalize, fades, trim/crop, silence removal, DC offset and polarity.
- Operation reorder/duplicate and robust parameter editing.
- Save/reopen, branch creation and A/B version recall.
- More audio formats and channel layouts after tested support.

### Alpha 0.3 — clip/range workflow
- Selection/range processing.
- Multiple clips and batch processing.
- More complete clip property/warp restoration where supported.
- Version comparison and branch UI.

### Beta — plugin and advanced time processing research
- Offline VST3/AU processor host/bridge feasibility and first validated plugin.
- Plugin state/preset recall and parameter editing.
- Latency, tail, sidechain, multichannel and automation handling.
- High-quality time stretch and pitch/time edits.
- ARA feasibility and integration design.

These are capability gates, not delivery-date commitments. Each milestone requires a tested acceptance demo before scope expands.

## Suite target and compatibility

The user has selected Live Suite as the initial development target. The supplied beta SDK archive directs users to its compatible Live beta build; its example references Live 12.4 Beta. It does not establish compatibility with stable Live 12.5 or Live 13.

Keep the core graph, DSP operations and file format edition-neutral. Use Suite for the initial SDK integration proof. Do not alter production Live installations; test only in a confirmed compatible side-by-side beta and disposable Set. Verify the user's actual Suite entitlement/account separately before installation.

## Alpha 0.1 acceptance gate

The milestone is complete only when:
1. A known WAV source is loaded and its hash recorded.
2. Reverse and Gain render as separate immutable nodes.
3. Reverse is removed while Gain remains.
4. The final output matches direct Gain-on-original within a documented numeric tolerance.
5. Unaffected source/upstream data is reused; invalidation is limited to affected descendants.
6. Repeating an exact chain produces a cache hit.
7. Branches do not contaminate one another.
8. History and cache references survive save/reopen.
9. Actual render times and file sizes are displayed.
10. The SDK integration can obtain one isolated clip's audio, import the processed file and create a new clip on another track without modifying the original.
11. The test report records exact Live, SDK, Node and OS versions and all limitations.

## Non-negotiable safety and engineering rules

- Never overwrite source audio or the original Live clip.
- Never publish stale output from superseded parameter edits.
- Never claim plugin, post-FX, ARA or warp-marker support without a verified API and test.
- Keep DSP independent of UI and Live host adapters.
- Keep cache files immutable and manifests versioned/migratable.
- Report measured bytes/times, not estimates.
- No automatic merge to main.
