# MF Build 3 — Primary Shared State and Structural Listeners

Design specification (not implemented or tested).

Primary shared state should track:
- regular track count, identity and order; additions/removals/reordering;
- return track count, identity and order; additions/removals/reordering;
- selected track, track name, type, and (where supported) grouping/folding or visibility;
- selected device and device-chain structure changes, including device additions/removals;
- transport playing/recording;
- tempo and time signature for shared beat/bar timing;
- send availability when return tracks or target track change.

Guidelines:
1. Centralize collection-level listeners, avoiding per-column duplicates.
2. Reconcile track/device identities after structure changes, not just numeric indices.
3. Distinguish ordinary, return, and master tracks. Define whether hidden/folded group children are included in banking during hardware testing.
4. On track/return change, update banking bounds and active mixer/send modules; avoid full redraw of unrelated modules.
5. Keep listener scope narrow: do not eagerly attach name/device/parameter listeners to every track and device when only selected or displayed objects matter.
6. Structural changes are event-driven; expensive high-rate VU, clip position, MIDI activity, device parameter rings and beat subdivision monitoring are on-demand.
7. Rebind safely on deletion, and guard queued callbacks against stale objects/generations.
8. Verify exact Live 12.4.16 listener API availability before implementation.

Related: ON_DEMAND_MONITORS.md; SHARED_TRANSPORT_STATE.md.
