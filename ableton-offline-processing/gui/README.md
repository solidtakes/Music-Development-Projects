# Offline Processing Suite Webview

Run the Webview shell from this directory with Node 24.16 or later.

```sh
node preview.mjs
```

Open the printed localhost URL. The initial mock clip has a synthetic waveform and example Reverse and Gain settings. The mock transport previews operation editing and submission. Audition and measured render diagnostics require the engine preview.

```sh
npm ci
npm run build
npm run check
npm test
```

Set `AOPX_CHROMIUM_EXECUTABLE` to the path of an installed Chromium browser to run the Webview interaction test at the proposed modal size.

The provisional modal target is 790 × 480 CSS pixels. Host chrome, actual content geometry and Webview focus behavior need a Live Suite beta test.

The build produces `dist/modal.html` for the Extension bundler's HTML text loader. Pass that template and the session to `createModalUrl` in `modal.mjs`, then open the returned URL with `context.ui.showModalDialog(url, MODAL_SIZE.width, MODAL_SIZE.height)`. The Webview returns a versioned plan with the SDK's `close_and_send` message on Render, or a cancel action. The host runs processing after the modal closes and can pass the resulting report to a second modal. Reference [SDK archive review](../SDK_ARCHIVE_REVIEW_BETA_1.md).
