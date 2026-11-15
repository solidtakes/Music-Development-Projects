# MF4TRKBento v1.7 EXP baseline

- Feature branch: `feature/mf4trkbento-v1.7-next-four-20261115`
- Parent: PR #27 head `2e9336d758aedcb230d05def2f4bc3313712eb5e`
- Parent PR: [#27 — v1.6 startup repair](https://github.com/solidtakes/Music-Development-Projects/pull/27)
- v1.6 source path retained unchanged: `MF4TRKBento_REVIEW/startup-repair-v1.6/`
- New v1.7 source path: `MF4TRKBento_REVIEW/v1.7/`
- No edits to PR #27, PR #25, PR #26, or the v1.5 rollback.

The owner reports the v1.6 startup-repair build now launches without crashes.
The earlier hangs were attributed by the owner to the separate Push 3 audio
problem. This is owner-reported hardware evidence, not a claim that the
offline scheduler mocks prove Live 13 startup behavior.

## Four feature scope

1. FX Returns / regular Tracks group toggle using hold E1 + press E16.
2. Combined Mute/Volume module with a local 35 ms reversible press-detent guard.
3. Master Unsolo control in the fourth Mute encoder during alternate mode.
4. Pan/Sends audio-output availability and Sends purple palette correction.

All other v1.6 functionality is intended to remain unchanged.
