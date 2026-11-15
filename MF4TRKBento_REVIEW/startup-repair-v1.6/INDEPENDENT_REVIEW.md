# Independent startup review — pending

Status: NOT YET REVIEWED. The candidate is not approved for hardware testing.

## Required independent review scope

- one-pending-callback invariant through 1,000+ ticks;
- reentrant _tick() and _refresh_all() behavior;
- refresh_state while a callback is pending;
- queued callback after disconnect;
- repeated init/disconnect listener and SessionComponent cleanup;
- Live 13 Beta schedule_message callback semantics;
- bounded Track.has_audio_output probes and no stale Track-proxy cache;
- confirmation that no MIDI, colors, gestures, or other v1.6 feature behavior changed.

## Copilot request attempt

A request was submitted through the connected GitHub reviewer-request action
using the documented Copilot bot login. Verification immediately afterward
queried the PR's requested-reviewers endpoint and returned:

- users: []
- teams: []

PR #27 also has no submitted reviews, review comments, or review threads.
Therefore Copilot was NOT registered and no Copilot review has run. The
connector does not expose GitHub's dedicated Copilot code-review request
endpoint; a successful response from the ordinary reviewer-request action
was not sufficient evidence of registration.

## Alternative independent reviewer

No human reviewer can be identified from the visible review history in this
repository: all 13 visible PRs are authored by the repository owner, and PRs
#25, #26, and #27 have no submitted reviews. This does not prove there are no
collaborators; it means the current PR history supplies no independent human
reviewer identity.

Recommended alternative: **CodeRabbit** (separate GitHub code-review service).
The repository is public. CodeRabbit's current open-source guidance says to
install its GitHub App on the public repository to enable free PR reviews.
For public repositories with fewer than 10 stars, its guidance says to trigger
a review manually using the CodeRabbit status-comment action or
`@coderabbitai review`.

- Setup and public-repository review guidance:
  https://kb.coderabbit.ai/articles/8856795235-how-do-i-activate-coderabbit-pro-for-my-open-source-project
- CodeRabbit GitHub review documentation:
  https://docs.coderabbit.ai/

CodeRabbit is a separate AI reviewer, not a human reviewer. Its installation
and an actual review on this exact PR head must be verified before counting
the independent-review gate as passed. No CodeRabbit review is claimed here.

Human-review alternative: **PullRequest** on GitHub Marketplace offers
on-demand reviews by a vetted network of human engineers and lists Python
among its supported languages. Its published Team pricing starts at
$129 per developer per month, billed annually, so this is a paid option and
has not been installed or requested.

- PullRequest GitHub Marketplace: https://github.com/marketplace/pullrequest
- PullRequest pricing: https://www.pullrequest.com/pricing/

If neither service is selected, a human GitHub username must be supplied or
invited to the repository.

## Hardware gate

No Ableton Live 13 Beta hardware startup validation is claimed. Do not install
or hardware-test until an independent startup-focused review has completed,
its findings have been reconciled, and the owner approves the one-launch
validation. Preserve the accepted v1.5 EXP rollback unchanged.
