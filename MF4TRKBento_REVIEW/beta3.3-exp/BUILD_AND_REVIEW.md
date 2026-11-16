# MF4TRKBento Beta 3.3 EXP — Three-feature hardware review build

**Status**: experimental. Owner-designated stable Beta 3.1 repair ZIP: `33ec4287aca915bf4c27518548d8c3f1359a48d6f3ff2f6ed88242a7e94d6d8a`. Beta 3.2.1 EXP is a preserved predecessor: `ea956aeee76ba6d8f33b0689f1f7c568401435055a0a55723b3ad63bb156ff3d`. Do not overwrite any earlier source or ZIP.

## Changes in this build (exactly three)
1. **Device bank stride grows with rows**: 1 Device row → 4 controls/bank, total 16 across 4 banks; 2 rows → 8/bank, total 32; 3 rows → 12/bank, total 48; 4 rows → 16/bank, total 64. E2 still cycles maximum four banks, wrapping earlier for short devices. All parameter groups in a bank are consecutive and non-overlapping.
2. **E3/E4 navigation diagnostic/repair**: top-row pushes select previous/next via `Song.View.select_device`; handle unset selection by choosing a first/last top-level device; support siblings within rack chains through `canonical_parent.devices`; show a clear status message on success, boundary, unavailable API or failure. Confirm this on real Live before marking fixed.
3. **Live white Volume VU**: active audio meter drives white ring from `output_meter_left/right` every render tick (without MIDI floods, thanks to ring cache). Silent fallback displays volume position. Manual Volume turn displays fader for 300ms before VU resumes. Empty MIDI tracks remain dark. Volume VU works with FX Returns and alternate Master, but not on Device rows.

## Retained behavior
- Send A above Send B; single-send fallback after first Device row
- Fixed mixer rotary mapping and independently selectable button modules
- 0–4 Device rows top-down, E1 yellow power, other rows blue, E2 four-bank max
- CC0–15; rotaries channel 12, pushes channel 11
- 35ms Volume press contamination guard, existing scene/track navigation and FX Returns
- No other banks, Utility, Native Mode, auto-merge or persistence

## Tests & hardware
Offline mock tests verify 1–4-row dynamic bank indices across four pages, shorter device wrap, missing selection recovery, chain boundaries, active audio VU, silent fader fallback, manual-turn feedback, Master/FX Returns meter, empty MIDI tracks and Device-row isolation. GitHub CI creates a three-file deterministic ZIP. All are **mock-only**, not proof of Ableton Live or physical Twister behavior.

Hardware checklist:
- Verify E2 page stride for 1/2/3/4 Device rows; with 2 rows, Bank 2 should display params 9–16, not 5–12.
- Press E3/E4 on selected devices; verify song Device View actually changes. If no selection, E4 should select the first device. Check rack siblings.
- Play audio: bottom Volume rings should move with output meter. Stop audio: return to fader position. Turn Volume: see fader immediately then VU. Empty MIDI tracks remain dark.
- Confirm when Device rows replace Volume, no mixer VU overrides Device rings.
- Keep Beta 3.1 stable rollback. No automatic merge.
