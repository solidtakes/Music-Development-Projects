# Architecture Decisions — Alpha 0.1

## ADR-001: Source audio is immutable

The original WAV is read-only. Every rendered operation writes to a new unique output. Live's source file is never edited in place.

## ADR-002: Processing history is a graph, not a destructive undo stack

Each operation is a stable node in a revision graph. The first UI may show a simple ordered list, but the data model must permit multiple child revisions/branches and restore of prior outputs.

## ADR-003: Incremental rendering is based on exact cache identity

A cache hit requires a full matching key: input audio content hash, operation identity and type, normalized parameters, processor/engine version, and relevant audio format metadata. A parameter change invalidates that operation and downstream operations on the affected branch. Upstream valid outputs remain reusable.

## ADR-004: Separate Live integration from audio processing

The Live adapter must not own the processing engine. The engine and companion editor must be testable without Live. SDK support and file handoff are a feasibility gate, not an assumption.

## ADR-005: Whole clip before range selection

Alpha 0.1 operates on one whole audio clip. Selection/range processing is deferred until clip-level rendering and history are proven.

## ADR-006: Visible diagnostics from the first GUI

Show actual file sizes and render durations. Distinguish metadata-only changes from audio renders. Record cache hit/miss, invalidation and total storage footprint.

## ADR-007: Branch-capable model from day one

The internal revision model supports branches and alternate versions. The first interface exposes a single active history path plus restore/A-B controls.

## ADR-008: Plugin and ARA hosting are future milestones

Do not implement VST3/AU or ARA in Alpha 0.1. Keep an operation/processor interface that can support built-in DSP and future plugin processors. Research ARA separately because it has different integration and document/model requirements from ordinary plug-in hosting.
