# Windows installation and owner test

Reviewed 2026-11-19 against research commit `1cf77341`.
The logger's four Python files are unchanged. Review: getters only, no MIDI
bindings/output, setters, private imports or listeners; bounded capture and
disconnect guards. Four logger tests passed again. Actual Live execution is
still pending; this review does not establish new native API access.

## Install once

1. Extract `MF_SEQ_Push_ReadOnly_Windows_20261119.zip` with Windows **Extract
   All**. Preserve your working Set and fully quit Live.
2. In File Explorer, paste this confirmed existing folder into the address bar:

   ```text
   C:\ProgramData\Ableton\Live 13 Beta\Resources\MIDI Remote Scripts
   ```

3. Copy the extracted **MF_SEQ_Push_ReadOnly** folder there. Allow Windows'
   administrator prompt if shown. Its four `.py` files must sit directly inside:

   ```text
   C:\ProgramData\Ableton\Live 13 Beta\Resources\MIDI Remote Scripts\MF_SEQ_Push_ReadOnly\__init__.py
   C:\ProgramData\Ableton\Live 13 Beta\Resources\MIDI Remote Scripts\MF_SEQ_Push_ReadOnly\surface.py
   C:\ProgramData\Ableton\Live 13 Beta\Resources\MIDI Remote Scripts\MF_SEQ_Push_ReadOnly\session.py
   C:\ProgramData\Ableton\Live 13 Beta\Resources\MIDI Remote Scripts\MF_SEQ_Push_ReadOnly\inspect_host.py
   ```

   Avoid a second nested folder. Do not replace another script. This separate
   folder was absent at review time; stop if Windows unexpectedly asks to
   replace it. The installation is specific to the confirmed Beta installation.
4. Relaunch Live. Open a **disposable Set with a duplicate existing native Step
   Sequencer clip**; keep transport/recording stopped. Keep Twister untouched.
5. On Push, press **Clip Mode** and, if needed, hold **Layout** and choose
   **8-Row**. Confirm it shows the same native clip. **If unavailable, stop and
   report the Live/Push versions**; no conversion or update is required for
   this test. These controls are documented in Push b25; desktop is currently b24.
6. Open Live Settings > **Link, Tempo & MIDI** (the MIDI/Control Surface page).
   In an **empty** Control Surface slot select **MF SEQ Push ReadOnly**; set
   that slot's **Input = None, Output = None**. Preserve existing Push/Twister
   assignments. If the script is missing, stop and report that; do not substitute
   MFSEQsteptest or another similarly named diagnostic.

Selecting the script starts logging. Close Settings and start a stopwatch.
Wait five seconds before beginning. No separate logger window appears.

## Two-minute test — owner actions only

Wait **five seconds before and after** each action. Note time, row/column and
visible old/new values. Use page 1, column 1 where possible.

1. Turn Push's **jog wheel** to another existing row, then back. Note whether
   Live's row selection follows. Identify one empty pad and one lit pad.
2. **Tap the empty pad once**; confirm exactly that native step turns on.
3. **Hold the lit pad**, confirm its step highlight, and turn the encoder
   labeled **Velocity** to a different value, e.g. 64. Release.
4. Hold that same lit pad; turn the encoder labeled **Pitch** one displayed
   increment. Release. Record the exact values/units.
5. Optional: with pads released, change the selected row's clearly labeled
   **Rate** by one increment. Skip if unclear.

After two minutes, return **only the diagnostic slot to None**. Discard the
disposable Set if desired. Do not launch playback, use Convert, change firmware,
MIDI mappings or Native Mode, or edit the Master Set.

## Return results

Reply **test finished**, with Live/Push versions and the visible old/new values
(the included `OWNER_RESULTS.txt` is a simple template). If blocked, state which
installation step/control was missing. No further hardware actions are implied.

Codex can then collect the diagnostic lines from the local log; **no full-log
upload is needed**. For the current installation the log is:

```text
C:\Users\lovea\AppData\Roaming\Ableton\Live 13.0b24\Preferences\Log.txt
```

If About Live shows a different build, use its corresponding version folder.
Codex will extract only the latest `MFSEQ_PUSH_RO` capture, preserve original
timestamps, check runtime/finished/disconnect records and sampling limits, and
compare samples around the owner's action times. No controls are operated by
the logger. Its reads currently cannot reach native step/lane state in the
tested ordinary b24 host; UI results and API results will be reported separately.

See [OWNER_TEST.md](OWNER_TEST.md) for per-action UI/log comparisons and
[SDK_REVIEW.md](SDK_REVIEW.md) for the existing capability matrix. Logger/source
review does not resolve the blocked newer SDK/build checks. Stable/Master and
the preserved R1 workspace remain unchanged.
