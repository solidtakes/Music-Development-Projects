# AOPX offline integration core (Alpha 0.1)

This package implements the Offline Process flow that a Live Extension will run. It does **not** import the Ableton SDK and does not run in Live. Every Live call goes through the narrow `LivePort` interface in `src/port.ts`. The tests run the flow against an in-memory fake, so the whole flow is verified offline on Linux and Windows CI.

```
resolve clip → admit → renderPreFx → admit WAV → engine importSource → editor (modal) →
setPlan → engine render (history + cache) → export unique WAV → recheck →
importIntoProject (once) → createAudioClip on the existing "AOPX RESULT" track (once) → verify
```

**Status:** offline code only. **It is not a Live Extension, it has not been run in Live, and it is not authorized for Live.** The real adapter has not been written. That adapter is the one file that will implement `LivePort` with `@ableton-extensions/sdk`, and it is gated (see the plan document).

## Commands

```sh
cd ableton-offline-processing/integration
npm ci
npm run check    # tsc + all tests (no SDK, no Live)
```

## Modules

| File | Role |
|---|---|
| `src/port.ts` | The `LivePort` boundary and the `ClipSelection` and `CreatedClip` shapes. There is no method that can change the source clip. |
| `src/flow.ts` | `createOfflineProcess(port, options)`: admission, the flow above, and the outcome classification. |
| `src/render-input.ts` | Admits the file `renderPreFxAudio` returns. It checks that the file is inside the temp directory and is a regular file, applies size and decoded-memory caps, rejects AIFF and RF64 with a clear message, validates the WAV, rejects empty renders and more than 2 channels, and checks the frame count against the beat range. |
| `src/timing.ts` | Beat, second and frame conversion at a constant tempo: `seconds = beats × 60 / tempo`. |
| `src/progress.ts` | Maps engine fractions (0..1) to beta.1 `update(text, 0..100)`. Updates are monotonic, throttled, serialized and awaited, and an update failure never fails the render. |
| `src/errors.ts` | `IntegrationError` codes and `HostTimeoutError`. |
| `test/fake-port.ts` | The in-memory `LivePort` used by CI. It records every call and lets each test script host failures, hangs and drift. |

## Outcomes

`createOfflineProcess` returns `{ status, stage, reason, effects, ... }`. `effects` lists every host effect known to have happened, and nothing is undone automatically.

| status | Meaning | Can the Set have changed? |
|---|---|---|
| `completed` | Imported once; one new clip on AOPX RESULT; result geometry verified | Yes, as intended |
| `rejected` | Admission or render admission refused, or the selection drifted before any effect | No |
| `cancelled` | User cancel, editor closed, or an invalid editor result | No, unless `effects` lists the import (cancel after import) |
| `failed` | Engine failure, or a post-create verification failure | Only what `effects` lists |
| `unknown-outcome` | Import or create threw, timed out, or returned no usable receipt | **Possibly.** Check the Set before trying again |
| `busy` | Another invocation is running | No |

Import and create are each requested **at most once**, and **nothing is retried**. A timeout is not a cancellation, because the host call may still complete. The flow never deletes, moves or edits a clip.
