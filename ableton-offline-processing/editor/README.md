# AOPX-03 Floating Editor UI — Alpha 0.1

This folder contains the first runnable UI shell for the Offline Processing Suite for Ableton Live.

## Design intent

A compact floating SDK Webview styled to feel native to Live's workstation language:
- charcoal/graphite surfaces and subtle separators;
- restrained Live orange focus/selection;
- Arrangement-style waveform and time ruler;
- device-chain-like Reverse and Gain modules;
- compact parameter controls and a slim diagnostics footer.

The outer title bar/frame is owned by Live/OS. The UI does not draw fake native window chrome.

## Current capability

The HTML UI is a **plan editor**, not an audio renderer:
- loads source metadata and optional waveform peaks;
- displays source name, duration, sample rate, channels, bit depth and source bytes;
- adds Reverse and Gain operations;
- supports multiple instances of either operation;
- selects, bypasses/enables, reorders (drag-and-drop or keyboard) and removes operations;
- edits Gain in dB (-60 to +24);
- submits an Alpha 0.1 `OperationPlan` as JSON via the documented SDK `close_and_send` bridge;
- accepts an optional real `RenderReport` to populate per-operation and aggregate diagnostics.

It deliberately does not perform DSP, render audio, access the Live Set, or invent live progress inside the Webview. The Extension Host performs processing after the modal closes and can open a separate result/diagnostics dialog afterward.

If opened directly in a browser, it uses labelled sample preview data. The Apply and Cancel buttons report that the host bridge is unavailable; no fake processing is claimed.

## Waveform and PEAK PREVIEW

The waveform strip has two views, switched with **SOURCE** / **PEAK PREVIEW** above it.

| View | What it shows |
| --- | --- |
| SOURCE | The host-supplied source peaks, max-reduced into 180 columns so no bin (and no short transient) is skipped. |
| PEAK PREVIEW | An **estimate** of the processed waveform, computed from the source peaks by `previewPeaks` in the plan core. It updates live as operations are added, removed, reordered, bypassed or edited. The label reads "PEAK PREVIEW · ESTIMATE FROM SOURCE PEAKS · NOT A RENDER". |

PEAK PREVIEW rules:
- Reverse mirrors the peak bins. This equals the peaks of the reversed audio only when the bins split the frames evenly; otherwise the bin edges differ slightly.
- Gain multiplies the bins by 10^(dB/20). Like the engine kernel, nothing is clipped: columns beyond full scale are drawn in red and the caption counts them ("PCM EXPORT WOULD SATURATE").
- Bypassed operations are skipped.
- The preview is display-only. It never changes the returned plan and is never presented as a render result; the host render is authoritative.

If the host sends no peaks, no waveform is drawn: the caption reads "NO WAVEFORM DATA" and PEAK PREVIEW is disabled. Only the labelled browser design preview (PREVIEW DATA) uses sample peaks.

## Dialog keys

| Key | Result |
| --- | --- |
| `Esc` | Closes the **+ ADD OP** menu if it is open. Otherwise returns `{ envelopeVersion: 1, action: "cancel" }`. During a drag it cancels only the drag. Ignored after Apply. |
| `Ctrl+Enter` (`Cmd+Enter` on macOS) | Same as **APPLY TO CLIP**. A plain `Enter` never applies, because Apply writes to Live. |
| `Enter` / `Space` on a focused row | Selects that operation (unchanged). |

## Reordering the processing history

Each row in **Processing History** has a dedicated grip handle on its left edge.

| Input | Result |
| --- | --- |
| Drag the grip handle up/down | Moves the operation. An orange insertion line shows where it will land; release to drop. |
| `Esc` during a drag | Cancels; the order is unchanged. |
| Focus the grip handle, press `↑` / `↓` | Moves the operation one step; focus stays on its handle. |
| **↑ Move earlier / ↓ Move later** in Device View | Moves the selected operation one step (keyboard-accessible alternative). |

Behaviour guarantees:
- Only the grip handle starts a drag. Dragging the row body, or clicking the activator, remove button or row, never reorders.
- A plain click on the handle does nothing (no selection change). A drag needs at least 4 px of movement.
- Releasing a drag over another row's activator or remove button does not trigger it: the click produced by the drag gesture is swallowed.
- Reordering changes array order only. Operation IDs, types, enabled/bypass state and parameters are carried over unchanged (the same objects).
- Selection is tracked by operation ID, so the selected operation stays selected wherever it moves.
- Dropping onto the operation's current position is a no-op (no indicator is shown there).
- Apply emits `OperationPlan.operations` in exactly the order shown.
- First/last boundaries are no-ops; the corresponding Move button is disabled.

The order rules live in a small DOM-free script (`<script id="aopx-plan-core">`, exposed as `window.AOPX_PLAN_CORE`) so they can be unit tested. The drag uses Pointer Events rather than HTML5 drag-and-drop for consistent behaviour in WKWebView (macOS) and WebView2 (Windows).

## Host integration contract

The contract types live in `engine/src/contract.ts` and are versioned by `MODAL_ENVELOPE_VERSION` (currently 1), separately from `CONTRACT_VERSION`, which versions the operation plan and is part of every cache key.

The Extension Host injects a `HostInitialState` as `window.AOPX_INITIAL_STATE` before the UI scripts run:

```ts
interface HostInitialState {
  envelopeVersion: 1;
  source: SourceInfo;
  waveform: WaveformPeak[];          // min/max peaks, e.g. from the engine's computePeaks()
  plan: OperationPlan;
  diagnostics: RenderReport | null;  // last completed render for this source, or null
  preview: false;                    // host state is never preview data
}
```

The string returned through `close_and_send` is the JSON of a `ModalResult`:

```ts
type ModalResult =
  | { envelopeVersion: 1; action: "cancel" }
  | { envelopeVersion: 1; action: "process"; plan: OperationPlan };
```

If the injected state carries an `envelopeVersion` other than 1, the UI disables Apply and says so; Cancel still returns. State without `envelopeVersion` (the older shape, and the browser preview) is still accepted.

The SDK-independent host side is in `../host/src/modal.ts`:
- `buildHostInitialState(...)` builds the state;
- `injectInitialState(html, state)` inserts `<script>window.AOPX_INITIAL_STATE=...;</script>` before `<script id="aopx-plan-core">`, serialized so that no source name can end the script early;
- `parseModalResult(string)` validates the returned string (envelope version, action, plan version, operation types and fields, Gain range, unique ids) and throws `ModalResultError` otherwise.

For the SDK modal:
1. Read the HTML and call `injectInitialState`.
2. Open it with `context.ui.showModalDialog(url, 860, 660)`. Whether the URL is a data URL or a generated file in `tempDirectory` is decided by spike S3 on Windows.
3. Pass the returned string to `parseModalResult`. `cancel` stops; `process` gives the plan.
4. Pass the plan to `Project.setPlan(branch, sourceFingerprint, plan)`, then call `Project.render(branch, { signal, onProgress })` within the SDK's cancellable `withinProgressDialog`.
5. Import only a completed output using the SDK's host import API and create a new clip on a separate track; never overwrite the source.
6. Show a result dialog populated with the real `RenderReport`.

The Webview supports both SDK host bridge variants:
- macOS: `window.webkit.messageHandlers.live.postMessage(message)`
- Windows: `window.chrome.webview.postMessage(message)`

Message shape:
```js
{ method: "close_and_send", params: [JSON.stringify(payload)] }
```

This matches the SDK modal-dialog protocol reviewed for beta.1. The actual SDK runtime and Live modal sizing still need AOPX-01's integration proof.

## Contract alignment

The UI emits the exact shared operation-plan envelope:
- `version: 1`
- `operations: [{ id, type, enabled }, ...]`
- Gain operations additionally carry `db`.

Supported operation types in Alpha 0.1: `reverse`, `gain`.
Gain range: -60 to +24 dB. Multiple operations of the same type are allowed.

Render diagnostics consume the shared `RenderReport` shape:
- `steps[].operationId`, `status`, `renderMs`, `lookupMs`, `bytes`
- `sourceBytes`, `outputBytes`, `cacheBytes`, `projectBytes`
- `wallMs`: **LAST RENDER** shows this measured wall time of the render request, or "—" when it is `null`. It is not the sum of `renderMs`: a cache hit carries its entry's original `renderMs` forward, so that sum would report the original render time for an all-hit render. Per-step `renderMs` and `lookupMs` stay in the step table.

The current contract byte counts are logical file lengths from filesystem metadata, not allocated disk blocks.

## Validation

From this folder, run:

```sh
npm test
```

Requires Node ≥ 22.18. The suite contains:
- `test/ui-contract.test.mjs`: static checks of the operation-plan and SDK bridge contract markers.
- `test/reorder-core.test.mjs`: unit tests of the shipped reorder/plan core (evaluated from `interface.html`): move earlier/later, first/last boundaries, drag to first/last slot, stable IDs and parameters, bypass preservation, input immutability, and emitted plan order.
- `test/peak-preview-core.test.mjs`: unit tests of the shipped `reducePeaks` and `previewPeaks`, cross-checked against the real engine kernels (`engine/src/dsp.ts` `reverse`, `gain`, `computePeaks`): transient kept, every bin covered once, bypass skipped, input not mutated, exact match for Reverse→Gain chains when bins divide the frames, the documented Reverse estimate at uneven bin edges, and over-full-scale counting without clipping.
- `test/browser-waveform.test.mjs`: real Chromium tests of the waveform (stroked and visible, transient kept, no made-up waveform for host state without peaks), PEAK PREVIEW (labelled, live with gain/bypass, plan unchanged and validated with `parseModalResult`), and the dialog keys (Esc cancel, Esc closes the menu, Esc during a drag, plain Enter vs Ctrl+Enter, no second send after Apply).
- `test/browser-reorder.test.mjs`: real Chromium interaction tests through Playwright at 860×660 (SDK modal size), 640×660 (single-column layout) and 860×480. They demonstrate a three-operation drag reorder (`reverse, gain −3 dB (bypassed), gain +6.25 dB` → `gain +6.25, reverse, gain −3 (bypassed)` → …) and check the payload Apply sends through a mocked `close_and_send` bridge. They also cover row-body drags, handle clicks, drops over activator/remove buttons, no-op drops within the same slot, Esc and pointercancel cancellation, keyboard reordering and focus, and horizontal overflow.
- `test/browser-host-contract.test.mjs`: real Chromium tests of the host contract. The state is built and injected with `../host/src/modal.ts`, every payload sent through the Windows (`chrome.webview`) bridge is validated with `parseModalResult`, and the suite checks: injected state renders as non-preview; LAST RENDER shows `wallMs` (17.4 ms) for an all-hit report rather than the 118.4 ms sum of carried-forward `renderMs`; `wallMs: null` shows "—"; Apply, bypass and Cancel return valid `ModalResult`s; a hostile source name cannot inject script; an unsupported envelope version disables Apply.

| Command | Browser suite |
| --- | --- |
| `npm test` (same as `npm run test`) | Runs if Playwright is available. Otherwise it is **skipped**: the run prints `[aopx-editor] SKIPPED: Playwright not installed …`, the TAP summary shows `# skipped 1`, and the static and unit tests still run and pass. |
| `npm run test:browser` | **Mandatory.** Fails (non-zero exit, `Playwright is required …`) if Playwright/Chromium is unavailable. |

Both commands work unchanged in Windows CMD, PowerShell, macOS and Linux shells. `test:browser` runs `scripts/run-browser-tests.mjs`, a small Node runner that sets `AOPX_REQUIRE_BROWSER=1` itself instead of relying on shell-specific `VAR=value` syntax. No `cross-env` or other dependency is needed.

To also save before/dragging/after screenshots, set `AOPX_SCREENSHOT_DIR` (the directory must exist) in your shell's syntax:

```sh
AOPX_SCREENSHOT_DIR=/some/dir npm run test:browser
```

```powershell
$env:AOPX_SCREENSHOT_DIR="C:\some\dir"; npm run test:browser
```

```bat
set "AOPX_SCREENSHOT_DIR=C:\some\dir" && npm run test:browser
```

Playwright is resolved from the environment (global install or `NODE_PATH`); this package adds no dependencies.

None of this replaces testing in the Live SDK runtime. Browser preview never renders audio.

### Manual verification checklist (browser preview)

1. Open `interface.html` directly in Chrome/Safari at about 860×660. The preview data has two operations; use **+ ADD OP → Gain** to add a third.
2. Drag the third row's grip handle above the first row. Check that the orange insertion line appears, the row lands at step 01, and the same row is still selected.
3. Drag a row by its title or body. Check that nothing moves.
4. Start a handle drag and press `Esc`. Check that the order is unchanged.
5. End a drag over another row's × or activator. Check that nothing is removed or bypassed.
6. Tab to a grip handle and press `↑`/`↓`. Then use **Move earlier/later**. Check that focus stays on the control you used.
7. Press **Apply**. The status shows "host message bridge is not available" because no audio is rendered in preview. To inspect the plan, run the browser test above.
8. Click **PEAK PREVIEW**, then bypass the Reverse row or move the Gain slider to +24 dB. Check that the waveform follows, the label says NOT A RENDER, and red columns plus a 0 dBFS warning appear for loud settings.
9. Press `Esc` with the **+ ADD OP** menu open (it closes), then press `Esc` again (the status reports that the bridge is unavailable; in Live this returns cancel).

## Known limitations / next integration work

- No actual Webview launch from Live yet.
- No actual waveform peaks until the host injects them; PEAK PREVIEW is an estimate from those peaks, not audio rendered in the Webview.
- No audio audition/transport: the documented modal Webview flow is submit-and-close, not persistent bidirectional host messaging.
- Render progress/cancellation belongs to the host's native progress dialog, not this modal.
- Result/diagnostics display can be opened as a second modal after rendering; this first UI currently supports an injected report for preview/testing.
- Theme tokens use Live-inspired CSS variables with local fallbacks; host theme detection has not been assumed.
- No range editing, plugin hosting, ARA or time/pitch processing.
- Drag reordering has been tested with mouse input in Chromium. Touch/pen should work through Pointer Events (`touch-action:none` on the handle), but this is not yet verified on WKWebView/WebView2 inside Live.
- No auto-scroll while dragging. If the history grows taller than the modal, use the keyboard or Move buttons for long moves.

