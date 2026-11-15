# Project Plan — Alpha 0.1

## Product objective

Demonstrate a dependable, editable offline processing chain for one Ableton Live audio clip. The success criterion is not a large list of effects; it is proving that editing an early operation preserves later operations and efficiently re-renders the chain.

## User workflow

1. Select exactly one audio clip in Live.
2. Invoke the Offline Processing tool.
3. Open the editor with the source waveform and clip metadata.
4. Add Reverse.
5. Add Gain (initial default 0 dB; user can set a test value such as -3 dB).
6. Render and audition the result.
7. Remove Reverse or change its parameters where applicable.
8. Re-render Gain against the original source.
9. Compare the old and new versions.
10. Return the selected version to Live as a new audio clip/file; never overwrite the original.

Reverse has no useful parameter in the initial prototype beyond enabled/removed. Gain provides an editable parameter test. The exact acceptance sequence should therefore be:
- Original -> Reverse -> Gain(-3 dB) -> Render A.
- Remove Reverse -> Gain(-3 dB) -> Render B.
- Verify B is equivalent to applying -3 dB gain to the original, not the reversed source.
- Restore the previous history revision and confirm Render A remains recoverable.

## Incremental cache requirements

Represent the chain as ordered, stable operation nodes. Each node records:
- Stable operation ID and type.
- Parameters and enabled state.
- Input node/reference.
- Processor/engine version.
- Output format/sample rate/channel layout.
- Cache key and rendered output reference.
- Render duration, output byte size, cache status and diagnostics.

Cache key must include the input audio identity/content hash, operation identity/type, normalized parameters, processor version, and relevant audio format settings. A cache entry may only be reused when its full key matches.

When a node changes:
- Keep all valid upstream outputs.
- Invalidate that node and all downstream outputs on that branch.
- Render forward from the earliest invalid node.
- Keep old revision outputs available for A/B/restore until normal cache retention cleanup.
- If a previous exact key is encountered, reuse its cached output.
- Do not reuse downstream outputs from a different input, even if the plugin settings are unchanged.

The internal model must support parent/child revisions or DAG branches from the start. Alpha 0.1 UI may display only the active linear path.

## Storage and diagnostics

Display:
- Source file size.
- Per-operation output size.
- Per-operation render duration.
- Cache hit/miss and invalidation reason.
- Active render output size.
- Total cache size and project footprint.
- Current revision/branch identifier.

Clearly distinguish metadata-only operations from operations that generate audio. Do not invent disk usage estimates; measure actual file sizes.

## GUI requirements

A simple, polished desktop-style window:
- Header with project/clip name and source status.
- Waveform display.
- Ordered processing history.
- Selected operation controls.
- Add Reverse / Add Gain controls.
- Render / Cancel / A-B / Restore actions as applicable.
- Compact diagnostics panel for render time and disk usage.
- Clear progress, error, and cache status.

No elaborate editing toolset or range-selection UI in Alpha 0.1.

## Test requirements

Use deterministic generated WAV fixtures so tests do not depend on the user's private audio.

- Reverse output sample order is correct for mono and stereo.
- Gain applies correct linear amplitude conversion for dB.
- Reverse -> Gain output matches reference.
- Removing Reverse causes only the affected branch from that node onward to re-render.
- Unchanged upstream cache entries are reused.
- Old downstream cache is not reused after upstream input changes.
- Restoring the prior revision reuses prior valid output when key matches.
- Branches do not mutate one another.
- Manifest survives close/reopen and restores operation order/settings.
- Source file hash and bytes remain unchanged.
- Disk usage metrics equal actual output file sizes.
- Cancellation does not publish a partial/corrupt final output.
- Errors leave the last known-good render available.

## Milestones and gates

### Gate 0 — Feasibility and environment
- Verify exact Live editions/builds on the user's systems (Live 13 and Live 12.5 as reported).
- Verify whether the official Extensions SDK supports either installed release.
- Verify Suite licensing requirement and the actual SDK distribution channel.
- Establish whether an Extension can safely hand off a selected clip to a companion editor and return a processed WAV.
- Do not install beta builds or modify user installations without permission.

### Gate 1 — Engine proof
- Implement deterministic Reverse and Gain operations.
- Implement operation manifest, immutable outputs, branch-capable revision model and content-addressed incremental cache.
- Add unit/integration tests for invalidation and restoration.
- Deliver a runnable minimal demo and test report.

### Gate 2 — Basic GUI
- Add waveform and linear history list.
- Add Reverse/Gain controls and render actions.
- Show real render time and actual disk footprint.
- Demonstrate the required remove-first-step/re-render workflow.

### Gate 3 — Live handoff
- Add the supported Live integration path only after Gate 0 confirms the viable mechanism.
- Import/insert final processed audio safely; no source overwrite.
- Test on both available Live versions where supported.

### Gate 4 — Expansion decision
Only after the user has tested Alpha 0.1 and accepted the core workflow should development expand to range selection, more operations, plugin hosting, ARA research, time stretching or pitch/time edits.

## Out of scope

VST3/AU hosting, ARA, Ableton stock effect rendering, time stretching, warp marker editing, selection ranges, multi-clip processing, batch jobs, destructive edits, and public release packaging.
