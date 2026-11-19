# Issue #72 read-only follow-up

Latest handoff: [Push 3 owner test](push3/OWNER_TEST.md) and
[b26 SDK review](push3/SDK_REVIEW.md). Owner execution is pending; installed
desktop evidence remains **13.0b24**. The new bounded logger is separate from
the one-shot diagnostic below and has not been installed or loaded.

Read [REPORT.md](REPORT.md) for results and limits. `runtime_evidence.json` is
the fresh Live 13.0b24 capture; `recovery.json` identifies the eight recovered
files and preserved local evidence. `static_findings.json` identifies new
installed-source evidence without distributing private disassemblies.

The separate script is **MF_SEQ_I72_ReadOnly** (letter I, then 72). It appears
in Live as **MF SEQ I72 ReadOnly**. Keep its three Python files together.
After installation, fully quit/relaunch Live to refresh the script chooser.
Use an empty Control Surface slot with Input/Output None, select an existing
Step Sequencer clip, then load the diagnostic once. It reports only metadata,
type information and a conventional note count. It does not edit, map, launch,
convert or persist clips, import Push internals, or run native setters.

Restore the temporary slot to None after collection. There are no listeners to
detach. This task used slot 4 and restored it to None; both read-only diagnostic
folders remain installed but inactive. Master/controller ports remain assigned.

Offline checks from the repository root:

```powershell
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/tests -v
python -m unittest discover -s MF_SEQ_STANDALONE_REVIEW/V1_1_NATIVE_RESEARCH_2026_11_18/issue72 -p 'test_*.py' -v
```
