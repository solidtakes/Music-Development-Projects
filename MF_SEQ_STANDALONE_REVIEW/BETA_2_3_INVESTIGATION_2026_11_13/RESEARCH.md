# Separate research: swing, note nudge/reset, CC automation/modulation

None of these features is installed in S1 or SP1. CC1 stays outside the frozen Velocity/Pitch/Length/Probability cycle. No new Twister gesture is assigned. Research status: 5 offline contract groups passed; Live API calls, saved Set persistence, output routing and musical timing remain untested.

## Sequencer-owned swing — proposal and offline mathematical model

Owner decision: use sequencer-owned timing, never control Groove Pool swing. The same planned onset array must eventually drive audible clip note start times and blue-indicator boundaries. S1/SP1 deliberately retain straight-grid playback until a timing design is approved.

Let `s = 0.25` quarter-note beats in 4/4. Proposed amount A runs 0..100 **percent of maximum delay**, not Live's Groove percentage. `delta = s * 0.5 * A/100`. Delay odd zero-based sixteenth indices by delta; leave even indices unchanged.

| A | First four onset beats | Alternating intervals | Odd-note delay at 120 BPM |
|---|---|---|---:|
| 0 | 0, .25, .5, .75 | .25 / .25 | 0 ms |
| 50 | 0, .3125, .5, .8125 | .3125 / .1875 | 31.25 ms |
| 100 | 0, .375, .5, .875 | .375 / .125 | 62.5 ms |

Maximum is therefore a 75:25 division of each eighth-note pair. This is a proposed bounded convention requiring owner approval. Non-4/4 behavior and later eighth-note swing need explicit product decisions before live implementation.

`research/timing_model.py` uses canonical note start + explicit user nudge + generated swing offset. Canonical records include a separate grid-step anchor and retain user-authored microtiming. Reapply from canonical records every time; never infer the canonical position by rounding a swung note or subtracting a newly chosen amount from an unknown old amount. The offline planner is idempotent with a fixed canonical input and restores it at zero amount/zero nudge.

Preserve pitch, velocity, duration, probability, mute and arbitrary metadata. An overlap or out-of-content-bound result rejects the complete plan; do not shorten ties, remove notes, reorder musical ownership or wrap a negative onset. Tied-note duration stays unchanged and swing applies to its anchored onset only. Notes outside the active shortened loop remain content, not disposable notes.

Persistence is an unresolved design gate: a script-side dictionary is not Set persistence. Need an approved clip-associated metadata store or separately versioned, user-managed canonical snapshot with validated clip identity and note IDs. Recreated clips, duplicate IDs or ambiguous reload matching must disable automatic application. For external edits/Undo, compare current actual onsets with the last applied plan; do not reinterpret a mismatch as new canonical data without deliberate reconciliation. No automatic clip renaming or hidden note creation to store metadata.

Before a live prototype: test native start-time modification with the original MidiNoteVector, one validated batch, Undo boundaries, external edits, save/reload, duplicated clips, IDs and canonical-state recovery. Read available `has_groove`/`groove` and song groove amount to warn of potential double swing; do not write groove settings. Polling-based LEDs remain approximate, even when they share the correct boundary model.

## Nudge proposal and reset design — not production implementation

Proposed fine unit: 1/96 quarter-note beat (5.208 ms at 120 BPM); coarse unit: 4 fine units. Bound nudge to +/-6 fine units (+/-1/16 beat). The offline model tests earlier/later movement, content-start rejection, cross-bar movement and collision rejection. These are proposals, not newly accepted controls.

Allow crossing a bar boundary within the four-bar content window, keep the original canonical step identity, and do not wrap across content bounds. Precedence is canonical unswung onset (including recorded microtiming) + user nudge + swing. Collision preflight includes untouched notes; reject the entire conflicting edit. The frozen step-at-exact-start ownership code does not yet support off-grid starts, so timing writes cannot be integrated without adapting ownership/rendering and proving regression safety.

Reset proposals for owner sign-off:

- Per-note: reset only the active property on the uniquely owned existing note. Pitch default candidate MIDI60 and velocity default100 reflect current creation defaults. With Scale Awareness ON, a default pitch may be outside the scale: ask the owner whether reset means literal MIDI60 or a separate in-scale default; do not choose silently.
- Length/probability: probability candidate100%; length candidate current new-note duration (half a step). Length reset must preflight collisions and ties. These reset scopes are not authorized for implementation by the reset roadmap.
- Nudge reset removes user nudge only; swing amount reset is separate. Both require canonical-state validation.
- All-64 reset means existing owned notes across the four-bar content window, including notes outside a 1/2-bar playback loop. Never create missing notes. Collect IDs, validate the entire batch, change only the requested field in one original native vector and submit once. Verify one Undo action where the target API supports it; no 64-call loop.

All 240 ordered two-button pairs, in both release orders (480 fixtures), were compared between Test18 and SP1. `gesture_audit.json` records their effects. Reserved: E13-first+E1–E4 direct page, E16-first+E1 Follow, all E1-first press/turn modifiers, note entry, held edits and parameter presses. E16-first+E2 currently consumes an invalid backward tie; it is **not an unused gesture**. No fully conflict-free Twister assignment established. Recommend GUI-only prototype controls initially; a dedicated timing/reset layer requires owner approval. Bulk reset should use a separate deliberate confirmation action. No long-hold timer added.

## CC automation and modulation feasibility

| Route | Evidence | Current status / gate |
|---|---|---|
| Direct MIDI Ctrl CC1 clip envelope through Remote Script | No verified controller-number API established; published Python envelope signature targets DeviceParameter | Unsupported route in this investigation; do not pass raw `1` or claim a direct MIDI Ctrl lane |
| Clip automation targeting CC Control Mod Wheel | Ableton manual documents the device/automation; Python runtime reference describes lookup/create and stepped envelope methods | Four-step probe provided separately, with explicit same-track ownership and disposable empty lane; no automatic device search/insertion |
| Separate M4L CC sequencer device | Can expose an automatable parameter and emit MIDI downstream | Architecture alternative, not a built/validated device; needs licensing, routing, transport and persistence tests |
| Existing modulation devices | Current Ableton devices already cover LFO, Shaper, Expression Control, Envelope Follower, Envelope MIDI and Shaper MIDI | Reuse before inventing another smoothing/LFO engine; confirm ownership and availability in installed Live edition |

`research/cc_lane_probe.py` is inert on import. It requires explicit clip, DeviceParameter, owning track and disposable-clip confirmation. It checks Session context, refuses an existing lane, creates an envelope, inserts four 1/16 steps (0,42,85,127 in parameter-native units), and reacquires/read-checks the four values. A failed write may have changed the disposable clip; inspect/Undo. Its mock test is not real API validation. It does not send CC1 to the Twister, configure routing, change device parameters directly, create notes or activate the quarantined sequencer mode.

Native-envelope test plan: locate actual CC Control class and Mod Wheel parameter by runtime inspection; verify same track as clip, enabled state, range and method signatures on Live12.4.16 and Live13 separately. After four points, inspect the device's clip automation lane, edit a point, switch clips, stop/restart, save/close/reopen, and capture MIDI **after CC Control**, not only controller input. Distinguish clip automation from MIDI Ctrl CC1 data. Verify values/interpolation in the target instrument/hardware.

M4L alternative: expose one persisted automatable lane parameter; drive it with clip automation, generate MIDI through the track chain, and use existing transport/tempo objects. Do not use a ControlSurface timer to stream unsaved CC values. Define absolute versus relative modulation, range, smoothing, target ownership and override behavior. One owner per parameter; do not simultaneously drive it with a native envelope and another modulator. Start stepped; evaluate smoothing separately after persistence and routing pass.

## Evidence sources and limits

- [Ableton Scale Awareness manual](https://www.ableton.com/en/live-manual/12/live-concepts/#scale-awareness): clip scale settings and Control Bar relationship; highlighting/folding are separate presentation options.
- [Official Live12 release notes](https://www.ableton.com/en/release-notes/live-12/): 12.4.15 exposes four clip scale properties in M4L and fixes CcControlDevice LOM access; also documents the existing modulation-device family. This does not certify Python parity or our actual target runtime.
- [CC Control manual](https://www.ableton.com/en/live-manual/12/live-midi-effect-reference/#cc-control): native Mod Wheel control and parameter automation; concurrent CC data may merge.
- [Song LOM](https://docs.cycling74.com/apiref/lom/song/): scale_mode, root_note, scale_name and scale_intervals are observable; use clip context when available.
- [Clip LOM](https://docs.cycling74.com/apiref/lom/clip/): extended note edits; current page lags release notes for clip scale properties.
- [Python runtime signatures, supplementary/unofficial](https://midiremotescripts.structure-void.com/reference/live12/Live.Clip.runtime/) and [Envelope runtime](https://midiremotescripts.structure-void.com/reference/live12/Live.Envelope.runtime/): native vector, envelope lookup/create, insert_step and value_at_time. These are supplementary observations, not an official Python SDK or validation on Live12.4.16/13.

Actual save/reload persistence, CC output, swing/nudge sound and visual timing are all NOT RUN. Do not promote these offline models or the four-step probe into the frozen sequencer.
