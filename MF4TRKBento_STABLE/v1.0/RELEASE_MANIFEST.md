# MF4TRKBento v1.0 STABLE — owner-accepted release record

Owner acceptance (2026-11-16): Beta 3.7 described as "great", authorized promotion to v1 stable and GitHub upload.

**Exact implementation parent:** `52eec693aa1b832ecc40aa92772d17ec516299e1`, draft PR #58 (original Beta 3.7 EXP). `MF4TRKBento.py` is byte-identical to the working Beta 3.7 implementation except for **three occurrences of the user-facing startup/version label** `Beta 3.7 EXP` → `v1.0 STABLE`; no behavior, MIDI logic or mapping changed. README version headers updated; tests copied unchanged.

**Pinned installable ZIP SHA-256:** `332ba9a54f24c96eecb0c7979652282cb6661b697a227607ad753f5823890d77`

**Installable permanent package:** `MF4TRKBento_STABLE/v1.0/releases/MF4TRKBento_v1.0_STABLE.zip` contains only:
- `MF4TRKBento/__init__.py`
- `MF4TRKBento/MF4TRKBento.py`
- `MF4TRKBento/README_INSTALL.txt`

`MF4TRKBento` is the Ableton remote-script installation folder name. The release archive is a canonical uncompressed ZIP stored in Git; CI validates archive integrity, byte-for-byte member parity to adjacent source, and regressions. No bytecode, symlinks or hidden extras. Preserve the rollback Beta3.7 archive SHA-256 `46768c461ef337a3515a6f7a78e11c3411ec01febf02ca3a66393c3c838d8c78` and earlier Beta3.6 milestone SHA-256 `2de87b5ec4c46cb04cbb3eccb36c47f8de9e2ef17948f21fe54c114c86580013`.

## Bank 2 production contract — freeze
- Hardware: DJ TechTools MIDI Fighter Twister, non-Native mode. Encoder rotation CC0-15 on **MIDI channel 12** (zero-based 11), push CC0-15 on **MIDI channel 11** (zero-based 10); relative ENC 3FH/41H; four physical rows, four columns.
- Default rotary rows (top-down): Sends A, Sends B, Pan, Volume. Default push rows: Clip Launch, Arm, Solo, Mute.
- Rotary modules: Volume, Pan, Sends, Device Control; allow repeats and gaps. Push modules: Blank, Clip Launch, Arm, Solo, Mute, Stop Clips; Arm/Solo/Mute/Stop uniquely assigned one row max, Clip/Blank repeat.
- Device/Sends topmost active rotary row owns shared hold-last utility shortcuts. Device Control is rotary-only. Device full-page jumping and 4-parameter scrolling, slower device navigation, one-step nonwrapping Sends moves; no unavailable-parameter ring activity.
- Six physical row-to-row same-column push chords: Clip held/tap below=Stop Clips; Clip held/tap above=Select track; Mute held/tap below=Solo; Solo held/tap above=Mute; Solo held/tap below=Arm; Arm held/tap above=Solo. Held source determines action, order-sensitive; consume involved buttons on all releases. Honor the 3-clips+scene master column and FX Returns safety guards.
- Preserve global E1/E16 gestures, 4-detent module selectors and original volume press-contamination correction.
- Full integrated Ableton/Live session testing still required. Owner-positive hands-on acceptance is **not** proof of exhaustive gesture and cross-bank testing.

## Future three-bank assembly (NOT included in this v1 archive)
1. **Bank 1 — Selected Track Bento:** retain existing owner-approved, independently versioned stable build.
2. **Bank 2 — this MF4TRKBento v1.0 STABLE:** copy the exact three files above into its dedicated `MF4TRKBento` script package/module.
3. **Bank 3 — Sequencer:** retain existing owner-approved frozen sequencer build.

Integration must check non-overlapping CC/channel assignments **per hardware bank**, correct Twister hardware bank selection, Ableton Remote Script ports/identity and source namespaces, and MIDI-output LED isolation. Keep all bank-owned RGB/white ring behavior, startup behavior and E1+E16 shortcuts. A combined multi-bank package must have its own separate version and regression/hardware approval. **CROSS-BANK REVIEW REQUIRED** before shared routing, Native Mode, or firmware changes.

No automatic merge of old draft PRs. Preserve this v1 release as a separately named stable branch and permanent package; future minor tweaks go on a new patch branch (e.g. v1.1 EXP), not on this record.
