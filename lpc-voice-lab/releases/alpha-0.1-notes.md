# LPC Voice Lab — Alpha 0.1 (historical manual-test milestone)

**Historical pre-release**, kept for reproducibility and comparisons. This build is not current or production-validated.

**Source commit:** [`12234d0f8149fdc7294d59862185e02574022a90`](https://github.com/solidtakes/Music-Development-Projects/commit/12234d0f8149fdc7294d59862185e02574022a90)
**Successful CI build:** [44846306910](https://github.com/solidtakes/Music-Development-Projects/actions/runs/44846306910) — Windows/macOS build and existing DSP tests passed.

## What changed
Initial MDA-based LPC vocoder with stereo voice main input and external carrier sidechain; JUCE generic editor.

## Known limitations
**Known issue:** On Windows, enabling Unvoiced could silence output due to host latency changes made while processing. Alpha 0.2 corrects this. Use Alpha 0.1 only for historical regression/reproduction.

## Files
- `LPC-Voice-Lab-Alpha-0.1-Windows.zip` — Windows 64-bit VST3.
- `LPC-Voice-Lab-Alpha-0.1-macOS.zip` — macOS VST3 and AU.
- `SHA256SUMS.txt` — package checksums.

**Installation safety:** All Alpha versions use the same VST3 plugin identity. Back up your existing installation before replacing it. Test with prerecorded voice/carrier and safe monitoring levels to avoid microphone feedback. DAW runtime tests on macOS are not independently verified. No code PR is merged by this release.

See the [milestone index](https://github.com/solidtakes/Music-Development-Projects/releases) for the latest build.
