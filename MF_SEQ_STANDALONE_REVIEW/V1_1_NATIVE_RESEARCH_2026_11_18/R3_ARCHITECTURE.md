# R3 — dual-mode architecture proposal and stable-source audit

Follow-up source review: 2026-11-19; runtime evidence remains the 2026-11-18 capture.

Status: **proposal only**. No mode router, Alternate engine, MIDI mapping or
shared-controller change is implemented or activated by this research branch.
Native editing remains blocked by R1's Live 13.0b24 runtime findings.

**Gesture scope:** this audit analyzes E1 + E4 from the handoff in this chat.
While publication was in progress, the branch gained a separate
[design record specifying E1-held + E16-tap](../V1_1_R1_OWNER_GESTURE_DECISION_2026-11-18.md).
That record also preserves E16-first + E1 for Follow and E1 + E16 rotation for bars.
It is retained unchanged. The E1/E4 sequence below is a conditional analysis of
the chat handoff, not a replacement for that repository record or an implemented
gesture choice. Reconcile the two specifications before controller implementation.
The single-owner, cancellation, state and eligibility design applies to either
candidate; E1/E16 additionally needs turn-versus-tap arbitration for bar navigation.

**Issue #72 resolution (2026-11-19):** the current owner instruction explicitly
selects **hold E1 + tap E16**, superseding the earlier E1/E4 handoff candidate.
The E1/E4 analysis below is retained as historical source-audit evidence, not
the current gesture specification. Gesture implementation remains a separate task.
See [the Issue #72 research follow-up](issue72/REPORT.md).

## Accepted source reviewed

Review target is the complete `combined/MF_SEQ` source package at stable milestone
`a2cec39521472bf050e3467b40f263d4b6c304e8`, not an installed script selected by name.

| Source | Verified Git blob | Relevant entry points |
|---|---|---|
| [MF_SEQ.py](https://github.com/solidtakes/Music-Development-Projects/blob/a2cec39521472bf050e3467b40f263d4b6c304e8/MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/combined/MF_SEQ/MF_SEQ.py) | `cbf94ea1a765d3f02aa94ce844228f40f2c68faa` | `__init__` L48; MIDI forwarding L113; parameter mode L121; `receive_midi` L218; `_target` L412; `_led` L1007; `_white_ring` L1019; `_tick` L1072 |
| [scale_sync.py](https://github.com/solidtakes/Music-Development-Projects/blob/a2cec39521472bf050e3467b40f263d4b6c304e8/MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/combined/MF_SEQ/scale_sync.py) | `b2636e05136546bea2c88ac875a6893d8cca448b` | `_watch` L36; `_unwatch` L51; selection callbacks L65; bind L74; tick L147; next_pitch L156; close L177 |

The stable handoff requires `__init__.py` alongside both files, and identifies
the accepted scale + performance package as v1.0 without a new executable change.
[Stable assembly contract](https://github.com/solidtakes/Music-Development-Projects/blob/a2cec39521472bf050e3467b40f263d4b6c304e8/MF_SEQ_STANDALONE_REVIEW/V1_0_STABLE_THREE_BANK_ASSEMBLY_HANDOFF_2026-11-16.md)

## Verified behavior that the experimental integration must preserve

| Area | Stable source contract |
|---|---|
| Input / white rings | Physical Bank 3, CC32..47; rotary channel 12, zero-based 11; relative 63/65 (`3F`/`41`) only. White-ring output uses the same rotary channel and CC range, clamped 0..127. |
| Push / RGB | Channel 11, zero-based 10, CC32..47. Push is down when value > 0. RGB output remains on this channel. |
| System brightness | `_rgb_brightness` currently returns without transmitting. Keep it inert. The defined channel-3 constants do not authorize a new system/shared output stream. |
| Notes / parameter editing | `_edit_mode` and `_last_edit_mode` are parameter states, not sequencer-backend modes. Active parameter cycle is velocity, pitch, length, probability; legacy CC1 branches exist but CC1 is excluded from that cycle. |
| Notes hold + turn | Four qualifying increments before each held edit. Unheld rotation in Notes remains inert. Parameter-mode velocity/probability respond to each accepted detent; length and pitch retain their distinct rules. |
| Navigation | E13 first then E1..E4 chooses bar 1..4. E1 + turn E16 uses four detents per bar, clamps without wrap; E1 + turn E15 uses four detents for loop movement. E1 + turn E13 uses eight detents for parameter selection. |
| Other ordered chords | E16 first then E1 toggles Follow. E1 + E13 advances parameter; E1 + E14 toggles Notes/parameter; E1 + E15 cycles loop length. |
| Follow default | `_follow_playback = False` in this accepted snapshot. Preserve it. Default ON belongs to a separately approved future experiment. |
| Color values | Velocity start/sustain 76/88; pitch 72/108; length 32/68; probability 96/104; playhead overlay `BLUE=68`; empty `OFF=0`. Reuse exact source calculations and output caching. |
| Rings | Preserve current velocity, scale-aware pitch, nine-choice length and probability normalization, changed-value sends, and touched-encoder ring reassertion. No RGB changes to the white-ring channel. |
| Scale sync | Keep Classic's existing capability checks, callback dirty flags, fallback polling and close lifecycle. Native row pitch identity is not a substitute for Classic ScaleSync. |

## Concrete E1 + E4 conflict

**VERIFIED — source execution with spies:** in Notes mode, E1 down followed by
E4 down reaches `_extend_note(0, 3)` immediately, before either key is released
(`receive_midi`, L275). Intercepting only the release is too late.
In Probability mode the same unhandled pair can invoke probability presets for
step 4 and step 1 on their releases (L305). This affects more than note toggles.

Reserving the approved ordered E1 + E4 mode chord deliberately replaces this
particular two-key gesture in the future experimental version. Other accepted
Classic gestures should retain their existing dispatch. Stable source is frozen.

The source audit tests execute the exact accepted `receive_midi` function with
mutation helpers replaced by action-recording spies. They demonstrate these
existing routes; they do **not** validate a proposed router or any Live edit.

## Proposed ownership

Use one ControlSurface host, one MIDI forwarding map, one scheduler owner and
one output writer for the sequencer bank. A host input arbiter receives normalized
push/rotate events and passes them to exactly one active engine after chord and
clip-eligibility checks. Maintain a distinct `sequencer_mode` name so the existing
`_edit_mode` parameter selection cannot accidentally change backend.

Keep the accepted Classic code as the reference. In a future isolated implementation,
extract or adapt its logic into a Classic engine with a narrow host facade; do not
construct two independent instances of `MF_SEQ`. Its constructor forwards MIDI
and schedules `_tick`, and its disconnect clears LEDs/closes ScaleSync. Two full
surfaces would compete for callbacks, outputs and routing.

Separate the future responsibilities:

| Component | Ownership |
|---|---|
| Host / input arbiter | Physical held state, per-press owner, ordered-chord recognition, suppression until release, callback generation, current backend and manual preference. |
| Classic engine | Existing note editor, loop/bar state, parameter state, ScaleSync and Classic frame calculations. No Alternate state reused here. |
| Native adapter | Capability report and immutable row/step snapshots. A write entry point must remain disabled until supported runtime reads/listeners/writes are established. Never import Push's private Flip transport as a public bridge. |
| Alternate engine | Future independent parameter, lane and step-page state; 16 encoders map to 16 steps in the selected lane/window. Dormant until the adapter passes its gates. |
| Output writer | Exactly one active engine's frame, existing channels/CCs, changed-value cache, RGB and white-ring separation. |

The experimental extraction must preserve the Classic tick body, scan intervals,
output order and formulas. Move scheduling ownership without leaving the original
self-scheduling loop running in parallel. A backend generation token makes queued
work from a deactivated engine inert. No faster poll rate is justified by R1.

## Proposed chord priority and release ownership

1. Decode only the accepted CC ranges, channels and relative values. Discard
   repeated down events and orphan releases according to physical held state.
2. Honor releases captured by a prior gesture/engine before considering a new
   backend. The backend active at release time must not inherit an older press.
3. Preserve established modifier sequences: E13 first still owns E1..E4 page
   selection; E16 first still owns E1 Follow. A held E13/E16 or any other encoder
   prevents the new two-key mode chord from matching.
4. Recognize a candidate only when E1 was pressed first, E4 was previously up,
   no other encoder is held, and E1 has not rotated, edited, or been consumed by
   another gesture. Physical order is required; E4 then E1 does not switch modes.
5. Intercept E4 **down before Classic's tie logic**. Capture both physical keys;
   do not forward the E4 press. Mark E1's existing engine press as canceled using
   a read-only gesture-cancel hook. Do not synthesize a normal E1 release, which
   could toggle a note or change probability.
6. Commit one manual mode request on E4 release while E1 is still held and the
   candidate remains clean. E1 released first, rotation, a third key, a selection
   change, or disconnect cancels the candidate. A canceled candidate must still
   consume both captured releases; do not replay buffered edits.
7. Suppress both captured keys' remaining pushes/turns/releases until their physical
   up events arrive. No duration timer is needed for this ordered tap gesture.

A future `cancel_gesture` hook clears only transient input state without calling
`_toggle`, `_extend_note`, parameter writers or clip creation. It must clear held
flags, rotation/detent accumulators, tie-consumed flags, press order, temporary
feedback and pending release intents. Leave durable page/parameter/loop state intact.
Do not use full engine disconnect for mode changes.

The immediate E1 press can be forwarded for ordinary Classic feedback because
the qualifying two-key sequence starts with no other held keys and no edit on
E1 press. Once E1 has already caused any edit, do not recognize a later E4 press
as a clean mode chord. No implementation can retroactively undo an earlier edit
while promising a read-only switch.

## Independent state and transitions

Keep Classic durable state in its own engine: `_page`, `_edit_mode`,
`_last_edit_mode`, `_follow_playback`, manual-follow preference and clip-scoped
loop origin. Preserve its existing page-retention behavior across clip selection.
Revalidate `_loop_clip`/`_loop_origin` when the target changes.

Alternate has its own remembered parameter, step window, lane identity and
future row settings. Lane identity must come from the selected-row API; do not
persist an index across structural row changes without re-resolving it.

On transition, cancel transient gestures, invalidate cached notes/LEDs/rings and
playhead context, re-resolve the current target, then repaint from the entering
engine. Do not restore raw note-vector objects, proxy IDs, stale step snapshots,
pressed flags or pending callbacks. Follow's prior-playing edge state must be
re-evaluated on activation so an old transport observation cannot move pages.

## Automatic detection and document eligibility

Maintain three separate concepts: observed clip kind, manual mode preference,
and effective editing capability. A successful type read is not permission to
edit through either engine.

- A manual chord request sets a sticky preference for this script session, even
  when Alternate is unavailable. Selection, type and lane events do not clear it.
  Only another manual choice or an explicit future return-to-Auto action clears it.
- Automatic detection may suggest/select a backend only while policy is Auto.
  No extra Auto gesture or UI mapping is assigned by this proposal.
- On b24, requesting Alternate must report unavailable and leave editing disabled;
  it must not silently route encoder edits to Classic. This research implements
  no such request or activation path.
- A future dual-mode host must gate Classic mutation helpers to an ordinary MIDI
  notes clip. Stable `_target` checks only `is_midi_clip`, which also accepts a
  native Step Sequencer clip. A shared read-only resolver must classify the exact
  target used by the editor, including highlighted-slot precedence. Unknown or
  native type must not reach Classic creation, toggle, tie or parameter writers.
- A manual Classic choice on a native clip keeps the preference but blocks edits.
  Switching back to an ordinary clip can restore eligibility without changing
  the preference. Missing type/capability information is an explicit unavailable
  state in this experimental Live 13 integration, not an invitation to convert.
- For Alternate, validate the clip, selected row, bounds and binding generation
  again at every edit. Selection/type/lane callbacks may invalidate state, but
  must never create or convert a clip, move the UI lane or make an edit themselves.

For grids over 16 steps, a future independent Alternate step page is required.
For a shorter active row, encoders beyond its active length should be inert until
an explicitly approved length-edit action is defined. Native offset/length/span,
repeat and direction must not be reconstructed from Classic note geometry.

## Verification required before a controller implementation can pass

The R1 blockers must first be resolved in a named Live build. Then test a future
router against all accepted Classic traces, including:

- E1/E4 press/release permutations, repeated down events, rotations, third-key
  interruptions, empty slots, clip changes during a chord and disconnect mid-hold.
- Zero mutation-helper calls for every mode chord and canceled candidate in Notes,
  Velocity, Pitch, Length and Probability modes; zero stale-release edits after a switch.
- E13-first bar selection, E16-first Follow, E1/E13/E14/E15 chords, 4/8-detent
  thresholds, loop bounds and unchanged Follow default.
- Byte-for-byte Classic MIDI output equivalence outside the reserved new chord,
  including color palette, white rings, push reassertion and playhead overlay.
- State round-trips, listener replacement, late callbacks, clip deletion/reload,
  manual preference surviving auto events and unsupported-native fail-closed behavior.

These are future acceptance tests. The current 12 offline checks cover the
diagnostic and existing source dispatch only. They do not establish that a
dual-mode implementation or native editing works.

**CROSS-BANK REVIEW REQUIRED** before changing shared routing, LEDs, callback
ownership, bank switching or composing this proposal with the three-bank host.
No three-bank baseline changes are part of R1–R3 research.
