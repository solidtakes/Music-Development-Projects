# MF4TRKBento v1.5 EXP performance audit

## Implemented, ranked by measured API-read savings

| Rank | Change and source location | Measured effect per 800 ticks | Risk |
| --- | --- | --- | --- |
| 1 | `_scan_frame`, `_scene_state`, `_slot_list` reuse each track's clip-slot collection across rows within one scan. | 107,200 → 26,800 clip-slot property reads in the stopped and animated 64-track grids. Scene aggregation still visits all tracks in each row. | Low. Snapshot lasts one scan and observes newly inserted clips on the next scan. |
| 2 | `_scan_frame` slices the visible-track window once and reuses mixer, Pan and Sends handles within the scan. | 5,200 → 400 visible-track reads in each grid and idle mixer. Idle mixer reads 5,600 → 1,600 for mixer devices, 3,200 → 1,600 for Pan, 2,400 → 1,200 for Sends. | Low. Gesture actions resolve live targets, including send reassignment when modules move. |
| 3 | `_render_frame` reads the beat only when a scene LED needs it and shares a ring sample for cells referencing the same clip proxy. | 800 → 0 transport/beat reads each for idle mixer and stopped grid. Animated grid retained 800 beat reads and cut position reads 3,200 → 2,400. | Low. Scene, clip, Arm and Solo flash phases and ring cadence are preserved. Proxy identity can limit sharing. |

`_rgb` and `_ring` retain changed-value-only output, including retry on explicit send failure. `refresh_state` still invalidates the caches when the host requests a repaint. Ordinary scans and module changes render through the caches. `_tick` still performs a state/ring scan every second scheduled callback and checks animation on intervening ticks. Module switching keeps directional navigation at four detents and consumes held releases on layout or navigation gestures. On disconnect, the script removes all 32 input listeners, clears references and leaves a closed guard for any late callback. The framework owns task cancellation and its own listeners.

## Results and historical comparison

| Identical 64-track workload | Baseline → v1.5 median µs/tick | Script MIDI attempts |
| --- | ---: | ---: |
| Idle mixer | 15.10 → 9.72 (−35.7%) | 0 → 0 |
| Stopped alternate grid | 93.19 → 74.83 (−19.7%) | 0 → 0 |
| Playing/recording alternate grid | 127.58 → 110.54 (−13.4%) | 8,000 → 8,000 |
| Input dispatch with inactive animation | 74.72 → 65.41 (−12.5%) | 112 → 112 |

Python 3.14, nine alternating trials of 800 callbacks per build/workload. Mock time, input, track counts and clip states were identical. All streams matched in message order and bytes. Each trial dispatched 800 scheduled ticks, plus 240 input callbacks in the event workload. Script-owned listeners numbered 32 before and 0 after disconnect in both builds. This measures Python and instrumented mock calls. Live can buffer MIDI output. Live CPU, wire traffic, audio impact and hardware latency remain unmeasured. Reproduction command and raw counters are in the checklist and BENCHMARK_RESULTS.txt.

Selected Track Bento v2.2 EXP's `_send_cc` (lines 884–889) caches final values but records them before sending. MF4TRKBento v1.4 already improves on that by recording only after the send does not return False. Its `_render_clips` (1381–1412) snapshots slots per column, and `disconnect` (2044–2069) explicitly tears down callback state. The independent Selected Track Bento v0.1.32 audit also flags per-tick duplicate reads and release intents surviving track/module changes. [Selected Track Bento audit](https://github.com/solidtakes/Music-Development-Projects/issues/11#issuecomment-6843820822)

The v1.1 MF4TRKBento audit reported 17→0 stopped, 33→0 frozen playing, and 532→448 animated sends over its historical 80-tick workload. v1.5 retains changed-value caching and two-tick scans. v1.2 established independent offsets and four-detent navigation, retained here. [v1.1 audit](https://github.com/solidtakes/Music-Development-Projects/blob/bento/mf4trkbento-v1.1-experimental/MF4TRKBento_REVIEW/v1.1/README.md) · [v1.2 draft PR](https://github.com/solidtakes/Music-Development-Projects/pull/21)

## Deferred optimization opportunities

1. **High potential, high risk — replace full scene polling with incremental invalidation.** `_scene_state` still scales with song tracks × displayed RClip rows. Live listeners could lower steady work but must cover queued, clip replacement, folding, recording and transport changes. Listener churn and stale LED state need real Live measurements first.
2. **Medium potential, high risk — split timers or throttle white-ring sampling.** `_tick` and `_render_frame` could reduce wakeups or MIDI when transport is moving. This changes flash phase sampling, ring responsiveness and recovery from host scheduling jitter. Establish Twister wire and audio/CPU baselines before changing timing.
3. **Medium potential, high risk — replace dimension-changing highlight components.** `_refresh_highlight` reuses the component for normal refreshes and scrolls, and reconstructs it when width or actual RClip height changes. Installed Live 13.0b24 framework bytecode shows the host retaining registered components until surface disconnect. Disconnected component trees can remain referenced across dimension changes. Replacing the highlight path or mutating the private registry needs a Live integration test.
4. **Lower potential, medium risk — coalesce event-triggered full refreshes and unify release target binding across existing modules.** `_push`, `_rotary` and action helpers often scan immediately. Deferring burst refreshes may change visual feedback. Stop is target-bound; existing RClip/Arm/Pan/Mute releases can still resolve a new column target after external track topology changes. Broader changes should be tested with automation and real held gestures.
