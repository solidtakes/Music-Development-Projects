# LPC Voice Lab — persistent milestone releases

Download milestones at GitHub Releases:
https://github.com/solidtakes/Music-Development-Projects/releases

Each milestone has one **pre-release** with permanently addressable Windows and macOS ZIP assets, SHA256SUMS and notes. Releases point to the exact source commit whose build and tests passed, even when source PRs are still draft/unmerged.

## Current milestone

- Alpha 0.4: https://github.com/solidtakes/Music-Development-Projects/releases/tag/lpc-voice-lab-alpha-0.4

## Repeat for subsequent approved milestones

1. Create an isolated source branch for development. Get Windows/macOS CI and DSP tests green and record the final source SHA and successful run ID.
2. Create an appropriately named **milestone/lpc-voice-lab-alpha-X.Y** branch from that verified SHA. Add the release workflow and a manifest recording the exact SHA/run, tag, title, and release notes. Keep release metadata immutable; never replace an existing tag/asset.
3. The milestone workflow verifies SHA versus the passed run, downloads the two tested artifacts, checks their contents, packages Windows VST3 and macOS VST3/AU, adds SHA256SUMS, and creates a GitHub pre-release.
4. Inspect the public Releases page to verify both assets exist and have nonzero size, then report the permanent URLs to the owner. If any check fails, report failure rather than claiming publication.
5. Keep development PRs unmerged until separate owner approval. Do not run DAWs or overwrite owner installations as part of publishing.

**Important:** This release process only packages verified build artifacts. It is not proof that GUI/preset features work in a host, nor that sound matches a hardware reference. Milestone approval and manual tests remain separate.
