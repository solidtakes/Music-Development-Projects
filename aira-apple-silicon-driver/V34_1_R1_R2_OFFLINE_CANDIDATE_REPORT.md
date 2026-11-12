# v3.4.1 R1/R2 offline candidate — 2026-11-09

**Status: isolated experimental candidate only. Not promoted, committed as source, installed or hardware-tested.**

Starting input: original `DEMORA_v3_4_STAGE5_WORK.zip`, SHA-256 `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6`. The original archive and v3.3 baseline were not modified. The candidate patchset is a conversation-generated attachment, not a GitHub source commit.

## R1 change

`Session::finish_gate()` now defers finalization while any lease remains callback-owned. `finish()` returns unfinished and leaves the session Stopping; after the serialized consumer releases the lease, a later finish can drain normally. This prevents temporary CPU-side callback ownership from being converted into a permanent session-level Pinned state. The Pin policy remains for genuinely unresolved backend-owned requests.

## R2 host-only ingress model

Added a bounded MPMC completion queue with explicit Item / Empty / Pending results. Pending means a producer reserved the head but has not published; later ready entries are not treated as an empty queue. A generic asynchronous serial-scheduler contract signals after each publication; the drain clears its scheduled flag and rechecks the head to avoid a coalesced lost wake. The mailbox fallback is removed from this model; compile-time capacity must cover the maximum outstanding lease count. A bounded sequence reorder buffer holds later completions until gaps close and rejects duplicate/out-of-window events.

**Critical limitation:** the scheduler is a generic host test interface. No native DriverKit/Apple callback-safe scheduler adapter has been implemented or qualified. This does not prove Apple's completion/DMA/OSAction contracts.

## Reproduced candidate results

Environment: Linux x86_64, GCC 14.2.0, Python 3.13.5.

- `make check`: existing C++ suite 94 tests / 514 checks / 0 failures; new ingress model 4 PASS scenarios; Python 61 passed; 154,500-line v2/v3 parity identical; engine logs passed.
- ASan/UBSan: v3.4 core 94/514 passed; ingress model 4 scenarios passed.
- R1 direct regression: PASS; finish defers until owner release, then drains/restarts.
- R4 stress, 20,000 iterations, capacity 4/pool 4 with serialized finish retry: 20,000 drained; zero Pinned-with-all-leases-Free defects, zero queue push failures, zero duplicate-winner errors, zero consumer errors.
- Capacity 2/pool 4: 16,648 queue push failures; this violates the required capacity invariant and must fail closed rather than rely on a mailbox.
- TSan and ARM64 macOS were not run.

## Remaining gates

No integration into `DiagEngine` or a native DriverKit service. No actual scheduler API qualification, TSan, ARM64 macOS, Apple SDK, USB, DMA, clock, HAL, or 10x10 streaming validation. Original Stage 5 mailbox simulation remains historical and must not be treated as the production ingress design.

Local patchset SHA-256: `d90c88c9748cdcb4bb90e38ba5430e4938c356f1f854cf2c274715aef7b972e1`. Patch SHA-256: `26f46765525ba7a06237abbe8c0ad4f6d62195e8fd273f51fc3d89ca7b9d2e6b`. Keep the patchset labeled CONVERSATION_ARCHIVE until separately approved for a source branch. Preserve v3.3 and original v3.4.
