# DEMORA offline recovery verification — 2026-11-09

## Scope and safety

Independent offline verification of the recovered v3.3 baseline, original experimental v3.4 Stage 5 package and recovered R1/R2/R4 reproductions. All archives were extracted to disposable `/tmp` directories. No source archive was edited. No hardware, USB device, Apple SDK, DriverKit runtime, installation, signing or nonzero output was used.

Environment:
- Linux x86_64, kernel `6.18.57`
- GCC/G++ `14.2.0`
- Python `3.13.5`

## Exact input hashes

| Input | SHA-256 |
|---|---|
| `DEMORA_Offline_v3_3_finish_race_scratch(2).zip` | `1853630d5593ea9a2a7f048bd7cf6f01147ab389756f746e7ec1a5f6a5cf9445` |
| `DEMORA_v3_4_STAGE5_WORK.zip` (original, not repaired) | `e5c26c6d94f2472bc760de9d522e7fe579dd6583a9bd0b2789b61373582d62d6` |
| `r1_pinned_after_owner_release.cpp` | `b88544ff4d66fe4ea79c1c43649afa164cf74a704c43e7be650709235450c13b` |
| `r2_queue_mailbox_ordering.cpp` | `fd6ba3f0b1f179fac0826e4943c8d3b5941966fb7375b7068a8225ba3cc0bd21` |
| `r4_stress.cpp` | `e3c3ef2c924492ed8859b5588eaec729df84771eb005289539d4b97b4fb4c609` |

## v3.3 baseline — independently reproduced

Command: `make check` from extracted `core/`.

Results:
- C++: `tests=89 checks=450 failures=0`.
- Python unittest: 61 passed.
- Generated 154,500 trace lines.
- v2 C++/Python parity identical.
- v3 C++/Python parity identical.
- All generated engine CSV logs passed `diag_log_check`.

ASan/UBSan command: `make sanitize`.
- ASan/UBSan phase completed: `tests=89 checks=450 failures=0`.
- The subsequent ThreadSanitizer phase did not finish within the 120-second execution limit. No TSan pass/fail conclusion is made. The final parity-under-sanitizers step was not reached.

## Original v3.4 Stage 5 core suite — independently reproduced

Command: `make check` from extracted original archive's `core/`.

Results:
- C++: `tests=94 checks=511 failures=0`.
- Python unittest: 61 passed.
- Generated 154,500 trace lines.
- v2 and v3 C++/Python parity identical.
- Engine CSV logs passed `diag_log_check`.

Five standalone C++ programs from the archive were separately compiled with:
`g++ -std=c++17 -O2 -Wall -Wextra -Werror -pthread`

| Program | Result |
|---|---|
| `stage4_tests/test_bounded_queue.cpp` | 5 PASS assertions |
| `stage4_tests/test_serial_dispatch.cpp` | 4 PASS assertions |
| `stage4_tests/test_callback_identity.cpp` | 1 PASS assertion |
| `stage4_tests/test_delayed_callback.cpp` | 4 PASS assertions |
| `stage5_tests/test_callback_overflow.cpp` | 8 PASS assertions; queued=2, overflowed=1, recovered=1 |

These passing tests do not negate the adversarial reproductions below. In particular, the Stage 5 overflow test is a deterministic single-threaded simulation and does not exercise the consumer/mailbox race.

## R1 — reproduced

Compiled the recovered R1 source against the original v3.4 archive's `core/v3` headers and ran it.

Observed in both Pin and Free policies:
- Callback-owned lease at shutdown.
- `finish()` returned with unresolved ownership and session phase Pinned.
- Consumer subsequently completed `consume_owned()` and `release_owned()`.
- Lease state became Free and pinned lease count was zero.
- Session phase remained Pinned; another finish was inert and restart was refused.

The control case, where the owner released before `finish()`, drained successfully.

**Conclusion:** session-level permanent Pinned state can outlive the lease ownership condition that originally caused it. This is an offline engine defect reproduction.

## R2 — reproduced

Compiled and ran the recovered deterministic queue/mailbox probes against the original v3.4 core.

Observed:
1. Queue producer 0 claimed a position but had not published. Producer 1 published a later position. Consumer `pop()` returned false even though a fully published later event existed. The drain loop could exit; the model has no doorbell to prompt another drain.
2. A mailbox publication after the consumer's one-shot mailbox scan remained ready and stranded; the corresponding lease stayed callback-owned.
3. Queue-first/mailbox-second processing delivered sequence 3 before sequence 2. The strict ledger accepted 0, 1, 3 and rejected 2 as late-after-gap; continuity was lost.

**Conclusion:** queue false-empty and mailbox scan/re-poll/order semantics require redesign or a rigorously proven drain protocol. The probe is deterministic model evidence, not a proof of Apple callback behavior.

## R4 — reproduced

Command: recovered R4 stress program, 20,000 iterations per mode, compiled with:
`g++ -std=c++17 -O2 -Wall -Wextra -Werror -pthread`.

Observed:
- Capacity 4 (equal to lease pool), shutdown racing: 20,000 iterations; 10,300 drained; **9,700 Pinned-with-all-leases-Free defects**; 0 other pinned states; 0 queue push failures; 0 duplicate-winner errors; 0 consumer errors.
- Capacity 4, no shutdown: 20,000 iterations; 0 push failures; 0 duplicate-winner errors; 0 consumer errors.
- Capacity 2 (smaller than lease pool), no shutdown: 20,000 iterations; 16,115 push failures (these completions would require mailbox fallback); 0 duplicate-winner errors; 0 consumer errors.

**Conclusion:** the shutdown/session-state defect is highly reproducible under this harness. Queue capacity equal to the lease pool prevents these queue-full events in this test, but does not fix the separate false-empty/stranded mailbox/order problems. Capacity 2 requires a correct overflow protocol.

## Interpretation and limits

- The passing v3.3 and v3.4 core suites show those offline test targets compile and pass on this Linux x86_64 environment.
- R1/R2/R4 reproduce defects in the recovered original v3.4 engine/model and copied queue semantics.
- These results do not prove or disprove DriverKit DMA coherence, actual Apple USB callback completion semantics, IOUSBHost buffer packing, clock lock, HAL behavior or physical output safety.
- No repaired Claude 2 Stage 5 archive was available, so no repair has been tested.
- No ARM64 macOS or Apple SDK run was performed in this verification.
- ThreadSanitizer did not complete within the execution limit.

## Recommended next engineering step

Do not promote original v3.4. Recover the exact Claude 2 repair package if it exists, verify its SHA-256, diff it against the original, and run R1/R2/R4 plus additional adversarial tests against that exact repaired source. Keep v3.3 frozen. Require generation-safe ownership return, queue/mailbox re-poll and ordering proofs, shutdown with pending fallback, bounded overflow behavior, and sanitizer/ARM64 validation before any native integration.
