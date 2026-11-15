# Ableton Extensions SDK — Access and Compatibility Notes

Last updated: 2026-11-15  
Supplied archive reviewed: `extensions-sdk-1.0.0-beta.1.zip`

## User-provided SDK archive

The user supplied `extensions-sdk-1.0.0-beta.1.zip`. Its contents were inspected directly. See [SDK Archive Review — 1.0.0-beta.1](SDK_ARCHIVE_REVIEW_BETA_1.md) for detailed source-derived findings.

The archive contains the SDK, CLI, project generator, API reference, offline documentation and seven examples. It is a developer toolkit, not a Live application installer.

### Node.js requirement

All three bundled npm package manifests declare:

```json
"engines": { "node": ">=24.16.0" }
```

The bundled Quick Start page says Node.js >=24.14.1, but the package engine metadata is stricter. Use Node 24.16.0 or later in the Node 24 line and verify `node --version`.

### Compatible Live build

The bundled Quick Start says to use the Live Beta build from the SDK release page on Centercode. The Execution guide's example references `Ableton Live 12.4 Beta.app`. This archive does not establish that stable Live 12.5 or Live 13 can load this SDK. AOPX-01 must test the exact Live beta build supplied for this SDK version.

Do not change the user's production Live 12.5 or Live 13 installations. Use a supported side-by-side beta and a disposable Set.

## Documented SDK capabilities

- Extensions run in Node.js alongside Live and can use npm packages and Node APIs.
- Context-menu actions can target `AudioClip` objects.
- `Resources.renderPreFxAudio(track, startBeat, endBeat)` renders an audio track's pre-FX signal over an Arrangement beat range to the Extension temp directory.
- The rendered file type follows Live's Record File Type setting. The bundled Strip Silence example supports WAV only and instructs users to change Live's Record File Type setting to WAV if it renders AIFF.
- The Extension can read/write its own `storageDirectory` (persistent) and `tempDirectory` (temporary).
- `Resources.importIntoProject(path)` imports an output file into the Live project and returns the path to use for subsequent API calls.
- `AudioTrack.createAudioClip({ filePath, startTime, duration, isWarped, loopSettings })` creates a clip in Arrangement.
- `Song.createAudioTrack()` creates a new audio track.
- Custom HTML/CSS/JS interfaces are available through modal Webviews using `Ui.showModalDialog`.
- `Ui.withinProgressDialog` provides cancellable progress for long-running work.
- `withinTransaction` groups Live Set changes into an undo step.

## Important API limitations

- `renderPreFxAudio` is explicitly pre-FX. It does not render the Live track's device chain.
- The `AudioTrack.insertDevice` API inserts built-in Live devices only; its docs explicitly say third-party plug-ins cannot be loaded this way.
- The SDK does not document a post-FX render API or VST3/AU/ARA hosting.
- `AudioClip` exposes `warping` and `warpMode` setters, plus loop properties and warp-marker data. Its API does not document clip-level transpose or clip gain properties.
- `AudioClip.warpMarkers` is documented as a getter; no warp-marker write method is shown.
- The filesystem guide restricts extension code to the extension's storage and temp directories. Do not access arbitrary Documents, Downloads or Desktop paths. Child processes and native addons must obey the same restrictions.
- Webviews are modal dialogs. The documented message pattern returns a result string and closes the dialog; this beta documentation does not describe a persistent always-on editor or general bidirectional host messaging.

## Alpha 0.1 recommendation

Build the first proof as an SDK-native Extension:
1. Right-click one AudioClip to invoke the Extension.
2. Resolve the clip handle and inspect its parent track/timing.
3. For the first test, render the isolated track's clip time range pre-FX to WAV.
4. Show a compact modal Webview with waveform and editable Reverse/Gain operation list.
5. Return the operation list as JSON when the modal closes.
6. Run the Node/TypeScript incremental processing/cache engine in the Extension Host.
7. Use a cancellable progress dialog.
8. Import the processed WAV into the Live project and create a new clip on a separate audio track, preserving the original.
9. Report render timing, cache hits and measured storage.

The pre-FX render is track/range based, not a documented raw AudioClip-file render. AOPX-01 must test isolation on a track containing one clip only and report effects of overlaps, take lanes, fades and automation.

Keep the history graph branch-capable from the start. A separate companion application is not required for the Alpha 0.1 proof unless later UI or SDK constraints establish that it is necessary.

## Account and Centercode

The user located and supplied the SDK archive through a different Ableton/Centercode account. Do not infer that this account owns the user's Live license or has the required Live beta entitlement. Verify the actual beta build and account/license eligibility separately.

## Official references

- https://ableton.github.io/extensions-sdk/
- https://help.ableton.com/hc/en-us/articles/27303428331420-Ableton-Extensions-FAQ
- https://www.ableton.com/en/live/extensions/
- https://help.ableton.com/hc/en-us/articles/115001663870-Live-Beta-FAQ
