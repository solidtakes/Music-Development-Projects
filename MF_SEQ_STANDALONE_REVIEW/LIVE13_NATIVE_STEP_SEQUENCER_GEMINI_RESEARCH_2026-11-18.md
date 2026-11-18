# Gemini independent research — Live 13 native Step Sequencer

Date: 2026-11-18. Source: owner-provided Gemini report (second revision). **Research assertions, not verified runtime facts.**

## Executive finding reported by Gemini
Live 13.0b25 reportedly introduces native Sequencer Clips, with Push 3 support for step editing and per-lane Steps, Rate, Direction and Swing. Gemini found no documented public LOM/M4L lane/step API. Push integration is characterized as proprietary/internal, largely **inferred** rather than proven from inspected bindings. Absence in documentation alone is insufficient to establish runtime inaccessibility.

## Requested capabilities and current evidence gate
- Per-step: Velocity, Offset, Length, Repeat, Pitch, Chance. Gemini reports native Push UI support; only conventional MIDI note properties have public LOM analogues.
- Per-lane: Steps, Rate, Direction, Swing. Gemini reports native Push UI support; public LOM access not demonstrated.
- Selected native note lane, clip-type detection, lane playheads: public access **unverified**.
- Third-party examples mentioned: BielC/AbletonScripts_BL, Ziforge/ableton-liveapi-tools; neither is presented as proven native Live 13 integration.

## Recommendation and restrictions
Codex must independently inspect the actual installed Live 13 runtime and documentation, log exact object paths/methods/listeners, and distinguish VERIFIED / INFERRED / BLOCKED. Build only a read-only introspection probe first. Do not convert clips, write notes, activate Native Mode, or alter the frozen v1.0 standalone sequencer or owner-accepted three-bank Beta 1.2 master. No auto-merge.

## Proposed architecture (conditional)
Preserve Classic Sequencer; use a clip backend adapter for ordinary MIDI note clips and a non-mutating native adapter stub unless actual API support is verified. Manual E1+E4 Classic/Alternate toggle and independent state remain planned, not implemented.

## Original report status
This document is a concise research handoff, **not a verbatim reproduction of the owner's full uploaded report**. Gemini's claims about private C++ bindings and absolute absence of API support require independent verification.
