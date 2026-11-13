# MF Step Sequencer v1.5.0 — standalone review candidate

Status: implementation for review only. No integration, deployment, merge, firmware change, or Ableton/hardware acceptance. v2 Automation Mode excluded. Only MF_SEQ/MF_SEQ.py changes; MF_SEQ/__init__.py is byte-identical. Existing repository source and all bank implementations remain untouched by this additive review package.

## Baseline and authority

Baseline supplied by the user for this task: MF_SEQ_V1.4.9_E1_E16_VIEW_GESTURE_TEST.zip.
SHA256: `65c88cb585d7dca3a424f800d2969e00fa5fa7a814b9b392c2c42f3523db49e4`.
Its CHANGELOG_TEST.md describes v1.4.9; the Python banner still says v1.4.8. Its own changelog says Ableton/hardware NOT TESTED. User supplied it in response to the baseline request; independent verification or a hardware sign-off was not supplied. This candidate uses those exact source bytes rather than inventing or reconstructing a baseline from GitHub. The earlier v1.4.8 ZIP is not used for implementation. Both uploaded archives remain unchanged.

Repository context inspected at development-branch commit `4f9f8cd3ee0da218f88d0f4e220e230e5e43d9e1` (bento/beta-v2-freeze-20261112). Recursive tree contained no AGENTS.md and no MF_SEQ source or v1.4.9 ZIP. Historical documents and attached changelogs are evidence; the user's current task defines the work authorized here.

## Source audit and evidence

Line references below refer to baseline MF_SEQ/MF_SEQ.py, retained in baseline/.

| Finding | Evidence | Assessment / action |
|---|---|---|
| Repeated LOM timing reads in render loops | _tick, lines 496–531, repeatedly calls _page_start, _step_time and _bar_beats for every note and step | Measured in mocks. Snapshot meter, page boundaries and 16 step times once per scan. No persistent timing cache, so subsequent scans see meter/loop edits. |
| Eager song signature reads even when clip has its own meter | _bar_beats, lines 210–211: Python evaluates getattr default arguments before the call | Measured in mocks. Fetch song meter only for missing clip fields. |
| Fresh equivalent clip wrappers defeat scan throttling | _tick, line 448: `clip is not self._last_clip` sets dirty and resets display caches | Conditional bottleneck: reproduced with an explicit equivalent-wrapper model. Compare identity, then equality; equality failure refreshes conservatively. Live's equality behavior must be confirmed. |
| Callback lifecycle | Constructor line 61 schedules once; _tick finally line 544 unconditionally schedules successor; disconnect lines 63–70 has no script-owned stop flag | No accumulating chain observed during mock normal operation. The harness deliberately leaves pending callbacks on disconnect; baseline resurrects LED output and retains one successor, candidate does neither. Real framework may already cancel callbacks. |
| Redundant intermediate RGB output | Playhead restoration lines 477–482 sends cached old-step color before a due scan sends its new color at lines 537–538 | Measured targeted deletion+playhead test: 4 total MIDI CCs becomes 3, same final RGB/rings. Candidate lights new playhead before note scan and restores old step from fresh scan colors. On scan failure it restores from preserved display cache. |
| Existing MIDI deduplication | _led / _white_ring lines 416–430 cache last values | Retained. No steady-playback MIDI-volume improvement observed in the standard workload. |
| Full note vectors for edits | _read line 249; _adjust_velocity/_adjust_pitch use original vector in modification calls | Retained deliberately. No scoped native-vector API experiments without Live validation; mocks enforce original-vector identity but cannot validate the C++ binding. Each edit still reads current clip notes; no stale edit cache. |
| Track/slot search on tick and each edit | _target / _track_for_slot lines 171–205 | Remaining scaling risk in large Sets. No persistent slot-to-track cache added: safe invalidation would require verified LOM identity/lifecycle behavior. |
| UI feedback per successful detent | _adjust_velocity/_adjust_pitch show_message calls | Remaining possible high-rate UI work. No status throttling or gesture coalescing introduced. Encoder edit behavior and detent resolution unchanged. |
| Double-click processing | v1.4.9 has no DOUBLE_CLICK_TICKS, pending-tap state, or double-click state | Already removed in baseline; verified absent in candidate. Do not claim v1.5.0 removed it. |

Increasing command latency over real session time is **not diagnosed** by these tests. Normal mock callback and MIDI work rates remain stable across equal windows. Potential real causes needing capture include repeated surface instances, other scripts sharing output, Live scheduler/USB backlog, large Sets and full note-vector costs. They are hypotheses, not established causes.

## Exact changes / changelog

- Correct source banner to v1.5.0 review candidate.
- Add disconnect flag before LED cleanup; late queued tick returns without work or rescheduling.
- Compare equivalent clip wrappers conservatively rather than solely Python identity.
- Eliminate eager song-meter defaults when clip meter is present.
- Calculate step length once for playhead; snapshot render timing once per scan.
- On scan ticks, omit intermediate old-playhead RGB restoration; final scan restores its fresh color. Keep new playhead feedback before scanning and white rings after RGB.
- Remove unused _last_slot and _last_note_signature fields.

No changes to receive_midi, build_midi_map, note-vector acquisition/modification, scale definitions, note colors, four-page limit, chord handling, note/tie editing or display polling interval. Patch included as changes.patch.

## Mapping and cross-bank boundary

Source mapping, preserved byte-for-byte: rotary MIDI channel 12 (zero-based 11); push/RGB channel 11 (zero-based 10); CC48–63; relative rotary down=63, up=65; CC Hold presses positive and releases zero. White-ring output stays on rotary channel, RGB on push channel.

Repository HARDWARE_CONFIGURATION_ACTIVE_2026-11-11.md records user-confirmed Relative ENC 3FH/41H and CC Hold across 64 controls, but its historical CC plan associates 48–63 with Bank 4 and leaves Bank 2 channels unverified. HANDOFF_BANK_2_STEP_SEQUENCER_V1_2026-11-12.md warns against importing older Bank 4 mappings. The two-bank owner test report does not contain combined source, hash or a capture. Thus documentation supports rotary/push semantics, but **does not establish this source's physical Bank 2 assignment**. No mapping change or physical-bank verification is claimed. Obtain current Utility export plus raw incoming/outgoing MIDI capture before any routing change.

**CROSS-BANK REVIEW REQUIRED** for adopting the LED refresh ordering or disconnect lifecycle into any shared controller. This standalone candidate introduces no shared routing, listeners, helpers or bank-switch code. Different CCs alone do not prove isolation. No combined build was assembled and no other bank was edited. A draft review submission is not authorization to merge or deploy.

## Automated measurements

See results.json for exact counts, 500-tick windows, Python version and mock host timings. The harness uses Python 3.12, a FIFO tick queue, a Python native-vector stand-in and counted property accesses. It imposes no real Live scheduler delay, LOM cost, MIDI bandwidth or USB timing. Results demonstrate workload reductions in this model only.

2,000 simulated playing ticks, 16 notes, one page, playhead advances one step per four ticks:

| Metric | v1.4.9 | v1.5.0 |
|---|---:|---:|
| Clip timing-property reads, stable wrappers | 632,000 | 17,500 |
| Song signature reads, stable wrappers | 491,000 | 0 |
| Note-vector reads, stable wrappers | 500 | 500 |
| Note-vector reads, fresh equivalent wrappers | 2,000 | 500 |
| Clip timing-property reads, fresh equivalent wrappers | 2,480,000 | 17,500 |
| Steady-playback MIDI CCs, either wrapper case | 1,030 | 1,030 |
| Maximum queued callbacks | 1 | 1 |
| Queued successors after disconnect + one late callback | 1 | 0 |
| MIDI CCs from that late callback after disconnect | 32 | 0 |
| Targeted old-step deletion + playhead move (separate case) | 4 | 3 |

Each 500-tick steady window contains 125 scans (baseline fresh-wrapper case: 500). The first window has 280 MIDI messages including initial output; each following window has 250 for both builds. No increasing mock queue length or per-window MIDI rate was observed. The candidate also passed a 20,000-tick soak with exactly one queued successor until disconnect. Host p50/p95 tick microseconds are in results.json for reproduction, but include Python profiling/mocking overhead and must not be interpreted as Live response times or claimed hardware speedups. No actual note-entry-to-LED, encoder-to-note, or end-to-end latency measurements were feasible in this Linux environment without Ableton and the Twister.

## Regression results and reproduction

All 10 test groups passed, including 60 deterministic baseline/candidate rendering comparisons. Coverage includes immediate E1 release, repeated E1 taps, both chord release orders, both modes, E14/E15 page limits, page-4 loop extension, velocity, four-detent pitch, scale boundaries, reversal, held turn, ties, ambiguous notes, native-vector identity, exact forwarded channel/CC set, rejected inputs, steady LED deduplication, external note edits, clip change, audio rejection, empty-slot creation, non-4/4 meters, chords/off-grid display, failure-path display retention, callback lifecycle, meter fallback and equality failure.

From this directory with Python 3 (no third-party dependencies):

```sh
python verify.py baseline/MF_SEQ/MF_SEQ.py candidate/MF_SEQ/MF_SEQ.py
```

The command rewrites results.json with current-host measurements. Syntax is checked for both package files; ZIP inventory contains only MF_SEQ/MF_SEQ.py and MF_SEQ/__init__.py, with no __pycache__. Source AST checks confirm executable MIDI mapping/gesture/edit functions and constants are unchanged. Full baseline ZIP included for reproducibility and rollback; never overwrite the user's retained working archive.

Limits: fake vectors do not validate Live bindings; simulated wrapper equality does not prove real wrapper equality; this harness deliberately omits framework cancellation to expose lifecycle behavior. It is not a test of bank switching, physical colors, USB load or other surfaces. Existing selected-clip-on-release gesture targeting remains unchanged; switching clips while a button is held needs explicit hardware regression attention.

## Ableton / hardware acceptance checklist — NOT RUN

Record Live version, OS, Set/clip size, BPM, sample rate/buffer, USB topology, active surfaces, Utility export/hash and raw timestamped MIDI captures. Use a copied Set and one standalone MF_SEQ surface. Preserve the working installed script separately; do not run baseline and candidate together on the same MIDI ports.

- [ ] Capture E1–E16 push/release/rotary on the actual sequencer bank. Verify channels, CC48–63 and 63/65 relative values; resolve historical Bank 2/Bank 4 discrepancy before any mapping change.
- [ ] Compare baseline and candidate under identical conditions at startup, 5, 15, 30 and 60 minutes. Repeat runs in alternating order. Measure incoming MIDI-to-note change and incoming MIDI-to-outgoing LED CC timestamps (p50/p95/max); use high-frame-rate video if no synchronized Live event trace is available. State clock alignment and measurement resolution.
- [ ] Capture outbound MIDI counts per minute and by channel/CC; separate normal playback, rapid entry, 100-detent encoder bursts, mode changes and page changes. Check for flat-rate operation and no duplicate script producers.
- [ ] Verify E1 tap and quick double taps edit notes on release with no delayed mode switch. E1+E16 switches Velocity/Pitch only; E1+E15 previous, E1+E14 next, both release orders. No chord creates/deletes a note.
- [ ] Verify all steps, velocity/pitch limits, four-detent pitch and reversal, push+turn, ties/overlap rejection, scale awareness, four-bar cap, page-4 loop extension, original native-vector metadata and polyphonic-step safeguards.
- [ ] Verify playhead at slow/fast tempos, RGB colors, rings, tied notes from prior pages, start/stop, external piano-roll edits and meter/loop changes. Confirm old-playhead restoration timing on a scan tick remains visually smooth.
- [ ] Change selected clip/track, delete/recreate clips and slots, switch while holding controls, use audio tracks/empty slots; verify no stale edit or stuck LED. This candidate does not redesign held-target semantics.
- [ ] Repeatedly load/unload/reload surface and close/open Set; verify no late LED output or continuing tick work after disconnect. Confirm actual framework cancellation and equivalent-wrapper behavior.
- [ ] In a separate owner-authorized integration exercise, verify bank-switch LED ownership and held-button cleanup and all frozen Bank 1 functions. CROSS-BANK REVIEW REQUIRED; combined integration is outside this standalone review.

## Rollback

1. Stop playback and quit Live before changing installed Remote Scripts.
2. Move the candidate MF_SEQ installation aside; restore the previously working MF_SEQ directory from a separately preserved installation or the unchanged supplied v1.4.9 ZIP. Do not overwrite or delete the original ZIP. Use one installed MF_SEQ surface, with the same original ports/settings.
3. Verify restored source/ZIP hashes using SHA256SUMS and baseline archive SHA above; restart Live and check original gestures, mapping, notes and LEDs.
4. If v1.4.9 itself was not hardware-accepted, restore the actual last hardware-approved archive instead; this task cannot certify an absent build. No firmware settings, bank mappings or Live Sets were changed by producing this package.
