# Ableton Offline Processing Extension — Project Status

**Milestone:** Alpha 0.1 — editable two-step processing history proof  
**Status:** Project plan and SDK archive review committed; runtime integration and audio-engine implementation not yet verified.  
**Canonical branch:** `ableton-offline-processing/alpha-0.1`  
**Repository:** `solidtakes/Music-Development-Projects`

## Owner-approved product direction

Create a non-destructive, history-based offline audio editor integrated with Ableton Live, inspired by Pro Tools AudioSuite and Cubase Offline Process History.

The key feature is editable history with incremental rendering: change or remove an early operation, preserve later operations, re-render only the affected downstream chain, and reuse valid cached intermediates.

## Alpha 0.1 scope

- One selected audio clip; whole-clip processing only.
- Compact, polished SDK modal Webview with waveform and linear operation list.
- Reverse and Gain as first deterministic operations.
- Remove Reverse while retaining Gain; re-render Gain against original source.
- Branch-capable internal history model; branches/alternate versions can be exposed later.
- Preserve source and prior rendered versions.
- Show actual per-operation render time, cache hit/miss, output file size, source size and total cache footprint.
- Return processed output to Live as a new clip on a separate track; never silently overwrite source.
- No third-party plugin hosting, ARA, range selection, time stretching, pitch rendering or multi-clip processing in Alpha 0.1.

## Supplied SDK archive reviewed

The user supplied `extensions-sdk-1.0.0-beta.1.zip`. Its docs, examples, API reference and npm package metadata were inspected. Full report: [SDK Archive Review](SDK_ARCHIVE_REVIEW_BETA_1.md).

Key findings:
- Extensions run Node.js/TypeScript and can use npm packages, so the Alpha 0.1 audio engine can run inside the Extension Host; a native companion app is not required for the first proof.
- The SDK supports AudioClip context-menu actions, modal HTML Webviews, cancellable progress dialogs, Node file processing, pre-FX track-range audio rendering, project import and new Arrangement clip creation.
- `renderPreFxAudio` is track/range based and pre-FX only. The first test must use one isolated clip on its own audio track and verify the rendered content.
- `AudioClip` API docs do not expose per-clip gain or transpose. Reverse/Gain are rendered audio operations. Basic warp/loop settings exist; arbitrary warp-marker writes are not documented.
- `AudioTrack.insertDevice` inserts built-in devices only; it cannot load third-party plug-ins. No post-FX render, VST3/AU or ARA host API is documented in this archive.
- The Webview is modal, not an always-on editor; use it to submit the operation list, then process with a Live progress dialog.
- All supplied npm packages declare Node >=24.16.0 (stricter than the Quick Start page's >=24.14.1).

## Canonical Codex queue

- [#30 AOPX-01 — SDK feasibility and Live clip round-trip](https://github.com/solidtakes/Music-Development-Projects/issues/30)  
  Branch: `codex/aopx-01-sdk-feasibility`
- [#31 AOPX-02 — Incremental WAV processing/history engine](https://github.com/solidtakes/Music-Development-Projects/issues/31)  
  Branch: `codex/aopx-02-engine-proof`
- [#32 AOPX-03 — GUI and storage/performance monitor](https://github.com/solidtakes/Music-Development-Projects/issues/32)  
  Start after AOPX-02's engine interface/tests are stable; create a dedicated child branch then.

The child branches were created before the SDK archive review commits. Codex was asked to merge/rebase the canonical branch before implementation while preserving any local work. The issues are labelled `codex`, `ableton-offline-processing`, and `alpha-0.1`; no Codex GitHub bot assignee is assumed.

## Live version and SDK gate

The user reports having Live 13 and Live 12.5 current-release installations. The supplied SDK Quick Start says to use the Live Beta build from the SDK release page in Centercode; its Execution guide example references Live 12.4 Beta. The archive does not prove stable Live 12.5 or Live 13 compatibility. AOPX-01 must verify the exact compatible beta/build and edition. Do not change or install anything into production Live installations without explicit approval.

## Required next sequence

1. AOPX-01 builds the official minimal Extension and verifies the one-clip pre-FX WAV → modal UI → import/new-clip route in a compatible disposable Live beta.
2. AOPX-02 proves Reverse -> Gain -> remove Reverse -> re-render Gain, persistent cache, branch-capable graph, and measured performance.
3. AOPX-03 builds the modal Webview after the engine interface/tests are stable.
4. User tests the working Alpha 0.1 flow before feature expansion.

## Future roadmap

VST3/AU plugin hosting, ARA integration research, Ableton stock-device offline rendering research, clip/range selections, normalization, fades, trimming, time stretching, pitch/time edits, batch processing, and richer branch/version UI are later milestones.

## Safeguards

- No changes to `main`; no automatic merge.
- Never modify source audio or the user's production Live Sets.
- Do not commit SDK packages, plugin binaries, user audio, licenses, credentials or secrets.
- Report exact commits, commands, test results, measurements and limitations.
