# Startup repair baseline and source hashes

## Immutable comparison points

- v1.5 known-starting rollback commit: 0bc87548853af047ae6c70535494a2546a8befb1
- v1.5 source and rollback artifacts are unchanged.
- v1.6 EXP comparison commit: ac34e38df3c42984daa01abb20b508ee5526e610
- v1.6 original source blob: 39708214c7194f94d6bb1027b8220d0def75311f
- PR #25 and PR #26 remain open/draft/unmerged and unchanged.

## Repair candidate

- Branch: repair/mf4trkbento-v1.6-startup-guard-20261115
- PR #27: open, draft, unmerged
- Code/test snapshot and build checkout commit: 010eb0d7eebf87719a1785622430b9413dcf925e
- Stacked PR base: bento/mf4trkbento-v1.6-experimental
- Repair source blob: 39a1a0b0464dea2de87c8a725b72ecf9351f6f37
- Startup test blob: 607cf830169ccf8a3135ccc25f6462b57a8c26bc
- Host mock blob: 1be5d77a8fa945158faa046fa90a5f0f10d02b28
- Listener-cache comparison variant blob: a9a189ae27df2c0262536a1c6cb544f6d6b69943

## Latest successful build

- Workflow run: 43676416345
- Workflow job: 132697440552 (regression-and-package, completed/success)
- Artifact name: MF4TRKBento-v1.6-startup-repair-EXP
- Artifact ID: 14146785354
- Artifact expires: 2026-12-15T04:21:42Z
- Installable ZIP path inside the artifact: dist/MF4TRKBento_v1.6_STARTUP_REPAIR_EXP.zip
- Installable ZIP SHA-256: 61a59f2689bb5b27d731e565eb8009c293a12baa6ed85568c0ed13d3d4f5e276
- GitHub Actions outer artifact archive SHA-256: 562a0f0058c5ced32ac5a71589704e4c7fd2b50e6c8d84f16c3de59505c997fd

The two SHA-256 values refer to different files: the first is the installable
MF4TRKBento ZIP built by the workflow; the second is GitHub's uploaded artifact
wrapper containing that ZIP. The workflow log prints the installable ZIP hash,
and GitHub's artifact metadata reports the outer artifact digest.

The downloaded artifact was independently inspected: its outer archive digest
matches GitHub's artifact digest; the extracted installable ZIP matches the
workflow's inner ZIP hash; the ZIP contains exactly three files and no
__pycache__ directories or .pyc files. The packaged Python source Git blob
matches 39a1a0b0464dea2de87c8a725b72ecf9351f6f37.

Earlier artifacts 14143644854 and 14145964115 and their hashes are
superseded. Do not use either as an installable candidate.

The installable package preserves the v1.6 feature paths and changes scheduler,
refresh-state, shutdown/render lifecycle guards; it adds the four requested
lifecycle edge-test groups. The listener-invalidated availability cache is
test-only and is not part of the installed remote script. No v1.5 source,
package, or rollback artifact is modified.

Offline test limits: the schedule_message mock stores callbacks in a Python
list and tests invoke them manually. It does not reproduce or validate Live 13
Beta's real TaskGroup, update_display, component_guard, or callback-dispatch
environment. Track.has_audio_output remains read in _audio_mixer(); its
latency and actual Live 13 Beta runtime behavior remain unverified. The
original startup hang's root cause has not been proven or shown fixed.

Independent startup-focused review remains pending. Ableton hardware startup
has not been tested and is not authorized. Preserve v1.5 EXP as the rollback
baseline.
