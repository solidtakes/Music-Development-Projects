# Ableton Offline Processing Extension — Project Status

**Current milestone:** Alpha 0.1 planning / feasibility  
**Status:** Branch and handoffs created; no implementation or Live compatibility test claimed.  
**Development branch:** `ableton-offline-processing/alpha-0.1-foundation`  
**Repository:** `solidtakes/Music-Development-Projects`

## Owner-approved direction

Build a non-destructive, history-based offline audio editor integrated with Ableton Live. The differentiator is editable processing history and incremental re-rendering: changing or removing an earlier operation must preserve later operations and re-render only the affected downstream chain, while reusing valid upstream caches.

Initial proof:
- One selected audio clip, whole-clip only.
- Reverse and Gain (-3 dB).
- Simple attractive GUI with waveform and linear history list.
- Branch-capable internal revision model.
- Actual per-operation render time, output file size, cache hit/miss and total cache footprint.
- Source remains immutable; processed audio returns to Live as a new file/clip.
- No plugin hosting, ARA, time stretch, range selection or multi-clip work in Alpha 0.1.

## GitHub handoffs

- [Issue #28 — Codex Task A: SDK compatibility and Live handoff feasibility](https://github.com/solidtakes/Music-Development-Projects/issues/28)
- [Issue #29 — Codex Task B: incremental history/cache engine proof](https://github.com/solidtakes/Music-Development-Projects/issues/29)

Issues are tagged `codex` and ready to be started by Codex. They are not assigned to a GitHub bot account because no verified Codex GitHub username is established.

## Key documentation

- [Project README](README.md)
- [Alpha 0.1 project plan](PROJECT_PLAN_ALPHA_0.1.md)
- [Codex task contract](CODEX_TASKS_ALPHA_0.1.md)
- [SDK compatibility findings](SDK_COMPATIBILITY.md)
- [Architecture decisions](ARCHITECTURE_DECISIONS.md)

## SDK compatibility warning

As of 2026-11-14, Ableton's official SDK overview and FAQ document the public-beta SDK with Live 12 Suite Beta 12.4.5 or later and state that Extensions are not available in Standard, Intro or Lite. The FAQ also says Extensions are discrete tasks and not intended for real-time signal processing.

The owner reports having Live 13 and Live 12.5 current-release installations. Official documentation located so far does not explicitly confirm SDK support for either exact release. Codex Task A must verify this rather than assume it. Do not install a beta or alter the owner's installations without permission.

## Current commits

- Project README: `d9944a7`
- Alpha plan: `f48e5a6`
- Codex task contract: `c01ebac`
- SDK compatibility note: `d793dfa`
- Architecture decisions: `d3a324e`
- Root README project index: `3124f24`

## Next steps

1. Start Codex Task A and Task B from issues #28 and #29.
2. Task A establishes supported Live integration and SDK compatibility.
3. Task B proves Reverse -> Gain -> remove Reverse -> re-render Gain -> restore prior version with incremental cache.
4. Build the simple GUI after the engine contract and tests are stable.
5. User tests Alpha 0.1 in their own Live installations before further investment.

## Safety and review

- No changes to main.
- No automatic merge.
- No original audio modification.
- No Live installation changes without explicit owner approval.
- Future VST3/AU, ARA, range processing and time-stretching remain separate roadmap items.
