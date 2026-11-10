# Issue #5 — Modded Mackie Control transport research
Date: 2026-11-10. Research only; approval required before fixes.

## Evidence and version boundaries
Reviewed [issue #5 and its hardware-history comment](https://github.com/solidtakes/Music-Development-Projects/issues/5), [fork baseline record](https://github.com/solidtakes/Music-Development-Projects/blob/f286ae5179a382f1e19c6b6c2f668e4f69c31387/Modded_Mackie_Control/Transport_Research/BUILD_STATUS.md), main history through f286ae5179a382f1e19c6b6c2f668e4f69c31387, all 11 current branch trees without truncation, and research/sac2k-mcu-reference at 452ad8d9e32fd18bdcb1023e684f27b5e2c0434e with its history. No project Python transport implementation or raw logs were present. A Desktop filename search found no SAC2K/Mackie or named v0.1.20/27/28 artifacts; other locations and deleted history are not ruled out.

The independent fork is v0.1.0 derived from Radikal v0.1.20, import folder Modded_Mackie_Control, recorded ZIP SHA256 8131ec562ce68dd2a9c83b5801b657d39b3b50b09773fce8fdcd511bbc61b1bd. Its source/archive is not committed. Experimental v0.1.27/v0.1.28 transport is explicitly NOT integrated. Issue #5 targets experimental behavior; it is not evidence that fork v0.1.0 contains that implementation. Recorded syntax/ZIP validation is not a hardware pass or validation performed here.

The issue requests investigation of held-note asymmetry, legacy repeat state, CC60 jog, jump_by/start_playing and playback-marker divergence. These are investigation leads, not findings from inspected Python.

## API facts and implications
The primary [Cycling ’74 Song reference](https://docs.cycling74.com/apiref/lom/song/) distinguishes playing position (current_song_time), playback start position (start_time), relative movement (jump_by), starting from the insert marker (start_playing), and resuming the current position (continue_playing). It currently describes scrub_by as equivalent to jump_by. This Max for Live reference supports a position-semantics hypothesis; it does not establish identical availability or side effects in every private Python API/Live build.

Inference: moving current position then invoking start_playing may resume from a different insert position. That can explain a jog/start mismatch without explaining runaway repeat. Merely substituting scrub_by is not a demonstrated remedy. Do not assume assigning start_time synchronizes every UI marker, or change marker state without verifying the version-specific behavior and intended user contract.

The user recalls a similar older jog/green-indicator issue fixed around Live 10 or 11; the version and mechanism remain unverified. No authenticated version-matched stock Live 10/11/current source or reproductions were available in this repository. The earlier reference index links a third-party Live 9-era source archive; its presence does not authenticate modern stock behavior. No cross-version fix attribution is justified.

## Ranked hypotheses and recommendations
| Priority | Candidate cause and discriminating evidence | Proposed solution if confirmed | Risk | Difficulty |
|---|---|---|---|---|
| P0 | Unknown loaded version / missing v0.1.27 source prevents reproducing exact dispatch | Obtain experimental source and dependencies, baseline fork, exact Live build and loaded import path; diff before changes | Low | Low–medium |
| P1 | Press reaches stock repeat owner while release is consumed by custom handler, or custom repeat starts and never receives release; trace raw release through each dispatch boundary | Give each gesture one owner across both edges; normalize true note-off and note-on-zero; prevent unmatched stock press/custom release | High | Medium |
| P1 | Stock timer and custom scheduler both seek, or queued callback runs after release/stop | Choose a single repeat owner; explicitly terminate its state and invalidate stale scheduled callbacks on release, stop and disconnect | High | Medium–high |
| P1 | FF during playback invokes playback-start or a repeated resume operation; trace each API call against is_playing | Seek during running transport without repeatedly restarting it; define stopped-seek/play semantics separately | High | Medium |
| P2 | Jog/seek updates current position but Play uses an unchanged insert/start position | Follow version-matched stock mechanism if proven; evaluate explicit resume vs marker synchronization only against agreed behavior | High | High |
| P2 | CC60 direction/magnitude decoding or modifier routing differs from stock; equal-magnitude opposite steps fail to cancel | Reuse verified decoder/routing, preserve sensitivity and do not treat relative CC as absolute position | Medium | Medium |

The strongest first lead is ownership asymmetry, because it can sustain seeking after physical release. It remains unconfirmed until both source dispatch and raw MIDI demonstrate it. Competing causes include missing device release messages, duplicate Control Surface assignments, MIDI loopback, or callbacks with stale state. A changed green indicator alone cannot identify which cause occurred.

### Required transport invariants for a future proposal
- One press starts at most one repeat process. Each input release closes its matching held gesture; duplicate release is harmless.
- Track active FF and REW independently. Specify simultaneous-button policy (neutral while both held, or last direction wins); do not invent it silently. Releasing either must not leave an unowned direction.
- Stop/disconnect/reload terminate all repeat ownership and callbacks; stale callbacks must check an invalidated generation/lifetime before accessing Live.
- Note-on-zero and true note-off converge on the same release semantics. Modifier changes during a hold do not strand the original owner.
- During playback, every seek has an attributable input/timer cause; normal playback progression is distinguished from post-release repeated jumps.
- Never catch and hide all exceptions as “success”; preserve diagnostic exceptions and state-reset evidence.

These are design criteria, not edits to stock code. Exact stop/disconnect hooks and scheduler cancellation capabilities require inspection.

## Comparison and regression matrix
No matrix entry has been executed. Compare stock and custom with the same Set, ports, controller and Live build, one active surface at a time.
| Scenario | Record / expected evidence |
|---|---|
| FF and REW separately, tap and hold, stopped and playing | Raw press/release, owner transitions, scheduled ticks, API calls, is_playing and time trajectory; no seek ticks after release |
| Both buttons, both press/release orders | Defined direction policy and empty held state after both releases |
| Modifier pressed/released during hold | Original owner still receives termination; no new orphan repeat |
| Stop while held; release after Stop | No repeated seek after Stop; later release harmless; next independent gesture works |
| Disconnect/reload while held | No callback accesses disconnected objects or resumes seeking after reload |
| Note-on-zero and true note-off, duplicates | Equivalent releases and one action per intended edge |
| Jog CC60 both directions/speeds, SCRUB/SHIFT variants | Decoder, selected target and before/after current/start times; no spontaneous playback |
| Jog stopped → Play, then Stop → Play | UI insert marker, green indicator location and actual start compared; screenshot/video plus numeric times |
| FF while playing, release, Stop, Play | Continuous playback preserved unless explicitly intended; restart origin documented |
| Start of Set, loop enabled/disabled, alternate meter/tempo | Boundary handling and beat/bar units verified, no negative time or accidental loop edit |
| Empty Set, Arrangement selection and Session clips | Scope-specific behavior distinguished; no accidental Session launches |
| Single active surface vs existing configuration | Detect duplicate dispatch/loopback without altering stable script |

For history comparison obtain stock MackieControl and dependencies for exact Live 9, 10, 11 and user's current build where legally available. Compare receive_midi routing → transport button dispatch → repeat callback/update_display → jog handler → Play command. Record archive/source hashes and version provenance. Mark unavailable cells explicitly. Reproduce the remembered problem before claiming a version fixed it; distinguish a script change from a Live engine/UI change. No matching stock source comparison could be completed with the supplied materials.

Offline event replay can test ownership, callback cancellation and edge handling. Only actual Live/controller validation can establish MIDI release behavior, playback-position semantics, LED/UI outcomes and feel.

## Missing materials / targeted request
1. Complete experimental v0.1.27 and v0.1.28 packages and last known pre-experiment package, including __init__, main controller/receive_midi, transport, constants and imported stock components; provide original filenames and changelog/diffs.
2. Separate Modded_Mackie_Control v0.1.0 archive matching the recorded SHA, plus exact loaded script folder and import path. Do not replace Radikal stable.
3. Version-matched stock MackieControl transport, dispatcher and dependencies from installed Live 10/11/current (and older affected version if available), exact build numbers and lawful source provenance.
4. Sanitized Live Log.txt with exceptions and a timestamped two-direction MIDI capture from initialization through FF hold/release, runaway, Stop and jog→Play; identify ports and all configured surfaces.
5. Minimal Set, exact reproduction steps, firmware/emulation mode, controller physical labels and video showing the green indicator, insert marker and playhead. State whether “runaway” means repeated jumps, continuing playback, an increasing seek rate or start-position snapback.
6. For future approved instrumentation: log event/owner/generation, repeat flags, callback entry, jump/start/resume calls, is_playing and readable current_song_time/start_time before/after each action. Do not collect unrelated private Set contents.

## Approval-gated plan
First secure sources and prove the loaded version. Next review ownership and compare stock call paths; present a minimal isolated change and expected behavior for approval. Address release/repeat cleanup before marker semantics, then evaluate a separate position-policy change if evidence requires it. Validate offline invariants and a bounded user-approved hardware/Live matrix against separate stock and fork baselines. Never port experimental handlers into Radikal Main Build or alter its FF/REW/jog behavior. No working scripts, imports, stable builds or branch merges changed here.
