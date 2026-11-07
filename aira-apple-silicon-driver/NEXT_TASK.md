# Next engineering assignment

## M9P: native integration preparation

Status: design and read-only readiness review prepared on local branch
`codex/aira-m9p-integration-plan`, based on published commit
`c437e0977e0b9d13ce4dbba39e31fbbc1eba5ed8`. All four documents are uncommitted;
no push or PR creation is authorized by this milestone.

Priorities:

1. Review the transport/clock/ownership contracts and ranked blockers in the audit.
2. Resolve supported AudioDriverKit plus USB provider topology, both-interface
   ownership and entitlement feasibility using authoritative framework evidence.
3. Specify the exact native transaction-buffer layout and completion/cancellation
   lease boundary; preserve fail-closed behavior where evidence is incomplete.
4. Independently review the M9N-B gaps before translating policies into native code.
5. Obtain separate source-only authorization for an isolated successor implementation;
   frozen M8 and M9K are references, not editing targets.

## Acceptance criteria

- Four public-safe documents identify evidence, hypotheses and proposed policies.
- Simulator arithmetic, lifecycle and failure cases map to native component duties.
- Zero-only transport proof precedes HAL publication and client-driven output.
- DMA layout, time units, concurrency, disconnect and resource-release gates are explicit.
- Existing 13-file simulator export and local project hashes stay unchanged.
- Offline tests pass; no new compile/runtime or physical-safety claim is made.
- Blockers and the concrete next approval are recorded without a promised shipping date.

## Safety and handoff

No USB/device access, driver build, activation, installation, signing, nonzero
output, merge, push or publication. No proprietary binary/disassembly/capture or
private archive belongs in this branch. Do not infer that a zero-only transfer
identifies safe audio/CV routes. Preserve DC in future capture transport.

Next approval requested: publish these four documents only. Native modifications,
compile-only validation, signing/activation and bounded hardware testing require
separate concrete scopes; approval to publish documentation authorizes none of them.
