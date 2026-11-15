# Ableton Offline Processing Extension — Project Status

**Milestone:** Alpha 0.1 — editable two-step processing history proof  
**Status:** Project plan and Codex task queue established; implementation not yet verified.  
**Canonical branch:** `ableton-offline-processing/alpha-0.1`  
**Repository:** `solidtakes/Music-Development-Projects`

## Owner-approved product direction

Create a non-destructive, history-based offline audio editor integrated with Ableton Live, inspired by Pro Tools AudioSuite and Cubase Offline Process History.

The key feature is editable history with incremental rendering: change or remove an early operation, preserve later operations, re-render only the affected downstream chain, and reuse valid cached intermediates.

## Alpha 0.1 scope

- One selected audio clip; whole-clip processing only.
- Simple, polished GUI with waveform and linear operation list.
- Reverse and Gain as first deterministic operations.
- Remove Reverse while retaining Gain; re-render Gain against original source.
- Branch-capable internal history model; branches/alternate versions can be exposed later.
- Preserve source and prior rendered versions.
- Show actual per-operation render time, cache hit/miss, output file size, source size and total cache footprint.
- Return processed output to Live as a new file/clip; never silently overwrite source.
- No third-party plugin hosting, ARA, range selection, time stretching, pitch rendering or multi-clip processing in Alpha 0.1.

## Canonical Codex queue

- [#30 AOPX-01 — Extensions SDK compatibility and Live clip handoff](https://github.com/solidtakes/Music-Development-Projects/issues/30)  
  Branch: `codex/aopx-01-sdk-feasibility`
- [#31 AOPX-02 — Incremental WAV processing/history engine](https://github.com/solidtakes/Music-Development-Projects/issues/31)  
  Branch: `codex/aopx-02-engine-proof`
- [#32 AOPX-03 — GUI and storage/performance monitor](https://github.com/solidtakes/Music-Development-Projects/issues/32)  
  Start after AOPX-02's engine interface/tests are stable; create a dedicated child branch then.

All three issues are labelled `codex`, `ableton-offline-processing`, and `alpha-0.1`. They are handoff tasks; no Codex GitHub bot assignee is assumed.

## Live version and SDK gate

The user reports having Live 13 and Live 12.5 current-release installations. Ableton's public SDK documentation currently describes the Extensions SDK as a public beta for Live 12 Suite Beta 12.4.5 or later and states that Extensions are discrete tasks, not continuous real-time audio processors.

The official sources located so far do not explicitly confirm compatibility with the user's exact Live 13 and Live 12.5 release builds. AOPX-01 must verify exact edition/build support and the selected-clip/file handoff route. Do not change or install anything into the user's production Live installations without permission.

## Required next sequence

1. Start Codex issue #30 and #31 on their respective child branches.
2. Prove the Live SDK route independently of the processing engine.
3. Prove Reverse -> Gain -> remove Reverse -> re-render Gain -> restore previous version.
4. Build the GUI only once the engine contract and tests are stable.
5. User tests the working Alpha 0.1 flow in their installed Live versions before expansion.

## Future roadmap

VST3/AU plugin hosting, ARA integration research, clip/range selections, normalization, fades, trimming, time stretching, pitch/time edits, batch processing, and richer branch/version UI are later milestones.

## Safeguards

- No changes to `main`; no automatic merge.
- Never modify source audio or the user's production Live Sets.
- Do not commit SDK packages, plugin binaries, user audio, licenses, credentials or secrets.
- Report exact commits, commands, test results, measurements and limitations.
