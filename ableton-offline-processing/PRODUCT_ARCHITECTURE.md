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

The GUI must feel at home inside Ableton Live, not like a generic web dashboard or a separate consumer audio app. Use an **Ableton-inspired visual language** while maintaining a distinct product identity; do not copy Live's branding, logo or proprietary artwork.

#### Floating window design direction — Live-native visual language

The editor is intentionally a **floating window** opened from Ableton Live. It does not need to dock into Arrangement View or replace Live's main interface. The goal is for the floating window to feel like a natural Live utility/device window: a user should recognize Live's visual language immediately, rather than see a generic web application.

Use Ableton Live's broad interface conventions as a design reference while retaining the Offline Processing Suite's own product name and identity. Do not copy Live's logo, proprietary icons, fonts or artwork, and do not claim pixel-perfect imitation.

**Window and overall composition**
- Fit the actual SDK modal/floating-window dimensions. Use a compact DAW utility-window layout, not a full-screen dashboard.
- Let Live/the operating system own the native outer window frame and title bar where the SDK does not expose them. Do not draw a fake title bar over the host's native chrome.
- Inside the window, use a narrow product/source header, dense working area and slim footer/status strip.
- Default to Live-inspired dark charcoal and graphite surfaces, slightly lighter control panels, darker inset areas, subtle grey separators and high-contrast text.
- Use restrained Live-like orange/amber for active, selected, focused and primary-action states. Other clip/track colours should be semantic and sparing.
- Keep typography compact and workstation-like, with readable small labels, aligned values and tabular numeric readouts.
- Use small square/rectangular controls, tight spacing, subtle corner radii and precise alignment. Avoid generic SaaS cards, oversized rounded corners, large empty margins, gradients, decorative shadows and oversized headings.

**Ableton-like interaction and visual grammar**
- Waveform area should resemble an Arrangement audio clip lane: horizontal clip bounds, time/bar ruler, grid divisions, waveform and clear playhead.
- Processing history should resemble Live's device chain: compact device-like modules with an activator/bypass switch, title strip, operation name, concise parameter summary, selected state and remove/menu affordance.
- Selected device gets a clear orange focus/selection treatment; bypassed devices visibly dim.
- The selected operation's controls should resemble Live device controls: compact knobs/sliders, numeric values and aligned labels rather than large web-form fields.
- Use familiar transport/audition controls where supported, and keep diagnostics in a narrow status strip rather than prominent dashboard cards.
- Make processing, cache hit, bypass, completion and error states distinguishable through both colour and explicit state labels/icons.

**Alpha 0.1 floating-window layout**
1. Narrow header: product identity, source clip name and duration/sample-rate/bit-depth/channel metadata.
2. Arrangement-style audio lane: full-width waveform, compact time ruler, clip bounds and playhead. Whole-clip only; do not imply range editing.
3. Device/history area: ordered Reverse and Gain device-like modules with activator/bypass, concise summaries and selected state. Add/remove; reorder only if supported by the first interaction model.
4. Parameter area: contextual controls for the selected operation. Gain gets a compact dB readout and slider/knob; Reverse gets a clear enabled state.
5. Slim footer: audition if supported, render/cancel, progress, per-step time, cache hit/miss, source/output bytes and total cache footprint.

The SDK currently documents a modal Webview flow. Treat that as the floating utility window for Alpha 0.1; do not attempt to build a docked Live panel or separate desktop app. Verify the actual modal dimensions and available window controls before implementation. Host theme detection must be verified before use; default to the dark Live-inspired palette if unavailable. A light theme can be added later without compromising the initial visual target.

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
12. The modal GUI follows the visual design direction above and remains compact, audio-focused and readable in both supported themes.

## Non-negotiable safety and engineering rules

- Never overwrite source audio or the original Live clip.
- Never publish stale output from superseded parameter edits.
- Never claim plugin, post-FX, ARA or warp-marker support without a verified API and test.
- Keep DSP independent of UI and Live host adapters.
- Keep cache files immutable and manifests versioned/migratable.
- Report measured bytes/times, not estimates.
- No automatic merge to main.
