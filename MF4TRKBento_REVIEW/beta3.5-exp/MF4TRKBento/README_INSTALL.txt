MF4TRKBento Beta 3.5 EXP — Linked Sends, Send Paging and Flexible Push Rows
==============================================================================
EXPERIMENTAL, NOT HARDWARE-VERIFIED. Owner says Beta 3.4 layout works on
hardware; Beta 3.3 is the preserved designated stable rollback. Preserve
existing installations and archived ZIPs. No Native Mode, MFT Utility,
cross-bank MIDI mapping changes or automatic merge.

DEFAULT STARTUP (UNCHANGED FUNCTIONALLY)
----------------------------------------
Top -> bottom rotary rows: Sends (A), Sends (B), Pan, Volume.
Top -> bottom push rows: Clip Launch, Arm, Solo, Mute.
White rings represent parameter values; Volume row includes live VU when
audio is active and fader position fallback, MIDI tracks without audio
remain dark. RGB normally shows PUSH-module state/clip colors.

SENDS IS ONE MODULE — CONNECTED TOP TO BOTTOM
----------------------------------------------
When 1 rotary row is set to Sends, it starts at Send A.
With 2 Sends rows (even separated), topmost = A, lower = B.
With 3 Sends rows: topmost = A, next = B, next = C.
With 4 Sends rows: A, B, C, D, spanning 4 tracks (16 Twister encoders).
Any row can be Sends; other rows may be Volume, Pan or Device Control.

SENDS BANKING (NEW)
-------------------
On the TOPMOST physical Sends row only:
   Hold its SECOND encoder push and rotate the THIRD encoder
   FOUR detents (forward / backward) to change Send page.
Examples:
   Row 1 Sends: HOLD E2 + TURN E3.
   Row 2 Sends: HOLD E6 + TURN E7.
   Row 3 Sends: HOLD E10 + TURN E11.
   Row 4 Sends: HOLD E14 + TURN E15.
Pushing/turning for this gesture will not launch clips or turn Sends,
and will consume the modifier on release. A lone push still performs
the normal assigned push-module action.

One Sends row: pages A; B; C; D ... up to P (16 destinations).
Two Sends rows: pages A-B; C-D; E-F ... up to O-P.
Four Sends rows: pages A-D; E-H; I-L; M-P.
Paging wraps at the last available destination, based on Return tracks
and mixer Sends. Only available parameters light their white ring.
The Send bank is INDEPENDENT from Device Control's four banks.
A non-audio MIDI track has no Sends white ring.

MODULE SELECTION (PRESERVED FROM BETA 3.4)
------------------------------------------
Hold FIRST encoder push and turn LAST encoder rotary of the row:
  select its push-button function: Blank, Clip Launch, Arm, Solo, Mute,
  Stop, Device Control.

Hold LAST encoder push and turn FIRST encoder rotary of the row:
  select its rotary function: Volume, Pan, Sends, Device Control.
  Temporary full-row RGB preview: green = Volume, blue = Pan,
  purple = Sends, yellow = Device; the RGB push colors restore
  automatically on release. White rings remain as parameter indicators.
Both selectors advance a function every FOUR detents.

NEW FLEXIBLE BUTTON LAYOUT
--------------------------
All four rows can be Clip Launch, and Arm/Solo/Mute/Stop can be repeated
as desired. No exclusivity restriction across rows; functionality still
acts on the controlled track's associated clip/arm/solo/mute/stop.
Original global E1/E16 chords, tracks vs FX Returns, scene scroll and
navigation are preserved.

DEVICE CONTROL
--------------
Device rows may be positioned anywhere. The page stride is 4 times
active Device rotary row count. Device banks are still a maximum of 4
(1 row = 16 parameters, 2 rows = 32, 3 rows = 48, 4 rows = 64).
A Device Control PUSH module on an active Device rotary row gives that
row power/bank/previous/next device actions; the first qualifying row
gets navigation. Other push modules can be mixed with Device rotary rows.

TEST CHECKLIST
--------------
1. Confirm default Sends A/B, Pan, Volume and default button modules.
2. Set the third row to Sends and confirm row mapping A/B/C. Set the
   top row to Device Control and confirm the remaining Sends rows reindex
   A/B, rather than silently losing Send A.
3. On the first Sends row, hold its SECOND push and turn the THIRD knob
   four detents. Confirm bank advances by the number of Sends rows, and
   only this action occurs (no clip launch, no parameter change).
4. Assign all four rows Sends and confirm pages A-D, E-H, I-L, M-P
   when 16 Return tracks and sends are available. Fewer Sends must
   bank only through available groups, wrapping to A.
5. Mix two Sends rows and two Device rows, verify distinct bank controls.
6. Put Clip Launch on all four button rows; check four different scenes
   launch. Duplicate Arm, Solo and Mute with their usual track semantics.
7. Verify RGB preview restores button LED colors, normal Volume VU works,
   empty MIDI tracks remain dark, FX mode and global gestures work.
8. Monitor the Live log for unexpected errors and compare against Beta 3.4.

INSTALL
-------
Fully quit Live. Back up existing MF4TRKBento folder. Extract this ZIP
to your Ableton MIDI Remote Scripts location so it contains ONLY
MF4TRKBento/__init__.py and MF4TRKBento/MF4TRKBento.py with README.
If a regression occurs, quit Live and restore the previous tested build.
Mock CI is NOT a physical Ableton or Twister test; no stable promotion.
