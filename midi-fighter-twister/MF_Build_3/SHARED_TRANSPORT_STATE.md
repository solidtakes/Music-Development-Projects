# MF Build 3 — Shared Transport and Musical Position State

Design requirement, not implemented or hardware-tested.

Provide one shared state service for:
- playing / stopped;
- recording state (distinguish Arrangement and Session when exposed);
- queued/waiting state, scoped to the relevant clip/scene/track rather than falsely treating it as a global transport flag;
- current bar and beat;
- 16th-note subdivision for LED animations.

Use available Live event listeners for transport and state changes. For musical position, use one bounded scheduler only while active modules subscribe, derive bar/beat/subdivision from Live song position and time signature, and refresh after jumps, looping, tempo or meter changes. Avoid per-module high-frequency polling.

Central service multiplexes changes to active modules only. Each module unsubscribes when switched away; queued callbacks must verify activation generation. LED MIDI sends are change-detected, and beat timing is consistent across active columns. The service must avoid assuming Session clip recording or launch queues are a single global flag.

Specific Live API capabilities and scheduler cadence require verification in the target Ableton Live 12.4.16 runtime.
