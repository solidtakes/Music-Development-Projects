# Controlled startup-repair variants

## Variant A — audio-output probe isolation (test-only control)

The v1.6 scan already shares a per-scan mixer dictionary across Pan and Sends.
The test suite compares the same source with only the Track.has_audio_output
gate bypassed for the duration of one test. With four audio-output tracks,
the resulting frame is identical and the getter count drops to zero. This
isolates the cost of the property read without changing any other mixer,
rendering or MIDI code.

The feature-off control is not a candidate build: it would incorrectly expose
Pan/Sends for tracks without audio output. The instrument-less MIDI test keeps
the required unavailable-control behavior.

## Variant B — per-scan availability (production baseline)

The current v1.6 design reads each visible Track.has_audio_output once per
scan, sharing both positive and negative results across Pan and Sends. At the
normal two-tick scan cadence this is four reads per scan for the four-track
window. Device add/remove changes are visible on the next scan.

## Variant C — listener-invalidated per-track cache (test-only safe variant)

A separate test-only variant registers Track.add_has_audio_output_listener,
caches one availability value per live Track, refreshes it on property-change
notifications, and removes listeners/cache entries when tracks leave the active
set or the cache closes. The mock test verifies one initial read per track,
100 subsequent scans with no extra getter reads, device add/remove invalidation,
deleted-track cleanup and listener removal.

The API reference documents the Track listener triplet
(add_has_audio_output_listener / has_audio_output_has_listener /
remove_has_audio_output_listener), but this reference is not a Live 13 Beta
runtime capture. The listener cache is therefore not selected for the repair:
the current per-scan path is already bounded to four getter calls per scan,
while the persistent listener cache adds registration, invalidation and
teardown paths that themselves need Live 13 Beta verification.

## Variant D — persistent Track-proxy cache without invalidation (test-only rejected variant)

A test-only cross-scan Track-identity cache fails the device-removal case by
leaving stale Pan/Sends controls visible. This confirms that a cache without
a proven invalidation path is unsafe.

## Variant E — scheduler lifecycle only (repair candidate)

The installable source is v1.6 plus the scheduler/refresh lifecycle guard and
opt-in diagnostics. It preserves the v1.6 feature behavior, including purple
Sends, unavailable Pan/Sends blackout, Master Pan, directional chords, Solo
blue and Stop safety. No other v1.6 feature rollback was justified by the
source comparison or offline tests.

## Deferred

No separate feature-removal variant was built for purple Sends, directional
gestures, or Stop behavior because the startup investigation has not produced
evidence implicating those paths. Adding speculative variants would expand the
crash-repair scope without improving causal isolation.
