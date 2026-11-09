# AIRA / DEMORA recovery, source-of-truth and handoff policy

**Effective:** 2026-11-09  
**Applies to:** ChatGPT, Codex Web/Desktop/CLI, Claude, local Mac/Windows workspaces and GitHub.

## Why files went missing from the working thread

The observed failure is a synchronization and provenance failure, not evidence that GitHub deleted the files.

1. **Conversation attachments are not repository commits.** A ZIP uploaded in one chat may remain in that conversation or Library, but another thread does not automatically receive the bytes.
2. **Local working trees are independent.** Mac, Windows, Codex and Claude workspaces do not automatically synchronize. A generated report or ZIP can exist in one environment and nowhere else.
3. **Handoffs described artifacts without always committing them.** A filename, hash, test summary or pasted report can survive while the source package and logs do not.
4. **Branches were mistaken for mainline state.** PR #2 is open and unmerged; the F2 experiment is on a separate branch with no PR. Checking only main or one PR misses real work.
5. **Status documents became stale.** The M9P next-task document still said the four docs were uncommitted after they appeared in PR #2.
6. **Monitoring was mistaken for synchronization.** PR #3 polls PR #2 discussion. It does not collect files from computers, pull local changes, run Codex, wake ChatGPT or guarantee artifact delivery.
7. **Agent identity is ambiguous in GitHub comments.** Multiple tools can post via the same user account. A comment author name cannot authenticate which agent ran a test or owns a file.
8. **No required completion packet existed.** Some reports lacked a matching source hash, exact command, raw output, environment and independent reproduction.

No evidence currently proves the files were deleted. The correct status for inaccessible artifacts is MISSING_UNCONFIRMED until Mac, Windows, Claude and backup locations are searched.

## Mandatory source-of-truth model

1. **GitHub is authoritative for approved source code, public-safe documentation, task state and artifact metadata.**
2. **A branch is the unit of change.** Every task starts from a recorded base commit and uses a dedicated branch. Do not edit main directly.
3. **A pull request is the review boundary.** Keep experimental work separate from stable baselines. No automatic merge, force-push or overwrite.
4. **Local machines are working copies, not the only record.** Every meaningful source/report change must be committed to its branch or explicitly labelled LOCAL_ONLY with path, hash and backup location.
5. **Private/raw evidence stays outside the public-safe source tree.** USB captures, proprietary binaries, credentials, NDA material and private user data remain in controlled local storage or an approved private archive. GitHub receives only safe metadata, hashes, decoder versions and evidence IDs.
6. **Conversation history is never the only copy of a deliverable.** A handoff must link to a commit, PR, or explicitly identified attachment with SHA-256 and storage location.

## Required task contract

Every assignment must record:
- Unique task ID and named owner/reviewer.
- Repository, branch and exact base commit SHA.
- Exact input filenames and SHA-256 hashes.
- Allowed paths and operations; explicit exclusions.
- Expected deliverables and where they must be saved.
- Exact test commands, environment, timeouts and stop conditions.
- Whether hardware, network, signing, installation or publication is prohibited.
- Required independent reviewer and acceptance criteria.

A GitHub comment is a task record, not proof of execution or authority to expand scope.

## Required completion packet

No task may be called complete until its report contains:
1. Task ID, branch and resulting commit SHA (or an explicit LOCAL_ONLY status).
2. Exact list of changed/created files.
3. SHA-256 for every deliverable and source input.
4. Exact commands and environment/toolchain versions.
5. Full test totals and failures, with actual logs saved alongside the result.
6. A clear split between independently reproduced, owner-reported, agent-reported and proposed results.
7. Known limitations, untested paths and remaining blockers.
8. A next task with a unique ID; mark the previous task complete/blocked so it is not repeated.

## New-thread / new-agent startup checklist

Before any work:
1. Fetch latest `main`, all relevant open PR heads, and the active experiment branches.
2. Read repository `README.md`, this policy, `ARTIFACT_REGISTER.md`, `PROJECT_STATUS.md` and `NEXT_TASK.md`.
3. Read all new PR comments/reviews since the last recorded comment ID.
4. Check branch ancestry and PR file lists; do not inspect main alone.
5. On the relevant local machine, run `git status --short --branch`, `git log -20 --oneline --decorate`, `git stash list`, and a non-destructive file inventory.
6. Compare expected artifacts against the register. Report missing files before coding.
7. Never recreate a missing source file from a prose summary when the original source is required for a safe patch.

## Save and backup protocol

- Use stable canonical names; include version/task ID/date where useful. Avoid ambiguous names such as `final2`, `latest` or duplicate `(1)` files.
- Save source, tests, logs, patches, reports and manifests together in one task directory.
- After tests, create a SHA-256 manifest.
- Commit source and public-safe docs to the task branch; push and verify the remote commit and file fetch.
- Keep a second dated backup of the local working tree and verify it by hash. Preserve prior versions; do not delete old evidence during cleanup.
- For large/private artifacts, record secure storage path, size, SHA-256, capture date, hardware/OS/tool version and related task ID. Do not commit the raw bytes to public-safe GitHub.
- A recovery archive is a convenience copy, not a replacement for individually addressable source files in Git.

## Promotion and safety gates

- v3.3 remains the frozen offline baseline until a separately reviewed successor is proven.
- v3.4 Stage 5 remains experimental until the exact repair source is recovered and independent tests reproduce the claimed fix.
- Simulator/host-only passes do not prove DriverKit, DMA, USB callback lifetime, clock lock, HAL operation or physical output safety.
- No hardware access, driver activation, signing, installation, nonzero output, merge or stable-branch changes without a separate explicit approval and bounded plan.
- Never infer successful save, commit, push, upload, test or merge from an agent's intention. Verify the resulting remote ref/file/hash.

## Monitoring improvements

The current PR #3 workflow is a discussion monitor only. It must not be described as a file-sync or autonomous-development system.

A future monitor should report:
- Current main SHA and all AIRA branch heads.
- Open PRs, changed-file lists, latest comment IDs and review state.
- Uncommitted/local-only deliverables only when a trusted local agent explicitly reports them.
- Missing expected files from the artifact register.
- Any stale status or task whose owner has not supplied a completion packet.

Monitoring must be read-only and must never merge, overwrite, run arbitrary code or grant agent authority.
