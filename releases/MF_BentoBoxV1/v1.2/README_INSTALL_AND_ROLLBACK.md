# MF BentoBoxV1 — v1.2 Milestone Candidate: Instant Preset Hold-Save + Bank 1 MIDI VU

**Owner requested the next working version; hardware testing of v1.2 is still pending.**
Built from the owner-confirmed working **Beta 2.4**. Preserves that ZIP as rollback.
Changes are isolated to the shared host's preset timing and to **Bank 1's
MIDI activity VU rendering**. Bank 2, Bank 3, `scale_sync.py`, `layout_state.py`,
and the Ableton entrypoint are byte-identical to Beta 2.4. The physical
`MF3BANK build 1(1).mfs` configuration is unchanged.


## Factory Default — protected in the script

Selected Track Bento (Bank 1):
- Column 1: Mixer Channel (Track Mixer)
- Column 2: 4 FX Sends
- Column 3: VU / Beat (default Selected Track VU)
- Column 4: Master Mixer

Four-Track Bento (Bank 2), from top row to bottom:
- Rotaries: Device Control / Device Control / Sends / Volume
- Pushes: Clip Launch / Clip Launch / Clip Launch / Clip Launch

Bank 3: Sequencer SP1 unchanged. Only Bank 1 and Bank 2 module assignments
are saved. Other controller values, FX levels, device parameters, MIDI routing,
clip states, step sequencer notes and LED settings are never persisted.

## Right-top side button (MIDI Channel 4, CC11, CC Hold)

This is a global hardware modifier across Banks 1/2/3:

| Hold top-right + push | Effect |
|--|--|
| E1 | Recall Preset 1 on short press; save current Bank 1+2 layout AS SOON AS 2s is reached |
| E2 | Recall Preset 2 on short press; save current layout immediately at 2s |
| E3 | Recall Preset 3 on short press; save current layout immediately at 2s |
| E4 | Recall Preset 4 on short press; save current layout immediately at 2s |
| E8 (2 seconds) | Restore Factory Default; user presets are **not** deleted |
| E13 rotate, while Transport Mode is active | Retains 1-beat Arrangement shuttle, 4 detents per beat |

The top-left side button still provides momentary and latched Transport Mode,
without functional changes to the accepted v1.1 playback, Session Record,
Arrangement Record chord, Capture MIDI, loop resize or shuttle.

**Top-right short tap Secondary Mode remains RESERVED** until its functions are
specified. It does not toggle an unfinished or inert secondary control page.
The right-side button's held preset gestures do not activate it accidentally.

## Preset colours and confirmation

When top-right is held, the first row displays preset slots in all banks:
E1 Blue, E2 Green, E3 Purple, E4 Yellow. Occupied slots light up; empty slots
stay dark. Three bright pulses in the slot colour indicate **disk save success at the two-second hold threshold, before you release the encoder**;
one pulse indicates preset recall. Three RED pulses mean an empty-slot recall
or failed save. Factory restore pulses the first row yellow three times.
These colours are provisional MF Twister standard/extended palette assignments
and must be confirmed on physical hardware. Normal bank LED feedback is
restored when the modifier/confirmation finishes. The release is consumed after a hold-save and never recalls or saves twice.

## Capture MIDI purple RGB repair

In Global Transport, E15 uses the same MIDI RGB purple code as the accepted
FX Sends module (code 47), with a 75%-on blink while
`Song.can_capture_midi` is true. A successful Capture MIDI gives a short,
brighter purple pulse (code 104). The white availability ring is preserved.
The previous v1.1 code used palette code 96 and had an owner-reported absence
of purple RGB while the white ring indicated Capture MIDI was available.
**Hardware verification is required**; offline testing proves MIDI messages,
not the physical LED colour or pulse timing.

## Persistence

- On first launch, if no last-used layout is present, load Factory Default.
- Changing Bank 1 columns or Bank 2 button/rotary rows auto-saves the new
  assignment layout after a short deferred scan. Pending changes are also
  flushed on normal disconnect when writable.
- A valid saved last-used layout restores automatically at Live startup.
- Four global preset slots persist across Live restarts and script upgrades.
- Factory Default is embedded and never overwritten by presets or auto-save.
- Malformed or incompatible state documents are rejected; the previous valid
  .bak is used when available. Corrupt primary files are quarantined to a
  `.corrupt*.json` filename before a new valid write.
- State writes use a temporary file + atomic replacement. If disk access is
  denied the script continues using Factory Default/volatile state and reports
  save failure; it never claims a successful save.

Windows state folder:
`%APPDATA%\MF_BentoBoxV1\layouts-v1.json`

macOS state folder:
`~/Library/Application Support/MF_BentoBoxV1/layouts-v1.json`

The JSON state folder is outside Ableton's Remote Scripts folder, so replacing
this test build does not erase it. If testing and rolling back to v1.1, the
extra state folder may remain unused. Back up the state folder before trying
other experimental releases. You can also override the directory using
`MF_BENTOBOX_STATE_DIR` for isolated tests.

**Not implemented yet:** Set-scoped preset identity or in-Live Set embedded
storage, named labels via controller, preset deletion, and the top-right
short-tap Secondary Mode. Only four global slots are active.


## Bank 1 Track Mixer / Selected Track VU — MIDI activity white LEDs

When a selected track accepts MIDI input, the Track Mixer column's four **WHITE**
encoder LEDs show **four MIDI-activity steps bottom-to-top** (0–4) rather than
audio loudness or the volume fader ring. Push-button RGB LEDs and all mixer
functions remain unchanged. The separate Bank 1 `VU / Beat` module also uses
MIDI meter activity for **Selected Track VU** on MIDI tracks; its Master VU
continues to show actual master audio. On audio tracks the previous audio-meter
behavior is unchanged.

The script samples Live's MIDI input `input_meter_level` for MIDI tracks with
instruments, or MIDI output `output_meter_level` for pure MIDI-output tracks.
It deliberately does **not** use post-instrument audio L/R levels as a MIDI
proxy. If Live does not expose an appropriate meter at runtime, the display
shows **no activity** rather than inventing note events. Live's MIDI meter is a
coarse activity indicator, not a 1:1 display of note velocities/number of notes.
Real Live 13 validation is required for both pure MIDI tracks and MIDI tracks
with an instrument: meter values may vary by monitoring/routing. No extra
Max for Live devices or external routing are required.

## Installation and owner hardware test

1. Close Live. Back up the current `MF_BentoBoxV1` Remote Script folder and
   retain `MF_BentoBoxV1_v1.1_MILESTONE_Session_Record_TEST.zip` as rollback.
2. Extract the new ZIP and copy **only** its `MF_BentoBoxV1` folder into the
   User Remote Scripts directory. Do not install `qa`, README or manifest.
3. Restart Live 13. Select Control Surface **MF_BentoBoxV1** with Twister
   MIDI input and output. Never select two control surfaces using the same
   Twister ports simultaneously.
4. Use a disposable empty Live Set. Verify the untouched Bank 1, 2 and 3
   controls, the E13+E14 Arrangement Record chord, transport, and sequencer.
5. Confirm Bank 1 factory columns and Bank 2 button/rotary rows.
6. In Transport Mode, enable Capture MIDI eligibility by recording some MIDI
   without manually recording a clip. Check whether E15 *RGB* flashes purple
   (not only white ring). Tap E15 to Capture; verify its brief purple pulse.
7. Change module assignments. Restart Live; check the last-used layout comes
   back. Holding top-right, long-press E1 for >=2 seconds and release; check
   three blue flashes. Change the layout again, recall Preset 1 with right+E1
   short press; verify one blue pulse and correct assignments. Repeat across
   another bank if desired.
8. Test right+E8 long hold restores Factory Default without deleting Preset 1.
   Check that the usual bank LEDs return after releasing the right modifier.
9. If Live hangs, doesn't load, fails to write storage, or module/LED behavior
   regresses, close Live, preserve fresh `Log.txt`, and restore the backed-up
   v1.1 folder. Do not edit the hardware `.mfs` file.

## QA limits

Offline `_Framework` shims do NOT prove Live 13 can write to the user profile,
that factory VU/clip mapping performs properly under real tracks/devices, or
that the MF Twister honours all RGB palette codes. No Mac runtime, Windows
Live startup or actual hardware tests are claimed. No Set-scoped persistence,
manual stable merge or GitHub release is implied by this ZIP.

## v1.2 hardware validation (owner gate)

1. Back up the complete working Beta 2.4 `MF_BentoBoxV1` folder and original ZIP.
2. Quit Live entirely, install ONLY the new `MF_BentoBoxV1` folder and restart.
3. In an empty test Set, test normal Bank 1/2/3 gestures and Transport Mode.
4. Hold top-right + E1. At the **2-second point, while still holding E1**,
   the E1 RGB LED should flash blue three times. Release: no additional recall.
5. Use a short top-right + E1 to recall; test empty slot and write-error handling.
6. Choose an audio track: audio VU must behave as before. Choose a MIDI track
   with an instrument and play MIDI into it: the Bank 1 Track Mixer column white
   ladder and the VU/Beat column should respond to MIDI meter activity, not
   output audio; test a pure MIDI-output track separately.
7. If there is a regression, quit Live and restore Beta 2.4. Do not modify the
   persistent `%APPDATA%\MF_BentoBoxV1\layouts-v1.json` as part of rollback.

Status: Offline shim tests and packaging verified; **NO actual Live 13 / Twister
hardware proof, no independent review, no merge into stable**.
