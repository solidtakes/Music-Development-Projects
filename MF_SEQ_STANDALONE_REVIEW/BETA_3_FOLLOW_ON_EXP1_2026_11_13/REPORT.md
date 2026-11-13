# Beta 3 Follow Playback ON — experimental build 1

Prepared from accepted Beta 3.0 SP1. The only runtime change is initialization of `_follow_playback` from `False` to `True`. E16 then E1 toggling, manual page selection and suspension until the next playback start retain their existing implementation. No mapping, palette, routing or roadmap feature changes. Experimental only; no merge or stable promotion.

## Provenance

- Handoff: `0f411aacd889bd23b369ff70ff6cefe9ef5a0bbb`, branch `mf-seq/codex-beta2.3-investigation-20261113`; experiment branches directly from this handoff.
- Accepted SP1 archive retrieved from review commit `372690b15751bbd5bd5c6287cf88fdf89d9dd89e`, path `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip`.
- Independently verified exact SP1 SHA-256: `223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180`.
- Independently verified Beta 2.3 Test18 rollback SHA-256: `38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c`.
- All three source files extracted from the exact SP1 ZIP. `source.patch` records the one-line change; other script files are byte-identical. Accepted artifacts and PR #14 remain unchanged.

## Validation

29 test groups pass: 8 focused Follow groups, 10 inherited SP1 regression groups, 11 inherited scale contract groups. `TEST_LOG.txt` and `TEST_RESULTS.json` contain results. Focused tests construct the real script class without the legacy fixture's Follow override. Differential gesture/LED checks cover all 240 ordered distinct press pairs, both release orders and both Follow states (960 scenarios). Initialization/reload, OFF/ON, navigation, manual suspension/restart, shifted loop/wrap, loop length, meter, clip replacement/removal, note suppression and listener lifecycle are covered.

The inherited harness and suites come from review commit 372690b; scale comparison uses accepted SP1 against EXP1. The original Test18 source remains the baseline for inherited regressions. One initial new test used a zero-based argument for the one-based loop-start helper; corrected the fixture to bar 3, without changing runtime code.

Mocks do not certify actual Live API availability, scheduler timing, hardware LEDs or CPU/latency. No Ableton/MFT hardware test was run here. Owner acceptance applies only to the prior SP1 report, not EXP1. See `HARDWARE_CHECKLIST.md`; every item is pending. No optimizations or unapproved features were added.

## Artifact and reproduction

`MF_SEQ_BETA_3_FOLLOW_ON_EXP1.zip` contains only `MF_SEQ/MF_SEQ.py`, `MF_SEQ/__init__.py` and `MF_SEQ/scale_sync.py`. ZIP CRC, exact layout, source/ZIP byte equality and host Python syntax pass. `SHA256SUMS` records archive and source hashes. The installable ZIP retains the MF_SEQ name, so install only for explicit owner testing, keeping a separate accepted copy.

From a repository clone with commit 372690b available (fetch that SHA if needed):

```sh
python3 MF_SEQ_STANDALONE_REVIEW/BETA_3_FOLLOW_ON_EXP1_2026_11_13/run_tests.py
python3 MF_SEQ_STANDALONE_REVIEW/BETA_3_FOLLOW_ON_EXP1_2026_11_13/build.py
```

`run_tests.py` verifies both accepted ZIP hashes and extracts fixtures into a temporary directory. `build.py` creates a deterministic ZIP. Requires only Python's standard library and git.

## Rollback

To retrieve exact Beta 3.0 SP1 bytes without rebuilding:

```sh
git show 372690b15751bbd5bd5c6287cf88fdf89d9dd89e:MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip > MF_SEQ_ACCEPTED_SP1.zip
```

Verify its hash above, then restore its MF_SEQ folder and reload Live's control surface. Prior Beta 2.3 rollback remains at `MF_SEQ_STANDALONE_REVIEW/BETA_2_3_TEST18_SOURCE/MF_SEQ_BETA_2_3_FROZEN_TEST18.zip` with the hash above. No accepted ZIP/source has been overwritten. CROSS-BANK REVIEW REQUIRED before any combined-bank integration.
