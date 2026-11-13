# Changelog and rollback

## S1 — scale-only review candidate

Derived directly from exact frozen Test18. Adds read-only scale_sync.py and lifecycle hooks; replaces hardcoded scale stepping with target-context synchronization. OFF is chromatic; ON uses observed root/intervals. Available Song/View/Clip listeners mark a small cache dirty. Missing observers use a four-existing-tick fallback and fresh state on a requested pitch edit. Unsupported/mismatched context blocks the pitch edit visibly; no static C Major fallback. Song proxy requires detail_clip equality. Close detaches only this instance's callbacks. Scale notifications never write notes or dirty the renderer. No mapping/gesture/palette/loop/Follow/probability changes.

## P1 — performance audit fixture, not a recommended installation

Isolates renderer work against frozen Test18 for reproducible benchmarking. Snapshot playback once for Follow/playhead, separate note-data refresh from page/display refresh, primitive display-note cache, render only when its content/context/mode changes, standard refresh_state invalidation and one touched-ring resend after RGB. No new timer/thread or note listeners. Original native vectors still used for all edits. This fixture deliberately retains the historical scale bug for isolation; use S1 or SP1 for scale testing.

## SP1 — combined experimental candidate

S1 synchronization plus P1 renderer changes, retaining identical frozen input dispatch, constants/palettes and musical edit behavior except the explicitly requested scale repair. Scale listener overhead included in its own benchmark row; do not attribute S1 cost to the renderer alone. No swing, nudge, reset or CC activation.

## Rollback

1. Quit Live. Move the candidate MF_SEQ directory aside; install one complete MF_SEQ package extracted from the unchanged frozen Test18 ZIP. Keep the ZIP and prior installed directory separately; never overwrite the archive.
2. Verify baseline ZIP SHA256 `38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c` and source SHA256 `270460564e5fb765ef4e7d86e4fefb5c2b69926445d9bec66358160c69d6c1a8`. Restart Live on original ports; confirm gestures, notes, colors and rings.
3. Remove any profiling attach call from disposable installations. No MIDI Utility, firmware, global routing or Set files were changed by producing this review. Any copied Set edited during hardware tests is separate; restoring script code does not undo user-created Set edits.
4. Frozen Test18 retains the known hardcoded-scale bug. Rolling back restores that behavior; do not claim rollback fixes Scale Awareness.
