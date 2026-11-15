# Startup repair baseline and source hashes

## Immutable comparison points

- v1.5 known-starting rollback commit: 0bc87548853af047ae6c70535494a2546a8befb1
- v1.5 source and rollback artifacts are unchanged.
- v1.6 EXP comparison commit: ac34e38df3c42984daa01abb20b508ee5526e610
- v1.6 original source blob: 39708214c7194f94d6bb1027b8220d0def75311f
- PR #25 and PR #26 remain open/draft/unmerged and unchanged.

## Repair candidate

- Branch: repair/mf4trkbento-v1.6-startup-guard-20261115
- Current branch head: 4c6468bc48ca1857340904cc19c12782c79e91db
- Stacked PR: #27, draft, base bento/mf4trkbento-v1.6-experimental
- Repair source blob: 38abd9e85e3af0af4ad1ba889de2ed05e83948cc
- Startup test blob: 85e803f5798b3010734c0189103d1a7994f4d208
- Host mock blob: 1be5d77a8fa945158faa046fa90a5f0f10d02b28
- Listener-cache comparison variant blob: a9a189ae27df2c0262536a1c6cb544f6d6b69943
- ZIP SHA-256: a8939a503fe48e3b67b442a493126529e0285b5f00ce1986f69abcaafc4fe36e
- Passing workflow run: 43669790111
- Artifact ID: 14143414808

The installable package changes only the v1.6 scheduler/refresh lifecycle and
adds disabled-by-default aggregate diagnostics. The listener-invalidated
availability cache is test-only and is not part of the installed remote script.
No v1.5 source, package, or rollback artifact is modified.
