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
- selects, bypasses/enables, reorders and removes operations;
- edits Gain in dB (-60 to +24);
- submits an Alpha 0.1 `OperationPlan` as JSON via the documented SDK `close_and_send` bridge;
- accepts an optional real `RenderReport` to populate per-operation and aggregate diagnostics.

It deliberately does not perform DSP, render audio, access the Live Set, or invent live progress inside the Webview. The Extension Host performs processing after the modal closes and can open a separate result/diagnostics dialog afterward.

If opened directly in a browser, it uses labelled sample preview data. The Apply and Cancel buttons report that the host bridge is unavailable; no fake processing is claimed.

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

The tests statically verify the UI's operation-plan and SDK bridge contract markers. They do not replace browser rendering or Live SDK runtime testing.

## Known limitations / next integration work

- No actual Webview launch from Live yet.
- No actual waveform peaks until the host injects them.
- No audio audition/transport: the documented modal Webview flow is submit-and-close, not persistent bidirectional host messaging.
- Render progress/cancellation belongs to the host's native progress dialog, not this modal.
- Result/diagnostics display can be opened as a second modal after rendering; this first UI currently supports an injected report for preview/testing.
- Theme tokens use Live-inspired CSS variables with local fallbacks; host theme detection has not been assumed.
- No range editing, plugin hosting, ARA or time/pitch processing.

