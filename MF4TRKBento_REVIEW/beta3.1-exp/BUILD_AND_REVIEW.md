# MF4TRKBento Beta 3.1 EXP — device rows

**Status:** Experimental; no Ableton Live runtime, hardware, MIDI timing, or LED physical verification claimed. Do not merge to main; owner hardware approval is required.

## Source provenance
- Owner tested Beta 3.0 EXP ZIP SHA256 `728c63bee4d5be6972112cf3f296f0a286ccbc28af5764397ca5f76a20f79320`.
- Frozen Beta 2 rollback ZIP SHA256 `a05f8fd68001599acecfadf2c037d97196269d1f704c93a8bd831e51d383bb56`.
- New build edits only the Bank 2 package; all other banks, Native Mode, firmware, device mapping, Utility configuration and persistence are out of scope.

## Layout acceptance
Top-down Device Control replacement order: Send B -> Send A -> Pan -> Volume. Zero through four device rows consume top rows successively. Top Device row controls selected device params 1–4, secondary rows next consecutive groups; only top row has yellow power, next bank, previous and next device push functions. Secondary rows show blue. The default button modules and mixer row push selection are independent of rotary assignments. Fixed row rotary assignment means Blank disables pushes but does not collapse mixer rows.

## Validation
```
python -m py_compile MF4TRKBento/MF4TRKBento.py
python -m unittest discover -s tests -p 'test_beta3.py' -v
```
43/43 offline tests passed locally. No physical test was run. Included tests use stub `_Framework`, `Live`, `ControlSurface` and MIDI IO and do not establish hardware correctness. Inspect `MF4TRKBento/README_INSTALL.txt` for all gestures and test steps.

## Independent reviewer assignment: Claude Code and Codex
Read the original Beta 3.0 EXP baseline (SHA above) and the complete new Python source and tests. Verify every material change and explicitly distinguish simulator tests from Live runtime evidence. Investigate:
1. No unintended top-down module movement; 0/1/2/3/4 Device Control rows; Volume last; mixer row button actions independent.
2. Device selected via Live `Song.View`/`Track.View` under Live 12/13, including racks/nested chains, missing device and track switches, and previous/next device semantics. Check `.select_device()` and the fallback property setter against actual Live APIs.
3. `Device On` detection/exclusion and parameters 1–4 then 5–8 and following groups; banking stride 4 versus selected-track frozen controls and labels (do not silently alter without owner approval).
4. Primary yellow power LED, blue secondary rows, invalid/missing parameter clearing, ring scaling and quantized parameters.
5. Interaction collision: E1/E4 device controls vs E1+E16, E1+E12, row selector hold+twist and consumed push releases, including 35ms Volume press correction.
6. Return track banking, partial Returns, selection, alternate mode, scene and Stop All, global Unsolo, no stale LED or changes to CC0–15 routing.
7. Startup, scheduler/tick lifecycle, heavy Live API property reads, potential exceptions from invalid Live proxies or nested devices; any candidate crash, race, or hard stop.

**Review protocol:** In GitHub, comment with findings ranked Blocker / High / Medium / Low, source line references, minimal reproduction, proposed fix and whether directly verified. If a problem is confirmed, propose a narrow follow-up patch or a separate fix branch; do not auto-merge, do not change other banks or baselines. Keep the thread active for follow-ups, report back to owner in same issue/PR, and seek owner approval before feature redesign or hardware/production changes. Claude/Codex access and automatic execution are not assumed; a GitHub issue alone does not start their cloud sessions.
