# AOPX host bridge (SDK-independent)

The Extension Host side of the modal Webview contract (Issue #40, T2). It has no dependency on the
Ableton Extensions SDK or on any Webview transport, and the WAV engine does not depend on it. The
future T8 adapter imports it.

The types live in `../engine/src/contract.ts`: `HostInitialState`, `ModalResult` and
`MODAL_ENVELOPE_VERSION`. `src/modal.ts` provides:

- `buildHostInitialState({ source, waveform, plan, diagnostics })` returns a non-preview `HostInitialState`.
- `serializeInitialState(state)` returns JSON that is safe inside an inline `<script>`.
- `injectInitialState(html, state)` inserts `window.AOPX_INITIAL_STATE` before the GUI scripts in `../editor/interface.html`.
- `parseModalResult(string)` validates the string returned by `close_and_send` and returns a `ModalResult` with only known fields, or throws `ModalResultError`.

How the injected document reaches `showModalDialog` (data URL or generated file) is still to be proven by spike S3.

```sh
npm ci
npm run check   # typecheck + tests
```

The editor's `test/browser-host-contract.test.mjs` exercises this module against the real GUI in Chromium.
