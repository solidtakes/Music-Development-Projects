# External SDK boilerplate — GUI/review lane findings (Claude), 2026-11-20

**Assignment:** Issue #40 comment 7041021615 (Claude lane, items 1–5). Ack: comment 7041165279.
**Status:** Research and offline checks only. Nothing was run in Live. No dependencies were installed, no SDK archive was extracted, no Codex-owned file was edited, and nothing was merged.
**Base:** canonical `ableton-offline-processing/alpha-0.1` @ `a57d5aa`. Integration artifacts reviewed: T8 design at `a57d5aa`, PR #75 head `0f069db`, PR #78 head `8c6cfea`.

## 0. Sources inspected

| Repository | Commit | Licence | SDK it targets |
|---|---|---|---|
| `onsurbex/clean-silence-extension` | `9553d62a793139c245ed2feb643379d96b4857a3` (2026-06-08) | **No LICENSE file**, so all rights are reserved by default | 1.0.0-**beta.0** (`package.json` deps) |
| `adamjmurray/ableton-extensions-experiments` | `6bf664f2edeb3f78db280f78552560d9206b45f3` (2026-06-24) | MIT © 2026 Adam Murray (root `LICENSE`, and `notation-extension/LICENSE` + `THIRD_PARTY_NOTICES.md`) | 1.0.0-**beta.0** (`AGENTS.md:6`) |
| `aker-dev/ableton-extension-skill` (cross-reference only; this repo is in Codex's scope) | `250c4b4b1d5c6bf10fe86dce3fda4af522cef95e` | MIT © 2026 AKER | 1.0.0-**beta.0** (`CHANGELOG.md:23`) |

**beta.1 declaration status.** The beta.1 `index.d.mts` is not in this container, and it must not be redistributed. Every SDK API behaviour below comes from beta.0 community code and docs, the in-repo `SDK_ARCHIVE_REVIEW_BETA_1.md`, and PR #78's handwritten `ci/sdk-stub.d.mts`. All of it is therefore **UNVERIFIED against beta.1**. §5 lists the exact declarations Codex should check.

**Licence/redistribution flag.** `clean-silence-extension/vendor/` commits `ableton-extensions-sdk-1.0.0-beta.0.tgz` (54,121 B) and `ableton-extensions-cli-1.0.0-beta.0.tgz` (13,326 B). The adamjmurray README states that Ableton's licence forbids redistributing the SDK. Those tarballs were **not extracted, installed or referenced**. Neither they nor clean-silence's code should be used. Only concepts are taken from that repository.

## 1. Review of the integration approach (item 4)

Codex's boilerplate report was not yet on #40 at the time of this review (last comment: 7041021615). This section reviews the integration design as it currently stands: T8 plus PR #78. It will be redone when Codex posts.

### H1 — HIGH (design): T8 assumes one atomic transaction for creating a track and then a clip. The external evidence says that is not possible.
- **T8** `T8_ADAPTER_ARCHITECTURE.md` §3 declares `withinTransaction<T>(fn: () => Promise<T>)`. §4 step 9 does "**inside one `withinTransaction`**: `createTrackAndClip`". The invariant line then says a failure inside it "is undone as one unit". D15 already notes that rollback is "not documented".
- **Evidence (beta.0):**
  - `ableton-extension-skill/.../references/concepts.md:141–159` says the callback "is synchronous — no `await` inside" and "**Create then modify = two transactions**", because the new object only resolves after the async create settles.
  - `mutate-extension/src/apply-arrangement.ts:29–41` uses separate transactions: Phase 1 creates take lanes, Phase 2 creates clips on them.
  - No source documents rollback when an error is thrown. `withinTransaction` groups undo steps; it does not roll back.
- **Impact:** `Song.createAudioTrack()` followed by `track.createAudioClip()` gives at least two undo steps. If the clip creation fails, an empty result track is left in the Set. The "every failure leaves the Set unchanged / atomic" claim does not hold for step 9.
- **PR #78 already avoids this.** `spikes/s5-t1/src/live-port.ts` needs a unique, pre-existing user-made `AOPX RESULT` track and makes one `createAudioClip` call, with no track creation and no transaction. **Endorse this for Alpha 0.1.**
- **Remediation:**
  1. Amend T8 §3/§4/§5 so that the port's `withinTransaction` callback is synchronous and returns a promise.
  2. Keep the "user-provided empty result track" model for Alpha 0.1.
  3. If track creation comes back later, use two phases with explicit compensation: delete the created track on failure, only if beta.1 exposes a delete. Report the honest state ("Set may contain an empty AOPX track").
  4. Verify the signature in beta.1 `index.d.mts`.

### M1 — MEDIUM: progress units and the `update` contract do not match
- The engine reports `RenderProgress.fraction` in 0..1 (`engine/src/project.ts:414–415`).
- `withinProgressDialog`'s `update(text, progress?)` takes **0–100** and returns `Promise<void>` (`ableton-extension-skill/.../references/api.md:75–87`). clean-silence passes 10…100 and ignores the promise (`src/extension.ts:219–221, 372`).
- **Remediation:** in the adapter, map `fraction × 100`, throttle (for example ≥1 point or ≥100 ms), and catch rejections from `update`. Add a FakeHost test that checks monotonic 0→100. Unverified against beta.1.

### M2 — MEDIUM: cancel cannot interrupt host calls
- `renderPreFxAudio`, `importIntoProject` and `createAudioClip` take no `AbortSignal` (aker `api.md:98–102, 155–163`; PR #78 stub). clean-silence only checks `abortSignal.aborted` between steps (`src/extension.ts:233, 243, 315`).
- Our engine is already correct here: it checks the signal per block (`engine/src/dsp.ts:27–34`).
- **Remediation:** after each host call returns, re-check the signal and throw away the result. Once `importIntoProject` has been *requested*, a cancel can no longer be reported as "cancelled, Set unchanged", because the project-folder copy is not undoable. PR #78 `flow.ts` already maps this to `unknown-outcome` (`requested` flag): **endorse**. The T8 §5 row "cancelled render: no change" holds only before import.

### M3 — MEDIUM: environment directories may be `undefined` or missing
- aker `api.md:89–97`: `storageDirectory`/`tempDirectory` may be `undefined`, and `extensions-cli run` does not create them.
- T8 §3 declares `readonly tempDirectory: string`. PR #78 already handles `undefined` (`src/files.ts:8`, `ownedRoot(root: string | undefined)`).
- **Remediation:** align the T8 port types with PR #78, and run `mkdir -p` before writing.

### M4 — MEDIUM: modal delivery on Windows
- adamjmurray moved Notation's dialog from `data:` URLs to a real file in `tempDirectory` loaded via `pathToFileURL()`, described as "a Windows fix" (`AGENTS.md:146–150`; `notation-extension/src/dialog.ts:165–176, 204`). Their note also mentions a removed shell-`open` path, so the `data:` URL itself is not proven to be the cause.
- PR #78 `confirm` uses `data:text/html;base64,…` (`live-port.ts`). T8 §4.5 already prefers `file://`.
- **Remediation:** before T1 relies on base64 `data:` on Windows WebView2, have the S3 result (Q1–Q4) cover it. Keep the `file://` fallback ready. Low cost, and it removes a Windows-only unknown.

### L1 — LOW: never minify the dialog UI
- `mutate-extension/esbuild.js:9–12`: a minified UI made Notation's `showModalDialog` resolve with an empty string. Our `editor/interface.html` is hand-written and not minified.
- **Remediation:** keep any future T8 bundling step from minifying it, and add a note in D10.

### L2 — LOW: BigInt values from the SDK
- `AGENTS.md:183`: SDK properties may return BigInt. Handle ids are `bigint`, which PR #78 checks.
- `JSON.stringify` throws on BigInt. `host/src/modal.ts:116–123` (`serializeInitialState`) would therefore throw if any SDK-sourced number reached `buildHostInitialState` uncoerced.
- **Remediation:** coerce with `Number()`/`String()` in the adapter, and add one FakeHost test.

## 2. Reusable GUI patterns (items 1–3)

### Waveform preview and Apply/Cancel (clean-silence; concepts only)
- **Pattern:** the host computes about 2,000 peaks, injects them before the page script runs, and the page redraws the preview live on slider `input` (`src/extension.ts:151–175`; `ui/interface.html:297–309, 557–573`). Apply posts params as JSON and disables the button (`ui/interface.html:592–618`). We already have stronger equivalents: script-safe injection (`host/src/modal.ts:116–138`) and a versioned envelope (`host/src/modal.ts:73–94`).
- **Lesson from its defect: the preview must use the same algorithm as Apply.**
  - The preview uses per-bucket **peak** values (`ui/interface.html:498–505`, fed by `src/extension.ts:151–163`). Apply uses per-2,048-sample **RMS** (`src/extension.ts:47–64`).
  - **Offline check:** an independent re-statement of both computations was run (Node 22.23.5; script in session scratchpad, not committed) on a 4 s, 440 Hz sine at −35 dBFS peak (−38 dBFS RMS) with a −37 dB threshold. Preview: **0/2000** buckets silent. Apply: **94/94** windows silent. The preview shows "keep everything" while Apply would delete the whole clip.
  - Two related checks: with integer `floor(frames/2000)` bucketing, the last `frames mod 2000` frames never appear (1,999 frames dropped for 145,999 frames), and clips shorter than 2,000 frames get `samplesPerBucket = 0`, so the preview is flat.
  - Our `computePeaks` (`engine/src/dsp.ts:78–97`) uses proportional bins, so neither issue affects us.
- **Other clean-silence patterns to avoid:**
  - It renders twice (`src/extension.ts:136` and `226`).
  - It is destructive: `clearClipsInRange` runs on the source track (`:367`).
  - It converts seconds to beats with a constant tempo (`:321–322, 359–360`).
  - It does not await the promises from its transaction (`:355–369`); aker `concepts.md:364–368` corrects this.
  - It types the context as `any` (`:209`).
  - Cancel is a bare string sentinel (`:181`).

### UI, packaging and lifecycle (adamjmurray, MIT)
- **Typed bridge:** a discriminated `apply | close` union, with a fallback payload if parsing fails (`mutate-extension/src/ui/bridge.ts:7–19, 106–122`). Ours already matches this; nothing to port.
- **Non-destructive writes:** results go to new take lanes and the originals are untouched (`README.md` Mutate section; `apply-arrangement.ts:29–52`). This matches our "new clip, original only read" rule.
- **Dialog re-show loop:** after an action, the same dialog re-opens with the last UI state (`notation-extension/src/dialog.ts:177–240`, `lastUiState`). Our `HostInitialState.diagnostics` already supports this. Recommendation **R2**: re-open the editor with the measured `RenderReport` instead of building a separate result modal. One HTML file, one tested path.
- **Packaging:**
  - `.ablx` is a zip of `manifest.json` plus the compiled CJS entry. Do not include `node_modules/` or a lockfile. `extensions-cli package` does not build first (`AGENTS.md:71, 90`).
  - Production builds use inline sourcemaps so the single `.cjs` file is self-contained (`mutate-extension/esbuild.js:55–58`).
  - This is relevant to Codex's D10 (engine packaging).
- **Tests:** beta.0 dropped `@ableton-extensions/sdk/testing`, so there is no host mock (`AGENTS.md:94–99`). This confirms the T8 FakeHost approach.

## 3. Findings on our floating editor (`editor/interface.html` @ `a57d5aa`)

### M5 — MEDIUM (verified by reading): synthetic waveform shown as if it were real
- When the host injects state with `waveform: []`, `state.preview` is `false` (`:259–260`). The PREVIEW DATA flag is then hidden and the label reads EDITOR (`:287–288`), but `renderWaveform` still draws a made-up sine-like shape (`:295–296`).
- This breaks the #40 rule "mock data must be labelled as mock".
- **Proposed fix:** if `!state.preview && peaks.length === 0`, draw only the centre line and set the caption to "NO WAVEFORM DATA". Add a browser test that injects real-host state with empty peaks.

### L3 — LOW: waveform downsampling drops transients
- `:294–295` picks one bin per column (`peaks[floor(i*n/180)]`). When there are more than 180 peaks, transients between the sampled bins vanish.
- **Proposed fix:** take the max of `|min|,|max|` over `[floor(i*n/180), floor((i+1)*n/180))`.

### L4 — LOW: no dialog-level Esc / Enter
- Esc is only handled during a drag (`:392`). The aker template binds Enter to submit and Escape to cancel (`assets/templates/interface.html:31–33`).
- T8 already treats any unknown close as a cancel, so this is safe today. An explicit Esc → `{envelopeVersion:1, action:"cancel"}` still gives a deterministic return for S3 Q6.
- Enter → Apply should be ignored while a drag is active or focus is in a text or number input.

### R1 — RECOMMENDATION: processed-waveform preview, derived from the plan
- Reverse can be previewed by mirroring the `min/max` bins. This is exact when the bins divide the frames evenly, and approximate at bin edges otherwise.
- Gain can be previewed by scaling with `10^(dB/20)`, with a clip indicator wherever `|v|·g > 1`.
- Put the logic in the shared `aopx-plan-core` script, label it "PEAK PREVIEW", and never present it as a render result.
- PR #78's order is the right model and is endorsed: render → process → confirm, with the confirmation showing the real output hash and frame count.

## 4. Proposed changes (not applied; need owner approval and file-ownership clearance)

| # | File (owner) | Change | Test |
|---|---|---|---|
| P1 | `T8_ADAPTER_ARCHITECTURE.md` (integration) | H1, M2, M3: synchronous transaction callback, no "atomic step 9", user-provided result track, `string \| undefined` dirs | Doc review |
| P2 | future `extension/src/flow.ts` (Codex) | M1 progress ×100 and throttle; M2 re-check after host calls; L2 BigInt coercion | FakeHost tests |
| P3 | `editor/interface.html` (GUI lane) | M5 no synthetic waveform for real state; L3 max-reduce; L4 Esc/Enter | `editor/test/browser-host-contract.test.mjs` cases |
| P4 | `editor/interface.html` + plan-core (GUI lane) | R1 labelled peak preview of Reverse/Gain | Unit test on plan-core against `engine/src/dsp.ts` reverse/gain peaks |

### Update 2026-11-21: P3/P4 implemented offline (owner GO)

P3 and P4 landed on this branch in `editor/interface.html`, with tests. P1 and P2 remain proposals for the integration owner.
- **M5:** host state without peaks now draws no waveform and shows "NO WAVEFORM DATA". Only the labelled design preview uses sample peaks.
- **L3:** columns are max-reduced (`reducePeaks`).
- **L4:** Esc returns the cancel envelope (or closes the + ADD OP menu). Apply is **Ctrl/Cmd+Enter** rather than plain Enter, because it writes to Live.
- **R1:** labelled PEAK PREVIEW (`previewPeaks`), cross-checked against the engine kernels.
- **Additional pre-existing defect fixed:** on `a57d5aa` the waveform never rendered at all. `.waveform` set only `fill`, but every column is a zero-area line, so the computed stroke was `none`; a screenshot showed an empty frame for both sample and host peaks. The path is now stroked.
- **Tests:** `npm test` 49/49 (was 32/32), and `npm run test:browser` 26/26 (was 17/17), Node 22.23.5 with Chromium via Playwright. Run against the old `interface.html`, the new tests fail (13 failures). Nothing was installed.

## 5. beta.1 declarations Codex should check (do not assume beta.0)

1. `ExtensionContext.withinTransaction`: callback type (sync or async), return type, and whether it rolls back.
2. `Ui.withinProgressDialog`: the `options` shape, the progress range, `update`'s return type, and `AbortSignal` semantics.
3. `Resources.renderPreFxAudio` / `importIntoProject`: signatures, and whether either takes a signal.
4. `AudioTrack.createAudioClip` args (`duration`, `isWarped`, `loopSettings`), and whether `Song.createAudioTrack` and a track or clip delete method exist.
5. `Environment.storageDirectory` / `tempDirectory` nullability.
6. `Ui.showModalDialog`: which URL schemes are accepted.

## 6. Gates preserved

- S5 T1 controlled-host gates and earlier stop conditions are unchanged.
- PRs #75 and #78 were left as drafts and not touched.
- No Live execution and no process actions. No dependency installs or builds. No SDK extraction or redistribution. No merges.
- Offline evidence is limited to: source reading at the commits above, and one standalone Node computation (§2).
