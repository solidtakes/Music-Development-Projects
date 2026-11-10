# Issue #4 — Radikal SAC-2K research
Date: 2026-11-10. Research and recommendations only; no implementation or hardware tests.

## Evidence and scope
Reviewed [issue #4](https://github.com/solidtakes/Music-Development-Projects/issues/4), main at f286ae5179a382f1e19c6b6c2f668e4f69c31387, its 11-commit history, all 11 current branch trees (none truncated), and the SAC2K reference branch at 452ad8d9e32fd18bdcb1023e684f27b5e2c0434e and its history. No applicable AGENTS.md or SAC2K Python source appeared in those trees. A filename search of the current Desktop workspace found no SAC2K/Mackie or named v0.1.20/27/28 artifacts. This does not establish absence elsewhere, in deleted history, attachments, or other computers.

Primary project records:
- [Stable build record](https://github.com/solidtakes/Music-Development-Projects/blob/f286ae5179a382f1e19c6b6c2f668e4f69c31387/Radikal_SAC2K/Main_Build/BUILD_STATUS.md).
- [Earlier requests](https://github.com/solidtakes/Music-Development-Projects/blob/452ad8d9e32fd18bdcb1023e684f27b5e2c0434e/SAC2K_Mackie_MCU/CHANGE_REQUESTS.md).
- [Reference MIDI caveats](https://github.com/solidtakes/Music-Development-Projects/blob/452ad8d9e32fd18bdcb1023e684f27b5e2c0434e/SAC2K_Mackie_MCU/MIDI_CC_AND_MESSAGES.md).
- [Reference note table](https://github.com/solidtakes/Music-Development-Projects/blob/452ad8d9e32fd18bdcb1023e684f27b5e2c0434e/SAC2K_Mackie_MCU/MIDI_NOTE_MAP.csv).

The baseline record names Radikal_SAC2K_Main_v0.1.20_STABLE_FF_REW.zip, SHA256 abf944ee36edd5371bc3db3daeef3d61012698ec71ae9a627685150418cf2c15. The archive and complete source are explicitly absent from that commit. ZIP/syntax validation and restoration are recorded claims, not validation performed here; hardware retest remains pending. Main history bc803c6e/f286ae51 documents the separated baselines, not their implementation.

The earlier reference branch proposed initial pan-only ×8 and described SHIFT as apparently inactive. The newer baseline records V-Pot/SENDS ×20 and SHIFT/SCRUB one-bar seek. These are different stages; do not apply the old change requests as current requirements or infer regressions from the difference alone.

## Ranked recommendations and likely causes
Risk means regression risk of a future change, not severity. P0 blocks reliable diagnosis; P1 protects state correctness; P2 addresses usability after diagnosis.

| Priority | Area / hypothesis, not confirmed defect | Recommendation | Risk | Difficulty |
|---|---|---|---|---|
| P0 | Missing executable baseline and raw evidence prevent handler-level attribution | Obtain exact v0.1.20 archive, verify recorded hash, inventory imported dependencies and loaded path; establish captures before edits | Low (evidence only) | Low–medium |
| P1 | Multi-ARM/SOLO: a swallowed release, duplicate press, stale held-note state or bank reassignment could leave chord mode active or affect the wrong strip | Audit normalized note-on-zero and true note-off, first stock press, secondary held press, release forwarding, strip identity and lifecycle cleanup; preserve global Live preferences | High | Medium–high |
| P1 | Bank-2 flashing while stopped: stale bank listeners, feedback routing collision, or a persistent hardware flash command could survive rebinding | Trace every writer of affected LED notes and raw output during bank switch; refresh LEDs from current assigned tracks and remove stale listeners only if demonstrated | Medium | Medium |
| P1 | SCRUB latch / jog track navigation: toggling on both edges, repeated note-on, or using the same variable for physical hold and logical latch could dispatch the jog into the wrong mode | Define the intended latch truth table, inspect mode precedence and press-only transitions, and test selection boundaries; preserve existing modifier seek and stock transport | High | Medium–high |
| P2 | V-Pot/SENDS ×20: a multiplier in a shared decoder or both Python and mapping layers could scale wrong modes twice; stale parameter assignments could target previous bank | Audit mode-specific scaling ownership after signed-relative decoding, parameter bounds, and mapping rebuilds | Medium | Medium |
| P2 | Mapping regressions: generic MCU tables or older DAW mappings may disagree with SAC2K emulation; input translation and LED reverse mapping may be asymmetric | Build a captured physical-control ↔ raw-message ↔ logical-handler ↔ feedback table and compare against v0.1.20 | Medium | Medium |

Bank-2 diagnosis should distinguish: repeated outgoing messages (software refresh/listener issue), a single flash-setting message followed by no traffic (possible latched firmware behavior), and flashing with no matching output after initialization (routing, hardware, or unobserved sender). Capture all relevant ports and initialization before assigning cause. Stopped transport does not imply that arm/solo/meters must all be dark; specify expected LED state per row and track. Standard MCU flash velocity 01 is only a clue from the reference notes, not verified SAC2K behavior.

For multi-ARM/SOLO, track physical button identity separately from the assigned track when banking while held. Decide and document whether a second press targets the new bank; release must clear the original held identity without toggling either bank. Cover non-armable returns/master and track deletion. Preserve first-press stock behavior and release delivery exactly once where the existing stock contract requires it.

For SCRUB/jog, establish whether “latch” is intended or the bug. A latched mode and a physical pressed modifier are distinct states. Capture press, release, second press, SHIFT combinations and wheel movement before proposing a state machine. Avoid intercepting FF/REW or changing the stable stock jog path.

## Proposed validation after separate approval
No tests below have been executed.
1. Snapshot stable package, dependency hashes, Live exact build, firmware/emulation mode, ports and Control Surface preferences. Use a minimal Set with identifiable tracks and at least two banks.
2. Record both MIDI directions with timestamps: bank 1→2→1 stopped/playing, armed/soloed states, empty final bank, track add/remove and group folding. Correlate LED output with visible row and assigned track.
3. ARM/SOLO: single press/release, overlapping same-mode chords, release orders, mixed ARM/SOLO, duplicate presses, both release encodings, bank change while held, script reload/disconnect. Expect first stock action, intended secondary actions, no stuck state and unchanged global preferences.
4. SCRUB: complete press/release truth table, repeated presses, SHIFT combinations, clockwise/counterclockwise jog, first/last track, returns/master, mode changes while held. Verify modifiers, marker and locator mappings against v0.1.20.
5. Encoders: both directions and speeds, PAN/SENDS/EQ/device modes, flip, bank changes, parameter min/center/max and absent sends. Confirm ×20 applies once only to intended modes, no wrap and no stale target; preserve LED-ring feedback.
6. Offline event replays can establish dispatch/state invariants. They cannot establish hardware LED acceptance, fader feedback, timing, feel or Live integration.

## Missing materials required
- Exact stable archive above and complete .py package, including __init__, main surface, transport, channel strip, encoder controller, constants/mapping modules and any patched stock imports (actual filenames to be determined).
- Pre-change source/report checkpoints identifying last working bank LEDs, SCRUB and encoder mappings; versioned diffs through v0.1.20.
- Timestamped bidirectional MIDI logs including initialization and both release encodings; physical button labels, bank/track assignments, exact blinking row and expected state, firmware and emulation mode.
- Live exact version/build, macOS version, loaded script folder/path, MIDI ports and Control Surface configuration; sanitized Live Log.txt covering reproduction and exceptions.
- Minimal Set and short screen recording synchronized with control actions; confirm whether flashing persists with only one surface active.
- Clarification of intended SCRUB latch/track-navigation behavior and which encoder modes the current ×20 contract includes.

## Approval-gated implementation plan
First acquire and hash evidence; then complete a line-level audit and present one isolated change proposal per proven defect. Only after approval, create a separate candidate build from verified v0.1.20, address release/lifetime correctness before LED/mode changes, and validate each independently against the frozen baseline. Preserve existing FF/REW, stock jog, SHIFT/SCRUB seek, marker behavior, bank-aware strips and preferences. Do not integrate v0.1.21–28 experimental transport. Keep Modded Mackie Control separate. No scripts, stable archives, or baseline records were changed by this research.
