# DEMORA Windows ETW shutdown plan

Source: [Codex report on PR #2](https://github.com/solidtakes/Music-Development-Projects/pull/2#issuecomment-6810009459). This file preserves the reported findings and proposed procedure from that comment. The original driver repository commit is separate.

## Offline follow-up for 6809854403

Completed on isolated local branch `codex/aira-etw-shutdown-plan` at `851710af79fde5ae469900b214c6355363a67399`, based on `838290e`. The commit updates the startup and native gap reports and adds the lifecycle record and shutdown draft. The commit is local. Reviewable procedure is included below.

- **Checks:** Rehashed the original ETL and reran chronological request pairing on both pipes. First matched IN is UCX 30/31 v0 at +27.565254/+27.570446 s, record ordinals 159851/62473; first matched OUT is +27.570471/+27.576456 s, ordinals 210140/62502 (zero-based decoder iteration). USBXHCI 9 v3 and USBHUB3 43 v2 establish target and descriptor attribution. UCX 23 v0 / 24 v1 confirms config 1 at +19.083050/+19.083073 s, IF2 alt1 at +27.564585/+27.564629 s, and IF1 alt1 at +27.565191/+27.565245 s. Each URB status is zero. Git diff check passed.
- **Tail:** Four requests per endpoint dispatched between +49.116457 and +49.119475 s lack a terminal record. Trace ends at +49.122862 s, 3.387 ms after the last dispatch. The recorded requests establish incomplete trace coverage of drain. Their later success, cancellation and retirement remain unknown.
- **Native implication and next task:** Windows provides a confirmed comparison sequence for 0582:01AF. Vendor/class controls, DriverKit match and ownership, OS configuration policy, native priming and action/DMA lifetime remain open. After eligibility/provider review, the next bounded compile-only proposal is a declaration-only IF1/IF2 endpoint contract with static checks for VID/PID, alternates, endpoint addresses and directions, packet size and interval. Leave runtime calls and packet-contract selection out of that task.

No Windows or native runtime testing was performed. The raw ETL stayed outside Git.

# Proposed Windows ETW shutdown capture

For review. This procedure has not been run. Use one targeted Windows session on the known DEMORA port with the existing Roland ASIO setup at 96 kHz. Preserve the ETL outside Git. Keep the DEMORA connected throughout so physical removal cannot supply the apparent stop.

1. With Ableton closed, start the file-backed ETW session before connecting the DEMORA. Use USBHUB3, UCX and USBXHCI with `Default,FullDataBusTrace` at verbose level (5). Use a unique output path, sequential logging and manual stop. For a pre-stop idle check, configure the same session for simultaneous file logging and real-time delivery. Before touching the device, confirm the ETL destination and that a real-time consumer is receiving events and reporting delivery loss. An ETW consumer can attach using `OpenTrace`/`ProcessTrace`. Availability and dual delivery on the Windows PC are preflight requirements. [Microsoft USB capture settings](https://learn.microsoft.com/en-us/windows-hardware/drivers/usbcon/how-to-capture-a-usb-event-trace) and [ETW consumption](https://learn.microsoft.com/en-us/windows/win32/etw/consuming-events)
2. Connect the DEMORA, open Ableton on Roland ASIO at 96 kHz, and play and record for 5–10 seconds. Note clock times for connection, ASIO open, transport stop, quit and process exit. Confirm the live observer shows both DEMORA isoch directions before attempting shutdown. Match identity to 0582:01AF and the current device/pipe objects.
3. Stop transport, quit Ableton normally, and confirm the Ableton process has exited in Task Manager. Process exit confirms the application is gone. If an existing Roland diagnostic reports ASIO close, record that timestamp too. Keep other ASIO clients closed. Use target UCX events to establish release of USB traffic, since transport stop or process exit alone cannot establish stream idle.
4. Keep ETW running until both target pipes show a continuous **10-second** interval after process exit with zero new dispatches and no outstanding requests. Start the window after the later of process exit or the final paired terminal event. Restart it on new target isoch activity. Require that the live observer has consumed events through the end of the window, with delivered buffers or a trace heartbeat advancing the observed clock. Silence in a stalled observer does not count. Record the idle interval and stop ETW manually. If the observer cannot establish idle within 30 seconds after process exit, stop and label the attempt inconclusive. Preserve that ETL for diagnosis.
5. Hash the closed ETL and verify the gate offline against the full event sequence. Use timestamps, device/pipe, IRP and URB identity to match each request to a unique completion or explicitly correlated terminal cancellation. Report raw URB and IRP status, packet status and any unresolved pairs. Record IF1/IF2 alt0 request bytes, time and completion status if captured. Also report any reset or disconnect if observed.

| Check | Pass | Inconclusive or fail |
|---|---|---|
| Provenance | Target descriptor and both streaming pipes link in one ETL, with pre-open and post-exit coverage. | Missing identity, direction, or time coverage. |
| Drain and idle | Zero unmatched requests or active-key collisions on either pipe. Trace extends at least 10 s beyond exit and last terminal event, with no target isoch dispatch or outstanding work in that window. | Outstanding requests, continued dispatch, uncorrelated cancellation, or short tail. |
| Restoration | Record any observed IF1/IF2 restore order and statuses. A successful alt0 claim requires a matched success for each interface claimed. | Absent restore stays unverified. A matched failure is reported separately from whether the stream drained. |
| Trace integrity | Header reports zero events and buffers lost. Live idle gate also requires healthy delivery. | Any loss or an unverified live clock prevents a definitive idle result. |

The live gate is the primary control against cutting off an active stream. A bounded ETL with no working live observer can still be inspected offline, but cannot satisfy the pre-stop gate. No reset, unplug/replug, forced termination or second capture is part of this plan.
