# T8 Live Extension adapter: draft architecture and unresolved SDK dependencies

**Status:** DRAFT design, 2026-11-16. **Not implemented and not approved for implementation.**
Base: canonical `a57d5aa` (PR #51 merge). Updated with the owner's Windows Live 13 Beta
[S1–S5 host-validation report](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6908336792): basic passes of the official SDK examples. See §7. Builds on the plan in the PR #41 integration review and the
PR #50 review findings R1–R7 (Issue #40). The spikes in [`spikes/`](spikes/README.md) settle the
open items below; this document is revised after they are reported.

## 1. Goals and non-goals

**Goal:** right-click one AudioClip → **Offline Process** → edit the Reverse/Gain chain in the
modal → the processed result appears on a new track. The original clip is never modified, and
right-clicking the same audio again restores its saved history.

**Non-goals for Alpha 0.1:** plugin hosting, post-FX rendering, ranges or multiple clips, new
operations, a persistent (non-modal) editor, and background processing.

## 2. Package layout

New package `ableton-offline-processing/extension/`, scaffolded with the SDK's own
create-extension tool. Only our sources and a lockfile are committed: no SDK tarball contents.

```
extension/
  src/
    host/live.ts        the ONLY file that imports the Ableton SDK; implements LiveHost
    host/port.ts        LiveHost interface (SDK-free)
    flow.ts             the Offline Process workflow, written against LiveHost only
    modal-delivery.ts   ports spikes/s3-modal/delivery.mjs (method chosen by S3)
    branch-key.ts       clip:<fingerprint> branch naming
    errors.ts           error → user message + "Set unchanged" guarantee
  test/
    fake-host.ts        in-memory LiveHost for CI (records every call)
    flow.test.ts        the whole flow against FakeHost, on Windows and Linux CI
    modal-delivery.test.ts
```

Dependencies point one way: `flow → port ← live`; `flow → host/src/modal.ts` (parse/inject);
`flow → engine/src/project.ts`. The engine and `host/` never import the SDK.

**Engine packaging (unresolved, see D10):** bundle the engine from source with the SDK build, or
add a `tsc` emit step (`rewriteRelativeImportExtensions`). Do not put the engine's `.ts` under
`node_modules`, because Node refuses to type-strip there.

## 3. The `LiveHost` port

Every SDK interaction goes through this narrow interface, so the flow is testable without Live.
The port's method names are **our own**. `live.ts` maps them onto the real SDK calls.

**SDK names observed on the Windows Live 13 Beta host** (official examples, basic passes):

| Port need | Host-observed SDK name | Still unconfirmed |
|---|---|---|
| handle → object | `getObjectFromHandle` (a Session `ClipSlot` handle) | an AudioClip handle from an Arrangement context menu; its receiver object, which the report doesn't name |
| selected track | Arrangement selection `selected_lanes[0]` → `AudioTrack` | multiple lanes; non-audio lanes |
| range | `time_selection_start` / `time_selection_end` (the selection object) | their units (beats?) |
| pre-FX render | `context.resources.renderPreFxAudio(track, selection.time_selection_start, selection.time_selection_end)` | cancellation; temp-file lifecycle; WAV vs AIFF |
| import and create | `audio-clips` example: WAV imported into Session and Arrangement | exact call names and the `loopSettings` shape (VERIFY); multi-step transactions |

Because the proven path is the **Arrangement time selection plus a selected audio track**, the port
takes a time range, not a clip-derived beat range. `resolveClip` stays for the later AudioClip
context-menu entry point, which hasn't been tested on the host yet (D3/D4).

```ts
interface LiveHost {
  resolveClip(handle: unknown): Promise<ClipInfo>;            // S2
  renderPreFx(track: TrackRef, start: number, end: number): Promise<string>; // S4: path in temp; Live's time_selection_start/end values, units unconfirmed
  showModal(url: string, width: number, height: number): Promise<unknown>;          // S3: raw value
  withinProgress<T>(title: string, fn: (p: Progress) => Promise<T>): Promise<T>;    // cancellable
  importIntoProject(path: string): Promise<string>;           // S5: returns the path to use
  withinTransaction<T>(fn: () => Promise<T>): Promise<T>;     // S5: one undo step
  createTrackAndClip(spec: ResultClipSpec): Promise<void>;    // S5, called inside the transaction
  readonly storageDirectory: string;                           // persistent: Project + cache
  readonly tempDirectory: string;                              // renders, modal documents, exports
  log(line: string): void;
}
interface ClipInfo { name: string; track: TrackRef; startBeat: number; endBeat: number;
  durationBeats: number; warping: boolean; warpMode: string | null; looping: boolean;
  loop: { start: number; end: number } | null; overlapsOtherClips: boolean | 'unknown' }
```

## 4. Flow

1. `resolveClip(handle)`. Preflight: the clip must be alone on its track over its range (warn if
   the API can't tell, S2). Refuse anything that is not an audio clip.
2. `renderPreFx(track, start, end)`. Check the RIFF/WAVE header; on AIFF tell the user to set
   Record File Type to WAV (S4).
3. Open the `Project` in `storageDirectory`; `importSource(render)` gives the fingerprint.
   **Branch key `clip:<fingerprint>`**, so the same audio restores its saved history.
4. Build `HostInitialState` with `buildHostInitialState` (`host/src/modal.ts`): source, peaks from
   `computePeaks()`, the saved plan or the Reverse → Gain(−3 dB) default, and the last diagnostics.
5. `injectInitialState(interface.html, state)`, then deliver it with the method S3 proves
   (`modal-delivery.ts`):
   - **Preferred:** a new uniquely named file in `tempDirectory`, opened via `pathToFileURL()`.
   - **Data URLs only if S3 accepts them**, always base64-encoded (finding R1), with a size guard
     that falls back to the file if the URL would exceed the limit S3 measures. In Chromium the
     ceiling is about 2 MB of URL text.
6. `showModal(url, 860, 660)`. The width and height units depend on S3 Q8.
7. Classify the raw return (spike `classifyModalReturn`), then `parseModalResult`. **Anything
   that is not a valid `process` result is a cancel**: close button, Esc, an empty or undefined
   value, invalid JSON or a validation error. Log the reason and stop with the Set unchanged
   (finding R2).
8. `setPlan`, then `render` inside `withinProgress` (forwarding progress and the abort signal),
   then `save()`. An unchanged Apply that leaves the head unchanged is not treated as "needs
   render" (finding R4).
9. If the render completed: `exportOutput` to a **unique** temp name per import (risk 4: Windows
   locks on a re-exported file name), then `importIntoProject`, then **inside one
   `withinTransaction`**: `createTrackAndClip` at the original start and duration with the
   original warp and loop settings, named `<clip> [AOPX]`.
10. Show the result modal with the real `RenderReport` (`wallMs`, cache hits, bytes).

**Invariant:** every failure before step 9 leaves the Set unchanged. Step 9 is a single
transaction, so a failure inside it is undone as one unit (to be confirmed in S5). The original
clip is only ever read.

## 5. Error handling

| Failure | Behaviour |
|---|---|
| Not an audio clip / overlapping clips | Message, no change |
| Render not WAV | Message: set Record File Type to WAV, no change |
| Engine error / cancelled render | Message or silent cancel, no change; the cache stays consistent |
| Modal closed / Esc / invalid result | Treated as cancel, logged, no change |
| `EBUSY` / `EPERM` on Windows | Surfaced, not retried (T4 caveat); export names are unique so re-runs don't collide |
| Import / create fails | The transaction is aborted; report what Live says |
| `collectGarbage()` | **Never called** from the adapter during Alpha 0.1 (L9) |

## 6. Tests (CI, no SDK)

- The whole flow against `FakeHost`: the happy path, cancel at every step, invalid modal returns,
  render-not-WAV, and import failure (the transaction must roll back in the fake).
- Original → Reverse → Gain → remove Reverse → re-render: the Gain step hits the cache and the
  output equals Gain applied directly to the original.
- Restore history on a second invocation with the same fingerprint.
- Modal delivery: base64 vs file, the size-guard fallback, Windows-style paths through
  `pathToFileURL`, unique export names.
- Structural comparison of plans, not JSON strings (finding R6).
- The engine → GUI → parser round trip (missing test from the PR #50 review).

## 7. Unresolved SDK dependencies

Each item names the spike that resolves it. **"Archive"** means the claim comes from
`SDK_ARCHIVE_REVIEW_BETA_1.md` (Codex's reading of the local archive), not re-verified here.

| # | Dependency | What T8 assumes | Source today | Resolved by |
|---|---|---|---|---|
| D1 | SDK beta.1 ↔ Live beta pairing on Windows; build and load commands | It loads | **Host: basic PASS.** Live 13 Beta; `npm install`, `npm run build`, `npm start -- --live "<path to Live>"`; `✓ Connected to Live` | S1 ✅ |
| D2 | Extension registration / activation shape and the context object | `context.ui`, `context.environment`, `context.resources` | Archive | S1 |
| D3 | AudioClip context-menu registration and handle resolution | The handle resolves to an AudioClip | **Host:** `getObjectFromHandle` resolved a Session `ClipSlot` handle. The AudioClip context-menu path is **untested** | S2 (open) |
| D4 | Parent track resolution from a clip; overlap detection | Possible; overlap may be unknown | Not documented | S2 |
| D5 | Clip timing units and warp/loop fields | Live's time values passed through unchanged | **Host:** `time_selection_start`/`_end` used directly for render and clip creation. Units unconfirmed | S2 (open) |
| D6 | `renderPreFxAudio(track, start, end)`: isolation, format, frame count | WAV in temp, one clip only | **Host: basic PASS** (`strip-silence`): a WAV was read and decoded; the original clip was unchanged. **Pre-FX only** (no post-FX API). **The AOPX engine decoding a real render is a gate** (`spikes/s4-wav-check.mts`) | S4 (gate) |
| D7 | `showModalDialog(url, w, h)`: accepted URL schemes, size limits | `file://` in temp works | Archive; the URL rules are not documented | **S3** Q1–Q4 |
| D8 | Bridge and message shape (`chrome.webview.postMessage({method:'close_and_send', params:[string]})`) | As the GUI sends today | `interface.html`; not re-verified | **S3** Q5 |
| D9 | Modal return on cancel, X, Esc, `window.close()`; non-string or repeated sends | T8 treats any non-result as cancel | **Host (official example):** on Cancel, Esc and X the result's `name` is not a string, which is consistent with the T8 rule. The exact raw values are unrecorded | **S3** Q6–Q7 |
| D10 | Engine packaging inside the SDK build (TS emit or bundling) | Bundled from source | **Host:** `npm run build` bundles (`dist/extension.js`, 4.4 MB for `strip-silence`). Whether it accepts the engine's `.ts`-suffixed relative imports is unverified | first T8 build |
| D11 | Modal width/height units and DPI scaling | CSS pixels | Not documented | **S3** Q8 |
| D12 | `withinProgressDialog`: progress units, abort signal | Cancellable, with a signal | Archive | S4 (or a small add-on to S1) |
| D13 | `importIntoProject(path)` return value and file ownership afterwards | Returns the path to use | Archive. **Host:** `audio-clips` imported a WAV (basic). Whether import copies the file (needed for temp cleanup) is untested | S5 (open) |
| D14 | `createAudioTrack` / `createAudioClip({filePath,startTime,duration,isWarped,loopSettings})` placement and settings | Placement exact; **no `loopSettings` on the unwarped path** | Archive. **Host:** an Arrangement clip was created; hard-coded `loopSettings` made a short unwarped Session clip inaudible. The warped path is untested | S5 (open) |
| D15 | `withinTransaction`: one undo step, rollback on a thrown error | Atomic | **Host:** single-step Ctrl+Z / Ctrl+Y work on Windows. Multi-step grouping and rollback are untested | S5 (open) |
| D16 | Where extension logs appear on Windows | In the CLI session | **Host:** `console` output appears in the `npm start` CLI session | S1 ✅ |
| D17 | Record File Type detection (only after the render?) | Check the header after rendering | `strip-silence` per archive | S4 |
| D18 | Filesystem sandbox: are `storageDirectory`/`tempDirectory` the only writable roots, and can the WebView2 page read a `file://` in temp? | Yes / yes | Archive (filesystem guide) + not documented for the webview | S1 + **S3** Q1 |
| D19 | Node version the extension actually runs in | Unknown | **Host:** the SDK examples ran with dev Node **26.13.0** / npm 11.20.0. With `npm start -- --live`, the extension probably runs in the CLI's Node (unconfirmed). **AOPX engine and host code are verified only on Node 22.23.4 and 24.22.1, not Node 26** | log `process.version` inside the extension |

## 8. Implementation gate

Basic S1–S5 passes of the official examples are reported on Issue #40. T8 implementation still
starts only after:
- **the S3 delivery gate:** the AOPX GUI opens in Live's modal, using the method the S3 runner proves;
- **the S4 engine gate:** `spikes/s4-wav-check.mts` decodes a copy of a real Live render;
- the owner approves.

The other open items (D3/D4, D5, D12, D13, D14, D15, D19) are gated inside the first T8 builds. It then lands as its
own draft PR from canonical.
