# Push 3 desktop test — two minutes of actions

**Owner run completed; see [results and evidence limits](hardware_2026_11_19/RESULTS.md).**
The owner performs all hardware actions; this remains the repeat procedure.

1. Preserve your working Set. Use a **disposable Set with a duplicate existing
   native Step Sequencer clip**. Keep playback/recording stopped; leave Twister
   untouched. Record About Live's full build and Push's software version.
2. Press **Clip Mode**. Hold **Layout**, choose **8-Row** if needed. Confirm
   Push and Live show the same native clip. If these controls are missing,
   **stop and report versions**. They are documented in Push b25; the inspected
   desktop is **13.0b24**. Do not convert a clip to make them appear.
3. Load the separate [read-only logger](LOGGER.md) in an **empty** Control
   Surface slot, **Input None / Output None**, preserving existing assignments.
   Start a stopwatch when selected. Wait five seconds.
4. Perform the actions below. **Wait five seconds before and after each**;
   note time, row/column and visible old/new values. Use page 1 / column 1
   where possible. All changes stay in the disposable duplicate.

| Action | Push control | Expected visible result |
|---|---|---|
| Select row / identify step | In Clip Mode turn **jog wheel** to another existing row and back. Identify an empty pad; don't tap merely to select. Check step highlight during the velocity action. | Live/Push row selection follows; record row pitch/label or disagreement. |
| Toggle one step | **Tap the empty pad once.** | That step changes off -> on. |
| Change velocity | **Hold that newly lit pad**, check its highlight, turn encoder labeled **Velocity** to a different value, e.g. 64; release. | Native Velocity changes; record both values. |
| Change pitch | Hold **the same lit pad**; turn encoder labeled **Pitch** one displayed increment; release. | Native step Pitch changes; record both values/units. |
| Optional rate | Release pads; turn the selected row's clearly labeled **Rate** encoder one increment. Skip if unclear. | Only that row's Rate changes. |

For **each action**, the logger samples clip type, selection getter results,
conventional note count (pitches 0–127, beats 0–4), and the guarded Push-root
candidate before/after. Native row/first-step values appear **only if reachable**;
column 1 must match the tested step. Missing attributes are logged literally.
**Direct native reads remain unavailable in the tested ordinary b24 host.**

After two minutes restore **only the diagnostic slot to None**. Return versions,
action times, visible values and `MFSEQ_PUSH_RO` log lines. See [log location](LOGGER.md).
Discard the disposable Set if desired. Do not use Convert, firmware changes,
Native Mode, MIDI mappings, or the Master Set. UI success alone proves no public
native writer.

Controls: [official Push beta notes](https://www.ableton.com/en/release-notes/push-13-beta/).
