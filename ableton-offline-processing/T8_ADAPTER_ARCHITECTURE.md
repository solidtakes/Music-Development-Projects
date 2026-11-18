# T8 Live Extension adapter: draft architecture and unresolved SDK dependencies

**Status:** DRAFT design, 2026-11-16. **Not implemented and not approved for implementation.**
**S5 correction (2026-11-18):** the [beta.1 evidence and readiness memo](spikes/s5-design/README.md)
supersedes the transaction/rollback and exact warp/loop restoration assumptions below.
Transactions are synchronous Undo groups; dependent new-track/clip creation is not verified as
one step, and rollback on failure is not documented. No S5 trial or mutating adapter is approved.
Base: canonical `9ebcf56` (PR #50). Builds on the plan in the PR #41 integration review and the
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

```ts
interface LiveHost {
  resolveClip(handle: unknown): Promise<ClipInfo>;            // S2
  renderPreFx(track: TrackRef, startBeat: number, endBeat: number): Promise<string>; // S4: path in temp
  showModal(url: string, width: number, height: number): Promise<unknown>;          // S3: raw value
  withinProgress<T>(title: string, fn: (p: Progress) => Promise<T>): Promise<T>;    // cancellable
  importIntoProject(path: string): Promise<string>;           // S5: returns the path to use
  withinTransaction<T>(fn: () => T): T;                      // synchronous grouping only; S5 unresolved
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
9. **BLOCKED / design only:** after a future authorized unique export and host import, creating
   a new track and its dependent clip requires sequential requests/Undo groups under the
   documented beta.1 pattern. Use only the returned imported path. Do not assume automatic
   rollback or exact warp/loop reproduction; see the S5 memo for the restricted first proposal.
10. Show the result modal with the real `RenderReport` (`wallMs`, cache hits, bytes).

**Proposed invariant:** the original clip is only read. Before any host import/create request,
no new Set objects are requested; after a host request, failures may leave partial effects.
No atomic rollback guarantee exists. The S5 memo defines reconciliation and discard/reopen recovery.

## 5. Error handling

| Failure | Behaviour |
|---|---|
| Not an audio clip / overlapping clips | Message, no change |
| Render not WAV | Message: set Record File Type to WAV, no change |
| Engine error / cancelled render | Message or silent cancel, no change; the cache stays consistent |
| Modal closed / Esc / invalid result | Treated as cancel, logged, no change |
| `EBUSY` / `EPERM` on Windows | Surfaced, not retried (T4 caveat); export names are unique so re-runs don't collide |
| Import / create fails | Stop; preserve receipts and report possible partial effects. No verified transaction abort/rollback. |
| `collectGarbage()` | **Never called** from the adapter during Alpha 0.1 (L9) |

## 6. Tests (CI, no SDK)

- The whole flow against `FakeHost`: the happy path, cancel at every step, invalid modal returns,
  render-not-WAV, and import failure. The S5 safety model retains partial effects; a fake must not
  manufacture proof of actual host rollback.
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
| D1 | SDK beta.1 ↔ Live beta pairing on Windows; build and load commands | It loads | Archive (example path is macOS) | S1 |
| D2 | Extension registration / activation shape and the context object | `context.ui`, `context.environment`, `context.resources` | Archive | S1 |
| D3 | AudioClip context-menu registration and handle resolution | The handle resolves to an AudioClip | Archive | S2 |
| D4 | Parent track resolution from a clip; overlap detection | Possible; overlap may be unknown | Not documented | S2 |
| D5 | Clip timing units and warp/loop fields | Beats; fields as listed in the archive | Archive | S2 |
| D6 | `renderPreFxAudio(track, startBeat, endBeat)`: isolation, format, frame count | WAV in temp, one clip only | Archive (+ `strip-silence` example) | S4 |
| D7 | `showModalDialog(url, w, h)`: accepted URL schemes, size limits | `file://` in temp works | Archive; the URL rules are not documented | **S3** Q1–Q4 |
| D8 | Bridge and message shape (`chrome.webview.postMessage({method:'close_and_send', params:[string]})`) | As the GUI sends today | `interface.html`; not re-verified | **S3** Q5 |
| D9 | Modal return on cancel, X, Esc, `window.close()`; non-string or repeated sends | Unknown; T8 treats it as cancel | Not documented | **S3** Q6–Q7 |
| D10 | Engine packaging inside the SDK build (TS emit or bundling) | Either works | Not documented | S1 |
| D11 | Modal width/height units and DPI scaling | CSS pixels | Not documented | **S3** Q8 |
| D12 | `withinProgressDialog`: progress units, abort signal | Cancellable, with a signal | Archive | S4 (or a small add-on to S1) |
| D13 | `importIntoProject(path)` return value and file ownership afterwards | Returns the path to use | Archive | S5 |
| D14 | `createAudioTrack` / `createAudioClip({filePath,startTime,duration,isWarped,loopSettings})` placement and settings | Placement exact; warp/loop partly restored | Archive | S5 |
| D15 | `withinTransaction`: synchronous Undo grouping; dependent async creation needs sequential groups | No verified rollback | Beta.1 types/source/guide, see S5 memo | Gated future S5 trial |
| D16 | Where extension logs appear on Windows | Somewhere visible | Not documented here | S1 |
| D17 | Record File Type detection (only after the render?) | Check the header after rendering | `strip-silence` per archive | S4 |
| D18 | Filesystem sandbox: are `storageDirectory`/`tempDirectory` the only writable roots, and can the WebView2 page read a `file://` in temp? | Yes / yes | Archive (filesystem guide) + not documented for the webview | S1 + **S3** Q1 |
| D19 | Live-bundled Node version inside the Extension host | 24.22.1 (AOPX-01 note) | Earlier AOPX-01 finding, unconfirmed on this machine | S1 |

## 8. Implementation gate

T8 implementation starts only after: S1–S5 are reported on Issue #40, the S3 delivery method is
chosen, this document is updated with the results, and the owner approves. It then lands as its
own draft PR from canonical.
