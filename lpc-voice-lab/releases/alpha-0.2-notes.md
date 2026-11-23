# LPC Voice Lab — Alpha 0.2 (historical manual-test milestone)

**Historical pre-release**, kept for reproducibility and comparisons. This build is not current or production-validated.

**Source commit:** [`8a6aaf3523ebe3964edde7b18f86111fac8ddc9c`](https://github.com/solidtakes/Music-Development-Projects/commit/8a6aaf3523ebe3964edde7b18f86111fac8ddc9c)
**Successful CI build:** [44858473660](https://github.com/solidtakes/Music-Development-Projects/actions/runs/44858473660) — Windows/macOS build and existing DSP tests passed.

## What changed
Fixed-latency Unvoiced correction. Fixed 25 ms lookahead is declared to the host during preparation, and Unvoiced ON was manually confirmed working in Windows Ableton.

## Known limitations
**Known limitation:** Generic JUCE editor; no custom blueprint GUI, named preset browser or optional Retro controls. Mac DAW runtime unverified.

## Files
- `LPC-Voice-Lab-Alpha-0.2-Windows.zip` — Windows 64-bit VST3.
- `LPC-Voice-Lab-Alpha-0.2-macOS.zip` — macOS VST3 and AU.
- `SHA256SUMS.txt` — package checksums.

**Installation safety:** All Alpha versions use the same VST3 plugin identity. Back up your existing installation before replacing it. Test with prerecorded voice/carrier and safe monitoring levels to avoid microphone feedback. DAW runtime tests on macOS are not independently verified. No code PR is merged by this release.

See the [milestone index](https://github.com/solidtakes/Music-Development-Projects/releases) for the latest build.
