# MF Build 3 — Bank 1 Column Switching and Lifecycle

Status: approved architecture specification, not yet implemented or tested.

Bank 1 Selected Track Bento uses four **vertical columns**, not horizontal rows:
- Column 1: E1 E5 E9 E13
- Column 2: E2 E6 E10 E14
- Column 3: E3 E7 E11 E15
- Column 4: E4 E8 E12 E16

Hold and twist E1, E2, E3, or E4 to change the corresponding column's assigned module. Clockwise selects next; counterclockwise previous. Suppress ordinary encoder action during module switching. Show immediate Ableton status-bar feedback naming the column and function.

## Required lifecycle
1. Deactivate previous module: invalidate generation token, unsubscribe its Ableton listeners, stop module-specific scheduled/polling work, release owned LED/ring outputs and control bindings.
2. Activate next module: bind its controls, register only required listeners, read current Live state, render LEDs/rings and show status message.
3. Callbacks that were already queued must check active state/generation before any state mutation or LED writes.
4. Repeated toggling must not leak listeners, duplicate callbacks, or leave stale LEDs.
5. Keep one lightweight global input/column switch controller. Shared track/transport listeners may be centrally multiplexed rather than duplicated by modules.
6. Inactive VU, beat, clip and device modules must not continue module-specific polling or animation.
7. A module activation/deactivation should be idempotent; switching should remain responsive without excessive polling.

Audit conflicts with existing E1–E4 press/hold gestures in MF Build 2 before implementation. This is a design requirement only; no hardware test or script implementation is claimed.
