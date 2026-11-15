# Test gate and rollback

## Review gate

Do not install or hardware-test this candidate until an independent reviewer
has inspected the scheduler, reentrancy, refresh and shutdown changes and the
offline CI suite has passed.

## One-launch hardware validation (after review only)

1. Close all Ableton Live processes and confirm none remains in Task Manager.
2. Install this candidate without changing any other surface or MIDI settings.
3. Launch Live 13 Beta once. Verify that the UI remains responsive for at least
   60 seconds and the control-surface initialization message appears.
4. Do not open a Set or test LEDs/gestures until startup remains responsive.
5. If Live becomes unresponsive, stop immediately and collect the current
   Live log plus a Windows hang dump; do not repeat the launch.

## Rollback

1. Quit all Live processes.
2. Remove the candidate MF4TRKBento package.
3. Restore the unchanged v1.5 EXP package from
   MF4TRKBento_REVIEW/v1.5/MF4TRKBento_v1.5_EXP.zip at baseline
   0bc87548853af047ae6c70535494a2546a8befb1.
4. Confirm the v1.5 package starts normally.

## Scope

No changes to v1.5, MIDI Fighter Utility, Native Mode, CC assignments,
SAC2K, other banks, or the original v1.6 branch.

## Offline test boundary

The regression tests use a list-backed schedule_message mock and manually fire
stored callbacks. They do not reproduce or validate Live 13 Beta's real
TaskGroup, update_display, component_guard, or callback-dispatch environment.
Passing offline tests is not evidence of successful Live 13 startup.

Track.has_audio_output remains read in _audio_mixer() for Pan/Sends
availability. Its latency and actual Live 13 Beta runtime behavior remain
unverified. The original hang's root cause is not established by the available
logs or these tests.
