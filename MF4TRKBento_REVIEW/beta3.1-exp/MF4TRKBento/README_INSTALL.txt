MF4TRKBento Beta 3.1 EXP — Priority Device Rows
================================================

Owner-approved experimental successor to the hardware-working Beta 3.0 EXP.
Do not overwrite your Beta 3.0 EXP or Beta 2 rollback ZIP.
This is a Bank 2-only test package; do not change other banks or MFT Utility.

LAYOUT — TOP TO BOTTOM
----------------------
0 Device rows:  FX Send B | FX Send A | Pan | Volume
1 Device row:   Device 1  | FX Send A | Pan | Volume
2 Device rows:  Device 1  | Device 2  | Pan | Volume
3 Device rows:  Device 1  | Device 2  | Device 3 | Volume
4 Device rows:  Device 1  | Device 2  | Device 3 | Device 4

Device Control always consumes rows TOP DOWN. Add the next Device row by
selecting 'Device Control' on the first mixer row immediately beneath the
current Device stack. Remove Device rows BOTTOM UP. This keeps mixer rows
in their agreed physical locations; Volume disappears last.

The existing row selector is unchanged: hold each row's first encoder and
rotate its fourth, FOUR detents per module step. Internal Device rows cannot
be reassigned until the lowest active Device row is removed. The selector
skips 'Device Control' on lower mixer rows that are not the next available
replacement slot. Selecting 'Blank' on a mixer row disables its push action;
it does NOT alter the fixed rotary function of that row in this new design.

MIXER ROW BUTTONS
-----------------
Each remaining mixer row independently selects its button module:
Clip Launch, Stop, Arm, Solo, Mute or Blank. These selections never change
Volume/Pan/Sends rotary assignments on that row. Arm/Solo/Mute are unique
across rows. Clip/Stop may be used on multiple rows. Accepted clip/scene,
Arm/Solo, Mute, Master Unsolo, Stop All and navigation functions are retained.

DEVICE ROW FUNCTIONS
--------------------
The TOP Device Control row is the primary row:
 - E1 press: device power on/off; yellow indicator when ON, dark when OFF
 - E2 press: next bank, advancing by FOUR device parameters
 - E3 press: previous device on selected track
 - E4 press: next device on selected track
 - E1–E4 rotary: device parameters 1–4 (excluding the Device On parameter)

Additional Device rows beneath it:
 - all available parameter indicators BLUE (MIDI colour 68)
 - rotary groups 5–8, 9–12, 13–16, respectively
 - their ordinary pushes have no device-action function

The row's four rotary parameter groups remain consecutive when E2 banks.
The target is the device selected in the selected track's Device View.
When navigating devices, the device bank returns to the first group.
When no device or parameter exists, rings and unavailable LEDs clear.
Quantized parameters step one unit per detent; continuous parameters move
1/64 of their range per detent. Unsupported/unavailable parameters are ignored.

BANK 2 MIDI AND GESTURES
-----------------------
 - CC0–15 unchanged; rotary MIDI channel 12, push channel 11
 - Hold E1 + twist E16: track navigation (4 detents / step)
 - Hold E1 + twist E12: scene navigation (when Clip Launch rows exist)
 - Hold E1 then push E16: tracks vs FX Returns
 - Hold E16 then push E1: alternate 3-clips/scene mode
 - Modules: hold a row's first push + twist its fourth (4 detents / step)
 - Volume retains 35 ms rotary-first push contamination reversal
 - Device rows still have full four rotary parameters in alternate mode
 - No Native Mode, new CC mappings, storage/presets, or other bank changes

INSTALLATION
------------
1. Quit ALL Ableton Live processes.
2. Back up your installed MF4TRKBento folder.
3. Keep Beta 3.0 EXP and the Beta 2 v1.9 rollback ZIP unchanged.
4. Unzip, install ONLY the MF4TRKBento folder into Live's Remote Scripts
   location. No extra files or compilation cache are bundled.
5. Start Live and verify the four original mixer rows first.
6. Assign one Device row, then two, three and four; check each replacement
   and each device parameter ring, power LED, E2 bank and E3/E4 navigation.
7. Verify that mixer row push modules remain independent and that device
   row buttons do not trigger mixer functions.
8. Verify alt mode, Return banking, Master Volume/Pan and missing columns.

ROLLBACK
--------
If anything misbehaves, quit Live and reinstall the previously working
Beta 3.0 EXP folder. Beta 2 remains the additional rollback.

BUILD STATUS
------------
Beta 3.1 EXP, generated 2026-11-15. Python syntax and 43 mock-based
regression tests passed locally (27 prior cases, 16 added cases after
updating 2 assertions to the new fixed-row architecture). The tests cover
mocked Ableton objects ONLY: not Live 13 runtime, USB timing, Twister LEDs,
or actual host-side device navigation. Not designated stable. Independent
Claude/Codex review is required before promoting this version.

Source Beta 3.0 EXP SHA-256:
728c63bee4d5be6972112cf3f296f0a286ccbc28af5764397ca5f76a20f79320
Source Beta 2 v1.9 ZIP SHA-256:
a05f8fd68001599acecfadf2c037d97196269d1f704c93a8bd831e51d383bb56
