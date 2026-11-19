# Separate read-only logger

For this owner's confirmed installation, use the
[exact Windows steps](WINDOWS_INSTALL.md). The generic locations below remain
alternatives; install only one copy of this script.

Status: **owner run captured in Live 13.0b24**; source hashes match the delivered
package and disconnect was observed. See [hardware results](hardware_2026_11_19/RESULTS.md).
The prior one-shot `MF_SEQ_I72_ReadOnly` remains separate.

Keep all four Python files in `probe/MF_SEQ_Push_ReadOnly` together. Copy that
folder to your Live 13 Beta User Library's `Remote Scripts` folder (or the same
Remote Scripts location as your existing Issue #72 probe). Fully quit/relaunch
Live to refresh the chooser if necessary. Preserve your Set before relaunching.

Choose **MF SEQ Push ReadOnly** only in an empty Control Surface slot, with
**Input None / Output None**. Loading starts capture; do not replace an existing
surface or change Push/Twister ports. If no empty slot exists, stop and report it.
After capture restore only this temporary slot to None. To restart a capture,
select None then reselect the diagnostic; a Live restart is not needed again.

Behavior: one initial pass of the existing Issue #72 read-only host inspector,
then snapshots approximately every two seconds, bounded to 120 seconds and
61 samples. Host callback delays can reduce the count. Zero MIDI bindings,
MIDI output, setters, private imports, or listeners. Exceptions retain type and
bounded message; missing native objects are not substituted with ordinary notes.
Disconnect guards queued callbacks. No clip names or note content are logged.

The log is `%APPDATA%\Ableton\Live <actual beta version>\Preferences\Log.txt`.
Retain lines containing `MFSEQ_PUSH_RO`: runtime, initial_capability, samples,
finished and disconnect. Retain the log's full build header separately; Python's
version getters omit the beta suffix. Share diagnostic lines rather than the
full log or Set. Compare `elapsed_s` with your stopwatch/action notes; the logger
does not infer which action happened or assign event labels.

Sampling reads `song.view.detail_clip`, `.is_midi_clip`, `.midi_clip_type`,
`.step_sequencer`; the clip view's four selection candidates; and
`get_notes_extended(0,128,0.0,4.0)` count. It also tries the existing
`c_instance.root()` getter only if callable, with guarded reads through
`.song.view.detail_clip.step_sequencer`. A reachable Push model would yield
selected-row properties and **first-step** fields; this route is absent in the
tested ordinary host and must not be called public LOM. Musical note values and
private module code are not published.

Offline checks (repository root):

```powershell
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/issue72/push3 -p 'test_*.py' -v
```

See [SDK review](SDK_REVIEW.md) for capability statuses and evidence limits.
