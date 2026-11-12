# MF Build 3 — MIDI Fighter Twister Configuration Baseline

Approved hardware preset: latest all-relative, CC Hold configuration (reference preset named `2026 all rel cchold.mfs`).

All banks:
- Rotary: MIDI channel 12; Relative ENC 3FH/41H; sensitivity 360.
- Push: MIDI channel 11; CC Hold (press and release).
- Standard Color Mode (not Expanded).
- Per-bank 16 logical encoders E1–E16, with zero-based CC offset.

Bank CC offsets:
1. Selected Track Bento: rotary and push CC 0–15.
2. 4-Track Bento: rotary and push CC 16–31.
3. Step Sequencer: rotary and push CC 32–47.
4. Device Aware: rotary and push CC 48–63.

CC for logical E(n) in bank b = 16*(b-1)+(n-1), for rotary channel 12 and push channel 11.

Bank 1 navigation: E1 push held + E16 rotary relative for track selection; E1 push held + E15 rotary reserved for secondary scroll. E1–E4 push held + own rotary selects each column's active four-control module. Suppress normal actions during gestures and prioritize modifier combinations.

Migrate old sequencer source previously mapped to Bank 4 CC48–63 to Bank 3 CC32–47. Do not change the physical preset unless actual device verification reveals a mismatch. This document is the design baseline, not proof of hardware re-test.
