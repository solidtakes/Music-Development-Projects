# Beta 3 Next Experimental Build — Follow Playback Default ON
Owner clarification 2026-11-13

The earlier phrase "make bank on default" refers to **automatic bar/page following for the sequencer's editing pages**, not to MFT physical bank selection or reassignment.

## Approved next-build behavior
- Follow Playback starts **ON by default** when the MF Sequencer script initializes.
- Existing gesture **hold E16 + press E1** remains the toggle for Follow Playback ON/OFF, with its current press/release and modifier suppression rules.
- With Follow ON, editing page follows the playing bar, including loop wrap.
- Manual bar selection temporarily suspends following until the next playback start, preserving existing accepted behavior.
- Do not change the MFT bank mapping, rotary/push CC assignments, colors, page selection gestures or other approved features.
- Verify stop/start, restart, clip replacement, loop start/length changes, and ON/OFF toggle behavior; no accidental note edits or LED regressions.

## Freeze/implementation
Beta 3.0 SP1 remains immutable and keeps its existing default. Implement this one-default change only on the next isolated experimental branch derived from accepted Beta 3.0 SP1, with tests and owner hardware review. No automatic merge or stable promotion. CROSS-BANK REVIEW REQUIRED if integrated into the combined multi-bank build.
