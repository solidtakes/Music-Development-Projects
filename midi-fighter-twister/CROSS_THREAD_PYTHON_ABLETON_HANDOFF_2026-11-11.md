# MIDI Fighter Twister — Cross-thread Ableton/Python knowledge handoff
Updated 2026-11-11. This covers known threads titled MF, MFT, Twister, Ableton Python, MIDI Remote Script, Main Build, Alternate/MF Build 2, Selected Channel, Four Track, Session, LED Diagnostics, sequencer and color calibration. It is not proof that every conversation or ZIP was accessed. Read with README.md, bank-*/PROJECT_STATUS.md, CONSOLIDATED_CHRONOLOGY_2026-11-11.md and experimental/SIGNED_OFF_BUILD_REGISTER.md.

## Protected distinct lineages
- **Main Build / Working Prototype:** v0.20.7.2 owner-confirmed stable. Experimental v0.23.5 and v0.23.4 rollback referenced historically; these do NOT replace stable v0.20.7.2. Do not conflate with Alternate.
- **MF Build 2 / Alternate:** v0.2 confirmed working with Exclusive Arm. Bank layouts have evolved; don't assume a bank number means the same thing in all historical scripts.
- **Standalone MF SEQ / Bank 4:** v1.51 most recently reported; remains separate until explicitly stable and approved to merge.
- **Selected Channel Mixer and Four-Track Mixer:** separate lineages; MIX-001 reconstructed v0.1 rejected. Original Selected CH reference filename MF_Sel_Track_Mode_v1_0_COMPAT_FIX.zip not recovered.
- **Experimental Lab:** COL-001 and VU-001 are not production features.

## Historical archive status
A prior audit inventoried 96 files (94 ZIP, 2 PDF), with 40 Selected Channel, 28 four-track, 25 Clips n Scenes, 2 LED Diagnostics, 1 legacy Main Build. ZIP integrity was checked in a prior local audit, but original ZIP bytes are NOT currently confirmed in GitHub. Source retrieval and binary retrieval must be tracked separately. A source filename or chat download link is not proof of archive.

## MIDI Fighter Utility and feedback
- Bank 3 rotary CC32–47 channel 12 Relative ENC 3FH/41H sensitivity 360; push CC32–47 channel 11 CC Hold.
- Bank 4 rotary CC48–63 channel 12 Relative ENC 3FH/41H sensitivity 360 with center detent/dot; push CC48–63 channel 11 CC Hold.
- Bank 1 diagnostic reported rotation CC0–15 channel 12, push CC0–15 channel 11. Do not assume push input channel equals RGB output channel.
- The 2026 Twister User Guide says factory bank select is channel 4 CC0–3 value 127 for banks 1–4, but user hardware has custom mapping; do not overwrite Utility settings.
- Historical Log.txt confirmed Twister_LED_Diagnostics loaded with Twister MIDI input/output; another log recorded LED Diagnostics v0.2.0 using bank 2 CC16–31 and transmitting startup RGB/ring sweeps. User reports a diagnostic build where pressing an encoder changes its color. Exact build/behavior must be verified from source rather than guessing.

## Main Build features to preserve
- v0.20.7.2 corrected beat/bar counters: vertical in Mixer Views 1/2, horizontal in Device View 3. Preserve macro CC-zero bug fix.
- Mixer E1 volume, E5 pan, rows 3–4 FX sends; push mute, pan reset, send clear. Macro 8 controls E3/4/7/8/11/12/15/16; Device View 16 controls. E15/E16 push previous/next track in relevant mixer views.
- Session: responsive track volume and LED feedback are owner-confirmed excellent. Relative track/scene scrolling E12/E16 must remain. Clip stopped solid own color, playing flash own color, recording red, queued orange, stop white. Session VUs disabled in performance optimization; do not casually reenable.
- Global semantics: device blue, sends purple, navigation pink, monitoring state distinct, counters/transport reserved. Calibrated hardware observations: red72, green76, orange108, light blue68, pink52, teal32, purple96, light purple104, dim green88, deep purple47 in a particular Expanded test, white117 reported. Values are palette-mode dependent.
- Proposed VU-001 E3/E7/E11/E15: inner green; E3 green→orange→red, E7 green→orange, E11/E15 green only; outer white MIDI activity. Not implemented in stable.

## MF Build 2 Bank 3 Clips n Scenes
- 4×3 launcher page E1–E12 clips, E13–E16 track stops. Owner currently prefers press/release triggering for both clips and stops as provisional feel test, zero intentional release delay. Other page 3×4 scenes; selected-track mixer page uses sends/pan/volume and meters. E15+E16 page switching; preserve relative navigation and tested timing.
- Latest named v0.3.0 MIXER_METER_FIX_TEST, rollback v0.2.9, older fallback v0.2.4; v0.3.0 hardware validation outstanding. Historical bank 3 is not the Main Build's Session Bank 2.

## MF SEQ / Bank 4
- Native Ableton Python Remote Script only, not Max for Live or MIDI mapping. Push note entry; hold+tap sustain; twist velocity on occupied note, empty twist does nothing; preserve LED feedback. Historical design also discussed hold+rotate note duration; implementation/version must be checked.
- Reported v1.51 double-click switching seemed good, bar 2 notes inserted and loop extended. User wants cap at 4 bars (8 bars reachable), lower note-entry lag without harming double-click. Rare E1+E15/E16 combination moved clip selection; not reproducible. Prior v1.4.9 and v1.5.1 reports conflict about loop extension and note entry: retain as version-specific reports, not a single verdict.

## Experimental COL-001 failures
- Goal: Bank 1 and Bank 3 16 distinct colors each, compare Standard vs Expanded Color Mode, no functional controls.
- v0.1 and v0.2 sent output CC on channel 2, and both showed no colors on hardware; neither approved. v0.2 delayed/repeated messages. Channel mismatch is a hypothesis, not established root cause.
- Reference working experiment Twister LED Diagnostics v0.3.0 CUSTOM_BANK1_TEST and earlier v0.2.0. Another Expanded Color Calibration v2 Windows was referenced, reportedly channel 11 CC0 with value47 deep purple; exact source not yet recovered. The user describes pressing an encoder changes color. Recover actual source and output code, do not reconstruct behavior from memory.
- Experimental branch experimental/mft-col-001-banks-1-3. Preserve failed versions and don't merge.

## Governance and future handoff
Before issuing a build: fetch actual reference source; preserve working behavior; commit complete source on isolated branch; package ZIP with matching internal folder name; test syntax/ZIP; record exact commit and SHA256; then request hardware test. Owner alone declares milestone/stable/move-on. Never silently promote, merge or overwrite. Keep test failures and source gaps explicit. When a new chat begins, read this file plus the chronology, register and relevant bank status. GitHub text source is available; old binary ZIP archives are NOT automatically synchronized. ChatGPT threads cannot be physically moved by a GitHub commit.
