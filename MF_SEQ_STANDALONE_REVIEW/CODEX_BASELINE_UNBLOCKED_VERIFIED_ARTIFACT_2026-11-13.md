# Codex unblock — Verified executable Beta 2.3 Test 18 baseline now available
Date: 2026-11-13
Status: BASELINE RESTORED; proceed with Phase 0 verification. Do not claim hardware tests beyond owner acceptance.

## Exact original owner-accepted ZIP
Path: MF_SEQ_STANDALONE_REVIEW/BETA_2_3_TEST18_SOURCE/MF_SEQ_BETA_2_3_FROZEN_TEST18.zip
Commit restoring ZIP: c35fedbc906c66c8823c137991ad5aa4b1eaa18c
Size: 14971 bytes
ZIP SHA-256: 38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c
Git blob SHA-1: 4007d62b7c9bb54fa94dd2901e93cbf255d85ed2
Checked locally: ZIP CRC passed; Python source and package __init__.py compiled.

## Also accessible
Path: MF_SEQ_STANDALONE_REVIEW/BETA_2_3_TEST18_SOURCE/MF_SEQ/MF_SEQ.py
Source restoration commit: 9cd31c504298e0ba80100794e1e98cd00ca73f72
Python SHA-256: 270460564e5fb765ef4e7d86e4fefb5c2b69926445d9bec66358160c69d6c1a8
Git blob SHA-1: 18283f1b0e3e4eeb7c99d67548f36248a7935d7f

## Resume instructions
1. Pull/fetch investigation branch mf-seq/codex-beta2.3-investigation-20261113 (NOT the old frozen branch, which intentionally only holds docs).
2. Verify ZIP with sha256sum or shasum -a 256. Unzip to a temporary working directory. Confirm package contains MF_SEQ/MF_SEQ.py, MF_SEQ/__init__.py, README_TEST18.txt and SHA256_MF_SEQ_py.txt.
3. Confirm source SHA-256 and compare against the standalone GitHub source file. If all hashes match, mark Phase 0 baseline recovered and resume performance audit.
4. Continue isolated performance benchmarking, CC/modulation research, note nudge, and sequencer-owned swing design per previous handoffs; do not change or merge the accepted frozen milestone without owner approval.

The GitHub upload was recovered from the exact original Test 18 file, not reconstructed from descriptions.
