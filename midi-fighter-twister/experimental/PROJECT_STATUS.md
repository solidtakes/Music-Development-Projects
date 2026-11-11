# Experimental Lab — Shared Twister Features

**Purpose:** One independent development thread for LED calibration, proof-of-concept controls/circuits, MIDI input/output diagnostics, shared animation engines, device feature prototypes and compatibility tests. Nothing here automatically changes Banks 1–4.

## Initial workstreams
1. **LED palette calibration:** document the Twister Extended Color Mode / utility configuration and observed hardware colors. Known preferred calibration values from testing: red 72, green 76, orange 108, light blue 68, pink 52, teal 32, light purple 104, dim green 88. Selected CH FX purple=47 in its tested Expanded palette; other scripts may differ. Never equate a MIDI CC numeric value with a universal RGB color.
2. **Animation timing:** investigate 16th-note flashing vs Live's roughly 100 ms Remote Script scheduler; measure aliasing, phase sync and MIDI traffic. Preserve responsive clip launch/scroll.
3. **Meter prototypes:** independently test audio stage levels and four MIDI-activity thresholds. Live's held MIDI activity meter is not per-note velocity; avoid claiming otherwise.
4. **Device features:** test parameter banking, on/off, navigation, and feedback in an isolated script or circuit before adoption.

## Promotion protocol
Experiment → isolated bench test → hardware evidence → compatibility matrix for Banks 1/2/3/4 → explicit approval → per-bank feature branch → regression test → versioned release. Record before/after behavior, MIDI channel, CC, color mode, latency, tests and rollback.

## Cross-bank compatibility matrix
| Feature | Bank 1 | Bank 2 | Bank 3 | Bank 4 |
| --- | --- | --- | --- | --- |
| LED palette | Review | Reference palette | Review | Review |
| Animation engine | Review | Review | Candidate | Review |
| Four-stage MIDI meter | Candidate | Reference | Candidate | Not assumed |
| Device controls | Candidate | Candidate | Review | Not assumed |

'Review' means no code has been changed.
