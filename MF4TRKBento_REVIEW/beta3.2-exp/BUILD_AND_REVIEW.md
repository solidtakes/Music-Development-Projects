# MF4TRKBento Beta 3.2 EXP — hardware feedback integration

**Status:** Experimental for user hardware testing. Stable rollback is the owner-designated **Beta 3.1 repair ZIP** SHA-256 `33ec4287aca915bf4c27518548d8c3f1359a48d6f3ff2f6ed88242a7e94d6d8a`. Preserve Beta 3.1 without modification. This branch derives from draft PR #46 (`761247bc`) and leaves its original `beta3.1-exp` source and tests byte-identical.

## Changes from Beta 3.1
- Physical mixer rows top → bottom: **Send A, Send B, Pan, Volume**.
- 0–4 Device Control rows replace mixer rows from top down, Volume last; primary Device row E1 yellow on/off, E2 4-parameter bank, E3/E4 prev/next; later Device rows show blue and have no duplicate push functions.
- On a track with one Send only and one Device row loaded, the remaining second mixer row falls back to **Send A**; with ≥2 Sends it controls **Send B**; with none it is unavailable.
- On MIDI tracks with **no audio output** (including no instrument), hide the white Volume ring as Pan/Sends already do. Do not disable Volume rotary or independent button modules. When audio output becomes available, the ring returns.
- Preserve CC0–15, rotary channel 12/push channel 11, existing modules and gestures, and 35 ms Volume press guard. No Native Mode, Utility or other-bank changes.

## Regression expectations
- Existing 48 offline mocked tests plus 7 new / adjusted ordering and ring/stack tests; GitHub Actions is authoritative for the precise passing test count.
- Test 0/1/2/3/4 Device row matrix; Send A vs B routing; one, two, zero Sends; no-audio Volume ring after scan **and** a rotary turn; normal Audio/Instrument track rings; device/FX Returns, Alt, mute buttons, power and navigation.
- Regression tests are **mock-only**. No Ableton Live or physical Twister validation is claimed by CI.

## Hardware verification
1. Start with **zero Device rows**. Top row Send A, second Send B, third Pan, bottom Volume. Use a track with at least two Returns.
2. Verify an empty MIDI track has **no white mixer rings**; verify a track with an instrument shows Volume, Pan, Sends rings when available. Button modules remain functional.
3. Add one Device row from the top. Its knobs should control device params 1–4; test E1 yellow power, E2 banking, E3/E4 device navigation. With **one** Return, second row now controls Send A; with two Returns, it controls Send B.
4. Add Device rows two, three and four: second row becomes params 5–8, third 9–12, bottom 13–16, keeping Volume until last replacement.
5. Remove Device rows bottom-up; confirm original mixer mapping is restored without changing module button functions. Preserve Beta 3.1 ZIP for rollback.

No automatic merge. Review and owner test before promoting Beta 3.2.
