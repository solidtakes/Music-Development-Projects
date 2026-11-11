# MIDI Fighter Twister — Consolidated chronology (2026-11-11)

## Source of truth and date interpretation
The ChatGPT audit inventoried **96 uploaded files: 94 ZIP and 2 PDF**; all 94 ZIP integrity checks passed. The local audit package contains the complete originals, SHA-256 inventory, and a per-file date-sorted CSV and chronology. ZIP member modification timestamps span **2026-11-07 12:14:42 through 2026-11-11 08:33:32**. They are *not* reliable proof of first creation or hardware validation. Compare with Git commit dates for repository-native builds. Do not use upload timestamps as build dates.

## Canonical classification
| Production area | Archived files | Notes |
|---|---:|---|
| Bank 1 / Selected Channel Mixer | 40 | v1.0 Stable and Compatibility Fix contain identical main Python source; ZIP packages differ |
| Bank 1 / Four-Track and Four-Channel Mixers | 28 | MF_4TRK_Mode v0.9 and Four_Channel_Mixer v0.3.0 are distinct lineages; do not rank versions across lineages |
| Bank 3 / Clips n Scenes | 25 | v0.3.0 MIXER_METER_FIX_TEST is latest named test; hardware validation outstanding |
| Experimental / LED Diagnostics | 2 | v0.2.0 and v0.3.0 CUSTOM_BANK1_TEST |
| Legacy Main Build | 1 | v0.23.4 YELLOW_ROLLBACK; keep separate |
| Bank 2 / Reserved | 0 | No assigned source |
| Bank 4 / Mono Melodic Sequencer | 0 | v1.51 reported in chat, source not uploaded |
| **Total** | **96** | 94 ZIP, 2 PDF |

## Global feature library (design, not implementation)
- **COL-001** calibrated colors and semantic roles; cross-bank mapping must be hardware-verified
- **VOL-001** Selected Channel volume, arm, mute, VU feedback, click timing, LED protection
- **PAN-001** pan, solo, monitor
- **SEND-001** FX sends, banking
- **DEV-001** device power, parameter banks, navigation
- **VU-001** standalone four-encoder vertical VU experiment; first candidate column 3 = E3/E7/E11/E15
- **TIME-001** gesture timing, LED refresh and ownership/protection
- **NAV-001** navigation and relative encoder behavior

**Layout convention:** rows horizontal (row 4 = E13–E16), columns vertical (column 3 = E3/E7/E11/E15). A validated module can later be placed on any row or column without changing its behavior contract.

## Safeguards
No stable build is superseded solely by a greater version number or a later ZIP timestamp. No production code modified or merged by this documentation commit. Binary ZIPs are **not yet backed up to GitHub**; the user-facing local organized archive is a separate artifact. Preserve all historical originals and check for existing GitHub versions before pushing binaries.