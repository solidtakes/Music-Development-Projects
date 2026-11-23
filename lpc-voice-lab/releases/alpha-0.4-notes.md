# LPC Voice Lab — Alpha 0.4 (manual-test milestone)

**Status:** pre-release, not a verified production plugin. Windows/macOS offline builds and existing core DSP tests passed; the new editor, Save/Load interactions and DAW host behavior still require manual testing.

**Source commit:** [`aa533ddf3f6ac02e051cfad4f8d97ff314f9255c`](https://github.com/solidtakes/Music-Development-Projects/commit/aa533ddf3f6ac02e051cfad4f8d97ff314f9255c)
**CI run:** [44874966814](https://github.com/solidtakes/Music-Development-Projects/actions/runs/44874966814) (Windows/macOS build and existing DSP tests successful)

## Downloads

- Windows 64-bit: `LPC-Voice-Lab-Alpha-0.4-Windows.zip` — VST3.
- macOS: `LPC-Voice-Lab-Alpha-0.4-macOS.zip` — VST3 + Audio Unit.
- `SHA256SUMS.txt` — hashes for both release ZIP files.

## New in Alpha 0.4

- Full-window original blueprint-style GUI with vector chicken-head controls.
- Named user presets (`.lpcpreset`) with Save As and Open; user folder and file format described in `lpc-voice-lab/ALPHA04_BLUEPRINT.md`.
- Voice, Carrier and Output peak meters (not LUFS meters).
- Factory Classic, Retro, and Articulate now restore their DSP parameters deterministically without resetting mic/carrier/output gains.

## Installation precautions

**Back up your current working VST3/AU before replacing it.** This build keeps the same plugin identity as Alpha 0.2/0.3, so an update replaces the previous version; do not expect side-by-side installations.

Windows: place the extracted `LPC Voice Lab.vst3` bundle in `C:\Program Files\Common Files\VST3` after closing your DAW. macOS: copy the VST3 to `~/Library/Audio/Plug-Ins/VST3/` or the AU to `~/Library/Audio/Plug-Ins/Components/` while the DAW is closed. The macOS build is not independently notarized or DAW runtime-verified.

Use prerecorded speech/carrier when comparing modes to avoid live microphone feedback. Verify presets Save/Load, project reopen, meter activity, gain behavior, and audio continuity. **No automatic loudness-matching algorithm is included.**

NuVo and TazMania have research recordings only; their DSP modes are not implemented. Max for Live exploration remains paused.

No PRs were merged to make this release.
