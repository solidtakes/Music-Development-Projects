# Bank 1 — Selected Track VU MIDI white ladder correction (mandatory)

Owner reconfirmed 2026-11-18: **Selected Track VU white LEDs indicate MIDI activity, NOT audio level**. This requirement was already frozen at the design level; it corrects an implementation gap in the v2.2 experimental build.

## Exact display
- RGB inner LEDs: selected track AUDIO VU, existing approved progressive green/yellow/orange/red stages unchanged.
- White outer rings: selected track MIDI activity, independent of RGB audio VU.
- One four-segment ladder E4 bottom -> E3 -> E2 -> E1 top; each ring output strictly **0** (off) or **127** (fully on), no partial rings.

| MIDI activity step | E1 | E2 | E3 | E4 |
|---|---:|---:|---:|---:|
| 0/4 | 0 | 0 | 0 | 0 |
| 1/4 | 0 | 0 | 0 | 127 |
| 2/4 | 0 | 0 | 127 | 127 |
| 3/4 | 0 | 127 | 127 | 127 |
| 4/4 | 127 | 127 | 127 | 127 |

**Master VU remains unchanged:** RGB and white both use Master audio. This does not authorize a change to frozen Track Mixer v1, Device v1, FX v1, or Bank 2 sequencer.

## Engineering gate
The previous v2.2 test build used an AUDIO proxy for Selected Track white output. Remove this proxy. First verify an actual selected-track MIDI activity source in the target Live API/runtime; do not label audio level as MIDI or fake detection. Define/document activity window, decay, and threshold calibration as test parameters (not owner-approved constants). If genuine MIDI activity cannot be observed reliably, report blocked and request hardware/API evidence rather than claiming implementation complete.

## Hardware acceptance tests
1. Selected MIDI track plays notes with no instrument/audio output: white ladder reacts to MIDI; RGB audio remains silent.
2. Selected audio track plays audio with no MIDI notes: white ladder does NOT follow audio.
3. Selected instrument MIDI track: white follows MIDI note activity, RGB follows audio independently.
4. White output is always binary 0/127 on all four rings, correct bottom-up order, clears on MIDI inactivity.
5. Master mode white continues following Master audio; no stuck LEDs on track/mode/bank switching.
6. Regression of frozen modules and Bank 2 isolation.

See SELECTED_TRACK_VU_RGB_AND_WHITE_V1_FROZEN_2026-11-12.md and SHARED_RULEBOOK_ALL_THREADS_V1_2026-11-12.md.
