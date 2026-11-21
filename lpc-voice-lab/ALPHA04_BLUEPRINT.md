# Alpha 0.4 — full-window blueprint GUI and preset workflow

**Branch:** `codex/lpc-voice-lab-a04-blueprint-presets` (derived from Alpha 0.3 GUI branch, itself based on Alpha 0.2 fixed-latency version). No automatic merge, installation or Ableton host run.

## Blueprint design

The approved sketch/blueprint design language occupies the **entire plugin window** (1220 × 760), with no virtual stompbox or decorative margins. Native JUCE vector drawing uses a blueprint grid, cyan technical labels, calibration markers and prominent black chicken-head style knobs.

The actual controls are live and automatable: Mic/Voice, Synth/Carrier, Effect Out, Quality, Fricative Gain, Grit, Bandwidth, Wet, Dry, Low End, Order, Unvoiced, Retro, Bypass. The meter panel reads live atomic block peaks for Voice, Carrier and Output. Meter bars are NOT LUFS and do not automatically compensate for level.

## Named user presets

- `SAVE AS` opens a native file chooser for `.lpcpreset`.
- `OPEN` loads a selected `.lpcpreset`.
- The top combo lists factory choices plus `.lpcpreset` files in the writable user application data/solidtakes/LPC Voice Lab/Presets folder.
- File data is the existing APVTS parameter state serialized to XML with `lpcVoiceLabPresetVersion=1` marker; malformed/foreign files are rejected before changing DSP state. New files use temporary writes.
- A user patch saves **all parameters**, including gain trims. Plugin instances also still save APVTS normally in Ableton projects.
- The three factory programs are deterministic for DSP parameters (fixing previous inheritance). They deliberately preserve the three gain knobs and bypass, to avoid unexpectedly resetting levels during live microphone use.
- This update does **not** claim perfectly matched loudness. Level normalization needs matched recordings and a supervised owner audition. Peak indicators help document gain differences.
- The original TalkBox-style core is unchanged. NuVo and TazMania are research references, not additional working algorithms.

## Safety and test gates

Windows/macOS CI must pass before a downloadable build is offered. New save/open UI and DAW preset recall need owner manual tests. Back up Alpha 0.2 / Alpha 0.3 VST3 before installing: this iteration retains the existing VST3 identity and cannot run side-by-side without a renamed plugin build. Max for Live paused.