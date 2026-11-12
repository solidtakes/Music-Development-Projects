# MF Build 3 — On-Demand Mode Monitors

Approved design requirement (not yet implemented or tested).

Keep lightweight shared Ableton state separate from mode-specific monitors. Only activate the following when at least one active module needs them:
- Audio VU meter: sample and draw audio level only while a VU display is engaged.
- Clip position: track and animate playback position only while its display is engaged.
- MIDI activity meter: process activity and draw its LEDs only while active.
- Device control positions: attach parameter value listeners and render encoder rings only while Device Controls/Device Aware modules require them.
- Device status: attach device-specific state listeners and render state LEDs only while required; selected-device identity may still be monitored centrally when needed for device-aware activation.
- Beat/bar position animation: only schedule high-frequency subdivisions when at least one active module displays them. Low-frequency shared transport state can remain centrally available.

## Subscription lifecycle
- Reference-count or otherwise deduplicate shared monitor subscriptions by source identity and signal; one underlying monitor may serve multiple active columns.
- Start monitoring on transition from zero to one consumer; stop on transition from one to zero.
- For each consumer: bind and snapshot current state on activation, unsubscribe on deactivation, invalidate queued callbacks using generation tokens.
- Release owned LED outputs and stop scheduled callbacks/animations when switching modes.
- Suppress redundant MIDI LED messages via change detection; batch/coalesce updates when appropriate without sacrificing immediate user feedback.
- Rebind relevant monitors on selected-track/device changes, cleanly removing old object listeners.
- Avoid listeners that persist on inactive Live objects or stale device parameters.
- Ensure no consumer is starved when another module unsubscribes.
- Test rapid repeated switching for leaks, duplicate callbacks, stale rings, and timing drift.

See SHARED_TRANSPORT_STATE.md and BANK_1_MODULE_LIFECYCLE.md.
