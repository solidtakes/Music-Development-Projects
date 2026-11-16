MF4TRKBento Beta 3.6 EXP — Utility Chords / Independent Button Rows
=====================================================================
EXPERIMENTAL. GitHub mock CI does NOT validate physical Ableton or MIDI Fighter
Twister behavior. Beta 3.3 is designated stable rollback; retain owner-tested
Beta 3.4 and experimental Beta 3.5 ZIPs. No Native Mode changes or auto-merge.

DEFAULT (unchanged):
  Rotary: Row1 Sends A, Row2 Sends B, Row3 Pan, Row4 Volume
  Push:   Row1 Clip Launch, Row2 Arm, Row3 Solo, Row4 Mute

ROTS and BUTTONS are independent in ALL FOUR rows; changing either one must
never reassign the other. Missing rotary parameters: white ring completely off
and rotation does nothing; RGB LED remains set by the normal push module.

BUTTON MODULES (HOLD first push + TURN last encoder, 4 detents per step):
  Blank / Clip Launch / Arm / Solo / Mute / Stop
  Clip Launch and Blank can repeat in multiple rows. Arm, Solo, Mute and Stop
  each have a MAXIMUM OF ONE ROW and skip if already assigned elsewhere.
  Device Control is NOT a button module.

ROTARY MODULES (HOLD last push + TURN first encoder, 4 detents per step):
  Volume / Pan / Sends / Device Control
  All may repeat freely, in any row and in gaps. Temporary full-row RGB
  preview: green Volume, blue Pan, purple Sends, yellow Device Control;
  normal push RGB colors restore on release; white rings retain parameters.

TOPMOST ACTIVE ROW ONLY owns shared utility shortcuts for that rotary type.
Physical row modifiers and corresponding first/second/third controls:
  Row1: HOLD E4  + tap E1/E2/E3, or twist E1/E2/E3
  Row2: HOLD E8  + tap E5/E6/E7, or twist E5/E6/E7
  Row3: HOLD E12 + tap E9/E10/E11, or twist E9/E10/E11
  Row4: HOLD E16 + tap E13/E14/E15, or twist E13/E14/E15

DEVICE CONTROL UTILITY (only topmost Device rotary row):
  Hold last + tap first:   selected Device power ON/OFF
  Hold last + tap second:  next FULL parameter page (+4 per Device row);
                           wraps at last available page (legacy tap behavior)
  Hold last + twist second: move parameter starting position +/- FOUR;
                           FIVE detents per step, CLAMP at ends
  Hold last + tap third:   next selected Device (convenient short press)
  Hold last + twist third: previous/next selected Device;
                           FIVE detents per device navigation
  Hold last + twist first: preserved rotary-module selector (4 detents)
  Device rows own sequential groups of four, in physical top-to-bottom order.
  A full page spans 4 * Device row count. Absolute offset is shared; twist
  moves that offset by 4, tap advances by a whole page. Hard cap: four full
  pages of parameters. Selected device change resets the offset.

SENDS UTILITY (only topmost Sends rotary row):
  Hold last + tap first:  shift shared Send start DOWN one (A->B), no wrap
  Hold last + tap second: shift shared Send start UP one (B->A), no wrap
  Hold last + twist first: preserved rotary-module selector (4 detents)
  All Sends rows take sequential destinations from current Send start in
  physical top-to-bottom order, including gaps. The final start can leave
  lower Sends rows without parameters; their white rings go dark and their
  rotaries do nothing. Up stops at A; down stops at last available Send.
  REMOVED: provisional Beta3.5 HOLD second + TWIST third Sends page command.

UTILITY SAFETY:
  Global E1/E16 gestures have priority over the row-local utility gestures.
  Once utility chord is recognized, its held modifier and tapped buttons are
  consumed until all participating presses are released; never launch Clips,
  Arm/Solo/Mute/Stop or modify rotary parameters as a side effect.
  No intentional debounce delay; start with minimal press/turn filtering.
  Holding last push alone and releasing still operates its normal push module.
  Module selection gestures preserve their current 4 detents per step.

TEST BEFORE FREEZE:
  1. Default Sends A/B, Pan, Volume, RGB push colors and volume white VU.
  2. Device and Sends rows in any order, including 2+2 and nonadjacent.
  3. Device utility power, full-page tap, +/-4 slow bank scroll, device prev/
     next slow scroll, E3 tap next device; check 5-detent behavior.
  4. Sends tap shift A-B -> B-C -> C-D; no wrap at limits.
  5. No accidental Clip/Arm/Solo/Mute/Stop on any modifier press/release,
     regardless of which of the two buttons is released first.
  6. Unavailable Device/Sends encoders dark while unrelated push RGB persists.
  7. All four Clip rows + single-instance Arm/Solo/Mute/Stop module selectors.
  8. Preserve E1/E16 global switching, legacy row selectors, FX Returns,
     volume MIDI white-ring-off and 35ms press contamination guard.

INSTALL: Exit Live, back up current MF4TRKBento folder, unzip the inner
installable ZIP to Ableton MIDI Remote Scripts to replace just MF4TRKBento.
Restore working ZIP if a hardware regression appears.
