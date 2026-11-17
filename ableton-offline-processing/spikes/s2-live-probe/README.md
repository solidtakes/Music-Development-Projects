# AOPX S2 Windows Live 13 Beta read-only AudioClip inspector

**Experimental draft, not yet independently reviewed or run in Live.**
This probe registers an AudioClip right-click item; resolves its current handle and
reads clip/parent-track metadata. It never modifies a Live Set, renders, imports,
creates a track or clip, stores handles, or reads file bytes.

## Install

Use the existing SDK 1.0.0-beta.1 that worked for S3/S4 on Windows. Place this
s2-live-probe package in the SDK examples folder, renamed to aopx-s2-probe.
The package relies on the official SDK and CLI tarballs two levels above it;
do NOT run it directly inside an arbitrary Git checkout.

Run PowerShell from the installed examples/aopx-s2-probe folder:
    powershell.exe -ExecutionPolicy Bypass -File .\run.ps1

The launcher runs npm install, four SDK-independent unit tests, TypeScript check,
esbuild and the beta CLI. Open ONLY the side-by-side Live 13 Beta with a
disposable Set. Stop other running SDK extension processes first.

Right-click an audio clip and choose:
    AOPX S2 inspect audio clip (read-only)

The result prints between AOPX_S2_RESULTS_BEGIN and AOPX_S2_RESULTS_END.
It includes no full file path, clip name or handle IDs.

## Manual diagnostic cases
1. Plain Arrangement clip on its own audio track; verify scope Arrangement,
   parentTrackResolved true and correct trackIndex, start/end beats.
2. Enable warping; inspect warping, warpMode and warpMarkerCount.
3. Enable looping; inspect looping, loopStart/loopEnd and start/end markers.
4. Trim clip; record differences between startTime/endTime and markers.
5. Make a second overlapping test clip on the same track; report overlapsOtherClips
   and otherClipCount. Clips touching only at an edge are NOT overlaps.
6. Optional Session clip; overlap must stay unknown (not measured).

All changes to the disposable test material are manual user actions inside Live.
This diagnostic makes ZERO SDK model writes. Return the JSON records to Issue #40.
If any invocation says BLOCKED, stop and report it; do not assume the property exists.

## Gates
- S2 real-host result is pending; SDK class properties and timing are not a Live pass.
- No merge and no production Set test without separate owner authorization.
- T8-0 read-only adapter is separate, gated by verified parent-track and beat fields.
- T8 import/track creation, audio render into Set and rollback are not in scope.
- Existing PR #55 and #56 remain separate, draft, and unmerged.
