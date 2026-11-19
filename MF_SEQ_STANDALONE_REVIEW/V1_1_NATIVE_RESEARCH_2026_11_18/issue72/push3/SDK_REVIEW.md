# Issue #72 — b26 SDK review and Push test handoff

## Assignment A follow-up — 2026-11-19

Starting point: `4a0dcd4fb4b0db0f8f5225eefddcd4147e6310cf`.
This follow-up used only read-only web/document inspection and static bytecode
disassembly. No Ableton module was imported or executed; no private constructor,
observer, setter or hardware action was used.

### New verification

The current official Live page still identifies **13.0b26**, dated November 18,
and places “Step sequencer clips are no longer considered MIDI clips” under
**Extensions SDK** bugfixes. The official Extensions SDK landing page describes
the public beta as available with Live 12.4.5 and subsequent beta releases, but
the download link redirects to authenticated Centercode. Therefore:

- **VERIFIED:** the b26 release-note statement and its Extensions SDK scope.
- **VERIFIED:** the available local SDK archive is `@ableton-extensions/sdk`
  `1.0.0-beta.1`, SHA256
  `1770f795c18901023d9df8129575c9a86b4e7255011c5295b2b98d0b73010c8e`.
  Its `index.d.mts` has `MidiClip extends Clip` with ordinary `notes` only.
  Token counts are zero for `StepSequencer`, `SequencerClip`, `step_sequencer`
  and `midi_clip_type`; `MidiClip`, `get notes` and `set notes` are present.
- **BLOCKED:** obtaining a b26 SDK package or comparing b24/b25/b26 declaration
  deltas. The beta.1 archive cannot prove what a later private package contains.
- **VERIFIED:** the public LOM page still documents Live 12.4.5 and lists no
  native row/step classes. This is a documentation boundary, not a universal
  impossibility claim.

### Static Push boundary recheck

The preserved xdis helper was run against the installed b24 files without
importing them. It inspected `live_model/Live/StepSequencer.pyc`,
`live_model/Live/Root.pyc` and `Push2/push2.pyc`; the temporary disassembly was
deleted after hashes and symbol evidence were captured. The StepSequencer file
hash is `24be86d94123b33bf1d38049bd5bf160706be1b31e7a8770cd174f81fa5b9df0`
(CPython 3.11, magic 3495). Static symbols reconfirm:

`StepSequencerStep` contains `is_on`, `velocity`, `offset`, `length`, `repeat`,
`pitch`, `chance`, `span`; `StepSequencerRow` contains `midi_key`,
`step_size`, `active_length`, `play_direction`, `swing`, `steps` and
`set_step`; `StepSequencer` contains `rows`, `step_count`,
`highlighted_row_index`, `selected_row`, `set_row` and `active_keys`.

The static Push model is therefore a real internal representation, but its
transport boundary is separate: `Push2.create_instance` accepts a
`flip_document`; `Push2.__init__` obtains the Push host's `c_instance.root()`
and creates a `LiveFlip.FlipObserver`; `live_model.Live.Root` requires a
Flip-backed object. The ordinary diagnostic host had no `root`,
`flip_document`, `_flip_document` or `live_model`, and top-level discovery for
`LiveFlip`, `live_model` and `Push2` was false. This is **VERIFIED** for the
tested b24 ordinary Remote Script host. It is **INFERRED** that copying the
private model cannot create a supported bridge; that inference is not a claim
about every internal Ableton process.

### Assignment A capability matrix

| Capability | Status after Assignment A | Evidence boundary |
|---|---|---|
| Native clip identification | **VERIFIED** | b24 runtime: `song.view.detail_clip.is_midi_clip`, `.midi_clip_type`, and `Live.Clip.MidiClipType.step_sequencer`; Push static utility uses the same enum check. |
| Selected note lane | **BLOCKED** | Owner UI row follows Push, but ordinary b24 `clip.view.selected_lane`, `selected_pitch`, `selected_note`, `highlighted_row_index` all fail; private candidate is `Q.highlighted_row_index`. |
| Lane pitch/note identity | **BLOCKED** | Private `R.midi_key` exists statically; no ordinary host parent/row object is reachable. |
| Step Velocity | **BLOCKED public** / **VERIFIED private static** | `S.velocity`; private replacement `R.set_step(i, step)`; no ordinary read/write/listener. |
| Step Offset | **BLOCKED public** / **VERIFIED private static** | `S.offset`; same boundary. |
| Step Length | **BLOCKED public** / **VERIFIED private static** | `S.length`; `span` is separate; same boundary. |
| Step Repeat | **BLOCKED public** / **VERIFIED private static** | `S.repeat`; same boundary. |
| Step Pitch | **BLOCKED public** / **VERIFIED private static** | `S.pitch`, distinct from `R.midi_key`; same boundary. |
| Step Chance | **BLOCKED public** / **VERIFIED private static** | `S.chance`, distinct from conventional note probability; same boundary. |
| Lane Steps | **BLOCKED public** / **VERIFIED private static** | `R.active_length`; `Q.step_count` is grid capacity; no public row. |
| Lane Rate | **BLOCKED public** / **VERIFIED private static** | `R.step_size`; no public row. |
| Lane Direction | **BLOCKED public** / **VERIFIED private static** | `R.play_direction`; no public row. |
| Lane Swing | **BLOCKED public** / **VERIFIED private static** | `R.swing`; no public row. |
| Step position/playback feedback | **BLOCKED** | Push static model exposes no ordinary host route or verified public row playhead; the tested clip getter only reported conventional playback state. |
| Clip/lane listeners | **PARTIAL VERIFIED** | Public detail clip/track listeners worked in R1; no native lane listener is reachable. Private row events are static only. |
| Supported third-party native step interface | **BLOCKED** | No public LOM, ordinary Remote Script, or available SDK declaration provides a reachable native row/step object. Push's private Flip model requires a host-owned document/root. |

### Assignment A conclusion

The supported third-party boundary remains **BLOCKED** for native step reads,
writes and lane observation. The owner-visible Push operations prove the native
editor exists and works through Ableton's own Push integration; they do not expose
that integration to an ordinary Remote Script. The narrowest safe next step is
to wait for an Ableton-published SDK/LOM or Remote Script bridge that exposes the
native object. No velocity write experiment, private import, memory access or
editing engine is justified by the current evidence.

Checked 2026-11-19. Parent research commit:
`b26414c9aa4f4ee630b8e22222c6eea22ea35813`.
Latest owner handoff: [Issue #72 comment](https://github.com/solidtakes/Music-Development-Projects/issues/72#issuecomment-7007941574).

## Verdict and version boundaries

**PASS:** R1 preservation, primary-source verification of the b26 SDK change,
and preparation of an isolated read-only owner test. **BLOCKED:** public native
lane/step reads, writes and observation in the tested ordinary b24 Remote Script
host. **PENDING:** owner Push 3 test and capture, newer SDK declarations, and
b25/b26 runtime comparison. No controller editing build is proposed.

The installed executable's ProductVersion is **13.0b24**, rechecked today.
Existing fresh Issue #72 b24 evidence has 26 records and a disconnect, already
committed in `../runtime_evidence.json`. This handoff has not loaded another
surface or operated Live's UI; a new capture after Push actions is pending.
The Application methods report `[13,0,0]` and cannot identify the beta suffix.

| Claim / capability | Status | Exact evidence and limit |
|---|---|---|
| b26 SDK classification change | **VERIFIED documentation** | Official Live **13.0b26**, November 18, Bugfixes: “Extensions SDK: Step sequencer clips are no longer considered MIDI clips.” This names the Extensions SDK, not Python/LOM. |
| b24 ordinary Python clip detection | **VERIFIED runtime** | `song.view.detail_clip.is_midi_clip == True`; `.midi_clip_type == 1`; `Live.Clip.MidiClipType.step_sequencer == 1`. Type listener succeeded in R1. Use the enum rather than hardcoding 1. |
| b26 Python clip classification | **BLOCKED verification** | b26 not installed/tested; no conclusion that `is_midi_clip` changes in ordinary Python. Do not transport SDK behavior across API boundaries. |
| Local SDK declarations | **VERIFIED static** | `@ableton-extensions/sdk` **1.0.0-beta.1**, `package/dist/index.d.mts` L375–396 `Clip`; L412–415 `MidiClip extends Clip` with `get/set notes(): NoteDescription[]`. No `StepSequencer`, `SequencerClip`, `step_sequencer`, `midi_clip_type` symbols in this declaration. `index.d.cts` is the matching CommonJS declaration. This is a package version, not a b24/b26 build label. |
| New SDK declarations / b24-b25-b26 declaration delta | **BLOCKED verification** | The official SDK page links to a Centercode download; retrieval redirects to sign-in. No newer package was obtained. Absence in beta.1 cannot prove absence in b26's SDK. |
| Public LOM documentation | **VERIFIED documentation limit** | Cycling '74's index identifies Live **12.4.5** and has no native sequencer class. It is not a complete Live 13 Python binding inventory. |
| Selected lane and lane pitch | **BLOCKED public runtime** | `song.view.detail_clip.view.selected_lane`, `.selected_pitch`, `.selected_note`, `.highlighted_row_index`: AttributeError in R1. Private static candidates `Q.highlighted_row_index`, `R.midi_key`; internal selected-row event exists. |
| Native step getter | **BLOCKED public runtime** | `song.view.detail_clip.step_sequencer`, `.get_step_sequencer`, `._flip_object`, `.flip_object`: AttributeError. `Live.StepSequencer`: AttributeError. |
| Public transport into Push model | **BLOCKED runtime** | Ordinary `MidiRemoteScript` `c_instance.root`, `.flip_document`, `._flip_document`, `.live_model`: AttributeError. Top-level `find_spec` for `LiveFlip`, `live_model`, `Push2`: None. No imports/injection attempted. |
| Push-specific transport | **VERIFIED static; external use INFERRED unsupported** | `Push2.__init__.create_instance(c_instance, flip_document)` receives separate document; `Push2.push2:Push2.__init__` uses host-specific `c_instance.root()` and `LiveFlip.FlipObserver`; model Root requires a supplied Flip object. Copying wrappers does not establish a document/root bridge. File hashes in `../static_findings.json`. |
| Clip changes/lifecycle | **VERIFIED b24 runtime, bounded scope** | R1 `song.view.detail_clip` and `selected_track` listeners fired; `highlighted_clip_slot` getter exists but listener unavailable. R1 tracked subscriptions cleaned at disconnect. New logger uses no listeners and guards queued callbacks. |
| Playback position | **VERIFIED stopped getter; moving native feedback BLOCKED** | R1 clip playing position 0 and status listener attachment; no playback started. No native row playhead was reached. |
| Conventional vs native data | **VERIFIED limited read / INFERRED separation** | `get_notes_extended(0,128,0.0,4.0)` returned a vector of length 0 in the tested native clip; no claim that this clip was populated. Owner-reported edits did not cross representations. New Push test provides controlled populated-step evidence without conventional note writes. |

`Q`, `R`, and `S` below belong to the **private Push model**, not the ordinary
LOM Clip: `Q = Push MIDI clip.step_sequencer`,
`R = Q.rows[Q.highlighted_row_index]`, `S = R.steps[i]`.

| Capability | Exact private path | Declared private write / observation | Ordinary Remote Script read / write / listener |
|---|---|---|---|
| Velocity | `S.velocity` | `R.set_step(i, step)` / row `steps` event | **BLOCKED / BLOCKED / BLOCKED** |
| Offset | `S.offset` | Same replacement / `steps` | **BLOCKED / BLOCKED / BLOCKED** |
| Length | `S.length` (`span` separate) | Same replacement / `steps` | **BLOCKED / BLOCKED / BLOCKED** |
| Repeat | `S.repeat` | Same replacement / `steps` | **BLOCKED / BLOCKED / BLOCKED** |
| Pitch | `S.pitch`, not lane `midi_key` | Same replacement / `steps` | **BLOCKED / BLOCKED / BLOCKED** |
| Chance | `S.chance`, not note `probability` | Same replacement / `steps` | **BLOCKED / BLOCKED / BLOCKED** |
| Lane Steps | `R.active_length`; `Q.step_count` is grid capacity | ValueProperty setter / `active_length` event | **BLOCKED / BLOCKED / BLOCKED** |
| Lane Rate | `R.step_size` | ValueProperty setter / `step_size` event | **BLOCKED / BLOCKED / BLOCKED** |
| Lane Direction | `R.play_direction` | ValueProperty setter / `play_direction` event | **BLOCKED / BLOCKED / BLOCKED** |
| Lane Swing | `R.swing` | ValueProperty setter / internal listenable default | **BLOCKED / BLOCKED / BLOCKED** |

Private declarations are **VERIFIED static** in installed b24 bytecode, not
tested third-party runtime writes. Row `set_step` forwards the complete step
record (including `is_on` and `span`) to its Flip object. Mutating a Python step
snapshot alone is not a native host write. No setter or private observer was run.

## Preservation and next gate

The eight original R1 files are already preserved by published commit
`9bece90d12e1701fbd0b90f6caa3bcbd78ca0b23`, under
`MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/`:

- `.gitignore`
- `README.md`
- `R3_ARCHITECTURE.md`
- `VERDICT.md`
- `tests/test_baseline_gestures.py`
- `tests/test_probe_lifecycle.py`
- `evidence/followup_verification.json`
- `evidence/TEST_RESULTS.txt`

`../recovery.json` contains their exact Git blobs and original-content matches.
The original loose `MF_SEQ_v1_1_R1` workspace remains intact; recovery and fresh
b24 capture were published in `b26414c9aa4f4ee630b8e22222c6eea22ea35813`.
This addendum changes only the research directory. See `verification.json`
for protected-file hashes and branch heads checked for this handoff.

The future chord remains **hold E1 + tap E16**, with reverse E16+E1 Follow,
E1+rotate E16 bars and E13+E4 bar 4 preserved. Gesture implementation and
CROSS-BANK REVIEW remain separate gates. No firmware, mappings, SysEx, Native
Mode, conventional note edits, native setters or merges were performed.

Owner procedure: [OWNER_TEST.md](OWNER_TEST.md). The separate four-file logger
reuses the existing read-only host inspector byte-for-byte. Offline checks cover
sampling limits, dispatcher stalls, missing routes and callbacks after disconnect;
they do not prove actual host or hardware behavior. Installation/loading and
owner execution are pending. Only propose an isolated API velocity write if a
credible supported route is found and owner authorization is obtained.

## Sources

- [Official Live beta notes](https://www.ableton.com/en/release-notes/live-13-beta/), b26 Bugfixes (verified 2026-11-19).
- [Official Push beta notes](https://www.ableton.com/en/release-notes/push-13-beta/), b25 Step Sequencer controls. Hardware availability in earlier builds is unverified.
- [Official SDK landing page](https://ableton.github.io/extensions-sdk/), SDK download links to authenticated Centercode.
- [Public LOM index](https://docs.cycling74.com/apiref/lom/), version 12.4.5 at retrieval.
- Local archive `AOPX-sdk-local/extensions-sdk-1.0.0-beta.1/ableton-extensions-sdk-1.0.0-beta.1.tgz`, SHA256 `1770f795c18901023d9df8129575c9a86b4e7255011c5295b2b98d0b73010c8e`. Read declarations without installing or executing the SDK.
- [Existing host report](../REPORT.md), [raw diagnostic records](../runtime_evidence.json), [static Push evidence](../static_findings.json).
