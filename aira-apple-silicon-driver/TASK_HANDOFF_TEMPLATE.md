# AIRA / DEMORA task and handoff template

Copy this file for every bounded task. Do not use a chat transcript as the only record.

## Task identity
- Task ID:
- Title:
- Owner:
- Independent reviewer:
- Status: NOT_STARTED / IN_PROGRESS / BLOCKED / REPORTED / VERIFIED / REJECTED
- Created / updated (UTC):

## Source baseline
- Repository:
- Branch:
- Base commit SHA:
- Relevant PR:
- Working directory:
- Clean working tree confirmed?:
- Existing uncommitted work preserved?:

## Inputs
| Path / artifact | Storage location or Git ref | SHA-256 | Provenance | Required? |
|---|---|---|---|---|
| | | | COMMITTED / PR_ONLY / BRANCH_ONLY / CONVERSATION_ARCHIVE / LOCAL_ONLY | |

Do not proceed if a required input is missing or its hash differs. Do not reconstruct required source from prose.

## Scope and permissions
- Exact allowed paths:
- Allowed operations:
- Explicitly prohibited operations:
- Hardware access allowed?:
- Network/API access allowed?:
- Build/sign/install/activate allowed?:
- Publication/merge allowed?:
- Runtime and output limits:
- Stop conditions:

## Deliverables
| File | Expected location | Required format | SHA-256 after creation |
|---|---|---|---|
| | | | |

Include source, tests, scripts, full logs, report and manifest where applicable. If any item remains only on a machine or in a conversation, label it LOCAL_ONLY or CONVERSATION_ARCHIVE and give its exact location.

## Validation
- OS / architecture:
- Toolchain and versions:
- Exact commands:
- Test suite and count:
- Assertions/checks and count:
- Failures / skips / expected failures:
- Sanitizers and limitations:
- Raw log paths:
- Independent reproduction performed by:
- Exact input hash and output hash:

Classify each claim:
- VERIFIED: exact source hash and command independently reproduced, with logs.
- OWNER_REPORTED: user supplied terminal output, not independently rerun.
- AGENT_REPORTED: agent supplied result, not independently rerun.
- PROPOSED: plan only; not run.
- BLOCKED: missing evidence or prerequisite.

## Completion and remote persistence
- Files changed:
- Commit SHA:
- Branch head after push:
- PR URL and state:
- Remote file fetch/hash verified?:
- Backup location:
- Backup hash verification:
- Stable baseline untouched?:
- Any uncommitted changes remaining?:

Do not say "saved", "uploaded", "committed", "pushed" or "complete" until the corresponding remote/local operation has been verified.

## Risks and next handoff
- Known defects:
- Untested paths:
- Safety limitations:
- Missing dependencies:
- Next task ID:
- Next exact action:
- Required approval:

## New-thread startup
1. Fetch current main, relevant PRs and all experiment branches.
2. Read repository README, PROJECT_STATUS, ARTIFACT_REGISTER, RECOVERY_AND_HANDOFF_POLICY and NEXT_TASK.
3. Read comments/reviews newer than the last recorded ID.
4. Check local `git status`, recent log, stashes and file inventory.
5. Verify every required input by hash before editing.
6. Continue the existing task if its deliverable is still outstanding; do not create duplicate work.
