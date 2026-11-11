# MIDI Fighter Twister — Active hardware configuration (2026-11-11)

## User-confirmed active configuration
- **Active export:** `2026 all rel cchold.mfs` (2,312 bytes).
- **Rotary standard (user-confirmed):** Relative ENC 3FH/41H across all 64 encoders / four banks.
- **Push standard (user-confirmed):** CC Hold across all 64 encoder buttons / four banks.
- **Original pre-change export:** `nov 11 before changing to rel.mfs` (2,282 bytes); retain as rollback, never overwrite.
- No Python Remote Scripts have been modified as part of this hardware-setting change.
- File formats have not been fully reverse-decoded; user confirmation establishes active operating configuration, not independent validation of every encoded field.

## SHA-256
- Original: `55c4ab92739232cbdb6ba0db3a852b1f3dbc1e69a5d219dd6c8b221f5460b7fa`
- Updated: `3ab457f9c427d8933340119cf4cd960f87d98b183f12af0cb406c7902a7694f4`

## Documented CC plan (verify against .mfs before modifying scripts)
| Bank | Rotary CC | Push CC | Rotary channel | Push channel |
|---|---|---|---|---|
| 1 | 0–15 | 0–15 | 12 (historical) | 11 (historical) |
| 2 | 16–31 | 16–31 | Unverified | Unverified |
| 3 | 32–47 | 32–47 | 12 (historical) | 11 (historical) |
| 4 | 48–63 | 48–63 | 12 (historical) | 11 (historical) |

Do not assume CC/channel mapping or individual sensitivity/LED fields remained unchanged until decoded/verified.

## MF Build 2 planned modules
1. MF Column 1 — Mixer (current isolated build not yet hardware-approved)
2. MF Column 2 — LED VU
3. MF Column 3 — FX Sends C/D/E/F
4. MF Column 4 — Four-bank device macros
5. MF Column 5 — Clips
6. MF Column 6 — Scenes
7. MF Column 7 — Transport
8. MF Column 8 — I/O

Modules may be placed as physical columns or transposed rows across banks/subpages; not all active at once. Shared controller should own LOM listeners, MIDI routing, LED ownership, and lifecycle. Extract proven behavior from working scripts; do not change existing stable scripts without approval.

## Next audit
Compare each available source build against the new Relative rotary and CC Hold semantics, including release-triggered launches, gesture handling, LED feedback, and cleanup. Propose changes first; no code edits without approval.

## Backup limitations
This document records names and checksums, **not the original binary .mfs files**. Retain the user's original exports and verified local backup; separately archive actual bytes in a durable user-controlled location.
