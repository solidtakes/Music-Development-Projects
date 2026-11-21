# LPC Voice Lab — Alpha 0.1 experimental scaffold

An open-source **LPC vocoder** experiment targeting the character of classic DigiTech Talker and Electrix WarpFactory units in Ableton Live. It is not an IVL DSP implementation; accurate similarity has not been demonstrated.

## Current state

- Imported original MDA Talkbox Plus framework-independent LPC core and tests (unmodified); derived a separate JUCE plug-in wrapper.
- JUCE VST3 for Windows and macOS; AU on macOS. Build and host runtime verification are **pending**.
- Voice goes to the main stereo input; synth/carrier goes to the external sidechain. If sidechain is disabled, output is silent.
- Controls: Wet, Dry, Quality, Order Normal/High, Unvoiced, Fricative Gain, Low End. Uses generic host editor to save time.
- No merges and no runtime tests in Live have been performed.

## Build

From lpc-voice-lab/:

    cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release --parallel
    ctest --test-dir build -C Release --output-on-failure

CMake 3.22+ and a C++17 compiler are needed. JUCE 8 is downloaded at configure time; alternatively provide -DJUCE_SOURCE_DIR=/path/to/JUCE.

## First Ableton test procedure (only once build is independently validated)

1. Add LPC Voice Lab VST3 to a voice track.
2. Route a held-note synth/sawtooth track to the plug-in external sidechain.
3. Start with Wet=100%, Dry=0%, Quality=100%, Order=Normal.
4. Compare bypass / sidechain off / sidechain on at modest monitor volume.
5. Try Unvoiced to hear the fricative passthrough. Record voice/carrier/output samples for later A/B checks.

## Next sound-matching steps

1. Build and test on Windows and macOS, check VST3 sidechain in Ableton.
2. Capture licensed reference audio from genuine Talker / WarpFactory and legal Robot Rocket trial for A/B comparison.
3. Implement selectable retro filter and crush processing, target LPC order ~30 based on public Robot Rocket documentation.
4. Evaluate noise excitation, formant shift, detection, latency behavior and richer presets.
5. Build the custom UI after audio and routing are stable.

## License and provenance

This open-source prototype is an AGPL-3.0 derivative of borris84/mda-talkbox-plus (https://github.com/borris84/mda-talkbox-plus). It includes the original AGPL LICENSE and MIT LICENSE-mda.txt from that project. The original TalkBox DSP was authored by Paul Kellett and is available in MIT-licensed form at https://github.com/pluginguru/mda-effects. JUCE itself has separate AGPL/commercial licensing. See THIRD_PARTY.md. None of these sources contains IVL's proprietary implementation.

Unrelated to, and not endorsed by, DigiTech, IVL, Electrix, Bjango or the MDA authors.

## Known risk

Sidechain bus behavior and real-time host PDC have not been validated. The reference wrapper's dynamic setLatencySamples call remains pending real-time review.