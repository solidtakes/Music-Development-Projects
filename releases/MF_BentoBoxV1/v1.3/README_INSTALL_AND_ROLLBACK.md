# MF BentoBoxV1 v1.3 — Dual Transport/Edit + Bank Scroll Transition TEST

**EXPERIMENTAL COMBINED-BUILD CANDIDATE.** Not proven in Ableton Live 13 or on the
physical MIDI Fighter Twister. This is not yet a production or v1 Stable build.

Derived from the owner's v1.2 combined candidate
`MF_BentoBoxV1_v1.2_HoldSave_MIDI_Activity_VU_TEST.zip`.
The existing Bank1, Bank2, Bank3, scale_sync, layout_state and entrypoint
modules are byte-identical to v1.2. Only `ThreeBankHost.py` was altered; the
new `secondary_edit.py` and `bank_transition.py` implement isolated host layers.
There are no changes to controller setup (`.mfs`), MIDI channel/CC mapping,
Native Mode, standalone builds or source ZIPs.

## Left-top and right-top control modes

* **Left top, Ch4 CC8:** tap toggles Transport; hold enters momentary Transport.
* **Right top, Ch4 CC11:** tap toggles Editing; hold enters momentary Editing.
* Modes are independent: either can be latched while the other is off, or both
  can be active at once. No automatic disabling of the other mode.

| Left Transport | Right Editing | Row 3, E9–E12 | Row 4, E13–E16 |
|:--:|:--:|:--|:--|
| Off | Off | Original bank controls | Original bank controls |
| On | Off | Original bank controls | Transport |
| Off | On | Original bank controls | Arrangement Editing |
| On | On | Arrangement Editing | Transport |

While the right-side modifier is held, its existing top-row **E1–E4** preset
recall (short press) / save (two-second hold, immediate confirmation) stays
available, as does **E8** factory restore (two-second hold). In Transport Mode,
right-side + E13 rotation retains one-beat shuttle. Chords that use the right
side do not accidentally toggle Editing when released. Press/release consumed
by an active layer should not fall into the native bank on a mode transition.

### Transport (unchanged from v1.2)

E13 Play/Stop, E14 Session Record, E13+E14 Arrangement Record, E15 Capture MIDI,
E16 Arrangement Loop. E13 rotation moves +/- one bar per four detents;
right+E13 in Transport moves +/- one beat per four detents. E16 rotation moves
whole loop +/- one bar per four detents; hold E15+E16 turn edits loop end
+/- one beat per four detents. Existing capture LED, record indicators, and
native-bank restoration are retained.

### Arrangement Editing — new

Buttons and turn actions below are **relative to the four Editing slots**.
When Editing is the only layer they are E13/E14/E15/E16. With both active they
move to E9/E10/E11/E12.

| Slot | Button | Turn | LED |
|--|--|--|--|
| 1 Punch In | Toggle `song.punch_in` | Reserved | Blue off, yellow on |
| 2 Editable range | Create new 1-beat loop brace at the current playhead; hold and turn resizes the **right** boundary | Move the whole range +/-1 beat / **4 detents** | Yellow |
| 3 Zoom | Hold for vertical zoom while rotating | Horizontal zoom in/out of active supported Arranger or Clip view / **4 detents** | Pink |
| 4 Punch Out | Toggle `song.punch_out` | Reserved | Blue off, yellow on |

**Range limitation:** the editable range is Live's **Arrangement loop brace**
(`song.loop_start` and `song.loop_length`). It does NOT create/edit an arbitrary
blue-highlighted Arrangement time selection, does not select clips, and does not
move clip contents. Punch In/Out use those loop boundaries when configured.
Zoom uses `Application.View.zoom_view` with existing focus when supported;
precise clip-waveform and piano-roll compatibility still requires real Live
runtime testing. Timeline changes are blocked during active Arrangement
recording. If an API is unavailable, the feature reports that limitation and
should not crash the Control Surface.

### On-screen mode reminder

The script shows one of:

- `BENTOBOX | TRANSPORT E13-E16`
- `BENTOBOX | EDIT E13-E16`
- `BENTOBOX | EDIT E9-E12 | TRANSPORT E13-E16`
- `BENTOBOX | NORMAL MODE`

While either overlay is active it refreshes the message on Ableton's status
line roughly every four seconds. This is **best effort**, not truly pinned:
Live may replace it with its own status/parameter messages. Preset and other
notifications still show in between reminders.

## Bank transition animation — hardware gated

The approved visual design is implemented as a host-owned LED overlay, with
**no hardware bank changes**:

* Bank 1 `SEL`: yellow; Bank 2 `4TRK`: blue; Bank 3 `SEQ`: purple.
* Each letter scrolls left to right across 16 encoders (4×4), with progressive
  white rings while the active glyph's RGB stays in the bank colour.
* 1.85-second transition. The last letter holds until bank feedback can
  replace the pixels, with no explicit all-black clearing frame.
* The host registers **Ch4 CC0–CC3** as possible bank-select reports. It starts
  a bank animation on a *positive* CC0/1/2 signal, but CC3/Bank4 is not
  animated. It never writes bank-select messages and does not change `.mfs`.

**Important runtime gate:** the exact firmware bank-report stream has **not
been captured** on the owner's updated Twister profile. Hardware may not emit
the expected Ch4 CC0–CC3 reports. In that case animations won't trigger, but
normal bank MIDI/control functions remain available. The owner must approve
and conduct a hardware probe before the feature is certified. The host buffers
normal bank LED output during animation and replaces the final glyph with any
available native feedback; it cannot prove a device-side 'bank fully loaded'
notification exists. If none has arrived, remaining final-letter pixels hold
until normal LED output overwrites them.

## Installation (only after owner hardware-test approval)

1. Back up your currently accepted v1.2 `MF_BentoBoxV1` Remote Script folder
   and keep its original ZIP as rollback; do not overwrite standalone sources.
2. **Quit Live**. Copy only `MF_BentoBoxV1/` from this ZIP into your user
   MIDI Remote Scripts directory, replacing the old combined folder.
3. Restart Live, choose **MF_BentoBoxV1** as the **only** Control Surface
   using the Twister's MIDI input and output. Use a disposable empty Set.
4. Verify Bank 1/2/3 native controls, module assignments, saved presets,
   transport recording chords, four-detent shuttle and MIDI VU **before**
   using the Editing layer. Leave v1.2 rollback readily available.
5. Tap top-right once: editing should occupy E13–E16. Test Punch In/Out and
   loop brace movement/length (not time selection), horizontal/vertical zoom.
6. Tap top-left: editing should move to E9–E12 and Transport to E13–E16.
   Test both independently, toggle off in either order, check LEDs restore.
7. Hold top-right and E1 for 2s: original preset-save 3-flash feedback should
   remain intact. Verify E1 short recall and E8 factory reset separately.
8. Check the text reminder and, **only if the Twister emits Ch4 CC0–CC3 bank
   reports**, view the 1.85s animations for SEL, 4TRK, SEQ. If no animation
   appears, capture the side-button MIDI messages before altering firmware.
9. On any startup error or regression: quit Live, keep `Log.txt`, remove v1.3,
   restore the exact v1.2 folder and restart. Keep the per-user preset JSON;
   don't wipe it as part of rollback.

## Offline verification and remaining gates

- 105 controlled-framework unit/integration tests pass from the ZIP extraction.
- Python source syntax/compilation, all ZIP CRCs, and source-parity checks pass.
- `MF_BentoBoxV1` remains a single `create_instance` Control Surface host.
- Offline shim tests **cannot** establish real Live MIDI event forwarding,
  physical RGB/white ring behaviour, bank-select side reports, or zoom
  compatibility in Arrangement/clip views.
- No stable branch merge, distribution release or hardware-success claim is
  authorized by this artifact. Owner hardware acceptance and independent
  review are prerequisites to any v1 Stable promotion.
