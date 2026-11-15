# Codex Work Assignment — Ableton Offline Processing Extension Alpha 0.1

Repository: `solidtakes/Music-Development-Projects`  
Branch: `ableton-offline-processing/alpha-0.1-foundation`  
Project folder: `ABLETON_OFFLINE_PROCESSING/`

## Working rules

- Read this file, README, PROJECT_PLAN_ALPHA_0.1.md, SDK_COMPATIBILITY.md and ARCHITECTURE_DECISIONS.md before coding.
- Work only on this branch or a clearly named child branch; never commit to main.
- Do not change or install anything into the user's Ableton installations.
- Do not modify source audio files.
- Do not add third-party plugin hosting, ARA, time stretching, range selection or multi-clip support in Alpha 0.1.
- Do not claim Live 13 or Live 12.5 support until verified on those exact builds.
- Do not assume Extensions SDK can launch a companion process or access arbitrary files; prove it from official API documentation and a runnable test.
- Keep tasks small, report blockers early, and preserve reproducible commands and test output.
- No auto-merge. Request owner review before any merge.

## Task A — Extensions SDK compatibility and handoff feasibility

Deliver a short evidence-based report and, if possible, a minimal sample extension.

1. Read the official SDK docs and examples.
2. Record the currently documented Live edition/build requirements and SDK version.
3. Investigate the user's reported Live 13 and Live 12.5 release versions. The official pages currently describe public beta availability beginning at Live 12.4.5 and state a Suite requirement; do not extrapolate support to Live 13/12.5.
4. Determine whether the Extension API can:
   - identify exactly one selected audio clip;
   - access/render/export the clip's audio or source file safely;
   - create/import a new audio clip from a processed WAV;
   - open or communicate with an external companion app using a documented, supported mechanism;
   - present a useful launch/configuration UI.
5. Identify all API limitations, permissions, file-system constraints and platform restrictions.
6. Build the smallest no-risk sample that reads selected clip identity/properties and returns a clear diagnostic. Do not modify a Set.
7. If the SDK is unsupported on the user's release versions, document the least-friction fallback (e.g. standalone companion plus a supported Live integration mechanism) without changing installations.
8. Provide source links, exact SDK/API symbols, build instructions, test matrix and explicit unknowns.

Acceptance: evidence-based compatibility matrix for Live 13 and Live 12.5; no unsupported claims; sample builds if the environment permits.

## Task B — Processing engine vertical slice

Implement a minimal, testable engine for one whole WAV file. Keep the UI and Live integration separate from the engine.

1. Define an immutable source reference and operation-node schema.
2. Implement Reverse and Gain operations.
3. Implement a branch-capable revision model, even if only one active linear chain is exposed.
4. Implement deterministic content-addressed caching. Include input audio hash, operation type/ID, normalized parameters, engine version and output format in cache identity.
5. Re-render from the earliest changed node; preserve valid upstream caches and old revision outputs.
6. Persist and reload the manifest and operation parameters.
7. Measure actual render duration and output byte size for every operation; report cache hits/misses and total cache footprint.
8. Write deterministic mono/stereo tests for reverse, gain, chain output, invalidation, cache reuse, branch isolation, restore, persistence and source immutability.
9. Ensure cancellation/errors never publish partial output and never discard the last known-good render.

Acceptance: automated tests pass; demo proves Original -> Reverse -> Gain -> Render A, then remove Reverse -> Gain -> Render B; B matches reference gain-only output; restoring A reuses prior cache where valid. Include timings and disk-size report from actual fixture runs.

## Task C — Minimal GUI shell (only after Task B's engine interface is stable)

1. Build a clean, compact interface with waveform, history list, selected-operation controls, render/cancel, A/B/restore and diagnostics.
2. Show actual per-step render duration, cache hit/miss, output size, source size and total cache footprint.
3. Keep the first UI to one clip and whole-file operations.
4. Do not add range editing or plugin UI.
5. Provide screenshots or a short screen recording and exact run instructions.

Acceptance: user can see and execute the Alpha 0.1 demonstration without editing JSON or using a command line.

## Task sequencing

- Task A and initial Task B design/research may proceed in parallel.
- Do not build the full GUI before the engine contract and tests are stable.
- Task C begins after Task B passes its acceptance tests.
- Live integration begins only after Task A proves the supported route and the user can test it.

## Required completion report

For every task, report:
- Commit SHA and branch.
- Files changed.
- Exact commands run.
- Test counts and pass/fail output.
- Build/run instructions.
- Known limitations and unverified items.
- Whether user action or a Live installation is needed next.

Do not mark the milestone complete based on compilation alone.
