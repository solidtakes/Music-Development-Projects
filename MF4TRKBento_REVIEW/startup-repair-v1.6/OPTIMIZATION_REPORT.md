# MF4TRKBento v1.6 startup repair investigation

## Scope

Crash repair only. No feature additions. Preserve purple Sends (Extended value 48),
unavailable Pan/Sends blackout, all five directional gestures, Solo blue 68,
Master Pan, Stop safety and the existing four-row behavior.

## Findings

1. The v1.6 scan already shares a per-scan mixer dictionary across Pan and Sends.
   _frame_mixer() uses membership rather than truthiness, so a None result is
   cached for the remainder of that scan. For the normal four-column window,
   Track.has_audio_output is therefore read at most once per track per scan.
2. Direct Pan/Sends encoder operations each make one additional availability
   probe. No cross-scan Track-proxy cache is introduced: retaining Live proxies
   across device-graph changes could make the availability state stale.
3. The original _tick() had no explicit in-flight or pending-callback state.
   A reentrant _tick() could execute a nested scan and schedule a second
   recurring callback. The repair adds a single-pending-callback gate and
   rejects reentrant ticks.
4. _refresh_all() had no reentrancy guard. A nested refresh during scan or
   render could recurse. The repair coalesces it into one scan on the next
   already-scheduled tick.
5. A queued callback after disconnect is not cancellable through this script's
   existing API, but the _closed guard makes it inert. The repair explicitly
   clears pending state and tests the queued callback path.
6. Session highlighting is created once for the active geometry; recurring
   scans update offsets only when the grid state changes. Diagnostics count
   creations without logging per tick.

## Controlled isolation

- Audio availability: retain v1.6's per-scan cache; test read counts, proxy
  failures, virtual slow getters, instrument-less MIDI, instrument-backed MIDI,
  silent instruments, audio tracks, device add/remove and deleted tracks.
- Scheduler lifecycle: add pending/running guards and reentrancy coalescing.
  The regression suite injects nested tick and refresh calls.
- Other v1.6 additions: no evidence from the source comparison justifies
  reverting purple Sends, Pan/Sends availability, directional chords, or Stop
  safety. They remain unchanged in this candidate.


## Controlled variant evidence

The test-only probe-off control produces an identical frame when all four
tracks report audio output, while reducing getter reads to zero. The existing
per-scan implementation reads each visible track once even when Pan and Sends
both consume its mixer. A test-only listener-invalidated per-track cache uses
Track.add_has_audio_output_listener to refresh on device graph changes and
reduces reads across 100 scans, but requires listener registration and cleanup.
A persistent cache without invalidation fails the device-removal case by
leaving stale Pan/Sends controls visible.

The listener triplet is present in third-party Live 9/10 API references, but
we do not have a Live 13 Beta runtime capture proving its behavior here. Given
only four availability reads per scan, the extra listener lifecycle is not
justified for this crash repair. Keep the simpler per-scan cache. See
VARIANT_ISOLATION.md.

## Causality limits

The owner-supplied log proves v1.6 initialization reached its loaded message;
it does not identify a Python callback, native Live deadlock, MIDI feedback
loop, or external surface as the cause. The two v1.6 hangs and successful v1.5
rollback establish a strong regression signal, not a proven root cause.
Offline tests cannot establish Live 13 Beta startup behavior.

## Repair rationale

The scheduler and refresh guards are the smallest source-level lifecycle
hardening justified by the requested adversarial tests. Audio-output access is
measured and remains scoped to the current scan or one encoder operation;
there is deliberately no persistent Track-identity cache.
