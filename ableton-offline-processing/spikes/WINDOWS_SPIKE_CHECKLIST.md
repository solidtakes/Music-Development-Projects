# AOPX-01 Windows spike checklist (S1–S5)

Manual steps for the owner to run on the Windows machine. **Nothing here has been run inside Ableton
Live yet.** Claude prepared it during Codex's absence; see Issue #40.

## Source of SDK facts, and what is still unverified

Every SDK name below comes from `../SDK_ARCHIVE_REVIEW_BETA_1.md` and `../SDK_ACCESS_NOTES.md`,
which were written from the supplied `extensions-sdk-1.0.0-beta.1.zip`. The online documentation
(`ableton.github.io/extensions-sdk`) could not be read from the cloud session, so:

- **exact CLI commands** (create, build, load) are **not** quoted here. Use the archive's offline
  *Quick Start* and *Execution* pages, and write the exact commands you ran into the report;
- anything marked **VERIFY** must be checked against the offline docs or the bundled examples
  (`modal-dialog`, `context-menu`, `progress-dialog`, `audio-clips`, `strip-silence`, `warpMode`,
  `arrangementselection`) before you rely on it.

## Safety rules (apply to every spike)

- Use only the **side-by-side Live Suite Beta** that the SDK release page on Centercode names. Never
  install into, update or open the production Live 12.5 or Live 13.
- Create a **new, empty, disposable Set** for the spikes, saved under a new folder such as
  `Documents\AOPX-spike-sets\`. Never open an existing Set.
- Use a **disposable WAV**: for example, generate a 10 s stereo test tone. Do not use personal or
  client audio.
- Do not commit the SDK archive, its `.tgz` packages, the generated `node_modules`, Live logs that
  contain personal paths, or audio. Paste only the logs and results requested below into Issue #40.
- Stop at the first unexpected modal, crash or data warning, and report it.

## Prerequisites (record each value in the report)

| Item | How to check | Expected |
|---|---|---|
| Windows version | `winver` | record |
| Display scaling | Settings → System → Display → Scale | record (for example 100 %, 150 %) |
| Live beta build | Live → Help → About | record exact build. AOPX-01 earlier saw **Live 12 Beta 12.4.25b1, bundled Node v24.22.1** on one machine; the Extensions FAQ cites Live 12 Suite Beta **12.4.5** as the minimum. VERIFY it is the build the SDK release page names |
| Edition | About window | Suite |
| Node for development | `node --version` | ≥ **24.16.0** (the SDK packages declare `engines.node >=24.16.0`) |
| SDK | the `.tgz` file names | `ableton-extensions-sdk-1.0.0-beta.1.tgz`, `ableton-extensions-cli-1.0.0-beta.1.tgz`, `ableton-create-extension-1.0.0-beta.1.tgz` |
| Repo | `git rev-parse HEAD` on this branch | record |
| Live's Record File Type (beta only) | Live beta Preferences | **WAV** for S4. Change it only in the beta, and record the value it had before |

---

## S1: SDK ↔ Windows Live beta pairing; official minimal extension

**Goal:** the official generator's minimal extension builds and loads into the Windows Live beta.

1. In a new empty folder **outside this repository** (for example `C:\aopx-spikes\s1-minimal`), create
   the minimal extension with the SDK's project generator from the local `.tgz` files, exactly as the
   offline *Quick Start* describes. Write down every command you ran.
2. Build and load or run it in the Live beta as the *Execution* guide describes. VERIFY: whether this
   is a developer-mode load of a folder, a packaged file, or a launch flag; whether Live must be
   restarted; and where the extension's console output goes.
3. Trigger the minimal extension's sample action in the disposable Set.

**Pass:** it loads with no error, its action runs, and you can see its log output.
**Fail:** any install, build or load error. Paste the exact message.
**Report:** the commands, the versions, where the logs appeared, and whether Live had to restart.

---

## S3 (do this first, after S1): modal delivery, message transport, close behaviour, sizing

**Goal:** decide how the GUI document reaches `context.ui.showModalDialog(url, width, height)` on
Windows, and record what comes back for every way of closing it.

Harness: `s3-modal/` in this branch.
- `probe/probe.html` is the page shown in the modal.
- `src/modal-transport.ts` builds the URLs: base64 data URL, temp file URL, and an unencoded data URL as a negative control.
- `example/s3-spike-command.example.ts` holds the command body.
- The Chromium tests (`npm run test:browser`) already pass for the probe itself. That proves the page, not Live.

### Setup
1. In the S1 project, add a second context-menu or sample command named, for example,
   "AOPX S3 probe". Copy the command-registration glue from the generated project and the bundled
   `context-menu` / `modal-dialog` examples. **VERIFY** the registration API there.
2. Copy `s3-modal/src/modal-transport.ts`, `s3-modal/example/s3-spike-command.example.ts` and
   `s3-modal/probe/probe.html` into that project. Make `probe.html`'s text available to the command
   as `probeHtml` (bundled asset or `readFile`, as the generated project allows; **VERIFY**). Call
   `runS3Spike(context, probeHtml)` from the command.
3. Check that `context.environment.tempDirectory` exists in this SDK build (**VERIFY**). The log is
   written to `<tempDirectory>\aopx-s3-log.jsonl`.

### Run
Run the command once. It opens 11 dialogs in sequence. **Each dialog's title says what to do in it.**

| Run | Delivery | Do this | Expectation to confirm or refute |
|---|---|---|---|
| A1 | base64 data URL | RETURN DIAGNOSTICS | page loads; `bridge.chromeWebview: true`; a string result |
| A2 | base64 data URL | SEND CANCEL ENVELOPE | string `{"envelopeVersion":1,"action":"cancel"}` |
| A3 | base64 data URL | window **X** button | **unknown**: string, empty, `undefined` or a rejection? |
| A4 | base64 data URL | **Esc** (then X if still open) | **unknown**: does Esc close it at all? |
| A5 | base64 data URL | RETURN 1 MB STRING | does a 1 MB result arrive intact (`bytes` = 1048576)? |
| B1 | temp file URL | RETURN DIAGNOSTICS | does a `file:///C:/…` URL load at all? |
| B2 | temp file URL | window **X** | same as A3, for a file URL |
| C1 | raw data URL | close with X | expected **blank or broken** (truncated at the first `#`) |
| D1 | base64 + 256 KB state | RETURN DIAGNOSTICS | `injectedIntact: true` |
| E1 | base64 + 2 MB state | close with X | Chromium refuses data URLs over ~2 MiB: expected **not to load** |
| F1 | temp file + 2 MB state | RETURN DIAGNOSTICS | `injectedIntact: true`; no size limit |

While each probe is open, also note:
- **Sizing:** does the window's inside measure 860 × 660 CSS px? Use the `inner` and `documentClient` rows, together with `devicePixelRatio`. Is anything clipped? Can the window be resized?
- Is there a native title bar? What does it say?
- Do keyboard focus and typing work?
- **Dark mode:** check the `prefersDark` row.

**Optional DPI repeat:** if you are comfortable changing the display scale temporarily, set it to 150 %, run
A1 and F1 again, then set it back. Record both values. This changes a Windows display setting, not
installed software, and it is reversible. Skip it if you prefer.

### Collect
- `<tempDirectory>\aopx-s3-log.jsonl`, the whole file. It records each run's `urlScheme`,
  `urlLength`, duration and `result` (`kind`, `length`, `preview`, `errorName`, `errorMessage`).
- For each run, a screenshot of the probe or a note "did not load".
- The extension's console output for the run.

**Pass criteria for S3 (decision rule for T8):**
- **Delivery:**
  - A1 and B1 both work: prefer **B (temp file)** for state over about 1 MB, and A for small state, or B for everything.
  - Only one of them works: T8 uses that one.
  - Neither works: S3 fails. Report it, and T8 is blocked.
- **Transport:** `chrome.webview.postMessage({method:"close_and_send", params:[string]})` yields that string as the return value of `showModalDialog`.
- **Close behaviour:** A3, A4 and B2 are recorded precisely. T8 treats any non-parsable result as **cancel**.

---

## S2: AudioClip context menu, parent track, timing, warp and loop fields

**Goal:** right-clicking one Arrangement audio clip runs our command with that clip, and we can read
everything the round trip needs.

1. In the disposable Set, put the disposable WAV as **one clip on its own audio track** in Arrangement.
2. Register an AudioClip-scoped context-menu command, following the bundled `context-menu` example.
   **VERIFY** the registration fields and how the command receives the clicked clip's handle.
3. In the command, resolve the handle to an `AudioClip` and log these read-only fields (names from the
   archive review): `filePath`, `duration`, `startTime`, `endTime`, `startMarker`, `endMarker`,
   `loopStart`, `loopEnd`, `warpMarkers`. Also log the writable fields `name`, `muted`, `warping`,
   `warpMode` and `looping` (read them only; **do not write**).
4. Resolve the clip's **parent AudioTrack**. **VERIFY** the API (not named in the archive review).
   Log the track's name and index if available.
5. Try it with two clips on the same track and with a MIDI clip, to see whether the menu entry is
   offered and what is passed.

**Pass:** exactly one AudioClip and its parent AudioTrack are resolved, and the timing units are known (beats?).
**Report:** the logged values, the units, and the exact API names used.

---

## S4: pre-FX render of an isolated clip to a WAV the engine reads

**Goal:** `renderPreFxAudio` produces a WAV of exactly the clip, and the AOPX engine decodes it.

1. Use the S2 setup: one clip, alone on its track. Record File Type is **WAV** in the beta.
2. Call `context.resources.renderPreFxAudio(track, clip.startTime, clip.endTime)`, following the
   `strip-silence` example. **VERIFY** the argument units and the return value (the archive review says
   it writes into the Extension temp directory).
3. Log the returned path, the file size, and the first 12 bytes in hex (`RIFF....WAVE` expected).
4. Copy that rendered file **out of** temp to a scratch folder. Then, from a checkout of this branch,
   run the read-only checker. It needs Node ≥ 22.18 and no `npm install`. Pass the clip's duration in seconds as the second argument:
   ```powershell
   node ableton-offline-processing\spikes\s4-wav-check.mts "C:\aopx-spikes\render-copy.wav" 4.0
   ```
   It prints the first 12 bytes, the engine's view of the format, whether every frame decodes, and the duration difference.
5. Work out the clip's expected duration in seconds from its beat length at the Set's tempo, and compare it with `durationDeltaSeconds`.

**Pass:** the file is RIFF/WAVE, the engine reads its format, and the duration matches the clip
within one buffer. Listen to it: only the clip, and no effects.
**Report:** format (channels, rate, bit depth, encoding), frames, the duration comparison, and
whether Record File Type had to change.

---

## S5: import a generated file and create a track and clip in one transaction

**Goal:** a processed WAV lands as a new clip on a **new** track at the original position, and the
original clip is untouched.

1. Make a test output: run the engine demo, or simply copy the S4 render to
   `<tempDirectory>\aopx-s5-output.wav`.
2. Call `context.resources.importIntoProject(path)` and **use the returned path** from then on.
3. Inside **one** `withinTransaction` (**VERIFY** signature): `Song.createAudioTrack()`, then
   `AudioTrack.createAudioClip({ filePath, startTime, duration, isWarped, loopSettings })` with the
   original clip's `startTime` and `duration`, and its `warping` value for `isWarped`.
4. Check:
   - the new clip's start and end equal the original's;
   - the original clip and its file are unchanged;
   - **one Undo removes the new track and clip together**;
   - saving the disposable Set and reopening it keeps the new clip.
5. Try importing the same file twice and note whether the returned paths differ. This matters for
   the export file-lock risk on #40.

**Pass:** placement is exact, the original is untouched, and the change undoes as one step.
**Report:** the returned import path, the placement values, the warp and loop settings that survived, and the Undo behaviour.

---

## Report template (paste into Issue #40)

```
S-run report — <date>
Windows: <winver>   Display scale: <%>   Live beta: <build>   Edition: Suite
Node (dev): <version>   SDK tgz: <names>   Repo commit: <sha>
Commands used (create/build/load): <exact commands>

S1: PASS/FAIL — <notes, where logs appear>
S3: delivery A=<ok/fail> B=<ok/fail> C=<broken as expected?> E=<refused?> F=<ok?>
    returns: A1=<kind> A2=<kind> A3(X)=<kind> A4(Esc)=<kind/no close> A5=<bytes> B2(X)=<kind>
    sizing: inner=<w×h> dpr=<n> clipped=<y/n> resizable=<y/n>
    aopx-s3-log.jsonl: <attached/pasted>
S2: PASS/FAIL — clip fields: <...>  parent track API: <name>  units: <beats?>
S4: PASS/FAIL — format: <...> frames=<n> duration match=<y/n>
S5: PASS/FAIL — placement=<ok?> original untouched=<y/n> single undo=<y/n>
Unexpected: <anything>
```
