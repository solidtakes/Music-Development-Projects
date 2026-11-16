# AOPX-01 Windows SDK spike preparation

Isolated harnesses and manual instructions for spikes S1–S5 (Issue #40). These files are **not** product
code. Nothing here imports the Ableton SDK, launches Live or touches a Live Set. They were prepared by
Claude during Codex's absence, and none of it has been run inside Live yet.

| Path | What it is |
|---|---|
| [`WINDOWS_SPIKE_CHECKLIST.md`](WINDOWS_SPIKE_CHECKLIST.md) | Step-by-step manual tests for S1–S5 on the owner's Windows machine, with pass/fail criteria and a report template. S3 comes first |
| [`s3-modal/`](s3-modal) | S3 harness: probe page, SDK-independent URL builders and return-value logger, the example command body, and tests |
| [`s4-wav-check.mts`](s4-wav-check.mts) | Read-only checker: does the AOPX engine read a WAV rendered by Live? |
| [`../T8_ADAPTER_ARCHITECTURE.md`](../T8_ADAPTER_ARCHITECTURE.md) | Draft T8 adapter design and the list of unresolved SDK dependencies |

## S3 harness (`s3-modal/`)

```sh
cd ableton-offline-processing/spikes/s3-modal
npm ci
npm run check         # typecheck (src, test, example, ../s4-wav-check.mts) + node tests
npm run test:browser  # Chromium suite; fails if Playwright or Chromium is missing
```

What the Chromium suite shows. Chromium is the engine under WebView2, but **this is not Live**:

- The base64 and percent-encoded data URLs and a temp `file:` URL all load the probe intact and return diagnostics through a mocked `chrome.webview.postMessage`.
- **An unencoded data URL is cut off at the first `#`.** The probe never runs.
- **Chromium refuses a data URL over about 2 MiB** (`net::ERR_ABORTED`), while the same state as a temp file loads.
- A 1 MB string survives the bridge.
- The cancel envelope passes `host/src/modal.ts`'s `parseModalResult`.
- `devicePixelRatio` and the inner size are reported in CSS px.

The real GUI (`editor/interface.html`, about 36 KB) with a typical injected state is far below the data URL limit. A long clip's full-resolution waveform could get close to it, which is one reason the checklist also tests the temp-file route.

## Safety

- Run the Live parts only in the side-by-side Live Suite Beta, with a new disposable Set and a disposable WAV.
- Never commit the SDK archive or its `.tgz` packages, generated SDK projects, `node_modules`, audio, or logs containing personal paths.
