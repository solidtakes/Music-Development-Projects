# MIDI Fighter Twister — Canonical Build and Sign-off Register

Updated: 2026-11-11

## Rules (effective immediately)
1. Every new build must have its complete source committed to GitHub **before** being offered for hardware testing. A download link alone is not an archive.
2. Keep three separate pointers per module: **reference source**, **latest experimental**, and **last explicitly hardware-approved**. Never infer approval from filename or successful syntax tests.
3. Preserve the exact source filename, internal Ableton Remote Script folder, ZIP filename, source commit, SHA-256 of ZIP when available, test notes, and owner approval.
4. Never overwrite a signed-off build. Each new version gets an immutable versioned directory or Git tag. Never merge experimental code automatically.
5. ZIP archives must be stored in GitHub or an accessible GitHub Release when the available integration supports binary uploads. The currently connected GitHub file-write tools support **UTF-8 text only**; therefore ZIP archival is **pending until a binary-capable upload path is available**. Do not mark a ZIP backed up merely because its filename appears here.
6. For each handoff, check that the committed source can be fetched back, and report source availability separately from ZIP availability.
7. Use the same descriptive build name for the ZIP and its internal Ableton script folder; append a version to the ZIP only when needed without renaming the stable internal folder.

## MIX-001 — mfcolumn mix ch 1
- **Reference source filename:** `MF_Sel_Track_Mode_v1_0_COMPAT_FIX.zip`
- **Reference status:** user-designated source; actual bytes not recovered; SHA-256 pending
- **Historical comparison:** v1.0 Stable and Compatibility Fix reportedly have identical main Python source but different ZIP packages; do not treat them as byte-identical
- **Last hardware-approved source:** not yet established in this register
- **Latest experimental:** `mfcolumn mix ch 1.zip`, reconstructed v0.1; user reported **does not work**; **REJECTED**, not signed off
- **Target hardware:** Column 1 E1/E5/E9/E13 only; remaining encoders inactive
- **Source Git commit:** pending recovery of original working code
- **Internal Ableton folder:** `mfcolumn mix ch 1`
- **Next action:** recover exact original source, verify mappings and compatibility, create versioned isolated source directory and test ZIP, commit source before delivery
- **Production protection:** no existing production scripts modified

## Build entry template
```
Module:
Reference source:
Reference SHA-256:
Build version:
Git source path:
Git commit:
ZIP filename:
ZIP SHA-256:
ZIP archival URL (verified, or pending):
Ableton internal folder:
MIDI channel/CC mapping:
Static/syntax test result:
Hardware test result:
Owner approval and date:
Rollback reference:
Known issues:
```

## Owner-directed milestone workflow (2026-11-11)
- Owner explicitly declares a **milestone build**, **stable build**, or **move-on / frozen baseline** in conversation. These declarations are authoritative for status; do not silently promote test builds.
- On each declaration, immediately commit available source and milestone metadata to GitHub, preserving previous baselines; record version, source commit, ZIP/hash if available, hardware test notes, owner approval and rollback path.
- A milestone is not automatically stable; stable requires explicit owner designation. Moving on freezes the current explicitly approved baseline and starts subsequent work separately.
- For each new test build, archive source before delivery. For each owner milestone, update this register and link the exact GitHub commit. Never claim that an unavailable ZIP was archived.
- This is an **event-driven in-chat workflow**, not autonomous monitoring of conversations. When the owner says milestone/stable/move on in a conversation with GitHub access, perform the update then; if the source is inaccessible, record metadata and clearly flag the missing source.

## COL-001 — Twister LED color calibration (2026-11-11)
- **Owner goal:** Bank 1 and Bank 3, 16 distinct color values per bank, compare Standard and Expanded MF Utility modes, no functional controls in final calibration.
- **Historical working reference:** Twister LED Diagnostics (reported v0.3.0); exact source and ZIP not yet recovered. User reports clicking an encoder changes colors; earlier conversational descriptions conflict; do not claim precise behavior until source is inspected.
- **Hardware mapping reported from prior tests:** custom encoder rotation channel 12 CC 0–15; push/RGB channel 11 CC 0–15 on Bank 1. Bank 3 rotary CC 32–47 channel 12, push CC 32–47 channel 11 (verify against source and MF Utility before use).
- **COL-001 v0.1:** fixed output channel 2 palette, user reports no colors; failed hardware test.
- **COL-001 v0.2:** delayed/repeated channel 2 palette, user reports no colors; failed hardware test.
- **Experimental source branch:** experimental/mft-col-001-banks-1-3; last source commit 933d40c4e0d31841da9c420ea5b0d34051113b65. Neither version is stable or hardware-approved.
- **Root-cause status:** unverified. Channel mismatch is a hypothesis, not established diagnosis.
- **Next step:** retrieve the exact prior working diagnostic source, inspect its output behavior and MIDI messages, then produce source-archived COL-001 v0.3. Do not ask the owner to re-explain already documented mappings or treat memory as a substitute for source.
- **Archive limitation:** original working ZIP not available in GitHub; source and binary provenance remain pending. No claim of full historical recovery.
