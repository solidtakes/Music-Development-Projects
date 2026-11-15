MF4TRKBento v1.7 EXP
=====================

Experimental four-feature build based on the owner-tested v1.6 startup-repair
source branch, PR #27 head 2e9336d758aedcb230d05def2f4bc3313712eb5e.

FEATURES
--------
1. FX Returns group: hold E1, then press E16. The four-column target list and
   Session highlight move together between regular tracks and FX Returns.
   The regular-track and FX-return scroll offsets are remembered separately.
   Master is excluded from the FX Returns group. E16 alone retains its Row 4
   module meaning; E16-first then E1 remains the alternate-mode gesture.

2. Combined Volume/Mute module: rotate adjusts the active track's volume;
   push toggles mute. The white ring shows volume, monitor state remains
   yellow/blue, and mute flashes the monitor color. A local 35 ms press guard
   ignores rotary events while the switch is held and restores a just-applied
   detent if the push-down CC follows it within the guard window. This avoids
   the Remote Script scheduler's approximately 100 ms update tick and does
   not delay normal volume turns. The rotary-first correction is immediate,
   not a pre-application buffer; hardware event ordering and audible behavior
   still require validation.

3. Master Unsolo: when a row uses Mute and alternate mode is active, its fourth
   encoder clears solo on regular tracks, Return tracks and Master. The LED is
   teal/cyan (32), solid when nothing is soloed and flashing while any track
   is soloed.

4. Pan/Sends availability and color: Pan and Sends are absent when the target
   track reports no audio output. Sends use palette value 47 (FX purple).

INSTALLATION
------------
This is an experimental candidate. Do not install until the v1.7 GitHub
Actions compile, regression, smoke and ZIP-integrity checks pass and the owner
authorizes hardware testing.

1. Quit every Ableton Live process.
2. Back up the currently installed MF4TRKBento package.
3. Replace only the MF4TRKBento remote-script package with this package.
4. Leave MIDI Fighter Utility, MIDI routing, Native Mode, CC assignments,
   other banks and other control surfaces unchanged.
5. Launch Live 13 Beta once. Confirm responsiveness before testing controls.
6. Test the hardware checklist in TEST_AND_ROLLBACK.md.

ROLLBACK
--------
The owner-reported working v1.6 startup-repair candidate is preserved in
PR #27 and GitHub Actions artifact 14146785354 (workflow 43676416345).
Quit all Live processes and restore that exact v1.6 package if v1.7 causes
a startup, control-surface or hardware regression.

VALIDATION LIMITS
-----------------
Offline tests use host mocks. They do not prove Live 13's runtime behavior,
the SessionComponent Return-track highlight on the user's exact Live build,
the Twister's actual push/rotary event ordering, or measured end-to-end
volume latency. Hardware validation remains required.
