# Alpha 0.1 offline integration plan and bounded implementation, 2026-11-21

**Assignment:** Issue #40 comment 7053628549, with the role change in 7053412885 (Claude implements, Codex audits). The owner approved it in chat, and I acknowledged it in comment 7054181284.

**Status:** an offline plan plus offline code. **No Live, no Extension Host, no CLI, no SDK install, no Set or media change, no merge.** PRs #75 and #78 have not been touched and remain drafts.

**Branch:** `claude/peaceful-edison-ix41ct`, created from canonical `ableton-offline-processing/alpha-0.1` at `a57d5aa`.

## 1. Reconciliation (what already exists and who owns it)

| Item | State | How this work uses it |
|---|---|---|
| `engine/` (canonical, from #41) | WAV I/O, Reverse/Gain, history graph, content-addressed cache, `RenderReport.wallMs` (#50). 59/59 tests pass on Windows and Linux | Used unchanged: `Project.importSource/setPlan/render/save/exportOutput`, `computePeaks`, `decodeWav` |
| `host/src/modal.ts` (canonical, #50) | Versioned `ModalResult` parser, `buildHostInitialState`, script-safe injection | Used unchanged for the editor round trip |
| `T8_ADAPTER_ARCHITECTURE.md` | DRAFT design. Assumes one `withinTransaction` covering *create track + clip* | **Superseded on that point.** The GUI review (H1) and the beta.1 declaration evidence show it isn't atomic. This flow creates no track, uses no transaction and does exactly one `createAudioClip` on an existing track |
| PR #78 / #75 `spikes/s5-t1` (Codex, draft, locked by `LIVE_TRIAL_ENABLED = false`) | One-shot trial: exactly 2 beats, 120 BPM, 48 kHz, in-memory DSP, a typed-phrase consent, receipts, `unknown-outcome` | **Not modified.** Its safety rules carry over into the general flow: an existing unique `AOPX RESULT` track, a single `createAudioClip`, a recheck before every effect, no retry, and `unknown-outcome` once an effect has been requested. Its journal/receipt persistence and typed-phrase consent are trial-specific and are not duplicated here (§5, item P4) |
| GUI review `reviews/EXTERNAL_SDK_BOILERPLATE_GUI_REVIEW_2026-11-20.md` (branch `claude/ableton-sdk-boilerplate-research-mnw46c`) | H1, M1–M5, L1–L4 | Implemented here: H1 (no transaction or track creation), M1 (progress ×100, throttled, errors caught), M2 (cancel cannot interrupt host calls; unknown outcome after a request), M3 (directories may be undefined) |

**Gates that stay open (unchanged):** the independent review of the pristine Modal fixture; native-loader uncertainty (the bundle must be CommonJS, per #78); the Live 12 development-Host handshake timeout (#7039006862); and fresh owner authorization for any native attempt.

## 2. beta.1 API evidence

**Provenance: secondary.** This container has **no pristine SDK**. `@ableton/extensions-sdk` and `@ableton-extensions/sdk` both return 404 on npm. The unscoped `ableton-extensions-sdk@1.0.0` is a placeholder whose description points to `@ableton-extensions/sdk`. The line references below come from Windows Codex's static read of `index.d.mts` (SHA-256 `b0b6d355…a570a`, tied to ZIP SHA-256 `eae6918f…7ca2`, comments #7053184703 and #7053202100), plus `SDK_ARCHIVE_REVIEW_BETA_1.md`. **I have not read those declarations myself.** The Codex audit should re-check the "LivePort method" column against them.

| LivePort method | beta.1 call (line in `index.d.mts`) | Proven statically | Unproven (native only) |
|---|---|---|---|
| `resolveSelection` | `getObjectFromHandle`, `AudioClip.parent/startTime/endTime/warping/looping` (:370, :375–407, :868) | Shapes and that the units are beats | Session clips and take lanes; whether overlap can be detected reliably (U5) |
| `renderPreFx` | `renderPreFxAudio(track, startTime, endTime): Promise<string>` (:765–774) | Pre-FX, a beat range, a path in temp, **no signal** | File type follows Live's Record File Type, **so AIFF is possible** (handled: `render-aiff`); exact frame rounding (U3); whether clip gain is applied (U2) |
| `showEditor` | `showModalDialog(url, w, h): Promise<string>` (:800–812) | URL schemes and a string result | Windows close-without-result behaviour (U6); the delivery method (S3) |
| `reportProgress` | `withinProgressDialog` → `update(text, progress?)`, 0–100, `AbortSignal` (:814–836) | 0–100, awaited, the signal is delivered | Whether cancel interrupts an in-flight host call (assumed **no**) |
| `importIntoProject` | `importIntoProject(filePath): Promise<string>` (:775–780) | Returns the project-managed path | No signal; no rollback; what a throw or timeout means (treated as unknown outcome) |
| `createAudioClip` | `AudioTrack.createAudioClip({filePath,startTime,duration?,isWarped?,loopSettings?})` (:555–568, :598–604) | Beats; omitting `duration` gives the natural length; `isWarped:false` must be explicit | The exact end beat it returns (checked within ±2 frames: `result-geometry-mismatch`) |
| *(not used)* | `withinTransaction(fn: () => T): T` (:869–886) | Synchronous callback, grouping only | Rollback. **Not relied on** |
| `storageDirectory` / `tempDirectory` | `environment.storageDirectory/tempDirectory: string \| undefined` (:740–755) | May be undefined (handled: `no-storage`) | Whether the directories exist; the engine runs `mkdir -p` |

A community recipe has a conversion error, called out in #7053184703: it turns seconds into beats as `seconds × 60 / tempo`. The correct form is `seconds × tempo / 60`, so at 120 BPM one second is 2 beats. `src/timing.ts` uses the correct form, and the unit tests plus a mutation test pin it.

## 3. Audacity and Ardour as architectural references (clean room, no code copied)

These were read on GitHub master on 2026-11-21 for design facts only.
- **Audacity** is GPLv3, and most files are GPLv2-or-later (repo README).
- **Ardour `libs/audiographer`** is GPLv2 (its `COPYING`).

**No source was copied and no dependency was added.**

| Reference | Fact (file read) | What it means for AOPX |
|---|---|---|
| Audacity `au3/libraries/au3-builtin-effects/TwoPassSimpleMono.cpp` | The two-pass effect framework runs an analysis pass over every selected track, then an apply pass, block by block | A future **Normalize** needs a peak-analysis pass and then a gain pass. The engine's per-node cache already stores the analysed input, so the analysis can be its own cacheable step. Not needed for Alpha 0.1 |
| Audacity `au3/libraries/au3-wave-track/SampleBlock.h`, `Sequence.cpp` | Blocks of roughly 128k–256k float samples (1 MiB disk blocks), each with a `MinMaxRMS` summary and 256- and 64k-sample summaries. Whole-block summaries are combined, and only edge blocks are read | AOPX recomputes 512 min/max peaks from the decoded render each time it's invoked. That's fine for whole-clip Alpha. For long files, store multi-level peaks next to each cache object (future work) |
| Audacity `Sequence.cpp` | Dither only when narrowing the sample format | AOPX output always equals the source format (it never narrows), so no dither is correct. This is already in the cache key as `dither:'none'` |
| Audacity Reverse | **Not found** in the directories listed (`au3/src/effects`, `au3-builtin-effects`) | No claim made. The engine's frame-wise Reverse is already exact and tested |
| Ardour `audiographer/general/normalizer.h` + `peak_reader.h` | `PeakReader` measures, then `Normalizer.set_peak()` applies gain: two passes | Confirms the Normalize design above |
| Ardour `audiographer/general/sample_format_converter.h`, `chunker.h`, `process_context.h` | Chunked `ProcessContext` pushed through `Source → Sink`; float→int conversion with optional dither and a `max_samples` chunk cap | Path to **bounded memory**: the engine currently decodes whole files to float64. Streaming via fixed chunks through the existing kernels is the scalable design. Alpha 0.1 caps memory instead (`maxFileBytes` 512 MiB, `maxDecodedBytes` 2 GiB) |

**Recommendation: DEFER any library or engine replacement.**
- Neither project shortens the time to the first working AOPX round trip. The blockers are native (loader, handshake, modal), not DSP.
- Both are GPL, so their code can't be reused under the current licence.
- The existing engine is bit-exact and tested.
- Adopt the two ideas when the features need them: two-pass Normalize, and chunked streaming with multi-level summaries for long files.

## 4. Implemented on this branch: `ableton-offline-processing/integration/` (SDK-free)

| File | What it does |
|---|---|
| `src/port.ts` | `LivePort`: the seven host calls above plus the directories. **It has no method that can change the source clip or track** |
| `src/flow.ts` | `createOfflineProcess(port)`, in order: admission → render → render admission → engine import (branch `clip:<sha256>`, so history is restored per audio) → editor → `setPlan` + `render` + `save` → unique export, hash- and format-checked → recheck → import ×1 → recheck → create ×1 on `AOPX RESULT` → verify geometry and that the source is unchanged. It is single-flight, never retries, and reports outcomes as `completed`, `rejected`, `cancelled`, `failed`, `unknown-outcome` or `busy`, plus `effects` |
| `src/render-input.ts` | Admits the rendered file. It must be inside temp, a regular file, under the size and decoded-memory caps, and WAV (AIFF and RF64 are rejected with a fix message). It must not be empty or have more than 2 channels, and its frames must be within ±2 of the beat range |
| `src/timing.ts` | Beat, second and frame conversion at a constant tempo |
| `src/progress.ts` | Engine 0..1 → beta.1 0..100, monotonic, throttled, serialized; failures are swallowed |
| `test/*` | 54 tests against an in-memory `FakePort` |
| `.github/workflows/aopx-engine-windows.yml` | Adds this package to the existing Windows and Linux CI with Node 24.22.1, and triggers on this branch |

**Admission (fail-closed, deliberately narrow):** the clip must be:
- an Arrangement AudioClip;
- unwarped and unlooped, at a finite tempo above 0;
- of positive length;
- with no overlapping clips on its own track.

The result track must be:
- exactly one track named `AOPX RESULT`;
- an audio track, not the clip's own track;
- empty over the clip's range.

The general flow drops #78's 2-beat/120 BPM/48 kHz restriction. Any rate, length and tempo is admitted within the caps.

### Test matrix (all offline; 54 tests)

| Requirement | Tests |
|---|---|
| Channel order | L is a sine and R a ramp. After Reverse → Gain, L[0] = g·L[last] and R[0] = g·R[last] within 1 LSB, and the ramp is reversed, not swapped |
| Sample rate, channels, length, bit depth | Preserved, including a 44.1 kHz render. Output is **bit-identical** to Gain(Reverse(source)) computed directly with the kernels |
| PCM bounds | +24 dB on 0.9 full-scale pcm16 saturates to exactly +32767/32768 and −1, with no wrap |
| WAV output | Decoded and format-checked. The exported copy's SHA-256 equals the cache object's |
| Empty clips | Zero-length selection → `not-admitted`. 0-frame render → `render-empty` |
| Formats | AIFF/AIFC → `render-aiff`; RF64/BW64 → `render-rf64`; truncated → `render-invalid-wav`; 3 channels → `render-channels`; wrong length → `render-frame-mismatch` |
| Memory | `maxFileBytes` and `maxDecodedBytes` caps refuse before decode |
| Cancellation | In the editor, or during the engine render: no import. After import: reports the import and never creates |
| Unknown import outcome | Import that throws, hangs (timeout) or returns an empty receipt → `unknown-outcome`, called exactly once, no create. Create that throws or hangs → `unknown-outcome`, with the import reported |
| Non-destructive result | The user media SHA-256 is unchanged in every test. The port has no source-mutating method. Result clip on `AOPX RESULT` at the source start, unwarped. A misplaced result is reported and **left in place**, not "fixed" |
| Drift | The result range becomes occupied between render and import → `selection-changed`, no effect |
| Editor | cancel, undefined, empty, non-string, invalid JSON, wrong envelope version, out-of-range gain or unknown op → `cancelled`, no effect |
| History and cache | A second invocation on the same audio restores the edited plan and the last `RenderReport`, and the engine reports `bypassed`, `hit` |
| Single flight | A concurrent invocation → `busy`, no effect |
| Progress | 0..100, non-decreasing, ends at 100. Throttle, serialization, latest-wins and error swallowing are unit-tested |

**Mutation check:** each of these deliberate bugs makes at least one test fail:
- removing the pre-import recheck (2 fail);
- inverting the beat conversion (1 fail);
- treating an import error as "no change" (3 fail);
- disabling AIFF detection (2 fail);
- disabling the history restore (1 fail).

## 5. File-by-file plan for what remains (not implemented; each step is gated)

| # | File | Change | Gate |
|---|---|---|---|
| P1 | `extension/src/live-port.ts` (new; **the only SDK importer**) | Implement `LivePort` with beta.1. Base it on #78's reviewed `live-port.ts` patterns: `getObjectFromHandle`, `instanceof AudioTrack`, BigInt handle IDs via `String()`, and overlap counts from `arrangementClips` over the range. Use `createAudioClip({ filePath, startTime, isWarped:false })` with **no `duration`** | Codex audit of this branch, then owner approval |
| P2 | `extension/src/extension.ts` | Register the AudioClip context action. Wrap `createOfflineProcess` in `withinProgressDialog`, passing its `AbortSignal` and `update`. Show the outcome with its `effects` | P1 |
| P3 | `extension/src/modal-delivery.ts` | Port `spikes/s3-modal/delivery.mjs`: `injectInitialState` into `editor/interface.html`, delivered as a unique temp file or a base64 data URL, whichever S3 proves | Independent pristine Modal fixture review (open gate) |
| P4 | `extension/src/journal.ts` | Persist an intent/ack record before each effect (the #78 receipt pattern), so an `unknown-outcome` survives a crash and blocks a blind re-run | Optional for a first trial; recommended |
| P5 | `extension/ci/build.mjs`, `package.json`, `manifest.json` | A pinned esbuild **CommonJS** bundle with the SDK as the only external, and no minification (GUI review L1). This is the #78 loader fix | Native-loader gate |
| P6 | `editor/interface.html` | Progress and error states for each `FlowResult.status`; GUI review M5 (no synthetic waveform for real state) | Separate GUI task |
| P7 | `T8_ADAPTER_ARCHITECTURE.md` | Replace the "one transaction / create track" step with this flow | Doc-only, with P1 |

## 6. Native-only uncertainties (cannot be settled offline)

- **U1.** Whether the Live 12 development-Host handshake connects at all (#7039006862), and whether Live 13 loads a CJS bundle.
- **U2.** Whether a pre-FX track render applies clip gain, fades and the clip's own envelope (#7032542278 notes an intentional −3.1 dB clip gain on the test Set).
- **U3.** The rendered frame count and rounding for a beat range. The flow allows ±2 frames and refuses anything else.
- **U4.** Tempo automation. The flow assumes a constant tempo, and beta.1 exposes no tempo-map check in the evidence I have.
- **U5.** Whether overlap and occupancy can be read reliably from `arrangementClips` (take lanes, Session clips).
- **U6.** The modal close or Esc result on Windows WebView2. The flow treats any non-string or invalid value as a cancel.
- **U7.** What an `importIntoProject` or `createAudioClip` throw means natively. The flow treats it as an unknown outcome, never as "no change".
- **U8.** The end beat `createAudioClip` returns when `duration` is omitted. It is verified within the frame tolerance.

## 7. Codex audit target

- **Revision to audit:** commit `<filled in by the milestone report>` on `claude/peaceful-edison-ix41ct`, based on canonical `a57d5aa`.
- **Files:** `ableton-offline-processing/integration/**`, `ableton-offline-processing/reviews/ALPHA01_OFFLINE_INTEGRATION_PLAN_2026-11-21.md`, `.github/workflows/aopx-engine-windows.yml`.

Please check:
1. The "LivePort method" column of §2 against the pristine `index.d.mts` (`b0b6d355…`).
2. `flow.ts` outcome classification: is any path reported as no-effect after an effect could have happened?
3. `render-input.ts` admission: memory caps, the temp-root containment check on Windows (realpath, 8.3 names, junctions), and AIFF/RF64 detection.
4. The tolerance choices (±2 frames, geometry tolerance) and whether a frame-mismatch refusal would block legitimate renders.
5. Test quality: does each test prove behaviour rather than mock wiring?
6. Licensing: confirm that nothing Audacity- or Ardour-derived is present beyond the cited ideas.

Report as BLOCKER/HIGH/MEDIUM/LOW with file:line and a GO/BLOCK verdict.
