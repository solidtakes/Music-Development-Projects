# MF Build 3 — Primary Shared State Guidelines Approval

Approved by user on 2026-11-12; design requirements, not implemented or tested.

1. Centralize relevant Ableton collection listeners and avoid per-column duplication.
2. Reconcile track and device identity after additions, removals, and reordering rather than trusting stale indices.
3. Distinguish ordinary tracks, returns, master, and group/fold visibility in navigation and state handling.
4. Refresh only affected active modules after structural changes, not the whole controller.
5. Keep listener scope narrow: selected/displayed tracks and devices only, not every object in the Live set.

Keep structural state monitoring separate from on-demand VU, MIDI activity, clip position, device parameter and animation monitors. Implement and test listener cleanup, stale callback invalidation and track deletion/reordering safety. See PRIMARY_SHARED_STATE.md.
