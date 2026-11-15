# Startup repair baseline and source hashes

## Immutable comparison points

- v1.5 known-starting rollback commit: 0bc87548853af047ae6c70535494a2546a8befb1
- v1.5 source and rollback artifacts are unchanged.
- v1.6 EXP comparison commit: ac34e38df3c42984daa01abb20b508ee5526e610
- v1.6 original source blob: 39708214c7194f94d6bb1027b8220d0def75311f
- PR #25 and PR #26 remain open/draft/unmerged and unchanged.

## Repair candidate

- Branch: repair/mf4trkbento-v1.6-startup-guard-20261115
- Current branch head: 2e98c4923aec1df59e1eedb1352a0aad173350ab
- Source/test snapshot commit: 62edbda472049d5d05a4274844c0d2c378e7dc58
- Stacked PR: #27, open/draft/unmerged, base bento/mf4trkbento-v1.6-experimental
- Repair source blob: 38abd9e85e3af0af4ad1ba889de2ed05e83948cc
- Startup test blob: 85e803f5798b3010734c0189103d1a7994f4d208
- Host mock blob: 1be5d77a8fa945158faa046fa90a5f0f10d02b28
- Listener-cache comparison variant blob: a9a189ae27df2c0262536a1c6cb544f6d6b69943

## Latest successful build

- Workflow run: 43669961379
- Workflow job: 132677609326 (regression-and-package, completed/success)
- Workflow checked out the current branch head above.
- Artifact name: MF4TRKBento-v1.6-startup-repair-EXP
- Artifact ID: 14143549108
- Artifact expires: 2026-12-15T02:55:11Z
- Installable ZIP path inside the artifact: dist/MF4TRKBento_v1.6_STARTUP_REPAIR_EXP.zip
- Installable ZIP SHA-256: 8c6314618335472472fe917e2a8c3c65b592320c41c149a9432ee76ea74e5214
- GitHub Actions outer artifact archive SHA-256: f27e69f6beb5f3fa7245e673695eb4f2ae85e16c9e94ab151320f38af8ff882b

The two SHA-256 values refer to different files: the first is the installable
MF4TRKBento ZIP built by the workflow; the second is GitHub's uploaded artifact
wrapper containing that ZIP. The workflow log prints the installable ZIP hash,
and GitHub's artifact metadata reports the outer archive digest.

The installable package changes only the v1.6 scheduler/refresh lifecycle and
adds disabled-by-default aggregate diagnostics. The listener-invalidated
availability cache is test-only and is not part of the installed remote script.
No v1.5 source, package, or rollback artifact is modified.
