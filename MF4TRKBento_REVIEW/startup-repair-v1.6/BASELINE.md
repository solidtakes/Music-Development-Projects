# Startup repair baseline and source hashes

## Immutable comparison points

- v1.5 known-starting rollback commit: 0bc87548853af047ae6c70535494a2546a8befb1
- v1.5 source and rollback artifacts are unchanged.
- v1.6 EXP comparison commit: ac34e38df3c42984daa01abb20b508ee5526e610
- v1.6 original source blob: 39708214c7194f94d6bb1027b8220d0def75311f
- PR #25 and PR #26 remain open/draft/unmerged and unchanged.

## Repair candidate

- Branch: repair/mf4trkbento-v1.6-startup-guard-20261115
- Code/test snapshot: 62edbda472049d5d05a4274844c0d2c378e7dc58
- Build checkout commit: 20369213385298c8d38a438b910a8408ed9ad904
- Stacked PR: #27, open/draft/unmerged, base bento/mf4trkbento-v1.6-experimental
- Repair source blob: 38abd9e85e3af0af4ad1ba889de2ed05e83948cc
- Startup test blob: 85e803f5798b3010734c0189103d1a7994f4d208
- Host mock blob: 1be5d77a8fa945158faa046fa90a5f0f10d02b28
- Listener-cache comparison variant blob: a9a189ae27df2c0262536a1c6cb544f6d6b69943

## Latest successful build

- Workflow run: 43671107506
- Workflow job: 132681126552 (regression-and-package, completed/success)
- The workflow checked out build commit 20369213385298c8d38a438b910a8408ed9ad904.
- Artifact name: MF4TRKBento-v1.6-startup-repair-EXP
- Artifact ID: 14143644854
- Artifact expires: 2026-12-15T03:10:07Z
- Installable ZIP path inside the artifact: dist/MF4TRKBento_v1.6_STARTUP_REPAIR_EXP.zip
- Installable ZIP SHA-256: ab61600505283ab6d5d8fc5ae462f65568c58bff2cecd75e4c6a8d91d6c9637f
- GitHub Actions outer artifact archive SHA-256: a7c4f7ddc39aa2c19bcc1847f809446278b9edd68aa6270ea48d443435da86ea

The two SHA-256 values refer to different files: the first is the installable
MF4TRKBento ZIP built by the workflow; the second is GitHub's uploaded artifact
wrapper containing that ZIP. The workflow log prints the installable ZIP hash,
and GitHub's artifact metadata reports the outer archive digest.

The installable package changes only the v1.6 scheduler/refresh lifecycle and
adds disabled-by-default aggregate diagnostics. The listener-invalidated
availability cache is test-only and is not part of the installed remote script.
No v1.5 source, package, or rollback artifact is modified.

Any subsequent changes to this report or TEST_RESULTS.txt are documentation-only
and do not change the source/test snapshot or installable ZIP.
