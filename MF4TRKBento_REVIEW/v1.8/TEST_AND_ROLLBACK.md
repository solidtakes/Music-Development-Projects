# MF4TRKBento v1.8 hardware test and rollback

## Before installation
- [ ] GitHub Actions compile, full regression suite, smoke sequence, ZIP inspection and artifact creation pass.
- [ ] Review exact ZIP contents and SHA-256.
- [ ] Keep the currently installed working build backed up.
- [ ] Keep the owner-accepted v1.6 startup-repair rollback package available.
- [ ] Quit all Ableton Live processes.
- [ ] Do not change Utility, Native Mode, MIDI routing, CC assignments or other surfaces.

## First launch
- [ ] Launch Live 13 Beta once.
- [ ] Confirm Live remains responsive for at least 60 seconds.
- [ ] Confirm MF4TRKBento v1.8 initializes.
- [ ] If Live hangs or crashes, stop and roll back; preserve logs and crash/hang dump.

## Feature 1 — Sends push reset
- [ ] Rotate a Sends encoder and confirm the assigned send changes.
- [ ] Push and release: only that send resets to minimum.
- [ ] Hold push and rotate: send value remains unchanged.
- [ ] Confirm another Sends row (e.g. Send B) is unaffected.
- [ ] Remove audio output: Sends LED is off, turn and push do not change the parameter.
- [ ] Restore audio output: Sends control returns.

## Feature 2 — Fast Pan/Sends refresh
- [ ] Rotate Pan and confirm ring/LED responds without perceptible delay.
- [ ] Rotate Sends and confirm ring/LED responds without perceptible delay.
- [ ] Push Pan to center and Sends to minimum; confirm both update immediately.
- [ ] Confirm RClip animations, track/scene navigation and Session highlight remain responsive.
- [ ] Check no MIDI LED flood or increased CPU usage during sustained turns.

## Feature 3 — Master Volume + Master Unsolo
- [ ] Assign Mute to a row and enter alternate mode.
- [ ] Fourth encoder rotation changes Master Volume.
- [ ] White ring follows Master Volume.
- [ ] Center LED stays teal/cyan when nothing is soloed.
- [ ] Center LED flashes when a regular track, Return or Master is soloed.
- [ ] Push/release clears solo on regular tracks, Returns and Master where supported.
- [ ] Push-first then rotate does not change Master Volume.
- [ ] Rotary-first then push within 35 ms restores the just-applied detent (known behavior); verify normal turns remain immediate.

## Feature 4 — FX Return hot-removal recovery
- [ ] Enter FX Returns mode with hold E1 + press E16.
- [ ] Delete the final Return track in Live.
- [ ] Confirm the surface automatically returns to regular tracks.
- [ ] Confirm regular-track scroll offset is restored and Session highlight follows regular tracks.
- [ ] Confirm no crash or stale FX target remains.
- [ ] Add a Return track again; confirm manual FX toggle works normally.

## Regression
- [ ] E16 alone still retains its Row 4 module function.
- [ ] E16-first then E1 still toggles alternate mode.
- [ ] E1-first then E16 still toggles FX Returns.
- [ ] Existing RClip, Arm, Solo, Mute/Volume, Pan, Sends, Stop, LED colors and scrolling behave as before.

## Rollback
1. Quit all Ableton Live processes.
2. Remove the v1.8 package.
3. Restore the exact owner-accepted v1.6 startup-repair package from PR #27's retained artifact.
4. Launch Live and confirm normal responsiveness.
5. Do not modify v1.6 or v1.7 source during rollback.
