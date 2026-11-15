# MF Twister Module State Manager — research and architecture

Status: research-backed design; persistence integration is **not yet approved**.

## Findings

1. Ableton's official Remote Script guidance confirms that custom control surfaces are Python scripts loaded by Live, and that Live 11+ uses Python 3. It documents script installation and MIDI configuration, not a supported durable key/value persistence API. [Ableton: Installing third-party remote scripts](https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-Remote-Scripts).
2. Ableton's official custom Control Surface article documents the User Remote Scripts folder and basic configuration, but does not document a Set-scoped storage API. [Ableton: Creating your own Control Surface script](https://help.ableton.com/hc/en-us/articles/206240184-Creating-your-own-Control-Surface-script).
3. Community LiveAPI research describes `c_instance` as an opaque bridge exposing methods such as `song()`, `show_message()`, `log_message()`, and MIDI callbacks. It also states the Python Live API is not publicly documented and relies on runtime introspection/decompiled shipped scripts. This is useful research, not an Ableton support guarantee. [LiveAPI Remote Scripts reference](https://photonicvelocity.github.io/LiveAPI/remote-scripts/) and [LiveAPI project](https://github.com/kamalexandre/LiveAPI).
4. `Live.Application.get_application().get_document()` is reported by community introspection as returning the current Song. This identifies the current in-memory document, but does not by itself establish a durable, unique identifier for a Set across Save As, duplicate names, moved files, or unsaved sessions. [LiveAPI project](https://github.com/kamalexandre/LiveAPI).
5. No evidence found in the official documentation above establishes a built-in Remote Script `get_data/set_data` persistence contract. Do not call such a method unless a target-version runtime probe proves it exists.

## Decisions

- Keep the core independent of Ableton imports and filesystem operations.
- Persist only module IDs assigned to stable surface slots (row/column); never encoder values, Live parameters, MIDI routing, LED state, or transient state.
- Use a versioned JSON-compatible schema with stable surface IDs and stable module IDs.
- Registry resolution is allow-list based. Unknown module IDs are reported and preserved in the source document; they are not silently rewritten or replaced.
- Startup restore is an explicit coordinator step after the surface has registered its module catalog and default layout.
- Storage is an injected interface. The initial prototype uses an in-memory fake adapter only.
- Global named presets and per-Set presets are distinct namespaces in the interface.
- Do not enable a filesystem adapter until location, permissions, atomic replacement behavior, and recovery have been tested in the actual Live 12/13 embedded Python runtime on Windows.

## Set identity — unresolved gate

A Set title is not a safe key: duplicate names are possible and Save As/moves can change identity. A path-based key may be a practical fallback only if the target Live version exposes a stable, readable saved-set path at the required lifecycle point. That has not yet been verified against the user's Live 12.5 and Live 13 installations. Unsaved Sets must remain session-only until a durable identity is available. Do not guess based on title, track names, or runtime object addresses.

Proposed future resolver order:
1. A verified persistent document UUID, if a target Live version exposes one.
2. Otherwise a normalized saved-set path, with explicit behavior for Save As/moves and case-insensitive Windows paths.
3. Otherwise session-only state; do not write a per-Set preset under an ambiguous identity.

## Storage design

- `Storage.load_global()/save_global()/delete_global()`
- `Storage.load_set()/save_set()/delete_set()`
- Core accepts any adapter implementing this contract; tests use a fake store.
- A future file adapter should write a temporary file in the same directory, flush and close it, then atomically replace the destination; retain a last-known-good backup and validate schema before accepting a file.
- Do not perform disk I/O on MIDI callbacks. Queue writes through a bounded/coalescing persistence coordinator, with explicit shutdown flush only if the Live lifecycle supports it safely.

## Startup and multi-surface ownership

Each surface registers a unique surface ID and its own module catalog. State keys are namespaced by surface ID and layout slot. A manager instance must not globally overwrite another surface's last layout. Restore only after registration is complete; apply the resolved layout in one controlled operation, then refresh LEDs once. Repeated restore of the same state must be idempotent.

## Go / no-go

**GO** for an isolated pure-Python schema/registry/restore core and fake-storage tests.

**NO-GO** for real filesystem persistence, Set-scoped identity, Live integration, or automatic startup restoration until a Windows Live 12.5/13 probe confirms the needed APIs, path behavior, permissions, and lifecycle timing. This boundary is intentional, not a blocker to the independent core prototype.
