# Step 2 — deferred architecture audit and experimental plan
Research date: 2026-11-12 (America/Los_Angeles).
Companion: [API feasibility and artifact gate](API_FEASIBILITY.md).

## Audit status
**Source audit NOT PERFORMED.** The exact v0.1.32 ZIP is unavailable and its SHA-256 cannot be verified. Per issue #11, work continued as independent API research only. The following is a prospective review protocol and conditional design guidance, not findings about existing functions, data structures, duplicate definitions, runtime costs, MIDI rates or a diagnosed banking bug. No measured performance numbers are claimed.

The frozen manifest is the authority for preserved behavior; it establishes four assignable columns but does not specify a complete exclusivity/repetition policy. No exclusivity rules should be inferred from historical builds.

## Source audit worksheet to run after artifact verification
| Area | Evidence to collect from verified source | Review question / acceptance |
|---|---|---|
| Four-column ownership | Input dispatch, module registry, chooser, per-column state and LED addresses | One owner per physical input/output; preserve all current valid assignments and chooser gestures. |
| Repetition/exclusivity | Existing duplicate assignment paths, shared device/clip bank state, active-instance list | Document actual policy first. Proposed policy must explicitly distinguish mirrored shared state from consecutive banks and independent cursors. |
| Two-column VU | Width allocation and adjacent-column assignment paths | A proposed pair reserves both columns atomically; reject conflict without evicting working modules. One lifecycle owner for the pair. |
| Lifecycle | Listener/task registration and teardown, held-button state, module transition | Repeated activation does not grow listeners/tasks; leaving while held clears consumed gestures and stale LEDs. |
| Refresh | Full refresh callback call graph and per-mode loops | Record operations per tick; no library walk or repeated full device/clip scan in hot path. |
| MIDI/cache | Send functions, force flags, cache keys and invalidation | Key by output port/status/channel/address and message role where needed; distinguish RGB, ring and animation messages. |
| Clip animation | Clock sources, state polling and LED write paths | One animation phase source; preserve accepted color translation and launch state priority. |
| Device banking | Parameter list construction, bank offsets, persisted selection and labels | Reproduce 32/33 with exact list and event trace before choosing a fix. |
| Duplicate methods | Class-local definition inventory and inheritance resolution | Identify actual shadowed methods and active behavior before cleanup; duplicate text alone does not establish a bug. |

Potential cost centers to investigate, not observed defects: repeated nested device traversal; rebuilding parameter lists per encoder event; per-column copies of shared meter/clip polling; duplicate listener notifications; unconditional ring/RGB retransmission; allocation and string formatting inside ticks; synchronous Browser enumeration; repeated invalid-object exceptions.

## Conditional performance recommendations
Preserve the existing scheduler initially. Measure its real cadence before proposing faster updates. A suggested experiment is to compare 10 Hz and 20 Hz visible meter sampling; these are trial settings, not supported-rate guarantees or measured requirements. Read each distinct visible source once per interval, share its snapshot across renderers, quantize output and send only changed values. Static modules should become dirty on events rather than receive periodic full repaint. On unsupported meter access, show an unavailable state rather than a false zero.

Use a bounded dirty-output queue with newest-value coalescing for meters. Retain input processing and discrete state changes at higher priority than cosmetic animation. Don't coalesce away press/release events or ordered setup commands. Budget output work per tick, spread reconnect painting over ticks, and invalidate all relevant cached values on reconnect, hardware-bank change, output reset and column reassignment. A cache that suppresses required startup writes is a regression.

Illustrative traffic model only: 16 encoders × 2 feedback messages × 20 Hz = 640 messages/s. At 3 MIDI bytes per channel message that is 1,920 payload bytes/s; at 10 Hz, 320 messages/s and 960 bytes/s. Extra brightness/mode messages add traffic. DIN MIDI's 31,250 bit/s serialization would spend about 61% on the former under 10 bits/byte, but the Twister uses USB: this calculation is **not** a USB limit or evidence that the baseline saturates. Record actual message lengths, USB packet behavior if available and hardware response. Average rate alone misses reconnect bursts and queue latency.

Clip animation should derive phase once from the shared clock and repaint only when the visible phase/state changes. Preserve queued/recording/playing/stopped precedence and existing color mapping. Do not send tick-by-tick changes to an invisible bank. Any hardware animation offload requires confirmation of the current Twister configuration and its feedback protocol first.

## Dedicated VU design proposal (deferred)
An additive VU module should consume a shared read-only meter service; it must not replace the accepted Master module's meter path in the first experiment. Separate source selection, level visualization and beat/bar modes. Specify silence floor, peak hold/release, overload indication and unavailable-source behavior using observed meter semantics before selecting a transfer curve. Avoid claiming RMS, peak dBFS or true stereo from an unverified scalar.

For a two-column mode, propose one shared source snapshot with synchronized renderers and explicit stereo-versus-dual-source semantics. Reserve the pair in a single transaction and preserve existing assignments on allocation failure. Beat/bar mode should follow musical position, meter and transport jumps, not a free-running wall-clock approximation. Test non-4/4 signatures and stopped playback. Begin with level mode; beat/bar and paired mode should be later features after review.

## Device banking 32/33 — diagnostic protocol, no root-cause claim
The manifest reports returning to 33 instead of 32. It does not establish whether those numbers mean parameter labels, offsets, bank labels or controller values.

Capture the gesture sequence, device class, exact parameter identities/order, inclusion of Device On, bank width, current bank/offset, displayed label and next/previous indices. Test consecutive parameters around 31–34 in both directions, a partially filled final bank, reselecting a device, repeating Device across columns, changing parameter count and restoring state.

Possible causes to distinguish: one-based display versus zero-based storage; treating Device On as a numbered control parameter; inconsistent filtering between forward/back paths; bank-index versus parameter-offset confusion; stale shared bank restoration. These are hypotheses only.

For a deliberately chosen controllable list of length N and width W, a proposed consistent model is B = ceil(N/W), bank index b in [0,B-1], slot index b*W+i. N=0 has no valid bank. Display b+1 only at presentation. Do not adopt that model until existing named/custom banks and accepted parameter ordering are understood. Test N=0,1,W-1,W,W+1,31,32,33,34 and repeated next/previous round trips. A fix must preserve parameter identity, not merely produce a preferred label.

## Measurement plan and proposed acceptance gates
No tests below have been run on Live or hardware.

Record baseline and each experimental build separately on the same Live 12.4.16/OS/Twister firmware/settings, audio interface/sample rate/buffer and Set. Include a small Set and a representative large Set; log track/scene/device counts and nesting depth. Retain the immutable ZIP and hashes for every run.

After warm-up, capture 60-second runs for idle/static, all visible meters active, clip launch/animation, rapid parameter and track changes, rapid chooser changes, repeated modules, and reconnect. Repeat comparable runs three times. Log callback duration p50/p95/p99/max, actual tick intervals, late ticks, operations/objects read per callback, MIDI attempted/sent/suppressed by type, bytes/s, burst size, queue depth/age, input-to-feedback latency and listener/task counts. Aggregate logs; do not add disk writes on every tick. Include instrumentation overhead comparison.

Provisional gates for review: no sustained queue growth; no lost or duplicated input actions; no stuck modifier; no exceptions during normal use; idle static feedback settles after initial paint; output queue age stays below two observed refresh intervals in steady state; p99 refresh work stays within 25% of the measured tick interval. These are proposed experiment criteria, not existing product guarantees. Also inspect whole-process CPU, Live audio load, audio dropouts and subjective hardware readability; CPU improvement cannot excuse worse controls.

## Regression checklist — all pending
- [ ] Exact source ZIP digest matches; package inventory recorded; stable artifact untouched.
- [ ] Purple Track Mixer / FX Sends startup LEDs remain color 104; unavailable sends stay off, including after reconnect.
- [ ] Master bottom RGB VU and white ring behave as accepted; silence, sustained level and restart tested.
- [ ] Channel Mixer bottom press arms; second-from-bottom press resets pan.
- [ ] Hold bottom + tap above mutes; hold second-from-bottom + tap bottom solos; release ordering adds no stray arm/reset.
- [ ] Hold top + twist bottom switches modules in each column; release consumes the chord without an extra action.
- [ ] Track Mixer, FX Sends, Device, Clip, Master, I/O and LED Diagnostics remain available; four-column assignments work.
- [ ] I/O selection/LED and slower sensitivity preserved.
- [ ] Clip launch, queued/playing/recording animations and accepted color translation preserved.
- [ ] Device controls preserve ordering, banking and mouse-driven feedback; 32/33 reproduction documented separately.
- [ ] Repeated modules and mode exits leave no stale listeners, animations, held state or LED ownership.
- [ ] Track/device/scene deletion and reorder while active safely rebind or disable; Master/return/audio/MIDI/group and empty cases checked.
- [ ] Hardware bank changes/reconnect and Live Set reload repaint correctly without MIDI feedback loops.
- [ ] Baseline-versus-experiment performance gates pass and user hardware review is recorded.
- [ ] No mapping diff outside the explicitly approved new module; no stable branch changes or automatic merge.

## First two experimental builds — recommendation only
**Prerequisites for either:** recover and verify ZIP; complete source audit; independent design/regression review requested by the frozen handoff; separate user approval for implementation. Reports do not authorize either build. Create separately named experimental branches from verified source, not from the docs-only freeze.

### Experiment 1 — observability and minimal transport (2 features)
Suggested branch: `bento/exp-v2-01-metrics-transport`.
1. Bounded, optional aggregate refresh/MIDI instrumentation with unchanged mappings and an off switch.
2. Additive Transport 1 module: tempo/tap, play-stop, metronome, Arrangement record, with reviewed gesture arbitration.

Purpose: establish target API behavior and performance evidence before scheduler changes. Pass the full regression checklist and report overhead with instrumentation on/off. No VU replacement or bank algorithm cleanup in this build.

### Experiment 2 — Rack variation and native compare (2 features)
Suggested branch: `bento/exp-v2-02-variations-compare`.
1. Additive Rack Macro Variations module: select/recall/recall-last and deliberate capture; omit delete/overwrite.
2. Additive native Device A/B compare module: A/B state selection and deliberate copy-to-other-state with capability guard.

Purpose: exercise documented APIs with small isolated modules and measurable feedback. Verify changes from both mouse and hardware. Unsupported devices stay disabled. No continuous crossfade, browser loading or native mixer slots.

Transport 2, Scene Launcher, custom device shortcuts, dedicated VU, 32/33 correction and scheduler optimization remain later candidates. Browser experiments require target-specific evidence and explicit loading safeguards. Contextual Browser/native Device Slots need a separate version decision. If the recovered baseline changes risk estimates, revise this build order before implementation. Each proposed build has two features, below the maximum of three.
