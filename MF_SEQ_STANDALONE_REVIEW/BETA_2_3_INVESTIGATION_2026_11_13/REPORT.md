# Beta 2.3 investigation — scale synchronization first, playback performance second

**Review candidates only. No merge, deployment, or new hardware acceptance.** Start hardware review with **S1 (scale-only)**. SP1 contains the same scale patch plus an independently measured renderer prototype. P1 source is retained solely as a benchmark fixture isolating renderer changes; it retains the old scale bug and is not a recommended installation. The earlier Test14 experiment is not used as a baseline or copied into these builds.

## Provenance verified

| Check | Result |
|---|---|
| Frozen owner-accepted commit | `33cb440328c6226bf26c09fc60eac33f0530c7d3` |
| Uploaded ZIP | MF_SEQ_BETA_2_3_FROZEN_TEST18.zip, 14,971 bytes |
| ZIP SHA256 | `38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c` — MATCH |
| MF_SEQ/MF_SEQ.py SHA256 | `270460564e5fb765ef4e7d86e4fefb5c2b69926445d9bec66358160c69d6c1a8` — MATCH |
| Git source blob SHA1 | `18283f1b0e3e4eeb7c99d67548f36248a7935d7f` — matches actual uploaded bytes |
| Git ZIP blob SHA1 | `4007d62b7c9bb54fa94dd2901e93cbf255d85ed2` — matches actual uploaded bytes |
| ZIP CRC/layout, package Python syntax | PASS; Python3.12 host syntax check, not Live12/13 runtime certification |
| Hardware mapping in source | Standalone Bank3 CC32–47, rotary channel12 / push-RGB channel11, 63 down / 65 up; unchanged |
| Scope | Bank3 standalone only; distinct from combined project's Bank3 Session View |

The archive's historical README says Test18 was not hardware validated at build time; the later owner-accepted freeze manifest supplies the acceptance status. We do not infer new tests from that status. The restoration/unblock documents and exact source/ZIP exist on investigation branch commit `0372d2f99de6b37c5c806b3bd16680f89e55c863`; scale/reset addendums were read at `b7ce38c776dd3ee71e7da7009ee7a320298780e1`. Original uploaded ZIP and restored Git source are untouched.

## Conflicts found and disposition, before scale edits

The owner-reported regression is source-confirmed: frozen lines26–38 define C Major constants; lines947–956 always filter against those constants; line971 calls that path unconditionally. There is no branch for Live Scale Awareness OFF, and no dynamic root/type subscriptions. P1 retained the same pitch path to isolate performance measurements, so it also failed the new scale requirement. This was reported before applying the scale repair. S1/SP1 replace that path; P1 remains a labelled audit fixture only.

Scale highlighting/Fold-to-Scale are display options, not the enable signal. Target clip scale and Song's current-scale proxy can differ. Official release notes expose clip scale properties in M4L from12.4.15, while the consulted generic Clip LOM page and supplementary Python runtime reference omit them. Therefore availability and observer support are checked at runtime rather than assumed from version strings. Actual Python exposure on Live12.4.16 and Live13 remains a validation gate.

**CROSS-BANK REVIEW REQUIRED:** S1/SP1 own read-only Song/View/Clip listeners; SP1 changes standalone LED refresh ordering/cache behavior. No shared bank dispatcher, routing, Native Mode, palette, firmware, or other-bank implementation is changed. Owner authorization covers these isolated fixes, not integration. No original source/ZIP/freeze manifest is replaced.

## Scale patch — S1

`scale/MF_SEQ/scale_sync.py` is a read-only adapter. It prefers exposed scale properties on the exact edit-target clip. If those are absent, Song proxy is permitted only when detail_clip equals the edited clip, and the proxy path is explicit in logs. A mismatched/ambiguous/unsupported context blocks pitch edits and reports the limitation; it never silently selects C Major. A future controller-owned fallback would be an explicitly selected mode requiring owner approval, not an automatic substitute.

- Scale OFF: chromatic semitones within frozen MIDI36..72 bounds.
- Scale ON: current root and interval mask, obtained from Live; no hardcoded scale-name table. Major/Minor/Dorian changes and root changes affect the next edit.
- Available add/remove listeners for scale_mode, root_note, scale_name and scale_intervals; selection observers for detail_clip, highlighted_clip_slot and selected_track. Callbacks only mark the small context cache dirty.
- Missing observers: bounded four-existing-tick polling and immediate small-state read on the next requested pitch edit. With full observers, steady unchanged ticks do not reread scale values.
- Rebinding handles clip and Song replacement. Duplicate attachments are avoided; only this adapter's registrations are removed on switch/unload. No note listener, timer or thread is added.
- Mask recomputation happens on changed effective state. Notifications do not touch native notes, note data refresh flags or LEDs. Existing note creation still uses the frozen default pitch; this repair changes pitch editing, not creation defaults.

MF_SEQ changes are import/construction, tick and disconnect hooks, target-aware pitch helper and forwarding the already-resolved clip from _adjust_pitch. All existing input dispatch/chords, palette constants, note/tie/velocity/probability/length logic, loop controls, Follow and pitch bounds remain intact. New scale settings alone never quantize, retune, delete or recreate notes.

## Playback source audit and ranked changes

Source references below are frozen MF_SEQ.py unless stated otherwise.

| Rank | Observation/evidence | Action / status |
|---|---|---|
| 1 | _tick1049–1234 reads/scans notes periodically even unchanged, with full16-RGB/16-ring render attempts; _dirty covers both musical edits and page changes | P1/SP1 separate primitive display-note cache from render context, preserve four-tick external note polling, mark real edits as note-dirty, render from cache on page changes |
| 2 | Follow1075–1098 and playhead1102–1113 independently read playback/meter/loop | P1/SP1 share one timing snapshot per callback. No faster callback rate implied |
| 3 | Ring pass1220 onward invalidates a touched ring, sends it, then invalidates/sends it a second time in the same callback | P1/SP1 keep one authoritative touched-ring send after RGB. Focused mock: 2 identical ring CCs becomes1; hardware-local ring interaction still needs testing |
| 4 | Existing _led984 / _white_ring996 already suppress identical values | Retained. Standard playback MIDI volume is unchanged, not a claimed bandwidth improvement |
| 5 | Follow sets page only when playback bar changes | Already correct at source; retained. Baseline page-driven _dirty can add/reset periodic note scans at some BPMs, not an unbounded redraw loop |
| 6 | Constructor81 seeds one schedule_message; finally1234 schedules one successor; disconnect83 sets stop flag | No buildup in model. No new timer/thread; no update_display override added. Actual inherited framework cadence must be captured on Live |
| 7 | _target392 and _track_for_slot419 scan tracks/slots on every callback and edit | Remaining large-Set risk; no persistent target cache or listener redesign without evidence for safe invalidation |
| 8 | Real edits always read full native note vector through _read472 | Preserved for correctness. Native vector acquisition/copy dominates parts of the mock; no claim of proven Live CPU reduction |

SP1 cache invalidation covers clip, page, loop/meter, transport state and explicit refresh_state. Only primitive display fields are cached; every musical edit still uses a fresh native MidiNoteVector. External piano-roll changes remain discoverable at the original four-tick interval. Failed note reads preserve last display and retry on the bounded interval. No notes/property metadata is written by rendering.

## Measured benchmarks — synthetic, not Ableton/hardware results

`comparison.json` contains four builds x14 cases: 90/120/160/200 BPM x1/2/4 bars, plus nonzero loop origin and an illustrative20Hz cadence. Every standard case advances **60 simulated seconds at assumed10Hz**, with64 synthetic notes and Follow ON. Counters include model property reads, native-vector stand-ins, _send_midi submissions/duplicates, full render passes, page changes, expected/observed straight-grid positions, handler host timings and10-second work windows. Timing fields include mock/profiling overhead and variable host load.

| 120 BPM /4 bars /60 simulated seconds, fallback observers absent | Frozen | P1 renderer fixture | S1 scale-only | SP1 combined |
|---|---:|---:|---:|---:|
| Counted model property reads | 67,950 | 67,500 | 68,702 | 68,252 |
| Note-vector reads | 150 | 150 | 150 | 150 |
| Full16-step render passes | 150 | 30 | 150 | 30 |
| Submitted MIDI messages | 1,454 | 1,454 | 1,454 | 1,454 |
| Identical-value duplicate submissions in standard case | 0 | 0 | 0 | 0 |
| Missed model positions | 0 | 0 | 0 | 0 |

With full mock Clip/Song/View observers (`observer_benchmark.json`), S1 counted67,955 property reads and SP1 67,505: only five scale-property reads at initial binding, instead of steady scale polling. This is a mock observer contract, not measured listener behavior on Live.

Across the standard tempo/loop matrix, frozen full renders range150–160; P1/SP1 range1–51. Note polling is150/minute in P1/SP1; frozen ranges150–160 because page changes can reset/add scans. At200BPM/4bars, full renders150→50; normal MIDI submissions2,008→2,008. No increasing per-window queue or recurring workload was established in these fixtures. Callbacks remained one queued successor; a2,000-tick soak and disconnect fixture passed. Reduced render work is demonstrated; lower end-to-end latency or Live CPU usage is **not** demonstrated. Host p50/p95 values vary and are not a promotion criterion.

### Polling ceiling and missed positions

At assumed10Hz, all builds share the same sampled playhead state at every tested point. Expected/observed position counts include initialization and end at the last sampled instant, not the unsampled end of the minute. For1/2/4-bar loops, missed positions were0 at90 and120BPM,39 at160BPM and211 at200BPM. At200BPM the sampling-capacity lower bound alone is199 misses; the difference also includes floating-point boundary behavior inherited from Test18. No boundary epsilon or musical timing change was introduced in this performance patch.

A model at20Hz observes all positions in the200BPM case, but **the prototype does not install or promise a20Hz scheduler**. Actual update_display/scheduled callback cadence and LED wire latency remain unknown. No sample-accurate visual tracking claim. The script may submit the new playhead color before note scanning while still missing entire positions between callbacks.

## Automated evidence

- **11 scale contract groups passed**, both S1/SP1: regression reproduction, OFF/ON, C→D, Major→Minor/Dorian, next-edit update, no notification-driven note/MIDI work, metadata preservation, clip/Song replacement, foreign listener retention, repeated attachment, disconnect/reload, absent-observer fallback, stale Song proxy, unavailable API, bounds, stopped/playing, independent fold/highlight and invalid scales.
- **10 frozen/performance regression groups passed** on SP1: identical frozen input AST/constant tests, every-sample playback comparison across tempo/loop/origin fixtures,480 ordered chord/release fixtures, native-vector musical edits, ties/length ownership, all modes/non4/4 display, loop shift/stop/restart/clip replacement/external edits, touched-ring output, reconnect, read failure, callback soak/disconnect.
- **2 runtime-probe contract groups passed**: no extra MIDI or callback chain, bounded log flush on existing ticks, attach idempotence and detach.
- **5 separate research model groups passed**: swing formula, canonical idempotence/zero restoration, nudge/bounds/collisions/ties and four-step CC probe ownership/readback. These do not validate a real CC API, musical swing or persisted clip data.

No Ableton application or Twister is attached to this Linux execution workspace. Live12.4.16 and Live13 runtime, visual colors/ring timing, saved Set persistence and USB measurements are NOT RUN. The earlier Live13 Probability log is historical evidence, not a new test of these candidates. A newer Git roadmap commit (7af81054cb7f61c381a18d25096968e15c2cad3f) records tie restoration as approved roadmap behavior, but the latest direct chat instruction withdrew that suggestion. Direct chat instruction takes precedence for this implementation: no tie-restoration change was made, and the roadmap file was not edited. Reconcile that discrepancy before future restoration work.

## Files, reproduction and review

S1 and SP1 ZIPs contain only their MF_SEQ package (MF_SEQ.py, unchanged __init__.py, scale_sync.py). SHA256SUMS records exact source/ZIP/review-file hashes. Diffs include new helper modules. Frozen baseline bytes remain at the existing `../BETA_2_3_TEST18_SOURCE/` path on the investigation branch; no extra baseline archive is substituted here.

From this review directory:

```sh
python verify_baseline.py ../BETA_2_3_TEST18_SOURCE/MF_SEQ_BETA_2_3_FROZEN_TEST18.zip
python scale_tests.py
python regressions.py combined/MF_SEQ/MF_SEQ.py
python probe_tests.py
python benchmark.py comparison.json baseline:baseline/MF_SEQ/MF_SEQ.py performance_P1:prototype/MF_SEQ/MF_SEQ.py scale_S1:scale/MF_SEQ/MF_SEQ.py scale_performance_SP1:combined/MF_SEQ/MF_SEQ.py
cd research
python test_research.py
```

Commands regenerate local results, not stable source. See HARDWARE_CHECKLIST.md for actual Live profiling/capture and CHANGELOG_ROLLBACK.md for exact changes/rollback. RESEARCH.md covers the distinct swing, nudge/reset and CC/modulation investigations and their approval/persistence gates. No new production reset, swing, nudge, modulation or CC gesture is assigned.

Remaining blockers to promotion: actual Python scale API/observer confirmation on both target Live versions, Song-proxy context validation, physical touched-ring behavior after single resend, actual callback cadence/CPU/MIDI/latency measurements, owner hardware acceptance and independent integration review. Canonical timing persistence and reset defaults/gestures need owner decisions before live timing/reset implementation.
