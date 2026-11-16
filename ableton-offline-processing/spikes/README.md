# AOPX-01 Windows SDK spikes S1–S5: preparation and manual test checklist

**Owner of this track:** Codex (AOPX-01). Claude Code is covering the preparation during Codex's
three-day absence (owner request, 2026-11-16, Issue #40). **Preparation only.** Nothing here has
been run in Ableton Live or its Extension host, and no SDK package is in this repository.

**Base:** canonical `ableton-offline-processing/alpha-0.1` at
`9ebcf56d41e027835c0f1a97af6d1aa6482d28d3` (PR #50 merge).

**Sources used:** [`SDK_ARCHIVE_REVIEW_BETA_1.md`](../SDK_ARCHIVE_REVIEW_BETA_1.md),
[`SDK_ACCESS_NOTES.md`](../SDK_ACCESS_NOTES.md), the GUI's bridge code in
`editor/interface.html`, and the PR #41 and PR #50 reviews on Issue #40. The public SDK
documentation site could not be reached from the cloud session (network allowlist), so **no API
signature below has been re-verified against the official docs.** Every call is marked with where
it came from. Check each one against the examples in your local `extensions-sdk-1.0.0-beta.1.zip`.

## Ground rules for every spike

- Use the **Live 12 Beta build paired with SDK 1.0.0-beta.1** (from the SDK release page on
  Centercode). Do **not** use production Live 12.5 or Live 13, and do not update them.
- Use a **new, disposable Set** saved in a throwaway folder (for example
  `C:\AOPX-spikes\S3\S3-disposable.als`) and a **disposable WAV** (for example a 10 s sine you
  generate). No production Sets, no personal audio.
- Scaffold each spike extension in a folder **outside** this repository. Never commit SDK
  tarballs, `node_modules`, the beta, or audio.
- Node: **24.16.0 or later** (the SDK package `engines` field). Record `node --version`.
- Set Live's **Record File Type to WAV** before S4.
- Automation never launches, installs or updates Live. You run every step yourself and stop at
  the first unexpected result.

### Record for every spike

| Field | How |
|---|---|
| Live version | Help > About Live |
| SDK version | the archive name, plus `npm ls` in the spike extension |
| Node | `node --version` (development) and, if the SDK exposes it, `process.version` inside the extension |
| Windows | `winver` (edition, version, build) |
| Display | Settings > Display: resolution and scale (%), for each monitor used |
| WebView2 runtime | Settings > Apps > "Microsoft Edge WebView2 Runtime" version |
| Result | PASS / FAIL / BLOCKED per step, with screenshots and the log text |

## Priority order

**S3 first.** It is the only open design unknown that could change the GUI wiring (PR #50 review,
finding R1/R2). S1 is its prerequisite, so do the minimal part of S1, then S3, then S2, S4, S5.

---

## S1: SDK beta.1 + Live beta pairing, minimal official extension

**Goal:** prove that this SDK build loads in this Live beta on this Windows machine.

1. Confirm Node ≥ 24.16.0.
2. Unpack the SDK archive into a scratch folder (not this repository).
3. Scaffold a new extension from the **official create-extension package in the archive**, using
   the exact command in the SDK Quick Start. If it can't resolve the packages from the registry,
   install from the local `.tgz` files as the Quick Start or Execution guide describes.
4. Build it and load it into the Live beta with the **exact command from the Execution guide**.
   (The archive review says the guide's example path is a macOS app path; find the Windows form.)
5. Trigger the example's command in Live.

**Pass:** the example's command appears and runs; its output is visible. **Record:** the exact
commands that worked, the load mechanism (dev-loaded folder vs. packaged file), where the
extension's logs appear, and the extension's `storageDirectory` and `tempDirectory` paths.
**Stop if:** the build fails, Live does not see the extension, or Live asks to update.

---

## S3: modal delivery, return transport, close behaviour and DPI (priority)

**Harness:** [`s3-modal/`](s3-modal/). See [`S3_EXTENSION_GLUE.md`](s3-modal/S3_EXTENSION_GLUE.md)
for wiring it into a throwaway extension. Already verified in CI-style Chromium (Playwright, not
Live): 18/18 tests, `npm test` in `spikes/s3-modal`.

**Questions S3 must answer on Windows:**

| # | Question | Case ids | Why it matters |
|---|---|---|---|
| Q1 | Does `showModalDialog` accept a `file://` URL to a generated file in `tempDirectory`? | A1, A2 | Preferred delivery: no size limit, injected state proven up to 1 MB in Chromium |
| Q2 | Does the injected inline-script state arrive intact? | A1, A2 (`stateIntact`) | The GUI reads `window.AOPX_INITIAL_STATE` before its UI script |
| Q3 | Are `?query` and `#hash` preserved on a file URL? | D1, D2 | Fallback if inline injection is blocked |
| Q4 | Are `data:` URLs accepted, and up to what size? | B1, B2, B3, C1 | Chromium refuses URLs over ~2 MB (measured: 512 KB state OK at 1.45 M chars, 900 KB aborted at 2.54 M) |
| Q5 | Is the bridge `window.chrome.webview.postMessage({method:'close_and_send', params:[string]})`? | all (`bridge`) | Shape taken from `editor/interface.html`; not re-verified against the docs |
| Q6 | What does `showModalDialog` resolve with for cancel, 1 MB results, a non-string param, and two sends? | R1–R4 | T8 must treat anything unparseable as cancel (finding R2) |
| Q7 | What happens on the window X, on Esc, and on `window.close()`? | X1–X3 | Undocumented; the GUI's Esc only cancels a drag today |
| Q8 | What size does an 860×660 request give at 100/125/150 % scaling? | Z1, Z2 (`innerSize`, `devicePixelRatio`) | Are width/height CSS pixels or physical pixels? |
| Q9 | Does the real editor render and cancel cleanly from a file URL and a data URL? | G1, G2 | End-to-end check with the product GUI |

**Steps:**

1. Finish S1 so a minimal extension loads.
2. Build the S3 spike extension per `S3_EXTENSION_GLUE.md`. It only opens dialogs: it never
   renders, imports or edits the Set. Open the disposable Set anyway.
3. Set Windows display scale to **100 %** and run all cases. Do exactly what each case's
   instruction says, one dialog at a time.
4. Repeat **Z1, Z2 and A1** at **125 %** and **150 %** scale (sign out/in if Windows asks).
5. If a monitor with different scaling is available, drag a Z1 dialog to it and note the result.
6. Collect the results JSON (path is logged) and the screenshots.

**Pass criteria (decides the T8 delivery method):**

- **Delivery = temp file** if A1 and A2 return `process` with `stateIntact: true`.
- **Fallback = URL hash/query** if A fails but D1 or D2 pass.
- **Data URL acceptable** only if B1/B2 pass and the state the adapter will send fits with margin
  under the size where B fails. Otherwise data URLs are rejected for T8.
- **Bridge confirmed** if every passing case reports `bridge: chrome.webview`.
- **Close behaviour** recorded for X1–X3 (what `showModalDialog` resolved with, or the error).
- **Sizing** recorded: `innerSize` and `devicePixelRatio` at each scale.

**Stop if:** Live hangs or crashes (note the case id), a dialog cannot be closed, or Live shows
any prompt to change the Set.

---

## S2: AudioClip context menu, parent track, timing/warp/loop fields

**APIs (from the archive review, VERIFY against the `context-menu` and `audio-clips` examples):**
context-menu actions scoped to `AudioClip` receive a clip Handle. `AudioClip` read-only fields are
`filePath, duration, startTime, endTime, startMarker, endMarker, loopStart, loopEnd, warpMarkers`,
and writable ones are `name, muted, warping, warpMode, looping`.

1. In the disposable Set, put the disposable WAV on its **own** audio track in Arrangement.
2. Register an AudioClip context-menu command that resolves the handle and **only logs**: every
   field above, the parent track (and how it was found), the clip's track index, and whether the
   API can tell if other clips overlap the same range.
3. Run it on: the plain clip; the clip with warp on (try two warp modes); the clip with loop on;
   a clip trimmed with start/end markers; a second clip on the same track.

**Pass:** the command appears only on audio clips; every field reads without error; the parent
track resolves. **Record:** units (beats vs. seconds), any field that throws or is missing, and
whether overlap detection is possible. **Writes:** none in S2.

---

## S4: pre-FX render to a WAV the engine decodes

**API (archive review, VERIFY against `strip-silence`):** `context.resources.renderPreFxAudio(track, startBeat, endBeat)`
writes into the extension temp directory. The file type follows Live's Record File Type.

1. Record File Type = WAV. Disposable WAV alone on its track.
2. Render the clip's `startTime`..`endTime` range. Log the returned path, file size, RIFF/WAVE
   header (first 12 bytes), channels, sample rate, bit depth and frame count.
3. Decode it with the AOPX engine's WAV reader (`engine/src/wav.ts`) in a standalone Node script
   **outside Live** (copy the file out of temp first). Compare the frame count with
   `duration × sampleRate`, converting beats to seconds at the Set tempo.
4. Repeat with Record File Type = AIFF and confirm the spike detects it and refuses to continue.
5. Try one case with a fade and one with a second overlapping clip, and note whether they leak
   into the render.

**Pass:** a valid WAV; the engine decodes it; the frame count matches within one buffer; AIFF is
detected. **Writes:** temp directory only.

---

## S5: import, create track and clip in one transaction, original untouched

**APIs (archive review, VERIFY):** `context.resources.importIntoProject(filePath)` returns the
path to use afterwards; `Song.createAudioTrack()`;
`AudioTrack.createAudioClip({ filePath, startTime, duration, isWarped, loopSettings })`;
`withinTransaction` groups changes into one undo step.

1. Generate a processed WAV in temp (copy the S4 render, or the engine's demo output), using a
   **unique file name per run** (finding risk 4).
2. `importIntoProject` it and log the returned path.
3. In **one** transaction: create a new audio track, then create a clip at the original clip's
   start and duration, with its warp and loop settings. Name it `<clip> [AOPX]`.
4. Check: placement and length match; the original clip and track are byte-for-byte unchanged
   (compare their logged fields before and after); one Ctrl+Z removes the whole change.
5. Run it twice to confirm the second import does not collide with the first file.

**Pass:** all checks hold. **Record:** which warp and loop settings survived, and anything the API
silently changed.

---

## After the spikes

Post on Issue #40: the version table, PASS/FAIL per step, the S3 results JSON, screenshots, and any
API that differs from this checklist. The T8 adapter design
([`T8_ADAPTER_ARCHITECTURE.md`](../T8_ADAPTER_ARCHITECTURE.md)) is updated from those results.
Do not start T8 implementation until S1–S5 are reported and the owner approves.
