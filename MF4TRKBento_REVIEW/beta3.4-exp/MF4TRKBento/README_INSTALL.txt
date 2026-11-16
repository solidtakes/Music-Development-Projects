MF4TRKBento Beta 3.4 EXP — Custom Rotary Rows and RGB Preview
==============================================================

EXPERIMENTAL CANDIDATE — NOT OWNER-FROZEN.
Stable rollback is owner-accepted Beta 3.3 (exact ZIP SHA-256:
7af1cb6d99f884b0ddc607745bed15ad28396f17293cd06efabac60f41cf06c7).
Preserve the installed Beta 3.3 package and previous archives for rollback.
Bank 2 only: no changes to MFT Utility, Native Mode or other banks.

DEFAULT (UNCHANGED)
-------------------
Physical rows top to bottom: Send A | Send B | Pan | Volume.
Default button modules: Clip Launch | Arm | Solo | Mute.
Using the ORIGINAL button-module selector before any custom rotary edit
retains automatic top-down Device row replacement as in Beta 3.3.

TWO MIRRORED GESTURES (FOUR DETENTS PER SELECTION STEP)
------------------------------------------------------
A. HOLD FIRST PUSH + TURN LAST ROTARY: change that row's PUSH module.
   Row 1 E1+E4; Row 2 E5+E8; Row 3 E9+E12; Row 4 E13+E16.
   Push choices: Blank, Clip Launch, Arm, Solo, Mute, Stop, Device Control.
   Arm/Solo/Mute remain unique. The normal clip/track/global controls remain.

B. HOLD LAST PUSH + TURN FIRST ROTARY: change that row's ROTARY assignment.
   Row 1 HOLD E4 + TURN E1
   Row 2 HOLD E8 + TURN E5
   Row 3 HOLD E12 + TURN E9
   Row 4 HOLD E16 + TURN E13
   Rotary choices: Volume | Pan | available FX Sends A/B/C/... | Device Control.
   The Send choices reflect currently available Return tracks (max 26).
   When none are available, they are skipped in the custom selector.
   When a custom Send is selected, its exact destination is used.
   The original single-send fallback for the legacy automatic layout remains.

RGB FUNCTION PREVIEW
--------------------
While the last push is held, all four RGB LEDs in its row temporarily
show the assigned rotary-function color:
   Volume = green 76, Pan = light blue 68,
   Send = purple 96, Device Control = yellow 108.
Changing selection refreshes the row preview immediately. White rings
still indicate the selected parameter/meter values independently.
Releasing the last push restores the usual Clip/Arm/Solo/Mute/Stop colors
and animations, without triggering an accidental push action after a
selector turn. Holding without turning retains the normal push action.
The row preview is temporary; the chosen rotary assignment persists.

INDEPENDENT ROWS
----------------
The first use of the reverse rotary selector snapshots the working layout.
Subsequent changes modify ONLY that physical row. Device Control can be on
any row or several nonadjacent rows, without the "Change lowest Device row
first" restriction. Physical Device rows are ordered top to bottom to
assign non-overlapping parameter groups. The first row with BOTH a Device
rotary and Device push module has the yellow E1/2/3/4-style device actions
(power/bank/prev/next); later Device push rows remain blue. When a Device
rotary row has another push module, it retains that push functionality.
Device banks: up to four pages, each page containing 4 × number of
Device rotary rows (16/32/48/64 parameters max for 1/2/3/4 rows).

SAFETY / HARDWARE CHECKS
------------------------
1. Verify initial Send A / Send B / Pan / Volume and button modules work.
2. HOLD E16 + TURN E13 four detents: Volume -> Pan on bottom row, without
   changing its Mute push action or other rows. Watch green -> blue preview;
   after releasing E16 its normal Mute LED returns.
3. HOLD E8 + TURN E5, select Send C when three Returns exist. Confirm Send C
   parameters, not Send B, are changed. Check absent sends are skipped.
4. Assign Device Control to Row 3 only. Verify its knobs control device
   params 1–4, others stay unchanged; when a Device push module is also
   assigned there, test bank/power and navigation. Add another Device row
   with a gap and verify Bank 2 advances by eight parameters.
5. Check default global combinations E1-hold+E16, E16-hold+E1, track and
   scene scrolling. Check missing columns, Returns and alternate Master.
6. Verify empty MIDI tracks have dark mixer white rings; audio Volume
   white VU still animates and returns to fader level on silence.
7. Test no parameter changes occur while turning the mirrored selector.

INSTALL: Quit Live fully, back up the existing MF4TRKBento folder, unzip,
install ONLY MF4TRKBento into Live's Remote Scripts location, launch Live.
If anything fails, quit Live and restore the accepted Beta 3.3 package.
Automated tests are offline mocks, NOT proof of Live or hardware behavior.
No auto-merge or release-candidate freeze until owner acceptance.
