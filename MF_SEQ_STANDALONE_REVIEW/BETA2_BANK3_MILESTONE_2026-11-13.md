# MF Step Sequencer — Beta 2 Bank 3 Milestone (2026-11-13)

## Owner-tested snapshot
- Baseline: MF_SEQ_BETA_V2.1_TEST10_BANK3_NOTES_LED_CC1_DIAGNOSTIC.zip, copied without modification as MF_SEQ_BETA_V2_Bank3_TEST10_MILESTONE.zip.
- Milestone ZIP SHA256: 8dea063d7f42e3e19d3e0b4e91b3b2f4c16ad9f33f2c014219c9241fbeef021a
- MF_SEQ/MF_SEQ.py SHA256: 63ac6e35596698fa807008a11f6547e8fc1fc4be137c105e04f0b06cdc252000
- Current hardware mapping: Bank 3, Extended Color Mode; rotary CC32–47 channel 12; push CC32–47 channel 11. Intermediate encoder sequence inferred from first and last screenshots.
- Owner-confirmed: mode-switch white-ring redraw nearly fixed; velocity sensitivity improved; long/held notes show multiple colored encoders and must be preserved; sustained brightness/color not yet calibrated.
- Known defects: held note-start white ring can disappear; CC1 clip envelope API unavailable and no data written. CC1 must not be described as working.
- Status: Beta 2 owner-accepted *working snapshot with known limitations*, not fully regression-tested release.

## Next experimental Test 11
- Reassert touched note-start ring after press, held turn and release.
- Reduce repeated CC1 API warning to once per clip/mode; no fake writes.
- Source SHA256: b37cfba5e7b15ac2fa5c03f46d02034ce050677cbcfc529f59ad917829ffe3bf
- Test 11 Python syntax and ZIP integrity passed; hardware test pending.

## CROSS-BANK REVIEW REQUIRED
This Bank 3 assignment conflicts with the earlier Session View reservation. Owner authorized experimental sequencer migration but not overwriting Session View or merging shared MIDI/LED dispatch. Experimental Integration must review before combining.

## Provenance limitation
This GitHub commit records the milestone manifest and checksums **only**. ZIP and source bytes are preserved as downloadable artifacts in the development conversation, **not committed to GitHub by this action**. Upload the exact archived ZIP/source separately before treating GitHub as a complete reproducible source backup. No merges.
