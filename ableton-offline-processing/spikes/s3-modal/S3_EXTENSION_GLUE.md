# S3 spike extension: wiring the harness into a throwaway Extension

**Status:** preparation only. Nothing here has run inside Ableton Live. The SDK documentation site
(`ableton.github.io/extensions-sdk`) could not be reached from the cloud session that wrote this,
so every SDK call below is taken from [`SDK_ARCHIVE_REVIEW_BETA_1.md`](../../SDK_ARCHIVE_REVIEW_BETA_1.md)
and the GUI's existing bridge code. Lines marked **VERIFY** must be checked against the official
`modal-dialog` and `context-menu` examples in your local `extensions-sdk-1.0.0-beta.1.zip`
before you build. If an example disagrees with this file, the example wins: note the difference
in your S3 report.

## What the spike does

One context-menu command, **"AOPX S3 probe"**, on an AudioClip. When chosen, it runs the S3 matrix
from `s3-runner.mjs`: it opens the probe page (and finally the real AOPX editor) once per case
through `showModalDialog`, waits for you to press the button the case asks for, and writes one
JSON results file. It **never edits the Set**: no render, no import, no track or clip creation.

## Files to copy into the scaffolded spike extension

Scaffold a **new, separate** extension folder with the SDK's own create-extension tool (exact
command: Quick Start in the local SDK docs). Do not scaffold inside this repository. Then copy:

| From this repo | Into the spike extension |
|---|---|
| `ableton-offline-processing/spikes/s3-modal/delivery.mjs` | `src/s3/delivery.mjs` |
| `ableton-offline-processing/spikes/s3-modal/s3-runner.mjs` | `src/s3/s3-runner.mjs` |
| `ableton-offline-processing/spikes/s3-modal/probe.html` | wherever the build keeps static assets (see the `modal-dialog` example) |
| `ableton-offline-processing/editor/interface.html` | the same asset folder |

The runner only uses Node built-ins (`fs/promises`, `path`, `url`, `crypto`). It has no npm
dependencies.

## Command handler sketch (adapt to the example's real shapes)

```js
// VERIFY: activation/registration shape, from the context-menu example.
// VERIFY: the context object's property names (ui, environment) and the showModalDialog
//         parameter order (url, width, height) and units, from the modal-dialog example.
import { runS3Matrix } from './s3/s3-runner.mjs';

async function onAopxS3Probe(context /* , clipHandle */) {
  const temp = context.environment.tempDirectory;      // VERIFY name
  const lines = [];
  const { outPath } = await runS3Matrix({
    showModalDialog: (url, w, h) => context.ui.showModalDialog(url, w, h), // VERIFY
    tempDirectory: temp,
    outDir: temp,
    probePath: /* absolute path of the bundled probe.html */ PROBE_ASSET_PATH,
    guiPath: /* absolute path of the bundled interface.html */ GUI_ASSET_PATH,
    log: (line) => { lines.push(line); console.log(line); },   // VERIFY where extension logs go
    environment: {
      live: 'fill in: Help > About Live',
      sdk: '1.0.0-beta.1',
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
    },
    // only: ['A1-file-inline-1k'],   // run a single case while debugging
  });
  console.log(`S3 results: ${outPath}`);
}
```

Notes:

- Each case shows its instruction (`ask`) in the log **before** the dialog opens. Keep the log
  visible. If the SDK has no visible log, run a few cases at a time with `only`.
- If `showModalDialog` refuses `file://` or `data:` URLs outright (throws), the runner records
  `threw` and moves on. That is a valid S3 result, not a harness bug.
- If the bundled-asset path cannot be resolved, write the HTML into `tempDirectory` first and pass
  that path as `probePath`/`guiPath`.

## What to send back

The results JSON (it lands in the extension's temp directory; its full path is logged), plus:
screenshots of A1, Z1, Z2 and G1, the Windows display scale (Settings > Display > Scale), and
anything the dialog showed that the JSON cannot (blank pages, error banners, title bar text).
