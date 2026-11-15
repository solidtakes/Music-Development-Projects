# MF4TRKBento v1.8 EXP baseline

- Feature branch: `feature/mf4trkbento-v1.8-next-4-20261115`
- Parent: v1.7 PR #35 head `9e248d4a535d7ded41b9eb5bda363e94e461f4ec`
- v1.7 candidate PR: [#35 — FX Returns, Volume/Mute, Master Unsolo](https://github.com/solidtakes/Music-Development-Projects/pull/35)
- Owner-accepted rollback source: v1.6 startup-repair PR #27 head `2e9336d758aedcb230d05def2f4bc3313712eb5e`
- New v1.8 source path: `MF4TRKBento_REVIEW/v1.8/`
- v1.7 and v1.6 source paths are preserved unchanged.

## Four v1.8 feature additions

1. Sends push/release resets only the selected send to its minimum; rotary is ignored while the push is held. Audio-output gating remains enforced.
2. Pan and Sends turns/resets refresh only the affected encoder cell; no full Live Set scan occurs per detent.
3. In alternate mode, the fourth encoder of a Mute row controls Master Volume on rotation; the white ring displays Master Volume, the teal/cyan center remains the Unsolo status, and push/release still clears solo.
4. If the final Return track is deleted while FX Returns mode is active, the surface returns to regular tracks and rebuilds the Session highlight. A failed Return-list read does not force a mode change.

## Preservation

- Existing MIDI CC assignments and relative encoder decoding remain unchanged.
- Existing row/module switching, RClip, Arm, Solo, Mute/Volume, FX group switching, Pan, Sends color and audio-output gating remain in place.
- The 35 ms press-contamination correction is retained for track Volume and also applies to alternate-mode Master Volume.
- Module State Manager / module-layout preset saving is explicitly out of scope for Bank 2 and remains in the separate Experimental Integration thread.
- No changes to PR #27, PR #35, other banks, Utility, Native Mode, or shared MIDI routing.
