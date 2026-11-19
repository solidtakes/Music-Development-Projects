# MF Sequencer v1.1 — independent native Step Sequencer API review

Follow-up: [Issue #72 research](issue72/REPORT.md) adds a second actual-host probe
on 2026-11-19. In that ordinary Remote Script host, the Push-model enum name
`piano_roll` is absent, while `MidiClipType.step_sequencer` is present. Keep the
private model names below separate from the public host API. Issue #72 also
selects E1 + E16 as the future mode chord; the original E1/E4 design note below
is historical, with no implementation.

Review date: 2026-11-18. Installed and running host: **Ableton Live 13.0b24, Windows**.
Baseline: `mf-seq/v1.0-stable-20261116`, milestone `a2cec39521472bf050e3467b40f263d4b6c304e8`.
Research branch: `mf-seq/v1.1-native-research-20261118`.

## Finding

Gemini's narrow documentation finding is confirmed: the public Cycling '74 LOM
reference inspected identifies itself as **Live 12.4.5** and does not document
native Step Sequencer rows or steps. Documentation absence alone was not used
to decide accessibility. [Public LOM](https://docs.cycling74.com/apiref/lom/)

Independent introspection of an **actual Step Sequencer clip** in Live **13.0b24**
established that ordinary Remote Scripts can identify its type, but cannot reach
the tested native sequencer/lane/step paths. `clip.step_sequencer` raises
`AttributeError`; the runtime `Live` module's members omit `StepSequencer`.
`clip.view` also lacks the tested lane-selection properties. Push's separately
bundled model contains all six step fields and all four row controls. Those
internal bindings are real, but they are not the ordinary Remote Script objects.

**Decision: do not implement or activate alternate-mode editing on this evidence.**
Identification is feasible; selected-row editing is blocked through the tested
Remote Script API in this build. This does not prove that every undocumented
interface, future beta, or other controller integration is inaccessible.

## Evidence and meaning of status

- **VERIFIED — runtime:** read from real Live objects or successfully attached an
  observation listener in 13.0b24. This is not a write test.
- **VERIFIED — static:** exact symbol, descriptor or call exists in bundled
  13.0b24 bytecode. This does not establish runtime availability to third parties.
- **INFERRED:** interpretation/design derived from evidence, not exercised.
- **BLOCKED:** the tested route is missing or an essential read/write test has not
  been authorized/executed. The reason is specified for each capability.

`evidence/runtime_evidence.json` contains 42 diagnostic records from three
snapshots plus disconnect, with exact object paths, getter results, exception
types and listener results. `evidence/static_manifest.json` hashes ten inspected
installed files. The executable ProductVersion was `13.0b24`; Application version
methods returned `[13, 0, 0]`, which alone would not identify the beta suffix.
No mocks were used to assert Live API availability.

The diagnostic was assigned temporarily to Control Surface slot 4 with Input
and Output **None**. Existing surfaces and their ports were left assigned.
The user saved/reopened their Set so Live could discover the separate diagnostic.
Only selection changes were made during the probe. No clips were created,
edited, launched, converted or saved by the agent. Native Mode was never activated.
The saved Set's title remained without a modified marker after inspection.

## Public interface matrix

In this table `clip = song.view.detail_clip`, a real `Live.Clip.Clip` instance.
The same clip was also sampled at `song.tracks[0].clip_slots[0].clip`.
Both paths returned the same type classification and missing sequencer getter.

| Capability | Status in ordinary Remote Scripts | Exact path/name and evidence | Read / write / observation |
|---|---|---|---|
| Native clip identification | **VERIFIED — runtime** | `clip.is_midi_clip == True`; `clip.midi_clip_type == 1` on the UI-confirmed Step Sequencer clip, snapshots 1 and 3 | Read succeeds. Runtime doc says get type. No assignment attempted. `add_midi_clip_type_listener(callback)` succeeds; `midi_clip_type_has_listener` and `remove_midi_clip_type_listener` exist. Conversion notification was not triggered because conversion was prohibited. |
| Distinguish native from ordinary MIDI | **VERIFIED — static**, ordinary control sample **BLOCKED** | Bundled `ableton.v3.live.util.is_step_sequencer_clip(clip)` checks validity, `is_midi_clip`, then `midi_clip_type == Live.Clip.MidiClipType.step_sequencer`; bundled model also names `piano_roll` | Do not use `is_midi_clip` alone. Only a native clip was present in the sampled Set; an ordinary MIDI clip was not created or converted for comparison. Do not hard-code enum numbers for future builds. |
| Native sequencer object | **BLOCKED — verified runtime failure** | `clip.step_sequencer` -> `AttributeError: 'Clip' object has no attribute 'step_sequencer'` | No reachable row/step object through this getter. Clip instance/class `dir()` contains no sequencer/row/step accessors beyond type detection and unrelated take-lane identification. |
| Selected note lane | **BLOCKED — verified runtime failure** | `clip.step_sequencer.highlighted_row_index` cannot be reached; `clip.view.selected_lane`, `.selected_pitch`, `.selected_note`, `.highlighted_row_index` each raise `AttributeError` | No selected-native-row read or listener verified in the ordinary API. Selecting piano-roll notes or a Drum Rack pad must not be treated as proof of native row selection. |
| Lane pitch / note identity | **BLOCKED** | Internal candidate `clip.step_sequencer.rows[index].midi_key`; public parent getter missing | No public read/write/listener verified. UI displayed C3; UI identity is a separate observation route. |
| Step Velocity | **BLOCKED** | Internal candidate `clip.step_sequencer.rows[index].steps[step].velocity`; public parent getter missing | No public step read, write or native step listener verified. |
| Step Offset | **BLOCKED** | Same candidate path ending `.offset` | Same blocker. Do not replace it with ordinary note `start_time` without a proven native editing contract. |
| Step Length | **BLOCKED** | Same candidate path ending `.length` | Same blocker; internal `span` is a separate field. |
| Step Repeat | **BLOCKED** | Same candidate path ending `.repeat` | Same blocker. Generating repeated ordinary notes is not an equivalent native API. |
| Step Pitch | **BLOCKED** | Same candidate path ending `.pitch` | Same blocker. Distinct from the row's `midi_key`; pitch semantics/units remain untested. |
| Step Chance / Probability | **BLOCKED** | Same candidate path ending `.chance` | Native internal name is `chance`. Ordinary MIDI-note `probability` does not establish access to this field. |
| Lane Steps | **BLOCKED** | Internal `row.active_length`; native grid capacity is separately `sequencer.step_count` | No public row read/write/listener. UI read verified row length 16 and grid size 16. |
| Lane Rate | **BLOCKED** | Internal `row.step_size` | No public read/write/listener. UI read verified index 6 / displayed 1/16. |
| Lane Direction | **BLOCKED** | Internal `row.play_direction` | No public read/write/listener. UI read verified Forward. |
| Lane Swing | **BLOCKED** | Internal `row.swing` | No public read/write/listener. UI read verified 0%. Global groove amount is a different control. |
| Clip changes / selection | **VERIFIED — runtime** | `song.view.add_detail_clip_listener`, `.add_selected_track_listener` | Registrations succeed. Snapshots observed detail clip -> None after selecting an empty slot -> original Clip. No clip content change. |
| Highlighted slot notification | **BLOCKED — verified runtime failure** | `song.view.highlighted_clip_slot` reads successfully, but `add_highlighted_clip_slot_listener` is absent | The getter's existence does not imply observation support. Re-resolve via verified selection callbacks; test `ClipSlot.has_clip` observation separately before relying on in-place clip replacement. |
| Playback state / clip position | **VERIFIED — runtime read**, moving feedback **BLOCKED** | `clip.is_playing == False`, `clip.playing_position == 0.0`; `add_playing_status_listener` attaches | No playback was started, so advancing callbacks/timing were not validated. Clip time is not a verified per-row current-step index. |
| Native row playhead / current step | **BLOCKED** | No public row object reached; no dedicated step-index getter found in inspected Push row model | Do not calculate `floor(clip_position / 0.25)` as native truth. Rate, row length, swing, direction and clip-loop resets affect the result. |

The public release notes explicitly announce Max for Live access to
`midi_clip_type` in **13.0b25**. The installed **13.0b24** already contains it in
`_MxDCore.LomTypes` and exposes it to the tested Remote Script. We did not run
b25 or a Max patch, so those must not be reported as runtime tests.
[Ableton beta release notes](https://www.ableton.com/en/release-notes/live-13-beta/)

## Push internal bindings: exact discovered contract

These are **VERIFIED — static** facts from
`Program/Push/python/live_model/Live/StepSequencer.pyc`, its Clip wrapper and
`Push2` components. They are not public LOM object paths.

Push's `Live.Clip.MidiClip` wrapper constructs a `StepSequencer` from
`flip_object.step_sequencer`. `Live.StepSequencer` here belongs to Push's
`live_model/Live` package and imports **`LiveFlip`**. It is different from the
embedded `Live` module used by the diagnostic. Importing/copying this wrapper
does not create a public bridge or supply a valid Flip object.

Let `P` be that **Push model** MIDI clip, `Q = P.step_sequencer`,
`R = Q.rows[Q.highlighted_row_index]`, and `S = R.steps[i]`.

| Requested property | Exact Push model API | Declared read/write route | Observed internal event / range evidence |
|---|---|---|---|
| Velocity | `S.velocity` (`int`) | Read snapshot; replace through `R.set_step(i, step)` | Row `steps` event; Push expressive editor limits 0..127. |
| Offset | `S.offset` (`float`) | Same replacement method | Row `steps`; expressive editor limits -0.24..0.76. Units not runtime-verified. |
| Length | `S.length` (`float`) | Same replacement method | Row `steps`; expressive editor limits 0.01..1.0. `S.span` is separate. |
| Repeat | `S.repeat` (`int`) | Same replacement method | Row `steps`; expressive editor limits 1..8. |
| Pitch | `S.pitch` (`int`) | Same replacement method | Row `steps`; expressive editor limits -12..12. Meaning relative to row key is inferred, not runtime-verified. |
| Chance | `S.chance` (`float`) | Same replacement method | Row `steps`; expressive editor limits 0.0..1.0. |
| Lane Steps | `R.active_length` | `ValueProperty()`, read and declared writable | `active_length` event in Push `listens_group`; encoder bounds 1..`Q.step_count`. |
| Rate | `R.step_size` | `ValueProperty()`, read and declared writable | `step_size` event. Push maps indexes to beat durations; index 6 maps to 0.25 beat. |
| Direction | `R.play_direction` | `ValueProperty()`, read and declared writable | `play_direction` event; enum names `forward`, `backward`, `ping_pong`. |
| Swing | `R.swing` | `ValueProperty()`, read and declared writable | Property's internal listenable default is True; Push binds its swing encoder to this field. Setter limits not exercised. |

The static expressive-editor limits describe that Push editor's controls; they
are **not** verified native API validation bounds. No setter was called.
`StepSequencerStep` is a dataclass containing `is_on`, `velocity`, `offset`,
`length`, `repeat`, `pitch`, `chance`, `span`. Its fields are a snapshot copied
from Flip. Editing the snapshot alone does not establish a Live mutation.
`StepSequencerRow.set_step(index, step)` forwards all eight fields to the
underlying Flip object's `set_step`, preserving the other fields.
`steps` is a `VectorProperty` whose whole-property setter raises `AttributeError`.

Additional exact Push paths:

- `Q.rows`: `ListProperty(StepSequencerRow, ...)`; structural event `rows`.
- `Q.highlighted_row_index`: read/write `ValueProperty`; exact internal event
  `highlighted_row_index` and nested `step_sequencer.highlighted_row_index`.
- `Q.selected_row`: convenience getter resolving `rows[highlighted_row_index]`,
  returning None for no rows. A future adapter should also check index bounds.
- `R.midi_key`: read/write `ValueProperty`; `R.label` explicitly read-only.
- `Q.step_count`: global grid size, distinct from row active length.
- `Q.row_values_changed`: aggregate internal event generated on row changes.
- Step changes are observed at the **row's `steps` event**, not independent
  documented listeners on each scalar step dataclass field.

The static `live_model.model._BasicProperty` defaults are `writeable=True` and
`listenable=True`. This supports the declared access classification above;
it does not prove external runtime writability or support guarantees.
Push's playhead components configure specialized playhead plumbing from row
rate, length and direction; no Twister-compatible current-step feedback API
was established.

## Regular clips, Max for Live and other routes

Ordinary MIDI-note editing uses note IDs, timing, duration, velocity, pitch and
probability. These documented note operations are useful for Classic Mode;
their existence is not proof that they retain native row state or repeat/swing
semantics. Native-to-notes conversion is a separate operation, and was prohibited
and never performed. [Clip LOM](https://docs.cycling74.com/apiref/lom/clip/)

Installed `_MxDCore.LomTypes` explicitly includes `Clip.midi_clip_type`; its
exposed Clip/View lists do not include the discovered native row/step model.
**INFERRED:** a Max `live.object`/JavaScript LiveAPI wrapper will not bypass this
same exposure boundary. No Max patch was installed or run. The older Max
`live.step` UI object is unrelated to the new native clip implementation.
[Max live.step reference](https://docs.cycling74.com/reference/live.step/)

Windows accessibility exposed native row Length, Step Size, Direction and Swing
controls and the C3 label. Those are **VERIFIED UI reads**, with IDs under
`ClipDetailView.StepSequencer...StepSequencerRowHeader.HeaderRight` ending in
`ActiveLength`, `StepSize`, `PlayDirection`, `Swing`. They are not LOM object
paths or a validated low-latency controller backend. Accessibility step-selection
text and editor focus must not be confused with a stable selected-row listener.
No UI parameter writes or MIDI mappings were made.

Native MIDI-mapping behavior and any alternative supported external API remain
**BLOCKED / untested** for the requested selected-row, 16-step editor. Installed
native mapping-related symbols alone are insufficient to claim support.

## Lifecycle, callback safety and limits

The diagnostic initializes via `_Framework.ControlSurface`, defers its first
snapshot with `schedule_message`, and only reads host objects on Live's callback
thread. Callbacks coalesce into a deferred resnapshot of the **current** selection.
No background thread touches LOM, no event callback edits the document, and no
unbounded recursive introspection occurs.

On rebind it removes stored callbacks before attaching to the newly resolved
objects. Disconnect sets a closed guard so a queued callback cannot reattach.
Three real snapshots and disconnect ran. The disconnect log reports zero
script-tracked listeners; removal exceptions are tolerated, so this is not an
independent assertion about Live's complete listener registry. Clip deletion,
Set reload, callback ordering under load, moving playhead timing and stress
behavior remain untested.

Two diagnostic limitations are preserved in the evidence:

1. `highlighted_clip_slot` has no listener in this runtime; the registration attempt
   logs AttributeError while verified detail-clip/track listeners still work.
2. The selected clip also appears via a different proxy in the slot scan. Duplicate
   clip-listener additions log RuntimeError; the first registration is retained
   for teardown. This does not change the getter results or establish duplicate
   successful subscriptions. Future probes should deduplicate by host-object
   equality or query `<property>_has_listener` before adding.

The three offline checks pass for read-only snapshots, preserving invalid-object
errors, and rejecting negative/stale row indexes. They are safety/regression
checks, not substitutes for the actual runtime capture.

## Stable preservation and proposed next gate

Only a new research directory/branch and distinct diagnostic script were added.
`evidence/stable_preservation.json` records matching before/after hashes for all
three installed MF_SEQ source files. The repository's frozen stable source and
ZIP were not edited. The installed source is not assumed to be identical to the
repository milestone merely because its folder is named MF_SEQ.

Retain the approved future design: hold E1 + tap E4 toggles modes; keep Classic
state/LED behavior intact; keep independent mode editing state; follow native
row selection only after a real observation path exists. **INFERRED design rule:**
automatic clip-type detection should be a separate policy with a sticky manual
override, so an event cannot immediately reverse the user's manual choice.
This report implements none of those mode behaviors.

Before alternate editing proceeds, obtain a documented or runtime-confirmed
supported row/step bridge in a specific build, verify selected-row observation,
then separately authorize and test writes on a disposable clip. Repeat the same
read-only probe on newer betas rather than extrapolating b24's result.
