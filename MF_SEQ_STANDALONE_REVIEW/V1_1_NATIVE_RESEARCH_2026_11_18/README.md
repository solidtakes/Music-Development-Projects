# MF Sequencer v1.1 experimental — R1 native API investigation

Research only, based on v1.0 Stable milestone `a2cec39521472bf050e3467b40f263d4b6c304e8`.
Read [R1_REPORT.md](R1_REPORT.md) for the VERIFIED / INFERRED / BLOCKED matrix and evidence.
Read [R3_ARCHITECTURE.md](R3_ARCHITECTURE.md) for the accepted-source audit and proposed
dual-mode design, and [VERDICT.md](VERDICT.md) for the explicit PASS / BLOCKERS gates.

The separate `probe/MF_SEQ_R1_ReadOnly` surface has no MIDI bindings, LED output,
clip editing, clip conversion, playback commands or mode-switch implementation.
It was run in **Live 13.0b24**, then disconnected and its temporary Control Surface
slot restored to None. Its installed folder remains available for later research.
No MF Sequencer stable files were changed.

## Reproduce the read-only inspection

1. Keep all three `.py` files in a distinct `MF_SEQ_R1_ReadOnly` Remote Script folder.
2. Restart Live if the new script is not in the chooser. Preserve your current Set first.
3. Select an **existing Step Sequencer clip**. This differs from an ordinary MIDI notes clip.
4. Assign the probe to an unused Control Surface slot; choose **None** for Input and Output.
5. Read lines with `RemoteScriptMessage:` and `MFSEQ_R1` in Live's `Log.txt`.
6. Restore that slot to None to disconnect the probe. Do not assign the Twister ports.

The probe inspects at most 512 Session slots, 16 sampled clip references and 16
steps in the selected row, if that row is reachable. It also reads a bounded
sample of Arrangement clips. The selected clip may appear a second time under
its Session path. Getter exceptions are recorded. Listeners only queue a deferred,
coalesced resnapshot; at most 20 snapshots occur per surface instance.

The R1 probe records duplicate listener-registration RuntimeErrors when the same
clip is reached through two proxy references. It retains/removes the successful
registration; the rejected second registration does not establish a second listener.
The disconnect count is a script-owned count, not an independent query of Live's
listener registry. See the report for all limits.

## Offline checks

```powershell
python -m unittest discover -s tests -v
python -m compileall -q probe
python tools/collect_runtime.py '<Live Preferences log path>' --out evidence/runtime_evidence.json
```

Static bytecode inspection uses `tools/inspect_bytecode.py` with locally installed
`xdis==6.3.0` in `tools/deps`; it does not import or execute Ableton bytecode.
Raw disassemblies, third-party packages, the full user log and Sets are not published.
`evidence/static_manifest.json` identifies the installed files by hash.

The baseline gesture audit resolves the accepted source from its unchanged
repository location when checked out with this branch. For a standalone copy,
place that exact stable source in `evidence/baseline/MF_SEQ.py`; the audit verifies
Git blob `cbf94ea1a765d3f02aa94ce844228f40f2c68faa` before extracting its input method.
All editing helpers are spies. No new sequencer engine is included in these tests.
