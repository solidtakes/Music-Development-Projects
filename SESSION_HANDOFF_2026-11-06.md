# Development Handoff — November 6, 2026

Repository: https://github.com/solidtakes/Music-Development-Projects

This handoff records the latest user-confirmed requests and the verified repository state for the next ChatGPT/Codex session. It is a progress note, not a claim that code changes have been made.

## 1. MIDI Fighter Twister Python scripts

Separate projects:
- `mft-main-python/` — Main Python Remote Script. Its status file identifies v0.20.7.2 as a confirmed working baseline, but says source is not yet uploaded.
- `mft-alternate-python/` — Alternate MF Build 2 script. Its status file says source and current version still need verification.

Latest reported issue/request:
- A lag has been noticed in the scroll encoder. Investigate the cause before changing behavior.
- First determine which of the two scripts and which exact encoder path is affected. Do not assume the issue belongs to both scripts.
- Preserve the separate codebases and their version histories. Do not merge or cross-copy their implementations.
- Inspect the actual source, MIDI handling, feedback/display updates and timing/polling behavior before proposing a fix.

Current limitation:
- The repository status documents do not themselves establish that the Python source files have been uploaded. Verify the actual directory contents and source before editing.

## 2. Matrix MIDI Router — Max for Live

See `matrix-midi-router/PROJECT_STATUS.md` for the full current specification.

Latest requested behavior:
- Encoders 13, 14 and 15 control the first, second and third tracks in the currently selected Matrix selection box.
- All three assignments follow the selection box when it moves.
- Normal display: white live VU meter for each assigned track.
- VU behavior: fastest practical peak response; no RMS, no RMS averaging or smoothing.
- On volume adjustment: freeze that encoder's VU display and show the corresponding track's volume in dB temporarily.
- After approximately one second without encoder movement, restore the live VU display.
- Update the volume targets and VU sources when the selection box changes.

Verified prior context:
- Earlier tests routed MIDI channels 1 and 2 to distinct receiving instruments.
- Version 6 was reported as in progress with Codex, but exact source/version and behavior have not been independently verified.
- At last inspection, the Matrix folder contained a status document but no Max patch / AMXD source. Obtain the real patch/source before implementation.

## 3. Working rules for the next session

1. Fetch/pull the latest repository state before doing anything.
2. Inspect actual files and identify the active versions; do not infer source code from status notes.
3. Keep Main Twister, Alternate Twister and Matrix as separate projects.
4. Do not overwrite uncommitted local work.
5. Implement only after the relevant source is available.
6. Test changes in the target environment and report what was actually tested.
7. Update the relevant `PROJECT_STATUS.md` with implementation status, version, commit SHA, test results and next steps.

## 4. Current progress as of this handoff

- Updated Matrix project status with the November 6 volume/VU specification.
- No Python or Max source code was changed.
- No encoder-lag fix or Matrix volume/VU implementation has been made or tested.
- The key next requirement is to connect the GitHub repository in the next ChatGPT account and provide/import the missing source files where needed.
