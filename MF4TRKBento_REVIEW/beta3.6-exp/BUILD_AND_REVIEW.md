# MF4TRKBento Beta 3.6 EXP — Owner-authorized design build

Implemented independently from the source of Beta 3.5 (draft PR #54). New branch and draft PR; no merge or stable-promotion authorization.

## Owner-approved new rules
- Independently assign any rotary module (Volume, Pan, Sends, Device Control) and any button module (Blank, Clip Launch, Arm, Solo, Mute, Stop) on each of four physical rows. Device is rotary-only; eliminate legacy push-module-to-rotary automatic displacement. Arm, Solo, Mute, Stop each single-row; Clips/Blank repeat freely.
- Topmost active Device rotary row owns last-push utility: first tap toggles power, second tap jumps full page (4×Device row count), second turn moves window ±4 at FIVE detents/action, third turn navigates previous/next Device at FIVE detents/action; third tap goes to next Device. First turn retains rotary-module selector.
- Topmost active Sends rotary row owns last-push utility: first tap shifts Sends start +1, second tap -1; clamp no wrapping. Remove provisional Beta 3.5 hold-second/turn-third paging. All Sends/Device rows index contiguously by physical order, even with gaps.
- Strict chord consumption through release of all involved held buttons; global E1/E16 higher priority. No intentional debounce delay. Hardware may guide optional sensitivity adjustments.
- Partial final windows remain visible; unavailable rotary white rings off and turning inactive knobs no-op; RGB push LEDs remain independent. Device cap 4 logical full pages; tap full-page retains existing fast-bank wrap, twist offset clamps.

## Evidence and gates
CI compiles source, runs mock regressions, builds deterministic three-file ZIP and tests archive integrity. Physical testing still necessary for gesture interference/speed and Ableton behavior. Preserve earlier archives; draft PR unmerged.
