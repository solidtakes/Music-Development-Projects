# MF 3 Banks Master Build — Release Candidate 1

The owner reported on 2026-11-18 that the supplied three-bank Beta 1.2 startup repair build works. This folder preserves the exact owner-supplied archive as the first master integration release candidate. Future bank changes can be developed separately and integrated here for combined debugging.

## Artifact

- Original file: `MF_Build_3banks_Beta_1_2_Startup_NameError_FIX_TEST.zip`
- SHA-256: `d4f10b5b42f52c875befc2e8ba6eac7fa0fd891bac1965f09b2525b307ebf8cd`
- Archive CRC: pass; nine members; all eight hashes listed in `MANIFEST.json` match.
- Offline integration tests: 14 passed using the supplied controlled framework shim.

The source and test files alongside the ZIP are extracted byte-for-byte from that archive. The original README inside the ZIP predates the owner's successful report and still labels hardware testing as pending. The owner reported that the build works, without a detailed per-bank test matrix in this chat. RC1 records that report and does not revise the archived source or claim that every control was tested.

## Included banks

- Bank 1: Selected Track Bento, physical CC 0–15.
- Bank 2: Four-Track Bento, physical CC 16–31.
- Bank 3: Sequencer, physical CC 32–47.

`ThreeBankHost.py` hosts the three banks through one control surface. The supplied README contains installation and rollback steps. Keep the prior working installation and its ZIP available for rollback. This master folder is the integration point; changes to individual banks should remain separate until intentionally brought into a later master candidate.
