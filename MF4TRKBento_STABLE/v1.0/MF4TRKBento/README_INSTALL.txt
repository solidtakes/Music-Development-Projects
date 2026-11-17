MF4TRKBento v1.0 STABLE — Utility Chords / Independent Button Rows
=====================================================================
OWNER-ACCEPTED STABLE MILESTONE. GitHub mock CI is not a substitute for
independent full-device Ableton/MIDI Fighter Twister verification. Beta 3.3 is designated stable rollback; retain owner-tested
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

v1.0 STABLE — VERTICAL SHORTCUTS (same column, adjacent PHYSICAL row)
  HELD PUSH MODULE        TAP             ACTION ON THAT COLUMN'S TRACK
  Clip Launch             BELOW           Stop Clips on this track
  Clip Launch             ABOVE           Select this track in Ableton
  Mute                    BELOW           Toggle exclusive Solo
  Solo                    ABOVE           Toggle Mute
  Solo                    BELOW           Toggle exclusive Arm
  Arm                     ABOVE           Toggle exclusive Solo

  The held button's push-module type determines the action. The target's
  own push module and both rows' rotary modules are irrelevant. Press order
  matters: hold Clip then tap Arm below = Stop; hold Arm then tap Clip above
  = Solo. No wrap at top/bottom, no search past immediately adjacent row,
  and no cross-column actions.

  Commands are triggered on second button press, with no intentional delay.
  Both presses are consumed through their releases; no stray clip launch,
  mute, arm, solo, stop or module-selection action on either release.
  Existing E1/E16 global shortcuts and same-row Device/Sends utility
  shortcuts remain higher priority. Arm and Solo retain exclusive single-
  track behavior. Solo on FX Returns is supported, Arm on Returns is gated
  by can_be_armed. A Clip Stop chord in FX Returns mode is a safe no-op.
  In alternate 3-clip-plus-scene layout, column four produces no vertical
  track actions, particularly NO global Stop All.
  Track Select uses Song.View.selected_track; it does not change which
  device is selected inside that track. Device page returns to first group
  when selected track changes. White rings update to the new track's
  selected device; missing device/parameters leave white rings dark.

HARDWARE TEST FOCUS FOR 3.7:
  - Order-sensitive Clip below Stop vs Arm above Solo, and other reverse pairs
  - Same-column only, physical row adjacency only, top/bottom boundaries
  - Both release orders and no accidental normal push action
  - Track Select follows offset and switches Device rows/rings immediately
  - Alt 3 clips + scene col4 does not trigger Stop All or Master Unsolo
  - FX Returns: select/solo/mute valid, Arm/Clip Stop safe/no-op
  - All accepted Beta 3.6 same-row Device/Sends utilities remain working
  - Zero added intentional press latency
