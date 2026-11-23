# LPC Voice Lab — Alpha 0.3 (historical manual-test milestone)

**Historical pre-release**, kept for reproducibility and comparisons. This build is not current or production-validated.

**Source commit:** [`72fa5ab9f1bda6cc0563eddce5e2a94296b0a4c1`](https://github.com/solidtakes/Music-Development-Projects/commit/72fa5ab9f1bda6cc0563eddce5e2a94296b0a4c1)
**Successful CI build:** [44870016642](https://github.com/solidtakes/Music-Development-Projects/actions/runs/44870016642) — Windows/macOS build and existing DSP tests passed.

## What changed
First custom pedal-inspired GUI; three gain knobs, Program/Bypass and advanced controls; optional experimental Retro, Grit, Bandwidth.

## Known limitations
**Known issue:** Factory Program changes could cause level jumps and inconsistent state due to incomplete parameter reset; owner preferred Classic. No named user-preset browser. Alpha 0.4 introduces deterministic factory DSP settings and a full-window blueprint GUI.

## Files
- `LPC-Voice-Lab-Alpha-0.3-Windows.zip` — Windows 64-bit VST3.
- `LPC-Voice-Lab-Alpha-0.3-macOS.zip` — macOS VST3 and AU.
- `SHA256SUMS.txt` — package checksums.

**Installation safety:** All Alpha versions use the same VST3 plugin identity. Back up your existing installation before replacing it. Test with prerecorded voice/carrier and safe monitoring levels to avoid microphone feedback. DAW runtime tests on macOS are not independently verified. No code PR is merged by this release.

See the [milestone index](https://github.com/solidtakes/Music-Development-Projects/releases) for the latest build.
