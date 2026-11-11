# MF / MIDI Fighter Twister / Ableton Python — Unified Handoff (2026-11-11)

## Coverage and limitations
Includes threads titled or referring to MF, MFT, MIDI Fighter Twister, Ableton Python, Remote Scripts, Main Build, MF Build 2, selected-channel mixer, four-track mixer, session/clip launcher, mono sequencer, LED diagnostics, and color calibration. This is a consolidated record of accessible conversation context and existing GitHub documents, **not proof of exhaustive access to every old thread or ZIP**. Do not confuse Max for Live Matrix patch or AIRA driver with Twister Python scripts.

## Governance and storage
- Separate Main Build / Working Prototype from experimental MF Build 2. No automatic merge, overwrite, or promotion.
- Owner alone declares milestone, stable, and move-on/freeze. Record exact version, source commit, ZIP hash, hardware evidence, known issues, rollback; archive source before issuing test ZIP.
- ZIP filename and internal Ableton Remote Scripts folder should share a recognizable base name; e.g. `mfcolumn mix ch 1.zip` -> `mfcolumn mix ch 1/`.
- Preserve older source/ZIPs even when newer tests fail. Text-only GitHub connector cannot archive binary ZIP; record binary archive as missing until verified.
- GitHub coordination: `midi-fighter-twister/README.md`, bank-specific PROJECT_STATUS, `experimental/SIGNED_OFF_BUILD_REGISTER.md`, `CONSOLIDATED_CHRONOLOGY_2026-11-11.md`.
- One conversation per bank plus experimental conversation is a workflow preference, not proof ChatGPT threads were physically moved.

## Families and baselines
**Main Build**: user-confirmed stable `v0.20.7.2`; earlier tested v0.18.4; historical legacy `v0.23.4 YELLOW_ROLLBACK` is a separate lineage. Preserve beat/bar counters, encoder 4 CC-zero fix, macros, responsive volume LEDs, colors and navigation. Actual stable source not verified in GitHub.

**Selected Channel / Single Channel**: v0.5.11 hardware-confirmed layout, v0.5.12 reportedly stable except E5 parameter banking; proposed v0.5.13 dynamic eight-parameter banking. `MF_Sel_Track_Mode_v1_0_COMPAT_FIX.zip` designated reference for MIX-001; actual bytes not recovered. Earlier reconstructed `mfcolumn mix ch 1` failed hardware test. MIX-001 should affect E1/E5/E9/E13 only, no other controls.

**Four-track / four-channel**: separate lineages `MF_4TRK_Mode v0.9` and `Four_Channel_Mixer v0.3.0`; do not compare version numbers as one sequence.

**MF Build 2 Bank 3 Clips n Scenes**: `MF_Clips_n_Scenes_v0.3.0_MIXER_METER_FIX_TEST.zip` latest named test; rollback v0.2.9; older v0.2.4. Hardware validation of v0.3.0 pending. Three pages documented in bank-3 status. Preserve relative scrolling, page-switch combo E15+E16, clip progress, sends/monitor colors, meter thresholds.

**MF Build 2 Bank 4 Mono Sequencer**: v1.51 reported; double-click switching worked, bar 2 note entry extended loop; cap at four bars requested, investigate note-entry lag and rare clip-position jump after E1+E15/E16 combo (not reproducible). Source unverified.

**COL-001**: 32 colors across Bank 1 and Bank 3, Standard vs Expanded MF Utility modes. v0.1 and v0.2 both failed to light Twister; do not repeat unverified channel-2 assumption. Working historical Twister LED Diagnostics v0.3.0 CUSTOM_BANK1_TEST reported color changes upon encoder action; user now reports click changes color. Recover actual source before specifying exact mechanism.

## Bank-specific MF Build 2 layout (historical plans can conflict)
- Bank 1 mixer/device, Bank 2 session/clips, Bank 3 4 tracks x 3 scenes launcher, Bank 4 mono sequencer. Existing `bank-2/PROJECT_STATUS.md` describes Selected Channel/4-Track Mixer instead; **bank ownership conflict needs reconciliation**, not silent rewriting.
- Bank 3 page 1 E1–E12 4x3 clip grid; E13–E16 track stops. User provisionally preferred release-triggered clips and stops (not press-triggered), zero intentional software delay after release. Expanded color mode for Bank 3 only, other banks unchanged.
- Bank 3 rotary channel 12 CC32–47, relative ENC 3FH/41H, sensitivity 360; push channel 11 CC32–47, CC Hold.
- Bank 4 rotary channel 12 CC48–63, relative ENC 3FH/41H, sensitivity 360, center detent/dot; push channel 11 CC48–63, CC Hold.
- Bank 1 diagnostic input reported rotary channel 12 CC0–15, push channel 11 CC0–15; RGB output may differ and must be verified against source. Twister factory defaults differ from custom mapping.
- Side button preference: left top previous, middle Bank 2, bottom Bank 1; right top next, middle Bank 4, bottom Bank 3.
- User prefers MFT PushGuard 400: suppress accidental rotary for 400ms after push, per encoder, but preserve intentional hold-rotate.
- E16 navigation should adapt to Ableton returns: Tracks/Master two zones or Tracks/Returns/Master three zones; design not confirmed implemented.

## Main Build details to preserve
- Mixer View 1: E1 volume, E5 pan, sends on lower rows; push mute/reset/clear. Beat/bar counters vertical E3/E7/E11/E15 and E4/E8/E12/E16.
- View 2 eight macros E3/E4/E7/E8/E11/E12/E15/E16; Device On/Off E3 push, disable E7 push, enable E11 push. E4 zero bug fixed.
- View 3 sixteen device controls; horizontal counters, device power E1, yellow on/cyan off. E15/E16 push track navigation.
- Session clip LEDs: stopped solid clip color, playing flashes clip color 1/8, recording red 1/16, queued orange 1/16; scene playing green, idle yellow; stop white flash. Relative track/scene scrolling E12/E16, confirmed responsive; volume E13–E15 confirmed excellent. Pause LED/VU updates during navigation; session VUs disabled for performance tests.
- Future VU concept (not implemented): E3/E7/E11/E15 green audio VU; E3 orange/red clipping, E7 orange only, E11/E15 green-only; outer white ring MIDI activity. Separate experimental VU-001.

## Calibration values — observed, not universally portable
Red72; green76; orange108; light blue68; pink52; teal32; purple96; light purple104; dim green88; yellow120 dim candidate; brown100 rejected. FX send deep purple47 in Selected CH expanded palette; value117 reported white in earlier diagnostics. Standard vs Expanded modes may produce different colors. Avoid claiming a number has identical visual meaning across all banks.

## Recent test outcomes and risks
- Bank 3 v0.3.0: E1/E5 sends deep purple47; E9 monitor IN blue/AUTO yellow/OFF dark then returns to Pan blue; E13 arm red priority; E2/E6/E10/E14 beat/meter; four MIDI meter thresholds 1/43/86/115 of 127, not mirrored values; verify physically.
- Sequencer v1.51: bar 2 works, 8-bar access unexpectedly possible, cap four; note entry latency; rare clip-position shift.
- Earlier LED diagnostics: v0.2.0 and v0.3.0 CUSTOM_BANK1_TEST inventoried; v0.4.0 color selection concept discussed, not verified as implemented.
- COL-001 v0.1/v0.2: no LEDs, failed; root cause unverified.
- Source gaps: historical 96-file audit (94 ZIP + 2 PDF) exists as local archive inventory, not binary-backed in GitHub; do not claim original ZIPs recoverable.

## Next recovery priorities
1. Retrieve exact working Twister LED Diagnostics source and hash/commit without modifying original.
2. Resolve Bank 2 ownership conflict from hardware/deployed scripts, retaining historical records.
3. Import verified Main stable v0.20.7.2 and Selected CH reference source into immutable versioned folders.
4. Preserve MF Build 2 Bank 3 v0.3.0 and Bank 4 v1.51 sources once accessible.
5. On each future build, commit source before packaging, record results in sign-off register; never imply that a missing ZIP was backed up.
