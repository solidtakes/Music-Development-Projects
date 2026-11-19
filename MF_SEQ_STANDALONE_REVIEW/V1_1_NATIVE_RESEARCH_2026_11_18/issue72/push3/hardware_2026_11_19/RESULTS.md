# Push 3 owner run — 2026-11-19

**PASS: owner-driven UI exercise and read-only runtime capture. BLOCKED:
native lane/step integration through the tested ordinary Remote Script routes.**
Desktop executable ProductVersion: **13.0b24**. Push 3 controls desktop Live;
its own software version was not supplied. No API editing experiment or engine
was implemented. The owner operated Live and Push; Codex read the resulting log.

## Owner observations, distinct from instrumented reads

Before capture the owner identified the native editor by its step controls
(Velocity, Offset, Length, Repeat, Pitch, Chance) and per-row Steps, Rate,
Direction, Swing. Push's reported layout name was **Melodic 8-Row**.

The owner confirmed completion of all four instructed actions: row selection,
one step enable, Velocity and Pitch editing. Follow-up answers explicitly
confirmed **Live's selected row followed Push** and **Velocity changed in Live**.
Pitch visibility was checked **afterward**, by opening the Pitch tab; the owner
then reported seeing it. That later observation is not time-correlated with the
original capture and is not a verified old/new numeric Pitch comparison.

Step enable was reported as part of completing all four actions; an independent
before/after step screenshot or numeric state was not supplied. Exact old/new
values and action timestamps were not supplied. Optional lane Rate was not
reported. Do not invent those values or assign specific samples to actions.

## Instrumented evidence

`runtime_evidence.json` contains the latest complete attempt: **85 logical
records**, comprising runtime 1, initial capabilities 23, samples **59**, finished
1 and disconnect 1. Live writes each message twice (framework LOG and
RemoteScriptMessage); retaining only the latter prevents double counting.
An earlier interrupted attempt was found but is not treated as the completed
owner run.

Log timestamps are retained verbatim (timezone unspecified):

- Start: `2026-11-19T04:14:46.610096`.
- Samples: elapsed `0.0` through `119.485` seconds, all within the 120-second
  sampling window; 59 <= the 61-sample cap.
- Finished: `2026-11-19T04:16:48.126640`, elapsed `121.516` seconds, reason `limit`.
  The terminal callback arrived after the sampling window; no later sample was
  taken. A nominal two-minute timer is subject to host callback scheduling.
- Disconnect: `2026-11-19T04:17:51.019611`.
- Finished records: writes attempted **0**, listeners registered **0**.
- Capture/sample error records: **0**. Unsupported-property failures are expected
  AttributeError results inside the successful diagnostic capture.

The 59 observations are identical. Repeated observations are dictionary-encoded
in the committed evidence, retaining every sample index, elapsed time and log
timestamp. Substituting each `observation_ref` reconstructs the complete logical
sample. Its canonical expanded-record SHA256 is included. An expanded diagnostic
archive is preserved locally; the unrelated full Live log is not published.

| Capability | Result in this actual host |
|---|---|
| Native type detection | **VERIFIED runtime:** every sample has `song.view.detail_clip.is_midi_clip == True` and `.midi_clip_type == 1`; `Live.Clip.MidiClipType.step_sequencer == 1` in initial read. |
| Lane selected by Push visible to ordinary script | **BLOCKED, verified failures:** `song.view.detail_clip.view.selected_lane`, `.selected_pitch`, `.selected_note`, `.highlighted_row_index` all raise AttributeError throughout. Owner-visible row following does not create a public getter. |
| Native sequencer getter | **BLOCKED, verified failures:** `song.view.detail_clip.step_sequencer` absent throughout; initial `.get_step_sequencer`, `._flip_object`, `.flip_object` and `Live.StepSequencer` absent. |
| Step Velocity, Offset, Length, Repeat, Pitch, Chance | **BLOCKED public read/write/listener:** parent native object remains unreachable; no step setter was called. UI Velocity and later Pitch observations are owner reports, not native API reads. |
| Lane Steps, Rate, Direction, Swing | **BLOCKED public read/write/listener:** no reachable row object. No lane Rate experiment was reported. |
| Candidate Push transport while hardware is available | **BLOCKED, verified failures:** ordinary `MidiRemoteScript` `c_instance.root`/`root()` absent; initial `.flip_document`, `._flip_document`, `.live_model` absent. `find_spec` for `LiveFlip`, `live_model`, `Push2` returns None in this script environment. This does not inspect the separate Push process or prove all private transports inaccessible. |
| Conventional notes | **VERIFIED bounded read:** `get_notes_extended(0,128,0.0,4.0)` count **0** throughout. No native step values were returned by this getter in the tested range. This does not prove all native patterns or beat ranges have no conventional notes. |
| Representation separation | **INFERRED, strengthened by owner report:** visible native UI edits coexist with an unchanged conventional note count and inaccessible native getters. Unknown exact action times/range prevent a stronger per-event or whole-clip claim. |

The [existing SDK matrix](../SDK_REVIEW.md) retains exact private Push property,
setter and listener names with static evidence. This run does not promote those
declarations into public capability. The verified b26 **Extensions SDK** release
note is still separate from this **b24 Python runtime**; b26 and newer SDK
declarations were not tested or obtained by this hardware exercise.

## Preservation and next gate

All **four installed logger source files match the delivered package hashes**.
All **21 protected source files remain unchanged**. See `verification.json`.
The terminal disconnect was observed. No script changes were needed, so no
redundant offline suite was run; previously reviewed code/tests remain applicable.
Original R1 preservation commits and research evidence remain intact.

No immediate repeat hardware run is required to preserve these findings. A
claim about exact per-step API read/write, persistence or per-action timing would
require a newly reachable supported interface and controlled values/timestamps.
Public integration remains blocked on the tested routes. Keep the future mode
gesture/cross-bank review gates; no native engine, API write test, stable/Master
modification, firmware/mapping change, Native Mode activation or merge.
