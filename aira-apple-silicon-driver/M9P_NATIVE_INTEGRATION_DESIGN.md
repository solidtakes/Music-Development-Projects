# M9P native integration design

November 7, 2026. Proposed architecture, not implemented or authorized to execute.
Initial goal: a bounded, zero-only native transport proof; subsequent goal:
96-kHz, ten-input/ten-output Core Audio integration. MIDI is a separate milestone.

## Evidence boundary

Recovered behavior summarized by the local M9N-A evidence design: request-local
input-derived budgets; nominal startup budgets; separate IN/OUT scheduling cursors,
OUT byte offset and shared-position update; conditional IN-before-OUT submission;
head-ordered consumption; different resume/full-init accumulator behavior.
M9N-B implements explicit reference and conservative policies around these findings.
This task reviews that reconciliation and source, not the original binary anew.
No historical exact ABI, runtime queue depth or proprietary excerpt is published.

Verified arithmetic: eight high-speed transactions per modeled 1-ms request;
ten four-byte channels = 40 bytes/frame; nominal 96 frames/request; endpoint ceiling
560 bytes/transaction = 14 frames. For eight valid received counts, use count/40
and replace counts below six frames by 11 plus carry from persistent phase+7904
modulo 8000. Phase advances only on substitutions. OUT transaction i receives
floor((i+1)*F/8)-floor(i*F/8) frames. F is finite and request-local; no global
rate clock, cross-request frame carry or invented feedback correction.

## Components and ownership

| Proposed component | Responsibility and boundary |
|---|---|
| Session coordinator | One serialized control executor; owns configuration, generation, state and resource registry |
| USB transport backend | Owns opened interfaces, pipe references, preallocated request descriptors, actions and mapped storage; reports API acceptance separately from callbacks |
| Scheduling core | Fixed-width checked arithmetic, typed bus units, staged IN/OUT calls, fallback phase, OUT stream offset and shared ledger; hardware-free and independently testable |
| Completion ingress | Captures immutable validated status/count/time/identity records at a documented coherent boundary; bounded queue to executor; no allocation or blocking in completion path |
| Capture/playback rings | Preallocated frame-aligned bounded storage and separate producer/consumer indices; no borrowed DMA pointer escapes its lease |
| Audio facade | Future IOUserAudioDriver/device/streams and clock bridge; not published for first transport proof |
| Diagnostics | Bounded records, saturation/overflow counters and persistent final summary; diagnostics loss cannot conceal unresolved ownership |

Use a new successor target. Do not graft asynchronous transport onto frozen M8 or
reuse its compile success as an async lifecycle proof. AudioDriverKit is the preferred
HAL integration direction, conditional on supported USB/audio provider topology.
Whether one service can own both interfaces or coordinated services are required
must be resolved before defining personalities or generated classes. A host app
must not become the owner of transfer memory whose callbacks outlive it.

## USB scope and geometry

Candidate ownership is DEMORA VID 0582/PID 01AF, IF1 OUT endpoint 0x0D and IF2 IN
endpoint 0x8E, using the evidence-selected high-speed streaming alternate setting.
Before implementation, reconcile descriptor provenance and interface/alternate
association; do not choose alt2 or its 112-byte packet ceiling for this 560-byte
96-kHz plan. The first hardware contract would limit settings to separately
approved alt0/alt1. No configuration selection, reset, seize or automatic recovery
from an ownership-open conflict. Other interfaces and firmware remain untouched.

Hold both interfaces before declaring duplex ready; unwind only resources actually
acquired. Failure acquiring the second interface closes the first under its contract.
Use endpoint-specific buffers and request pools. Capacity 192 and target 96 are
historical model parameters, not required first-native queue sizes. A bounded
four/eight-request candidate must be justified separately by measured lead.

Provisional maximum payload allocation: 8*560 = 4480 bytes/request/direction,
plus a distinct SDK frame-list descriptor and required alignment/metadata.
Nominal payload total is 3840 bytes/request. Packed-prefix versus fixed-stride
transaction placement remains a blocking contract: allocation size and struct
layout alone cannot establish where bytes land. Validate checked offsets, requested
and completed lengths, statuses, and all eight entries before reading capture data.
Do not copy historical low-level ABI assumptions into DriverKit.

## Request lifecycle and concurrency

Allocation -> RESERVED -> SUBMITTING -> ACCEPTED -> CALLBACK_RETURNED ->
CONSUMED/RETIRED -> REUSABLE, with REJECTED and QUARANTINED side paths.
Backend ownership and consumer readiness are independent axes. Install identity
and retain all dependencies before calling an API that could complete promptly;
serialize or reconcile completion arriving during SUBMITTING. Define whether a
rejected call can still callback from Apple contract evidence, not simulator behavior.

Identity includes session generation, direction, pool slot and reuse sequence.
An old completion can resolve its matching old lease only. It cannot advance the
current head, current fallback or current clock. Duplicate/unknown identity is a
fault; do not double-release. Do not hold executor locks across framework calls.
A bounded ingress overflow stops new submissions and preserves backend leases;
shutdown must still admit terminal ownership-return records.

Initially disable reference-style early reads while a request is active. A completed
callback is a candidate visibility boundary, not proof until the SDK contract is
resolved. Establish memory descriptor preparation/completion, DMA visibility,
barriers and mapping lifetime requirements. C++ atomics do not establish DMA coherence.
Only coherent immutable snapshots can enter the scheduling/capture core.

## Scheduling and budgets

Keep raw provider frame number, transaction slot and host time as different types.
The simulator's request_frame*8 and 125-us slots are synthetic adapters. Establish
GetFrameNumber/IsochIO units, epoch, wrap and lead from current contracts before
using them. Timestamp receipt time is not physical sample time.

Startup chooses validated future origins and submits nominal paired IN then OUT
requests. Record target, attempts, accepted calls, callback returns, current depth,
contiguous future coverage and holes separately. Do not claim achieved lead from
96 prequeue iterations. Nominal budgets say nothing about payload silence.

On eligible head IN: validate all entries atomically, derive F once, advance fallback
only for substitutions, attempt replacement IN, then OUT if IN accepted. Failed IN
prevents OUT. Accepted IN survives an OUT failure. Record F failed/dropped explicitly,
never retry/carry it silently. Keep recovered OUT offset advancement before API-result
handling separate from shared-position commit after both required submissions succeed.
The native policy may fault-stop on partial failure rather than reproduce every
historical recovery transition. No rollback disguises bytes consumed or bus holes.

## Audio rings, representation and clock

Preserve all ten raw signed32 little-endian input words, including DC/CV. A future
HAL input can expose signed32 packed or use an explicit reviewed float conversion;
never silently truncate to 24 bits. The inactive helper currently chooses signed32
input and float32 output: that does not define USB output conversion. Future output
float conversion, gain, clipping and packing require separate contract tests and
review. No physical slot is approved for nonzero playback.

Choose one immutable ring geometry from maximum callback burst, queue size and
client period, with checked byte arithmetic. Separate capture write, HAL read,
HAL output write, USB output read and shared scheduling positions. Define wrap,
full-block overflow rejection and counted underrun handling; never overwrite data
still read by HAL/DMA. Preallocate and pre-touch before streaming. Audio callbacks
must not allocate, wait on USB, log synchronously or perform unbounded work.

Clock bridge must relate validated device/bus observations and sample timeline to
host monotonic time with explicit epoch, discontinuity and uncertainty. Maintain
received frames separately from fallback/synthetic timeline frames. Shared scheduled
position is not automatically HAL sample position. Do not publish zero timestamps
from callback arrival or the nominal 96-kHz oscillator alone. Measure drift, FIFO
stability and valid timestamp anchors before StartIO support. No ASRC or clock
correction algorithm is inferred from simulator conservation.

## Startup, stop, recovery and disconnect

States: CREATED -> PREPARED -> OWNED -> PREFILL -> RUNNING -> QUIESCING ->
DRAINING -> STOPPED; FAULT/QUARANTINED outcomes remain visible. Audio publication
and StartIO are later separate transitions. Allocation/open failures unwind in
reverse acquisition order; inherited errors stay exact where interfaces return them.
Failed-init/free and lifecycle overlap require contracts or scoped runtime evidence.

Stop closes the submission gate, stops HAL admission if later active, requests abort
on owned pipes, accepts late terminal ingress, drains callbacks and downstream
consumers, then releases actions, mappings/descriptors, pipes/interfaces and service
references in dependency order. Quiescence requires callback, ingress and downstream
completion independently. Timeout records unresolved ownership; it never releases
potentially live memory. No access after inherited Stop/free where prohibited.

Disconnect follows the same ownership protocol without calling invalid providers.
Invalidate public availability and generation; preserve old resources until a valid
return contract resolves them. Reconnect creates a new explicit session, not automatic
reopen/reset. Bounded quarantine exhaustion blocks restart.

Resume preserves fallback phase only where the recovered path supports it; full
initialization resets it. Native first proof disables automatic recovery. Later resume
needs all required ownership resolved, valid interfaces and fresh nonoverlapping bus
origins. OUT offset/shared-position rebasing and timing are unresolved; a simulator
origin parameter is not a proven recovery algorithm.

## Instrumentation and test gates

Record configuration/source hashes, session/generation/request IDs, per-direction
cursor/offset, F source and phase, API result, every transaction status/count,
callback host time, provider anchor, depth/coverage, abort result and three drain
conditions. Preserve raw evidence privately; public reports contain approved summaries.
Report accepted, successful, cancelled, rejected, timed-out and unresolved separately.

Offline acceptance: compare checked native arithmetic/state traces against independent
M9N-B vectors; 5/6-frame and 239/240/241-byte boundaries; 8000 substitutions; budgets
0..112; all submission failure stages; reversed/duplicate/stale events; pool exhaustion;
restart overlaps; disconnect at every ownership state; ingress saturation; stop during
submission. Require explicit terminal F accounting and no release with a live lease.
Future compilation and sanitizers need separate authorization; none run in M9P.

First controlled hardware test acceptance, only after separate approval:

1. Exact reviewed source/binary/profile and supported provider/geometry contracts;
   all offline and compile/link gates pass, rollback/activation reviewed.
2. DEMORA identity and physical conditions confirmed; agreed four/eight slots and
   1–10-second bound; no HAL publication or client output path.
3. Every OUT buffer is byte-zero before submission and immutable throughout lease;
   instrument the actual payload path. Count-only tests cannot prove this.
4. Unique artifacts, bounded lead and capacity; reject unintended interface/config
   changes. No fault injection, unplug/reset or load stress in initial scope.
5. All accepted requests resolved, request and transaction success recorded, confirmed
   abort return and complete drain before teardown. Any missing callback, partial run,
   packet-layout ambiguity or incomplete artifact is BLOCKED/inconclusive, not PASS.
6. Zero-only success establishes bounded transport evidence only: no physical output
   mapping, phase lock, Core Audio timing or nonzero playback qualification.

Core Audio publication/capture and ultimately playback are later individually reviewed
gates. No implementation, build, signing, installation or test is authorized here.
