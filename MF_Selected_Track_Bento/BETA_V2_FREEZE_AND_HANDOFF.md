# MF Selected Track Bento — Beta v2.0 frozen baseline

Status: user hardware-accepted milestone; no auto-merge.
Source package (local artifact, NOT uploaded to GitHub): `Bento_v0.1.32_REDOWNLOAD.zip`
SHA-256: `a1d377fdacb40629bc8454ab48d4ebee984588f933568c02543900ed516ad4fd`
Prior release: v0.1.31; milestone source version v0.1.32.
Package files: `MF_Build_Selectedtrack_Bento/{MidiFighterTwister_Custom.py,__init__.py,README_INSTALL.txt}`, `CHANGELOG_v0.1.31.md`, `CHANGELOG_v0.1.32.md`.
Important: Git branch currently contains documentation only. Do not claim the executable baseline is backed up in Git until the exact ZIP/source is uploaded and SHA verified.

## Hardware-confirmed behavior
- Track Mixer / FX Sends purple LEDs at startup (color 104), unavailable sends off.
- Master module bottom-encoder RGB VU and white VU ring.
- v0.1.32 Channel Mixer: bottom press arm; second-from-bottom press pan reset; hold bottom + tap above mute; hold second-from-bottom + tap bottom solo. User accepted v0.1.32 as stable.
- Clip Launcher color translation considered good; preserve mapping.
- LED Diagnostics retained for future troubleshooting.

## Preserve and regression-check
- Module switching hold top + twist bottom; four independently assignable columns.
- Track Mixer, FX Sends, Device, Clip, Master, I/O, LED Diagnostics.
- I/O monitor selection/LED and slower sensitivity; clip launch/animations and device controls.
- No silent remapping; no auto-merge; stable ZIP immutable.

## Open issues / feature backlog
1. Dedicated VU module LED design, beat/bar modes, two-column support.
2. Device banking off-by-one (returns to 33 rather than 32).
3. Transport 1, Transport 2; Scene Launcher; Device Slots.
4. Rack Macro Variations; Effects A/B; Browser and Contextual Browser (API feasibility research).
5. Multi-column exclusivity/repeated module bank rules.
6. LED refresh/MIDI rate/clip animation optimization and duplicate-method cleanup.
7. Optional Ableton clip color matcher extension.

## Step 2: research only
Codex: verify Live 12.4.16 Python API capabilities for Rack Macro Variations, browser navigation/loading/contextual selection, Effects A/B. Produce supported/workaround/unavailable matrix, evidence and safe designs. Separately audit dedicated VU + LED scheduling and module architecture. Do not modify the frozen baseline; use experimental branches; report findings with tests. Independent reviewer to examine design and regression risks.
