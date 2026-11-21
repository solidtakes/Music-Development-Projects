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

`createOfflineProcess` returns `{ status, setChanged, stage, reason, effects, pending, ... }`. `effects` lists every host effect known to have happened, and nothing is undone automatically.

| status | Meaning | `setChanged` |
|---|---|---|
| `completed` | Imported once; one new clip on AOPX RESULT; content and geometry verified | `yes` |
| `partial` | Stopped after at least one **known** effect (for example a cancel or drift after the import, a mismatched import, or a misplaced clip). `effects` lists what happened | `yes` |
| `rejected` / `cancelled` / `failed` | Stopped **before any effect was requested** | `no` |
| `unknown-outcome` | An effect was requested and Live gave no valid answer (throw, timeout or unusable receipt). **Check the Set** | `unknown` |
| `reconciliation-required` | An earlier invocation's effects are not all known (durable journal). Nothing was done, not even a Live read | `no` |
| `busy` | Another invocation is running in this process | `no` |

Import and create are each requested **at most once**, and **nothing is retried**.
- A timeout is not a cancellation: the host call may still complete.
- Before each request, an intent record is written durably to `storageDirectory/aopx-journal/`. A record is closed only when every effect it describes is known. Until then, every invocation returns `reconciliation-required` (also after a restart), until the adapter calls `acknowledgeReconciliation(storageDirectory, invocation)` once the user has checked the Set.
- The flow never deletes, moves or edits a clip.

## Admission and memory

- **Render read:** the render is read **once**, through one descriptor with a size cap and identity, growth and shrink checks (`src/bounded-read.ts`).
- **Container check:** the WAV is validated strictly (`src/wav-container.ts`), and the verified bytes are passed to the engine (`Project.importSourceBytes`).
- **Memory budget:** peak memory is estimated as `3 × file bytes + 24 × samples` and must fit `maxWorkingSetBytes` (2 GiB by default). Only one invocation runs per process.
