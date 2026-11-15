# Controlled startup-repair variants

## Variant A — audio-output probe isolation (test-only control)

The v1.6 production path already uses one shared mixer dictionary per scan.
The test suite compares the same source with only the Track.has_audio_output
gate bypassed for the duration of one test. With four audio-output tracks,
the resulting frame is identical and the getter count drops to zero. This
isolates the cost of the property read without changing any other mixer,
rendering or MIDI code.

The feature-off control is not a candidate build: it would incorrectly expose
Pan/Sends for tracks without audio output. The instrument-less MIDI test keeps
the required unavailable-control behavior.

## Variant B — persistent Track-proxy cache (test-only rejected variant)

A test-only persistent cache keyed by Track identity is compared with the
per-scan cache. After simulated device removal, the persistent variant keeps
showing the old Pan/Sends controls. Restoring the production per-scan helper
reflects the changed graph on the next scan.

A cross-scan cache is therefore rejected unless a Live 13-supported device
graph invalidation contract is independently established. The candidate does
not retain Track proxies across scans.

## Variant C — scheduler lifecycle only (repair candidate)

The installable source is v1.6 plus the scheduler/refresh lifecycle guard and
opt-in diagnostics. It preserves the v1.6 mixer feature behavior, purple Sends,
unavailable Pan/Sends blackout, Master Pan, directional chords, Solo blue and
Stop safety. No other v1.6 feature rollback was justified by the source
comparison or offline tests.

## Deferred

No separate feature-removal variant was built for purple Sends, directional
gestures, or Stop behavior because the startup investigation has not produced
evidence implicating those paths. Adding speculative variants would expand the
crash-repair scope without improving causal isolation.
