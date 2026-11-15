# Ableton Offline Processing Extension — Project Status

**Working product name:** Offline Processing Suite for Ableton Live  
**Milestone:** Alpha 0.1 — editable two-step processing history proof  
**Status:** Product architecture and SDK archive review committed; runtime integration and audio-engine implementation not yet verified.  
**Canonical branch:** `ableton-offline-processing/alpha-0.1`  
**Repository:** `solidtakes/Music-Development-Projects`

## Owner-approved product direction

Build a non-destructive, history-based offline audio editor for Ableton Live, inspired by Pro Tools AudioSuite and Cubase Offline Process History.

The user has selected **Live Suite** as the initial development target. Keep the underlying processing engine, operation graph and DSP modules edition-neutral wherever possible. The actual Suite license/account entitlement and the exact SDK-compatible Live beta still need verification.

The key product differentiator is editable processing history with incremental rendering: change or remove an early operation, preserve later operations, re-render only affected downstream nodes, and reuse valid cached intermediates. The internal model must support branches/alternate versions from day one even while the first UI shows a linear list.

Full architecture: [PRODUCT_ARCHITECTURE.md](PRODUCT_ARCHITECTURE.md).

## Alpha 0.1 scope

- One selected AudioClip; whole-clip processing only.
- Compact, polished SDK modal Webview with waveform and linear operation list.
- Reverse and Gain as first deterministic operations.
- Remove Reverse while retaining Gain; re-render Gain against original source.
- Branch-capable internal history graph.
- Preserve source and prior rendered versions.
- Show actual per-operation render time, cache hit/miss, output file size, source size and total cache footprint.
- Return processed output to Live as a new clip on a separate track; never silently overwrite source.
- No third-party plugin hosting, ARA, range selection, time stretching, pitch rendering or multi-clip processing in Alpha 0.1.

## Product layers and roadmap

1. **Live adapter:** context-menu entry, clip metadata, supported audio acquisition, progress, project import and new clip creation.
2. **Editor UI:** modal Webview for Alpha 0.1; waveform, operation list, parameters and diagnostics.
3. **History/cache engine:** immutable audio assets, versioned DAG, content-addressed cache, downstream-only invalidation, branch recall and measured storage.
4. **Native DSP suite:** Reverse/Gain first; Normalize, fades, trim/crop, silence removal, DC offset and polarity in a later milestone.
5. **Plugin processor adapter:** future VST3/AU offline-host research; not supplied by the Extensions SDK. Plugin state and version must be included in cache identity.
6. **Advanced integration:** selection/multi-clip workflows, time/pitch processing and ARA feasibility later.

Milestones: Alpha 0.1 proof; Alpha 0.2 core operations and branch/A-B recall; Alpha 0.3 range/multi-clip workflows; Beta plugin-host and advanced time-processing research. These are capability gates, not delivery-date promises.

## Supplied SDK archive reviewed

The user supplied `extensions-sdk-1.0.0-beta.1.zip`. Its docs, examples, API reference and npm package metadata were inspected. Full report: [SDK Archive Review](SDK_ARCHIVE_REVIEW_BETA_1.md).

Key findings:
- Extensions run Node.js/TypeScript and can use npm packages, so the Alpha 0.1 audio engine can run inside the Extension Host; a native companion app is not required for the first proof.
- The SDK supports AudioClip context-menu actions, modal HTML Webviews, cancellable progress dialogs, Node file processing, pre-FX track-range audio rendering, project import and new Arrangement clip creation.
- `renderPreFxAudio` is track/range based and pre-FX only. The first test must use one isolated clip on its own audio track and verify the rendered content.
- `AudioClip` API docs do not expose per-clip gain or transpose. Reverse/Gain are rendered audio operations. Basic warp/loop settings exist; arbitrary warp-marker writes are not documented.
- `AudioTrack.insertDevice` inserts built-in devices only; it cannot load third-party plug-ins. No post-FX, VST3/AU or ARA hosting API is documented in this archive.
- The Webview is modal, not an always-on editor; use it to submit the operation list, then process with a Live progress dialog.
- All supplied npm packages declare Node >=24.16.0 (stricter than the Quick Start page's >=24.14.1).

## Canonical Codex queue

- [#30 AOPX-01 — SDK feasibility and Live clip round-trip](https://github.com/solidtakes/Music-Development-Projects/issues/30)  
  Branch: `codex/aopx-01-sdk-feasibility`
- [#31 AOPX-02 — Incremental WAV processing/history engine](https://github.com/solidtakes/Music-Development-Projects/issues/31)  
  Branch: `codex/aopx-02-engine-proof`
- [#32 AOPX-03 — floating GUI and storage/performance monitor](https://github.com/solidtakes/Music-Development-Projects/issues/32)  
  Branch: `codex/aopx-03-floating-gui` (created from the current canonical branch). Start the visual shell in parallel with mock data; integrate the real engine only after AOPX-02 publishes a stable API and passing core tests.

AOPX-01 and AOPX-02 branches predate the latest canonical documentation; AOPX-03 was created from the canonical branch but may also lag subsequent documentation commits. Each Codex workstream must inspect the current ahead/behind status, preserve local/uncommitted work and synchronize safely before coding. The three GitHub issues contain their workstream handoffs. No implementation commits are currently ahead of the canonical branch, and no GitHub assignee/Codex agent is attached to the issues.

## Live version and SDK gate

The user reports having Live 13 and Live 12.5 current-release installations and has selected Suite as the initial development target. The supplied SDK Quick Start says to use the Live Beta build from the SDK release page in Centercode; its Execution guide example references Live 12.4 Beta. The archive does not prove stable Live 12.5 or Live 13 compatibility. AOPX-01 must verify the exact compatible beta/build and edition. Do not change or install anything into production Live installations.

## Required next sequence

1. AOPX-01 researches SDK/Live compatibility and builds the minimal Live adapter proof; it does not block engine work.
2. AOPX-02 immediately builds the Node/TypeScript Reverse/Gain engine and proves editable history/cache independently of Live.
3. AOPX-03 builds the floating-window visual shell in parallel using clearly marked mock data, then integrates the real engine after AOPX-02's API contract and core tests are stable.
4. Integrate the Live adapter, GUI and engine; the user tests the complete Alpha 0.1 flow before feature expansion.

## Safeguards

- No changes to `main`; no automatic merge.
- Never modify source audio or the user's production Live Sets.
- Do not commit SDK packages, plugin binaries, user audio, licenses, credentials or secrets.
- Report exact commits, commands, test results, measurements and limitations.
