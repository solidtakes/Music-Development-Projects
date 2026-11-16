# T8 Live Extension adapter: draft architecture

**Status: draft for review, not implemented.** It was written during Codex's absence (Issue #40). Implementation
waits for spikes S1–S5 (`spikes/WINDOWS_SPIKE_CHECKLIST.md`) and an owner go-ahead. SDK names come from
`SDK_ARCHIVE_REVIEW_BETA_1.md`. Anything not confirmed there is listed under
[Unresolved SDK dependencies](#unresolved-sdk-dependencies).

## Goal and scope

One Live command, **Offline Process**, on an Arrangement AudioClip:
1. render the isolated clip pre-FX;
2. edit the Reverse/Gain history in the modal GUI;
3. render with the AOPX engine;
4. import the result as a **new clip on a new track**, leaving the original untouched.

Right-clicking the same audio again restores its history.

Out of scope: plugin hosting, post-FX rendering, range or multi-clip processing, new operations, and any
write to the original clip.

## Layers

```
ableton-offline-processing/
  engine/     WAV engine (Project, cache, graph)       — no SDK, no Webview knowledge
  host/       modal contract: build/inject state, parse result — no SDK
  editor/     interface.html (the modal GUI)            — no SDK, no Node
  extension/  (new, T8) created with the SDK's project generator on the owner's machine
    src/sdk/live-host.ts      the ONLY file that imports the Ableton SDK; implements LiveHost
    src/flow/offline-process.ts  the workflow, written against LiveHost (pure, testable)
    src/flow/modal-delivery.ts   data URL vs temp file (decided by S3)
    src/flow/errors.ts           error → user message mapping
    test/                        FakeHost tests; run on the existing Windows/Linux CI with no SDK
```

The SDK packages, the generated `node_modules` and any SDK binaries are **never committed**. CI tests the
flow against `FakeHost` only. The real `live-host.ts` is built and run on the owner's machine.

**Packaging note:** Node refuses to type-strip `.ts` files under `node_modules`. The extension should
therefore import `engine/` and `host/` **by relative source path** and let the SDK's build step bundle them,
or add a `tsc` emit step with `rewriteRelativeImportExtensions`. It must not depend on them as installed
packages. Which of these works depends on the SDK build tool (D11).

## The `LiveHost` port

This is a sketch. Every method maps to one SDK call, and the status column says how sure we are of it.

```ts
interface ClipInfo {
  handle: unknown;                 // opaque; only live-host.ts understands it
  name: string;
  startTime: number;               // units: beats? (D4)
  endTime: number;
  duration: number;
  warping: boolean;
  warpMode: unknown;               // passed back unchanged
  looping: boolean;
  loopStart: number;
  loopEnd: number;
  track: { handle: unknown; name: string };
}

interface LiveHost {
  resolveClip(handle: unknown): Promise<ClipInfo>;                       // S2
  isOnlyClipInRange(clip: ClipInfo): Promise<boolean | 'unknown'>;       // S2
  renderPreFx(clip: ClipInfo): Promise<string>;                          // S4: path in tempDirectory
  readonly storageDirectory: string;                                     // D7
  readonly tempDirectory: string;                                        // D7
  showModal(url: string, width: number, height: number): Promise<unknown>; // S3: raw, unclassified
  withinProgress<T>(title: string, fn: (p: { signal: AbortSignal; report(fraction: number, text?: string): void }) => Promise<T>): Promise<T>; // D6
  importIntoProject(path: string): Promise<string>;                      // S5
  withinTransaction<T>(fn: () => Promise<T>): Promise<T>;                // S5
  createTrackWithClip(clip: ClipInfo, importedPath: string): Promise<void>; // S5: createAudioTrack + createAudioClip
  notify(message: string): Promise<void>;                                // D10
  log(event: string, data?: unknown): void;                              // D12
}
```

| Method | SDK call (archive review) | Status |
|---|---|---|
| `resolveClip` | AudioClip context-menu command receives the clicked clip's handle, which resolves to an `AudioClip` | Handle → clip API and **parent-track API not named** (D3) |
| `renderPreFx` | `context.resources.renderPreFxAudio(track, startBeat, endBeat)`, written to temp | Units and return value to confirm (D5) |
| `showModal` | `context.ui.showModalDialog(url, width, height)`, string via `close_and_send` | URL schemes, Promise-ness and X-close result unknown (D1, D2) |
| `withinProgress` | `Ui.withinProgressDialog` | Signature and cancellation mechanism unknown (D6) |
| `importIntoProject` | `context.resources.importIntoProject(filePath)`, use the returned path | Documented |
| `withinTransaction` | `withinTransaction` groups changes into one undo step | Exact call site unknown (D8) |
| `createTrackWithClip` | `Song.createAudioTrack()` then `AudioTrack.createAudioClip({ filePath, startTime, duration, isWarped, loopSettings })` | Documented; `loopSettings` shape unknown (D9) |

## Workflow (`offline-process.ts`)

| # | Step | On failure or cancel |
|---|---|---|
| 1 | `resolveClip(handle)`. Refuse a MIDI clip or a clip without a track | message; stop |
| 2 | `isOnlyClipInRange`. If `false`: refuse. If `'unknown'`: warn that other material on the track is included | message; stop |
| 3 | `renderPreFx(clip)`, then a RIFF/WAVE check (as in `spikes/s4-wav-check.mts`). If it isn't WAVE, tell the user to set Record File Type to WAV | message; stop |
| 4 | `Project.open` or `create` at `<storageDirectory>/aopx/project`. Call `importSource(render)` to get the `fingerprint`. Branch = `clip:<fingerprint>` | message; stop |
| 5 | Build `HostInitialState` (`host/`): `source`, `computePeaks()` (300 bins), the saved `plan` or the default Reverse → Gain(−3), and `lastOutput()?.report ?? null` | — |
| 6 | Deliver the injected document by the S3-chosen method (below) and `showModal` it | — |
| 7 | `parseModalResult`. **Any `ModalResultError`, empty or `undefined` result, or rejection counts as cancel**, and the raw shape is logged with `classifyModalReturn` (#40 R2) | cancel: stop, no Set change |
| 8 | `setPlan(branch, fp, plan)`, then `withinProgress` → `render(branch, { signal, onProgress })`, then `save()` | `cancelled`/`superseded`: stop, no Set change. `failed`: message |
| 9 | `exportOutput(branch, <unique name>)`. Name it per import, e.g. `<outputKey16>-<timestamp>.wav`, so a previously imported copy that Live still holds is never overwritten (#40 risk 4) | message; stop |
| 10 | `importIntoProject(exported)`, then **inside one `withinTransaction`**: `createTrackWithClip(clip, importedPath)`, with the new clip named `<clip name> [AOPX]` | message. The transaction keeps the Set consistent |
| 11 | Result: reopen the modal with `diagnostics = report`, or notify with `wallMs`, the cache hits and the bytes | — |

**Invariants:**
- Nothing writes to the Set before step 10.
- The original clip is never written to.
- `collectGarbage()` is never called during a command (#40 L9).
- A `lastOutput().revision` that lags the branch revision does not mean "re-render" (#40 R4): always call `render` and let the cache decide.

### Modal delivery (`modal-delivery.ts`)

S3 decides this. The working assumption:
- If `toBase64DataUrl(html).length ≤ 1.5 MiB` **and** S3 shows data URLs work, use a data URL.
- Otherwise write `<tempDirectory>/aopx-modal-<uuid>.html`, pass `pathToFileURL(path).href`, and delete the file after the modal returns.
- If S3 shows only one route works, use that one route always.

Never pass an unencoded data URL (#40 R1). The S3 harness's `spikes/s3-modal/src/modal-transport.ts` is
the starting point.

### Progress and cancellation

`withinProgress` supplies an `AbortSignal`, or the live-host adapts the SDK's mechanism into one (D6). That
signal goes to `Project.render`. Progress reports map `RenderProgress.fraction`, and
`operationId` becomes the status text. `cancelled` renders publish nothing (engine invariant).

### Errors shown to the user

| Condition | Message (draft) |
|---|---|
| Not an audio clip, or no track | "Offline Process works on one audio clip in Arrangement." |
| Other clips overlap | "Move other clips off this track for now: the render would include them." |
| Render isn't WAV | "Set Live's Record File Type to WAV and try again." |
| `WavError` (unsupported format) | "This audio format isn't supported yet: <detail>." |
| `EBUSY`/`EPERM` on Windows (#40 T4 caveat) | "A file is in use by another program; try again." |
| Anything else | "Offline Process failed: <name>: <message>". Logged with the stack |

## Tests (FakeHost, no SDK, on the existing Windows/Linux CI)

1. Happy path: track and clip created once, at the original start and duration. The original is untouched.
2. The second invocation on the same audio restores the plan, and the re-render is all cache hits.
3. Each close shape (`''`, `undefined`, a rejection, malformed JSON, the wrong envelope version) is treated as cancel, and the FakeHost records **zero** Set writes.
4. Cancel during render publishes nothing and writes nothing.
5. A render that isn't WAV gives the right message and writes nothing.
6. Export names are unique per import.
7. Large state switches to temp-file delivery, and the temp file is deleted afterwards.
8. All Set writes happen inside `withinTransaction`.

## Unresolved SDK dependencies

| ID | Dependency | Needed for | Known from the archive review | Resolved by |
|---|---|---|---|---|
| D1 | URL schemes `showModalDialog` accepts (data:, file:, bundled asset), size limits, CSP | modal delivery | signature `(url, width, height)` | **S3** |
| D2 | `showModalDialog` return type (Promise?) and **result on X-close / Esc** | step 7 | "returns a string when the page posts `close_and_send`" | **S3** |
| D3 | API to resolve a context-menu handle to an `AudioClip` and to its **parent track** | step 1 | the command receives the clicked clip's handle | **S2** |
| D4 | Units of `startTime`/`endTime`/`duration` (beats vs seconds) and tempo access | steps 3, 10 | read-only fields listed | **S2** |
| D5 | `renderPreFxAudio` argument units, return value, and behaviour with overlaps, take lanes, fades and automation | step 3 | track/range based, pre-FX, written to temp, format follows Record File Type | **S4** |
| D6 | `withinProgressDialog` signature, progress API and cancellation mechanism | step 8 | "cancellable progress" | S1 (bundled `progress-dialog` example) |
| D7 | Exact `context.environment.storageDirectory` / `tempDirectory` names, and when temp is cleaned | step 4 | names listed in the filesystem guide | S1 / S3 |
| D8 | `withinTransaction` call form and undo grouping in practice | step 10 | groups Set changes into one undo step | **S5** |
| D9 | `createAudioClip` `loopSettings` shape; which warp settings survive | step 10 | options listed | **S5** |
| D10 | Any non-modal notification API for errors (else reuse the modal) | errors | not documented in the review | S1 docs |
| D11 | Project generator, build tool and load mechanism on Windows (dev-mode folder vs package); how relative `.ts` sources are bundled | packaging | the archive contains a CLI and a generator | **S1** |
| D12 | Where `console` output and logs go on Windows; webview dev tools | debugging | not in the review | S1 |
| D13 | Whether `window.chrome.webview` is present for each delivery route, and the message object it requires | GUI bridge | GUI implements both bridge variants | **S3** |
| D14 | Modal size: CSS px vs physical px at scaling > 100 %; resizable? | GUI layout | editor README uses 860 × 660 | **S3** |
| D15 | The exact Live Suite Beta build paired with SDK beta.1 on Windows | everything | Live 12.4 Beta referenced; 12.4.25b1 seen once; FAQ minimum 12.4.5 | **S1** |

## Implementation order (after S1–S5 and approval)

1. Write `live-host.ts` against the confirmed APIs, and adjust the port where S1–S5 disagree with this draft.
2. Add `modal-delivery.ts` with the S3 decision, plus tests.
3. Add `offline-process.ts` with the FakeHost tests listed above, running in CI.
4. Owner build on Windows, then the T9 checklist on a disposable Set.
