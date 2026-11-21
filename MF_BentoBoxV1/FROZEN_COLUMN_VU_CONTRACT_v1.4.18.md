# MF BentoBoxV1 — FROZEN COLUMN VU CONTRACT (owner-approved 2026-11-20)

## Status and provenance
Owner states v1.4.18 is accepted for moving on from VU development; freeze the design and prevent regressions across MF BentoBox branch work. This is a **design/behavior freeze**, not proof of individual event-velocity access or a new GitHub-hosted installable ZIP.

Local build: `MF_BentoBoxV1_v1.4.18_FROZEN_COLUMN_VU_TRACK_MIDI_MASTER_AUDIO_4STEP_TEST.zip`
SHA-256: `41e20560d53e1fae5c531ba0cd938c6e14a3938d662e1d6e458d9434ee7a3611`.
v1.4.18 README says 158/158 offline tests passed in earlier handoff; owner acceptance above is current instruction. **Binary ZIP and source have not yet been committed to GitHub by this documentation-only branch.** Do not claim that they have.

## RGB meter — same design for Track VU and Master VU
- Input: selected CHANNEL audio for Track VU; MASTER audio for Master VU.
- Silence = all four RGB OFF.
- Rising audio fills from **bottom to top**, with each newly illuminated row GREEN.
- Bottom encoder: OFF → GREEN only.
- Second encoder: OFF → GREEN → YELLOW.
- Third encoder: OFF → GREEN → YELLOW → ORANGE.
- Top encoder: OFF → GREEN → YELLOW → ORANGE → RED, and RED only near clipping.
- Never use fixed green/yellow/orange/red row colors; never show green at silence; never show green/yellow/green/red. Do not change the approved color curve/palette without owner permission.
- v1.4.18 inherits RGB numeric curve byte-identically from v1.4.17 (normalized onsets ~0.03, 0.19, 0.35, 0.50); this is a source-level description, not a claim of physical calibration.

## WHITE rings — four discrete ON/OFF ladder segments, **not** four independent continuous 0..127 meters
Read from bottom upward. For either meter, each encoder ring is 127 if active and 0 if inactive, never intermediate:
| Normalized meter 0..127 | White state |
|---|---|
| 0 | All OFF |
| 1–32 | Bottom ON |
| 33–64 | Bottom TWO ON |
| 65–96 | Bottom THREE ON |
| 97–127 | All FOUR ON |

### Strict input isolation
- **Track VU WHITE is MIDI activity only, NEVER audio**. When selected track is audio-only, all white rings OFF even if RGB moves.
- **Master VU WHITE is MASTER AUDIO only, NEVER MIDI.** Master RGB and Master white are sourced from Master audio. The two UI demo sliders were only an illustration.
- Current Track VU code uses Live-provided **MIDI activity meter proxy** rather than individual MIDI Note On velocity events. Do **not** claim exact event velocities without a separately approved implementation and runtime proof.
- Track VU RGB remains channel audio independent of its MIDI white ladder.

## Non-regression protections / change gates
1. Future Bank 1/combined-build changes must preserve ALL behavior above and explicitly test every 0/1/32/33/64/65/96/97/127 boundary, silence, low audio, clipping, MIDI-only, audio-only, MIDI stopping while audio continues, and Master inputs.
2. Protect RGB and white as independent code paths; prohibit routing audio into Track VU white. Check four independent ON/OFF rings, not 1..127 LED movement in each ring.
3. Preserve four-second A/B/C boot, one-second bank-change intros, current mapping/gesture ownership, Master peak semantics, and the `_send_midi(optimized=...)` reload fix.
4. Cross-bank/shared LED routing modifications require an explicit **CROSS-BANK REVIEW REQUIRED** gate; no automatic merges, no stable source overwrite, no Native Mode/firmware changes.
5. Freeze is scoped to **column VU modules**. Other meter implementations should not be silently rewritten.
6. Keep v1.4.15 as previous confirmed rollback ZIP. v1.4.16 and 1.4.17 are superseded experiments.
7. Any future deliberate VU design adjustment needs explicit owner approval, isolated branch, tests, physical hardware verification, and rollback.

## Branch handoff
All MF Bento, three-bank assembly, Bank 1 and future integration branches must read and cite this contract before touching Track/Master VU or shared output scheduling. Do not cherry-pick an unrelated version based only on its name or assume documentation alone is a code release.
