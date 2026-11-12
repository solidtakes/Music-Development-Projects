# M9P readiness audit and simulator review

November 7, 2026. Read-only inspection of local evidence and source; no new driver
compilation, binary execution, device query or runtime validation. Public-safe
summaries only; private paths, vendor instructions and raw research are omitted.

## Scope and evidence grades

S = direct source/generated artifact observation; H = historical report, not rerun;
P = proposed native/simulator policy; U = unresolved contract/runtime behavior.
The original binary was not independently re-disassembled in M9P. Comparison uses
the local M9N-A reconciliation plus the M9N-B source, tests and published checkpoint.
This is a fresh code review within Codex, not an independent external reviewer signoff.

| Component | Finding | Grade and limit |
|---|---|---|
| M8 service | One direct IOService; synchronous init/Start/Stop/free, local diagnostic POD, no USB/audio/actions | S; deliberately narrow prototype |
| Stage 2C generated glue | IOService superclass dispatch and separate subclass IVars; 20-byte diagnostics; Start/Stop routing and no post-super Stop/free accesses | S; generated dispatch does not prove runtime serialization or failed-init destruction |
| Stage 2C objects | Existing arm64 service and bindings objects, successful warning-clean SDK 24.5 / target 24.0 commands | H plus artifacts inspected; no new compile, final link or runtime |
| Separate audio compile target | IOUserAudioDriver Start returns unsupported; inactive device StartIO returns unsupported | S; not an active driver and not part of M8 |
| Audio object helper | Creates inactive 96-kHz ten-channel streams/maps; signed32 packed input, native float output; Prepare not called by Start | S; no AddStream/publication/clock/active IO path |
| SDK contract probe | Compile-time signature checks for IsochIO, GetFrameNumber, streams and clock methods; 24-byte frame-record layout | S/H; layout/signatures do not establish transaction payload placement or DMA semantics |
| M8 USB backend | No Open/Close, pipe acquisition, IsochIO, completion/abort, USB buffers or disconnect handling | S; absent scope, not a defect |
| Standalone local probe | Existing project status reports bounded silent duplex and tone capture experiments | H; distinct IOUSBHost path, not transferable DriverKit qualification |

Local evidence inspected: M8 Stage 2B source/README; Stage 2C report and generated
artifact findings; separate driverkit README, AiraBuildOnlyDriver, AiraAudioObjects,
AiraInactiveAudioDevice and AiraSDKContract; current project status; M9N-A design;
M9N-B arithmetic/model/records and unit tests; published source/test summary.
These materials stay local except approved simulator sources and these summaries.

## Native translation and remaining simulator discrepancies

| Model behavior | Review result | Required native treatment |
|---|---|---|
| Fallback and floor-difference packing | Matches recovered arithmetic summary: 40-byte divisor, strict <6 substitution, persistent 7904/8000 phase, finite F | Checked fixed-width arithmetic and independent vectors; validate whole request before phase changes |
| Separate ledgers, paired IN then OUT | Matches source design; OUT offset can change before rejection; shared update waits for required success | Preserve stage effects and account partial pairs without retry/rollback |
| Head selection / six return codes | Model has head-only admission and 0..5 mapping, caller table targets | Targets/states are static reference metadata, not a complete executable historical caller machine |
| Early active readiness | Reference accepts last-entry predicate; safe profile adds coherence/all-entry checks | Coherence is a scripted Boolean; native must prove visibility or defer until documented return boundary |
| Callback counts/status | Supplied callback counts create synthetic status-zero entries; callback sets coherent=true | Not evidence for actual all-entry status or DMA coherence; copy and validate real SDK records |
| Prequeue 8/32/96 | Separates target, successful iterations, accepted counts and outstanding depth | Tight prequeue loop does not itself simulate concurrently arriving callbacks; actual achieved queue depth unknown |
| RequestFrame to slots | Absolute frame*8, 125-us slots, synthetic origin and late-rejection policy | Resolve current API units/anchors and submission deadline; simulator is not historical provider ABI |
| Completion ownership | One scripted callback returns lease; effective cancellation explicitly releases future reservations | Apple callback/abort return semantics and duplicate delivery are not established by model |
| Recovery | Explicit RESUME/FULL, selected numeric states and origin supplied by caller; preserve/reset fallback separately | Simplifies all three historical AltRun paths; not complete predicate/timer/workaround behavior |
| Recovery position | recover() rebases bus origins but retains out_offset/shared_frames/recovery_phase | No recovered full rebase guarantee; define reset scopes before native recovery; no direct port |
| Missing completion | Stop cannot finish with owned leases; old callbacks can clean old identity | Timeout diagnostics do not prove resources reclaimable; native lifetime must span late callbacks |
| Resource limits | Bounded live packs/budgets, reservations and trace; Python counters/UIDs unbounded | Check native integer overflow, unique identity rollover and diagnostic saturation explicitly |
| Reference profile | Still enforces safety bounds and new generation isolation; may reject historical malformed counts | Not a bit-exact emulator; label intentional differences |
| OUT-only mode | Scripted nominal cycles possible; poll() is IN-specific | A real OUT-driven event pump is not established by duplex tests |

Fresh review finding: `callback(..., counts=...)` may overwrite previously observed
transaction records, while early retirement can already have consumed a snapshot.
The model does not prove equivalence of those observations. Native code must freeze
an admitted snapshot and forbid callback mutation of consumed metadata; retain lease
identity separately. This is a fidelity/contract gap, not a demonstrated failing test.

Fresh review finding: a partial prequeue failure enters RECOVERY_WAIT without a
complete historical state-4/state-5 transition model. Explicit recovery input and
fault scripts should not be treated as a recovered automatic recovery controller.
The first native milestone should fault-stop and drain, not copy these shortcuts.

Other unresolved evidence: exact startup provider arithmetic and achieved depth,
shared-position historical meaning, all resume rebase/reset scope, timer counter
units and dynamic recovery flags. No claim of input/output conversion symmetry,
physical channel safety or silent nominal prefill is made.

## Asynchronous validation obligations

Before native implementation closes its ownership design, establish submission-time
callback behavior, rejection-with-callback possibility, action/provider retention,
frame-list mutation and coherent visibility, memory descriptor mapping/preparation,
per-entry versus request status, abort ordering and provider disconnect validity.
Use separate callback/ingress/downstream drain conditions. Hardware-free mocks can
validate the chosen protocol but cannot certify framework contracts or DMA timing.
Lifecycle failed-init subclass free invocation, partial inherited cleanup and actual
Start/Stop overlap remain U; generated superclass calls prove only static routing.

## Entitlements, signing and installation

No authored M8 activation host, final bundle, granted profile or approved team/device
entitlement matrix was established. No identities, credentials or device registrations
were inspected. Required candidate scopes: DriverKit base, USB transport restricted
to the approved device scope, AudioDriverKit family for audio publication, and the
host's System Extension install capability. User-client grants depend on topology.
Having an entitlement name is not evidence of an Apple grant for Roland's VID.

Apple's official references checked for this audit:

- [DriverKit entitlement request](https://developer.apple.com/documentation/driverkit/requesting-entitlements-for-driverkit-development): obtain the team grants and matching profiles.
- [System extension installation](https://developer.apple.com/documentation/systemextensions/installing-system-extensions-and-drivers): host-app activation and signed entitlements, not copying an object into place.
- [AudioDriverKit](https://developer.apple.com/documentation/audiodriverkit): HAL integration architecture; this does not establish this device/provider combination.
- [Creating a DriverKit driver](https://developer.apple.com/documentation/driverkit/creating-a-driver-using-the-driverkit-sdk): generic USB-audio limitation wording requires reconciliation with AudioDriverKit and the chosen combined provider topology before implementation.

Current account grants, exact distribution/notarization requirements, deployment
compatibility and supported cross-family topology remain unverified. A future
activation plan must specify bundle IDs, matching/personality, team/profile/certificate,
host embedding, user approval, incumbent-driver conflicts, deactivation and rollback.
Do not disable security, seize ownership or reset hardware to bypass a failure.

## Ranked blockers and decision

1. **Critical: native transfer memory/lifetime contract.** Transaction packing,
   DMA visibility, completion/abort ownership and disconnect-safe release are open.
2. **Critical: supported ownership/provider and grant architecture.** Both-interface
   acquisition and AudioDriverKit/USB composition need authoritative validation;
   compile-time APIs do not prove a supportable signed device driver.
3. **High: lifecycle and concurrency implementation.** No native async backend,
   bounded ingress, durable drain diagnostics or validated failed-init/free behavior.
4. **High: clock and FIFO contract.** Startup lead, sample/host timestamps, ring
   latency, drift and recovery rebasing are not established by CPU tests.
5. **High: deployable artifacts.** No reviewed linked bundle/host, profiles, signing,
   activation/deactivation or rollback package; no account grant verification.
6. **Later playback blocker: encoding and physical routing.** Native output conversion
   boundary and safe audio/CV destinations remain unqualified. No nonzero test allowed.

**Verdict: READY for design review; BLOCKED for native runtime and Core Audio streaming.**
Next investigation: a bounded SDK/Apple-contract feasibility review of combined
provider ownership, transaction placement and terminal lease return. Then request
an isolated successor source-only implementation scope with a mock backend. Keep
M8 and simulators frozen. Gate sequence: review -> source-only implementation ->
compile/link -> signing/host preparation -> activation approval -> bounded zero-only
transport -> capture clock qualification -> Core Audio publication -> later playback.
Unknown Apple grants/runtime results prevent a credible calendar completion date.

M9P offline validation: standalone published M9K 38/38 and M9N-B 48/48 passed.
Historical million-request benchmark was not rerun. No native compile or hardware
test was performed. Original project and simulator preservation hashes are verified
in the separate local validation record; no new preservation files enter this branch.
