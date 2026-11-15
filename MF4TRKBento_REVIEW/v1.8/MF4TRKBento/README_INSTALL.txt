MF4TRKBento v1.8 EXP
=====================

Experimental four-feature build based on the v1.7 candidate. All v1.7
functionality and MIDI assignments are retained.

NEW FEATURES
------------

1. Sends push reset
   - Turning a Sends encoder adjusts its assigned send as before.
   - Pushing and releasing that encoder resets only that send to its minimum.
   - Rotation while the push is held is ignored, preventing reset/turn conflict.
   - Sends remain unavailable when the selected track has no audio output.

2. Fast Pan/Sends parameter refresh
   - Pan and Sends turns now update only the affected LED/ring cell.
   - Pan and Sends reset actions use the same single-cell refresh path.
   - These actions no longer rescan the Live Set on every detent.
   - Periodic scans remain responsible for external changes and track/device topology.

3. Master Volume on the alternate Mute encoder
   - When a row is assigned Mute and alternate mode is active, its fourth encoder
     rotary controls Master Volume.
   - The white ring displays Master Volume.
   - The center LED remains teal/cyan and flashes when any track, Return or
     Master is soloed.
   - Push/release still performs Master Unsolo. The existing 35 ms press
     contamination correction is applied to this rotary/push combination too.

4. FX Returns hot-removal recovery
   - If the last Return track is deleted while the bank is in FX mode, the
     controller automatically returns to regular tracks.
   - The regular-track scroll offset is restored and the Session highlight is
     rebuilt for the regular track group.
   - If Live cannot read the Return list due to a transient runtime error, the
     controller does not force a mode change.

INSTALLATION
------------

This is an experimental candidate. Do not install until GitHub Actions compile,
regression, smoke and ZIP-integrity checks pass, and the owner authorizes
hardware testing.

1. Quit every Ableton Live process.
2. Back up the currently installed MF4TRKBento package.
3. Replace only the MF4TRKBento remote-script package with this package.
4. Leave MIDI Fighter Utility, MIDI routing, Native Mode, CC assignments,
   other banks and other control surfaces unchanged.
5. Launch Live 13 Beta once. Confirm responsiveness before testing controls.
6. Test the v1.8 checklist in TEST_AND_ROLLBACK.md.

ROLLBACK
--------

The v1.7 candidate is preserved in PR #35. The v1.6 startup-repair package
remains the owner-accepted rollback baseline in PR #27. Quit all Live
processes and restore the exact owner-tested v1.6 package if v1.8 causes
a startup, control-surface or hardware regression.

VALIDATION LIMITS
-----------------

Offline tests use host mocks. They do not prove Live 13 runtime behavior,
actual Twister event ordering, physical LED behavior, or end-to-end latency.
Hardware validation remains required.
