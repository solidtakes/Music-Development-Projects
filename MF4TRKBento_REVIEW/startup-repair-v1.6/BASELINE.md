# Startup repair baseline and source hashes

## Immutable comparison points

- v1.5 known-starting rollback commit: 0bc87548853af047ae6c70535494a2546a8befb1
- v1.5 source and rollback artifacts are unchanged.
- v1.6 EXP comparison commit: ac34e38df3c42984daa01abb20b508ee5526e610
- v1.6 original source blob: 39708214c7194f94d6bb1027b8220d0def75311f
- PR #25 and PR #26 remain open/draft/unmerged and unchanged.

## Repair candidate

- Branch: repair/mf4trkbento-v1.6-startup-guard-20261115
- Source/test snapshot commit: 62edbda472049d5d05a4274844c0d2c378e7dc58
- Stacked PR: #27, draft, base bento/mf4trkbento-v1.6-experimental
- Repair source blob: 38abd9e85e3af0af4ad1ba889de2ed05e83948cc
- Startup test blob: 85e803f5798b3010734c0189103d1a7994f4d208
- Host mock blob: 1be5d77a8fa945158faa046fa90a5f0f10d02b28
- Listener-cache comparison variant blob: a9a189ae27df2c0262536a1c6cb544f6d6b69943
- ZIP SHA-256: b5e1762169b4e3e9c4003fb7526ea1f8120cec865a11c83d78ffa20fe3bbce71
- Passing workflow run: 43669838943
- Artifact ID: 14143891418

The installable package changes only the v1.6 scheduler/refresh lifecycle and
adds disabled-by-default aggregate diagnostics. The listener-invalidated
availability cache is test-only and is not part of the installed remote script.
No v1.5 source, package, or rollback artifact is modified.
