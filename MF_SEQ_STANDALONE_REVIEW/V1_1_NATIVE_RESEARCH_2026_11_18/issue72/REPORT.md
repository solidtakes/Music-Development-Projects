# Issue #72 — native Step Sequencer read/write feasibility

Date: 2026-11-19. Actual runtime: **Ableton Live 13.0b24 on Windows**.
Issue: [MF Sequencer v1.1 R2](https://github.com/solidtakes/Music-Development-Projects/issues/72).
Branch: `mf-seq/v1.1-native-research-20261118`.

## Verdict

**PASS: workspace recovery and read-only investigation. BLOCKED: native step
read/write integration through the tested ordinary Remote Script host.**
No credible reachable native step object or supported isolated native writer was
established. No velocity write, conversion, native editing engine or experimental
controller build is proposed or activated. These are build- and route-specific
results; they do not establish that every undocumented interface is inaccessible.

## Recovered workspace

The original `MF_SEQ_v1_1_R1` directory is a loose research workspace, not a Git
checkout. It was preserved, including its local raw R1 logs/disassemblies and
dependencies. A new sparse Git checkout, `MF_SEQ_issue72_recovered`, was created
on the existing research branch. Its initial `git status --short` and working
diff were clean at `9bece90d12e1701fbd0b90f6caa3bcbd78ca0b23`.

All eight files referenced by the pickup request already matched that pushed
commit byte-for-byte after newline normalization. Their exact committed blobs
are in `recovery.json`. This resolves the stale description of those files as
uncommitted without overwriting or inventing missing work. R1 runtime evidence
remains in the original commit `2bea6fc` and `../evidence/runtime_evidence.json`.

The sparse clone initially needed a network fetch to display historical Git
stats; this did not affect the clean working diff or the eight content checks.
Only this research directory and its index/docs are changed by the new work.
Protected installed/local source hashes and branch heads are recorded separately.

## New actual-host checks

`MF_SEQ_I72_ReadOnly` was loaded once in empty Control Surface slot 4, with
**Input None / Output None**. The letter after `SEQ_` is **I**, for Issue 72.
The selected clip was confirmed in Live's Step Sequencer UI. After the capture,
the probe was disconnected, slot 4 was restored to None, and Settings was closed.
The working `MF_Build_3banksb` surface and Twister ports were retained.

`runtime_evidence.json` contains **26 records** with source hashes and literal
host-log timestamps. Only diagnostic lines were extracted; no full Live log,
Set, user clip names, raw notes or private installed source was published.
Application version methods returned `[13, 0, 0]`; the executable's ProductVersion
identified **13.0b24**. The installed probe source hashes match the source committed
with this report.

| Capability / route | Status | Actual evidence and limit |
|---|---|---|
| Native clip identification | **VERIFIED runtime** | `song.view.detail_clip.is_midi_clip == True`; `.midi_clip_type == 1`; `Live.Clip.MidiClipType.step_sequencer == 1`. Use the enum member rather than assuming a permanent numeric value. |
| Push's ordinary-clip enum spelling | **VERIFIED runtime failure** | `Live.Clip.MidiClipType.piano_roll` raises AttributeError. That name in the separate Push model must not be advertised as the ordinary host's public constant. The ordinary-clip enum name was not enumerated or verified in this probe. |
| Native object getter | **BLOCKED, verified failures** | `song.view.detail_clip.step_sequencer` and `.get_step_sequencer` each raise AttributeError. |
| Hidden Flip object on Clip | **BLOCKED, verified failures** | `song.view.detail_clip._flip_object` and `.flip_object` each raise AttributeError. No native pointer was dereferenced or fabricated. |
| Native module in ordinary Live | **BLOCKED, verified failure** | `Live.StepSequencer` raises AttributeError. Native-term metadata inspection of the actual module and Clip class found no relevant bridge. |
| Discover Push modules in this host | **VERIFIED runtime discovery result** | `find_spec('LiveFlip')`, `find_spec('live_model')`, `find_spec('Push2')` return None; none is loaded in `sys.modules`. This describes the current host/search path, not all possible process environments. No private module was imported. |
| Push-style root getter | **BLOCKED, verified failure** | Ordinary `c_instance` is a `MidiRemoteScript`; `.root`, `.flip_document`, `._flip_document`, `.live_model` all raise AttributeError. The guarded `c_instance.root()` read route stops at missing `root`; no root constructor or observer is created. |
| Ordinary note read on selected native clip | **VERIFIED runtime read only** | `clip.get_notes_extended(0, 128, 0.0, 4.0)` returns a vector with count 0 for this clip/range. This is a conventional-note query, not a read of native steps. The probe did not establish a populated native-step versus ordinary-note count comparison. |
| Selected native lane observation | **BLOCKED** | No native sequencer/row object reached. Original R1 additionally tested `clip.view.selected_lane`, `.selected_pitch`, `.selected_note`, `.highlighted_row_index`: all absent. |
| Per-step and per-lane read/write | **BLOCKED in this host** | Exact private candidate paths are below. No native step read or setter/readback test occurred. |
| Public clip/type listeners | **VERIFIED in preserved R1** | Detail-clip/selected-track callbacks and clip type/status listener registration succeeded. This new one-shot probe registers no listeners. Conversion notifications and live row events remain untested. |

The original owner observations in Issue #72 describe MF conventional-note edits
not affecting native steps. They remain **owner-reported hardware observations**.
The zero-note result here does not independently reproduce those edits or prove
how all populated native patterns are represented.

## Per-property matrix

In this table `P` denotes the **Push model** MIDI clip, not an ordinary
`Live.Clip.Clip`; `Q=P.step_sequencer`, `R=Q.rows[Q.highlighted_row_index]`,
`S=R.steps[i]`. Static findings from R1 identify real internal symbols; the new
host checks do not expose their parent model.

| Property | Exact private candidate | Static declared write route | Internal observation | Ordinary Remote Script result |
|---|---|---|---|---|
| Velocity | `S.velocity` | `R.set_step(i, step)` forwarding all fields | Row `steps` event | **BLOCKED** read/write/listener |
| Offset | `S.offset` | Same replacement method | Row `steps` | **BLOCKED** read/write/listener |
| Length | `S.length` (`span` separate) | Same replacement method | Row `steps` | **BLOCKED** read/write/listener |
| Repeat | `S.repeat` | Same replacement method | Row `steps` | **BLOCKED** read/write/listener |
| Pitch | `S.pitch`, distinct from `R.midi_key` | Same replacement method | Row `steps` | **BLOCKED** read/write/listener |
| Chance | `S.chance`, not ordinary note `probability` | Same replacement method | Row `steps` | **BLOCKED** read/write/listener |
| Lane Steps | `R.active_length`; grid capacity `Q.step_count` | `ValueProperty` declared writable | `active_length` | **BLOCKED** read/write/listener |
| Lane Rate | `R.step_size` | `ValueProperty` declared writable | `step_size` | **BLOCKED** read/write/listener |
| Lane Direction | `R.play_direction` | `ValueProperty` declared writable | `play_direction` | **BLOCKED** read/write/listener |
| Lane Swing | `R.swing` | `ValueProperty` declared writable | Property's internal listenable default | **BLOCKED** read/write/listener |

All private names/write declarations above are **VERIFIED static**, not verified
third-party runtime capability. Selected-row candidate is
`Q.highlighted_row_index`, with internal event of that name; lane pitch is
`R.midi_key`. R1 records types, Push control ranges and exact installed file hashes.
Neither row-specific moving playheads nor persistence has been tested externally.

## What further inspection establishes about Push

`static_findings.json` hashes seven newly inspected files, in addition to the ten
preserved R1 sources. The local disassembler reads code objects with xdis 6.3.0;
it never imports/executes the installed modules. Raw disassemblies stay local.

- `Program/Push/python/Push2/__init__.pyc:create_instance` accepts an explicit
  `flip_document` alongside `c_instance` and passes both to Push2.
- `Push2.push2:Push2.__init__` stores that document (source L683), obtains
  `c_instance.root()` in its own host (L685), and creates a
  `LiveFlip.FlipObserver` using the document (L699).
- `live_model.Live.Root:Root.__init__` (L48) builds service wrappers around a
  supplied Flip-backed object. It is not a conversion from an ordinary LOM Clip.
- `ableton.v3.control_surface.components.note_editor:NoteEditorComponent.set_clip`
  (L368) checks native clip type, substitutes None as its edit clip and disables
  the note matrix for native Step Sequencer clips. This is corroborating static
  evidence that ordinary note editing should not be used as a substitute backend.

**INFERRED:** copying the Push wrappers or appending their folder to `sys.path`
would not supply the missing document/host root and would introduce a private,
version-sensitive transport dependency. No such injection, observer initialization,
process attachment, memory modification or Push hardware emulation was attempted.
The internal setter forwarding demonstrates an implementation path inside Push;
it does not establish a supported or isolated external writer.

## Documentation checked on 2026-11-19

The public LOM still identifies its reference version as Live 12.4.5 and does not
publish native row/step objects. This gap did not substitute for runtime checks.
[Cycling '74 LOM](https://docs.cycling74.com/apiref/lom/)

Public Live release notes now list **13.0b26**, released November 18. The local
host remains b24. Notes about `midi_clip_type` in b25 and the new Push custom
device **display** API in b26 do not establish native step access for ordinary
Remote Scripts. Neither b25 nor b26 was installed or tested here.
[Live beta notes](https://www.ableton.com/en/release-notes/live-13-beta/),
[Push beta notes](https://www.ableton.com/en/release-notes/push-13-beta/)

Max for Live exposure remains a separate gate: the installed R1 `_MxDCore`
whitelist contains clip type but no inspected native row/step model. **INFERRED**
that its usual wrappers will not provide this missing bridge; a Max patch was
not installed or executed. GUI accessibility readouts are not a verified native
controller API. No UI parameter changes, MIDI mappings or offline Set editing
were used to work around the missing objects.

## Safety, tests and next experiment

The new probe is one-shot, has bounded metadata lists, catches unsupported
attributes, and records complete exception types for tested routes. It calls
only the conventional note getter and an existing root getter if callable;
in this actual host that root getter is absent. It creates no listeners and
its closed guard makes queued work inert. `finished` and `disconnect` records
are present. There were zero probe writes and zero probe MIDI/SysEx output.

Five new offline tests cover whitelisted getter use, representation labeling,
missing attributes, bounded metadata, missing clip context and a mocked root
route. Twelve recovered tests cover baseline dispatch and R1 diagnostic safety.
These checks do not simulate native API support or establish hardware timing.

**Next research experiment:** repeat the read-only probe in a separately available
newer beta, or inspect an Ableton-supported external native row/step interface
if supplied. No one-step velocity write experiment is proposed yet: first obtain
a reachable real step, verified lane identity and an isolated writer. Once that
gate is met, Issue #72's opt-in duplicate-clip, one-step velocity/readback/UI/
persistence procedure is the next proposal, not an action taken in this task.

The future gesture is now unambiguous: **hold E1 + tap E16**, consuming both
releases. Preserve reverse E16 + E1 Follow, E1 + rotate E16 bar navigation and
E13 + E4 bar 4. No gesture implementation was added. Stable v1.0 and the Master
Build are unchanged; no merge, firmware operation or Native Mode activation occurred.
