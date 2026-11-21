# LPC Voice Lab — Max for Live prototype

**Status:** Source `.maxpat` scaffold; not yet opened or auditioned in Max/Live. This is an **8-band MSP filterbank vocoder**, NOT the MDA/IVL LPC algorithm. It is intended for routing and UI experimentation. The approved VST3 version remains the primary sound reference.

## Why a different input arrangement?

Max for Live Audio Effects receive two channels via `plugin~`. Built-in VST3-style external sidechain input cannot simply be assumed. `send~` / `receive~` across different M4L devices is unsupported: https://docs.cycling74.com/userguide/m4l/live_audiodevices/

## How to try it in Live

1. Open the patch source `LPC-Voice-Lab-M4L-Starter.maxpat` in Max for Live/Max. Create a Max Audio Effect device with this patch and save it as **LPC Voice Lab M4L.amxd** from the Max editor. The `.amxd` does not exist yet; Max must save it.
2. Create a `VOICE` audio track and a `CARRIER` synthesizer track. Route both outputs to a dedicated stereo audio bus (for example, a new audio track named `VOCODER BUS`) so it receives both sources.
3. Pan VOICE hard LEFT and CARRIER hard RIGHT upstream of the bus. Verify the bus receives only voice in its left channel and only synth in its right. Disable monitoring the individual source tracks to Master to avoid doubling.
4. Insert the saved M4L audio effect on the bus. It sums the 8 filtered bands to stereo.
5. Start with Mic Input 100, Carrier Input 100, Effect Output 100 (these are percentage gain controls); keep monitoring low and raise levels gradually.

**Not yet validated:** Live/Max loading, direct routing, output level/gain staging, M4L automation persistence, CPU cost, transport reset, nonzero internal latency. Do not present this as an already-working `.amxd` or claim it sounds like DigiTech/IVL.

## Next steps

- Independent Max runtime opening to confirm the patcher has no missing objects and correct two-channel routing.
- Add safer gain compensation and compression, a better filterbank envelope and consonant passthrough, param smoothing and UI.
- Determine whether to implement a Gen~ LPC core or build a licensed Max external for parity with the VST3; do not copy AGPL core into closed-source Max external without licensing review.

## Provenance

Own Max patch constructed with documented native `reson~`, `abs~`, `slide~`, `plugin~`, `plugout~`, and `live.dial` objects. Independent of copied MDA DSP code. Inspired by Cycling '74's introductory filter-bank vocoder tutorial, not a verbatim copy: https://cycling74.com/tutorials/a-basic-vocoder-tutorial-part-3 .