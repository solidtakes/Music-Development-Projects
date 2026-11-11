# Uploaded MIDI Fighter Twister archive audit — 2026-11-11

Inventory: 96 files, comprising 94 valid ZIP archives and 2 PDFs. All ZIP integrity tests passed. 26 groups of files have identical whole-archive SHA-256 hashes. Original archives remain preserved in the ChatGPT-generated organized audit package; this document does **not** mean ZIP binaries are stored in GitHub.

## Organization
- **Bank 1 / Mixers:** 28 Four-Track family ZIPs and 40 Selected-Channel family ZIPs, across multiple distinct development lineages.
- **Bank 3 / Clips n Scenes:** 25 ZIPs, latest local package v0.3.0 MIXER_METER_FIX_TEST, pending hardware validation.
- **Experimental / LED Diagnostics:** 2 ZIPs, latest v0.3.0 CUSTOM_BANK1_TEST.
- **Legacy Main Build:** 1 ZIP, MFT_Test_Build v0.23.4 YELLOW_ROLLBACK, preserved independently.
- **Bank 4 / Sequencer:** no uploaded archive; v1.51 is a previously reported test version, not verified from these files.

## Version findings
- MF_4TRK_Mode latest named test: v0.9 VOLUME_DEVICE_TEST.
- Four_Channel_Mixer latest named test: v0.3.0 FOUNDATION_TEST (different package lineage).
- MF_4Trk_Mode: v0.3.3 TEST, separate package structure.
- Selected Channel v1.0 STABLE and v1.0 COMPAT_FIX share identical main Python source SHA-256 prefix `84481b8067f9`; ZIP packages differ. This is **not** proof that every packaged file is identical.
- MFT_v058 DEVICE_SUBMENU_TEST is a separate later-named test in the v0.5x lineage. v0.5.11's layout PDF describes it as hardware-confirmed stable.
- Bank 3 latest test: v0.3.0. Do not promote without hardware test.

## Important caveats
The early requested 'MidiFighter Custom' prototype is not unambiguously identifiable: many unrelated ZIPs share the installed package name `MidiFighterTwister_Custom`. Do not classify by package name alone.
Keep separate histories and rollback archives; do not automatically merge or overwrite code. Compare MIDI mappings and LED color modes before sharing experiments across banks.

Full per-file SHA-256 and source hashes are available in the generated `INVENTORY.csv` and organized ZIP supplied in the ChatGPT conversation.
