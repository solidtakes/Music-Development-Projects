# Unvoiced apparent-silence bug: Alpha 0.2 experimental fix

Owner's Ableton report: Unvoiced ON caused loss of audible signal, including in the 0% Wet / 100% Dry diagnostic. Actual root cause is unproven. In Alpha 0.1, the JUCE wrapper called `setLatencySamples` inside `processBlock`, asking the host to change PDC dynamically from 0 to ~25 ms when Unvoiced toggles.

## A02 change

- Make wrapper use a **fixed 25 ms latency** declared once during `prepareToPlay`; never notify Ableton of latency changes from the audio thread.
- Preserve upstream core's exact original zero-latency behavior by default; use fixed-lookahead only when explicitly selected by the JUCE plugin wrapper.
- In fixed-lookahead mode, delay both main voice and carrier equally even with Unvoiced OFF, preserving PDC correctness and sidechain alignment.
- Add deterministic dry-only Unvoiced ON regression verifying nonzero delayed dry output, and fixed PDC across Unvoiced toggling.

## Known trade-offs

- Always uses 25 ms host-reported latency in the VST3; this may feel slower under live monitoring and should be measured.
- This addresses a likely host/PDC bug, not a proven root cause. If silence persists, instrument VST3 bus activation and processBlock input/output meters next.
- Do not overwrite the known-working Alpha 0.1 binary. Manually test the new build in a disposable Set after CI passes.
- No new Retro/grit processing yet; hold feature work until the silent output issue is resolved.
