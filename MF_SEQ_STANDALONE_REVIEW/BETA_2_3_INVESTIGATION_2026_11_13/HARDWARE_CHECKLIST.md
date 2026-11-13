# Owner hardware validation — all checks pending

Test S1 first (scale-only), then SP1 (same scale repair plus renderer changes) on separate copied Sets. Preserve frozen Test18 ZIP/installed source. One MF_SEQ surface on the original Twister ports; no simultaneous baseline/candidate surface. No Utility/firmware changes. Record OS, exact Live version, firmware/Utility export, MIDI port settings, BPM, Set/clip size, USB topology and active surfaces. Test Live12.4.16 and Live13.0b24 separately; the earlier supplied log is Live13, not proof of Live12 behavior.

## Scale priority

- [ ] Runtime log identifies Clip scale owner or explicit Song proxy. Confirm available root_note, scale_name, scale_mode, scale_intervals and each add/remove/has listener method. Public M4L support does not prove Python exposure.
- [ ] OFF: C,C#,D,D#... and reverse; pitch bounds MIDI36..72 unchanged. Fold/highlight toggles must not substitute for Scale Awareness.
- [ ] ON: C Major, D Major, D Minor, D Dorian. Change root/type while stopped and playing; next pitch edit follows the new scale without reload.
- [ ] Toggle OFF/ON repeatedly with long notes/ties present: no notes retuned, created, deleted or shortened by the setting change itself. Actual edits preserve native IDs and metadata except pitch.
- [ ] Select clips/tracks with different contexts, audio/empty slots, device/clip view, deleted clips and Set reload. Verify exact edited clip's scale, no stale source, no duplicate listeners after repeated switches/reloads.
- [ ] Missing/invalid API: explicit unsupported warning and blocked pitch edit; never silent C Major. Confirm whether a separate controller-owned fallback is wanted before assigning a gesture.

## Frozen controls and rendering

- [ ] Both press and release orders: E13-first+E1/E2/E3/E4 selects bars; E16-first+E1 toggles Follow. No accidental note/tie edits.
- [ ] E1-first+E13 press/turn parameter selection; E14 Notes/PARAM; E15 press loop length and turn loop start; E16 turn edit page. CC1 excluded. All note/probability preset gestures unchanged.
- [ ] Note entry/deletion, strict mono tie/length ownership, all pitch/velocity/probability properties, held edits, long-note multi-encoder colors, touched white ring on push/turn/release. Verify removing the second identical ring send in SP1 still overcomes hardware-local ring changes.
- [ ] Frozen palettes: velocity76/88, pitch72/108, length32/68, probability96/104; blue playhead68; working ring semantics. No channel3 brightness or Native Mode output.
- [ ] Play/stop/restart, nonzero loop start, 1/2/4-bar loops and wrap, manual bar selection while Follow enabled, resume on next start, Follow toggle resets manual pause, clip replacement and external piano-roll edits. Match Test18 state at equal observations.
- [ ] Reconnect or refresh_state: all indicators refresh. Transient read errors retain the last known display; recover without a growing callback/listener queue.

## Performance measurement

- [ ] Run 90/120/160/200 BPM x 1/2/4-bar loops, Follow ON/OFF, matched note content and modes. Repeat at startup and 5/15/30/60 minutes in alternating baseline/candidate order. Add a large Set and rapid encoder/entry stress case.
- [ ] In disposable instrumented copies, place runtime_probe.py beside MF_SEQ.py and add its documented attach call after initial scheduling. The adapter adds no clock/listener/MIDI. Collect `MF SEQ PERF` 10-second logs. Record actual tick gaps and handler wall time, note reads, submitted MIDI, full-render calls and duplicate submissions. Profiling overhead is part of the measurement; do not compare instrumented versus uninstrumented builds.
- [ ] Capture actual output MIDI timestamps externally; script submission counts are not USB wire traffic. Synchronize input/output timestamps and video before measuring encoder-to-note/LED latency. Report p50/p95/max with measurement resolution.
- [ ] Determine actual update_display/scheduled callback cadence. A 10Hz model misses steps above 150BPM; this prototype does not install a faster timer. Count missed observed transitions and sustained blue step visibility at fast tempos; never claim sample-accurate display.
- [ ] Log actual Live CPU meter separately. Mock Python execution timings are not Live CPU measurements. No accumulated-latency cause is established by the synthetic model.

## Future research / integration

- [ ] Review four-breakpoint CC probe before use on an empty disposable Session envelope. Inspect, edit, switch clips, save/reload and capture actual CC1 after the device; no success claim from mock readback.
- [ ] Approve canonical timing persistence, swing units/collision policy and nudge/reset defaults/gestures before any production timing or bulk reset implementation.
- [ ] CROSS-BANK REVIEW REQUIRED for combining listener lifecycle, LED refresh changes, MIDI/native-mode conventions or Bank3 integration. Standalone Bank3 remains distinct from combined Bank3 Session View. No automatic merge.
