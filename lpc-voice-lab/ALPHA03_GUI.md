# LPC Voice Lab Alpha 0.3 — GUI concept implemented in JUCE

JUCE custom vector editor inspired by the owner's approved pedal-style preview. Includes 3 large gain controls; current TalkBox mode status and five planned-mode status lamps (non-interactive until DSP exists); program footswitch cycles actual existing DSP param presets (Classic, Retro, Articulate); bypass footswitch; right Advanced panel: Quality, Order, Unvoiced, Fricative Gain, Retro, Grit, Bandwidth, Wet, Dry, Low End.

**Only TalkBox is currently implemented.** Other legacy-mode legends are placeholders, not switchable algorithms. No source/image asset from original DigiTech branding is embedded.

Retro is an independent first-pass first-order bandwidth limiter + tanh saturation. It is bypassed by default, preserving the existing Alpha 0.2 core behavior and parameters (new input/output gains default to 0 dB). This is not a proven IVL model, nor yet a faithful replication of the photorealistic GUI render.

Compile/run/DAW testing pending. No automated Ableton launch or installation. Do not overwrite the working Alpha 0.2 plugin until owner manually auditions a verified build. Plugin IDs retain their original Alpha 0.2 values, and existing parameter IDs are unchanged.

Max for Live exploration has been deferred by owner and preserved separately on `experimental/lpc-max-for-live-parked`. No Max code is included in this VST3 GUI PR.