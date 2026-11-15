# v1.7 hardware test and rollback

## Before installation

- [ ] GitHub Actions compile, unit tests, smoke assertions and ZIP inspection pass.
- [ ] Review the exact ZIP hash and contents.
- [ ] Keep the currently working v1.6 startup-repair package available.
- [ ] Quit all Ableton Live processes and back up the installed remote script.
- [ ] Do not change Utility, Native Mode, MIDI routing, CC assignments or other surfaces.

## First launch

- [ ] Launch Live 13 Beta once.
- [ ] Confirm the UI remains responsive for at least 60 seconds.
- [ ] Confirm MF4TRKBento v1.7 initializes.
- [ ] If Live hangs or crashes, stop immediately and roll back; preserve the Live log and hang/crash dump.

## Feature 1 — FX Returns group

- [ ] Hold E1, press E16: FX Returns group selected.
- [ ] Confirm the Session highlight moves to Return tracks only; Master is not included.
- [ ] Confirm all four module columns target Return A–D in order, with missing columns blank.
- [ ] Hold E1 + turn E16: scroll within FX Returns.
- [ ] Toggle back with hold E1 + press E16; confirm regular-track offset is restored.
- [ ] Toggle again; confirm FX-return offset is restored.
- [ ] Confirm E16 alone still performs the Row 4 module action.
- [ ] Confirm E16-first + E1 still toggles alternate mode.

## Feature 2 — Mute/Volume

- [ ] Rotate a Mute encoder: volume changes immediately and ring follows.
- [ ] Push only: mute toggles without a volume change.
- [ ] Test push-first then rotary while held: rotary is ignored.
- [ ] Test rotary-first then push within 35 ms: last detent is restored.
- [ ] Test a normal turn followed by a push after 35 ms: normal volume change remains.
- [ ] Confirm mute flashes the existing monitor color and ring still shows volume.
- [ ] Record actual MIDI event order and measure volume response; report median, p95 and maximum if possible.

## Feature 3 — Master Unsolo

- [ ] With Mute assigned to each row, enter alternate mode.
- [ ] Fourth encoder is solid teal/cyan when no tracks are soloed.
- [ ] It flashes when any regular or Return track is soloed.
- [ ] Pressing it clears solos on regular tracks, Return tracks and Master if applicable.
- [ ] Confirm externally initiated solo changes update the indicator.

## Feature 4 — Pan/Sends

- [ ] Sends center LED is purple.
- [ ] Pan and Sends are off on MIDI tracks without audio output.
- [ ] Pan and Sends become available again when audio output is present.
- [ ] Removing audio output clears both indicators and prevents parameter changes.
- [ ] Sends assignment order and inert push behavior remain unchanged.

## Rollback

1. Quit all Ableton Live processes.
2. Remove the v1.7 package.
3. Restore the exact owner-tested v1.6 startup-repair package from the preserved artifact.
4. Launch Live once and confirm v1.6 responsiveness.
5. Do not alter the v1.6 or v1.5 source branches during rollback.
