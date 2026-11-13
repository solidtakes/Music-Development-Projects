# Two-bank experimental Bento + Step Sequencer integration — owner test report

Date: 2026-11-12. Status: **USER REPORTS COMBINED TWO-BANK BUILD WORKS**. Exact combined ZIP, script source, hash and commit have NOT been supplied or independently verified here.

## Intended baseline
- Bank 1: current Selected Track Bento development line, retaining Track Mixer v1, Device Controls v1, FX Sends v1 frozen behavior, Beta Clip Launcher, Beta VU, and experimental transport work.
- Bank 2: added step sequencer from separate experimental thread.
- User may continue development on this combined two-bank build rather than the single-bank Bento test ZIP.

## Preservation rules
1. Do not silently assume combined Bank 1 is byte-identical or feature-identical to Bento v2.2. Compare actual scripts when combined ZIP becomes available.
2. Preserve frozen v1 module mappings and approved VU design requirements from existing freeze files.
3. Sequencer bank must not disturb Bank 1 channel/CC handling, LED routing, bank switching, or held-button cleanup.
4. Before designating combined build as canonical source, capture ZIP, SHA256, script file inventory, and compare Bank 1 with v2.2; test both banks.
5. No merges or source overwrites without owner approval.

## User report
'also i had experimental thread combine this build with sequncer work on bank 2 fyi, i tested it works so i might continue on this 2 bank build it should have all the same we are working on, but added is bank 2 for step sequencing'
