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

The Extension Host injects initial state before the main inline script executes:

```ts
interface AopxEditorInitialState {
  source: SourceInfo;
  waveform?: WaveformPeak[]; // min/max peaks, typically 150–300 buckets
  plan?: OperationPlan;
  diagnostics?: RenderReport; // optional previous/preview report
  preview?: boolean;          // omit/false in Live
}
```

For the SDK modal:
1. Read/prepare the HTML string.
2. Inject a safely serialized `window.AOPX_INITIAL_STATE = ...;` script before the UI's main script.
3. Open with `context.ui.showModalDialog(dataUrl, 860, 660)`.
4. Parse the returned string. `{ action: "cancel" }` cancels; `{ action: "process", plan: OperationPlan }` starts the engine.
5. Pass the plan to the existing `Project.setPlan(branch, sourceFingerprint, plan)`, then call `Project.render(branch, { signal, onProgress })` within the SDK's cancellable `withinProgressDialog`.
6. Import only a completed output using the SDK's host import API and create a new clip on a separate track; never overwrite the source.
7. Show a result dialog populated with the real `RenderReport`.

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

Render diagnostics consume the existing shared `RenderReport` shape:
- `steps[].operationId`, `status`, `renderMs`, `lookupMs`, `bytes`
- `sourceBytes`, `outputBytes`, `cacheBytes`, `projectBytes`

The current contract byte counts are logical file lengths from filesystem metadata, not allocated disk blocks.

## Validation

From this folder, run:

```sh
npm test
```

Requires Node ≥ 22.18. The suite contains:
- `test/ui-contract.test.mjs`: static checks of the operation-plan and SDK bridge contract markers.
- `test/reorder-core.test.mjs`: unit tests of the shipped reorder/plan core (evaluated from `interface.html`): move earlier/later, first/last boundaries, drag to first/last slot, stable IDs and parameters, bypass preservation, input immutability, and emitted plan order.
- `test/browser-reorder.test.mjs`: real Chromium interaction tests through Playwright at 860×660 (SDK modal size), 640×660 (single-column layout) and 860×480. They demonstrate a three-operation drag reorder (`reverse, gain −3 dB (bypassed), gain +6.25 dB` → `gain +6.25, reverse, gain −3 (bypassed)` → …) and check the payload Apply sends through a mocked `close_and_send` bridge. They also cover row-body drags, handle clicks, drops over activator/remove buttons, Esc cancel, keyboard reordering and focus, and horizontal overflow.

If Playwright is not installed, the browser suite is **skipped** and `npm test` still runs the static and unit tests. To require it:

```sh
npm run test:browser          # fails if Playwright/Chromium is unavailable
AOPX_SCREENSHOT_DIR=/some/dir npm run test:browser   # also saves before/dragging/after screenshots
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

## Known limitations / next integration work

- No actual Webview launch from Live yet.
- No actual waveform peaks until the host injects them.
- No audio audition/transport: the documented modal Webview flow is submit-and-close, not persistent bidirectional host messaging.
- Render progress/cancellation belongs to the host's native progress dialog, not this modal.
- Result/diagnostics display can be opened as a second modal after rendering; this first UI currently supports an injected report for preview/testing.
- Theme tokens use Live-inspired CSS variables with local fallbacks; host theme detection has not been assumed.
- No range editing, plugin hosting, ARA or time/pitch processing.
- Drag reordering has been tested with mouse input in Chromium. Touch/pen should work through Pointer Events (`touch-action:none` on the handle), but this is not yet verified on WKWebView/WebView2 inside Live.
- No auto-scroll while dragging. If the history grows taller than the modal, use the keyboard or Move buttons for long moves.

