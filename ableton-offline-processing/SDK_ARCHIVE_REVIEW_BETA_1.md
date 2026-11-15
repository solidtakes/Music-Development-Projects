# SDK Archive Review — 1.0.0-beta.1

**Source inspected:** user-provided `extensions-sdk-1.0.0-beta.1.zip`  
**Archive size:** 2,144,848 bytes  
**Review scope:** bundled documentation, API reference, examples and npm package metadata. No Live installation or SDK runtime was executed during this review.

## 1. Archive contents

The ZIP contains:
- `ableton-extensions-sdk-1.0.0-beta.1.tgz`
- `ableton-extensions-cli-1.0.0-beta.1.tgz`
- `ableton-create-extension-1.0.0-beta.1.tgz`
- Offline HTML documentation and generated API reference
- Seven examples: strip-silence, progress-dialog, arrangementselection, warpMode, context-menu, audio-clips and modal-dialog

The npm package metadata for all three packages declares `engines.node >=24.16.0`. The Quick Start page says Node.js >=24.14.1, so use the stricter package-engine requirement: Node 24.16.0 or later in the Node 24 line. Confirm `node --version` before installing.

The Quick Start says to use the Live Beta build supplied from the SDK release page in Centercode. The execution guide's example path is `/Applications/Ableton Live 12.4 Beta.app`. This archive alone does not prove compatibility with stable Live 12.5 or Live 13. Use the exact compatible beta build from the SDK release page and a disposable Set.

## 2. Key capabilities proven by the included documentation/examples

### Node.js audio/file processing

The introduction says Extensions run in Node.js alongside Live, support JavaScript/TypeScript and the npm ecosystem, and can transform audio files with external tools.

The official `strip-silence` example:
1. Receives an Arrangement time selection and selected audio tracks.
2. Calls `context.resources.renderPreFxAudio(track, startBeat, endBeat)`.
3. Reads the returned WAV from the extension temp directory with Node `fs.readFile`.
4. Decodes and analyses audio using npm package `audio-decode`.
5. Modifies the Arrangement in a transaction.

This confirms that offline file-based audio analysis/processing inside an Extension is a supported design direction. Alpha 0.1 Reverse and Gain can be implemented as ordinary Node/TypeScript file operations; a native C++/JUCE engine is not required for the first proof.

### Audio acquisition and its important limitation

API reference:
`Resources.renderPreFxAudio(track, startTime, endTime)` renders the **pre-effects audio of an AudioTrack** between Arrangement beat positions and writes the result to the Extension temp directory.

The file format follows Live's **Record File Type** setting. The included Strip Silence example supports WAV only and explicitly warns if Live renders AIFF. For Alpha 0.1, set Live's Record File Type to WAV and verify this before rendering.

This method is track/range based, not a documented raw-file render method for an individual AudioClip, and it is explicitly pre-FX. It does not render the track's device chain. For a safe first test, use one clip on an otherwise empty/isolated audio track and verify the returned render contains only the intended clip. Overlapping clips, take lanes, fades, automation and boundary behaviour require tests.

### Clip context and clip metadata

The SDK supports context-menu actions scoped to `AudioClip`. The command receives the clicked clip's Handle, which can be resolved to an `AudioClip`.

The bundled `AudioClip` API reference lists:
- Read-only: `filePath`, `duration`, `startTime`, `endTime`, `startMarker`, `endMarker`, `loopStart`, `loopEnd`, `warpMarkers`
- Writable: `name`, `muted`, `warping`, `warpMode`, `looping`
- `warpMarkers` is documented as a getter returning an array; no setter or warp-marker editing method appears in this API reference.
- The `AudioClip` and base `Clip` references do **not** document clip-level transpose or clip gain properties.

Correction to earlier planning: do not rely on `pitch_coarse`, `pitch_fine` or per-clip `gain` as Extensions SDK AudioClip properties. Those properties are not present in this archive's generated AudioClip/Clip API. Implement Reverse and Gain as rendered audio operations for Alpha 0.1. Warp enabled/mode and basic loop settings are available, but exact arbitrary warp-marker reconstruction is not proven.

The `filePath` accessor is read-only. Do not assume the extension can directly read the returned project-media path: the filesystem guide restricts extension code to its own storage and temp directories.

### Returning processed audio to Live

The API reference documents:
- `context.resources.importIntoProject(filePath)`: host-side copy of an output file into the Live project; always use the returned imported path for later API calls.
- `AudioTrack.createAudioClip({ filePath, startTime, duration, isWarped, loopSettings })`: creates an Arrangement audio clip from a file.
- `Song.createAudioTrack()`: creates an audio track.

Safe Alpha 0.1 approach: preserve the original clip, import the processed WAV into the project, and create the processed result on a separate new audio track at the original Arrangement beat position and duration. Test warp/loop restoration explicitly. The API permits setting warp mode and basic loop settings, but does not document arbitrary warp-marker writes.

### User interface and task lifecycle

The SDK supports custom HTML/CSS/JavaScript Webviews through `context.ui.showModalDialog(url, width, height)`. The modal returns a string to the Extension when the Webview posts `close_and_send` through the platform message handler.

The docs describe Webviews as modal dialogs. The Webview runs in a separate environment; the documented communication pattern returns a result and closes the dialog. No general persistent bidirectional UI messaging API is documented in this beta archive.

For Alpha 0.1, use a compact modal editor UI: source details/waveform, editable ordered operation list, Reverse/Gain controls, then submit the operation list as JSON. After the dialog closes, run processing in Node and use `withinProgressDialog` for progress/cancellation. A result/diagnostics modal can show measured render times and disk usage after processing. This is a suitable prototype UI, not proof of a persistent always-open desktop editor.

The design guide explicitly says Extensions are not designed for real-time audio/MIDI manipulation, drawing into Live's native UI, background extensions running without Live open, or Control Surface integration.

### Filesystem and cache locations

The filesystem guide documents:
- `context.environment.storageDirectory`: persistent per-extension storage, suitable for settings, cached state and data that should survive Live sessions.
- `context.environment.tempDirectory`: temporary audio/intermediate files; may be cleaned between sessions.

Extensions should not access arbitrary Documents, Downloads or Desktop paths. The guide says child processes and native addons must obey the same filesystem restrictions; do not work around the sandbox. Use `importIntoProject` when the host needs to import an external file.

For the history engine, use the persistent storage directory for manifests and retained content-addressed cache, and temp for disposable renders. Measure actual file sizes. Implement cache cleanup/retention deliberately.

### Device/plugin limitations

`AudioTrack.insertDevice(deviceName, index)` is documented as inserting a built-in Live device only; the API explicitly says third-party plug-ins cannot be loaded this way.

Combined with `renderPreFxAudio` being pre-FX, this archive does not provide a documented way to offline-render the Live track device chain or host third-party VST3/AU plug-ins. Keep those as later research/architecture work. Do not claim that the Extensions SDK itself supplies VST3, AU or ARA hosting.

## 3. Recommended Alpha 0.1 architecture update

Prefer an **SDK-native proof** over a separate companion application for the first milestone:

1. User right-clicks one AudioClip and chooses “Offline Process”.
2. Extension resolves the AudioClip handle and validates its parent audio track.
3. Extension records clip timing and basic warp/loop metadata.
4. Extension renders the isolated track range pre-FX to the Extension temp directory as WAV.
5. Extension computes waveform peaks and shows a polished modal Webview.
6. User builds a linear operation list: Reverse -> Gain.
7. Webview returns the serialized operation list and closes.
8. Extension's Node process runs the incremental graph/cache engine, with a cancellable Live progress dialog.
9. Extension imports the processed WAV into the Live project and creates a new clip on a separate audio track, leaving the original untouched.
10. A result dialog/log reports render times, cache hits, output sizes and cache footprint.

The underlying operation model must remain branch-capable even though the first Webview shows a linear list.

This flow is a design recommendation from the documented APIs, not yet a tested integration. The following must be proven in a compatible Live beta: AudioClip parent resolution, whether pre-FX rendering of the clip's track/time range isolates the intended clip, exact audio duration/sample count, UI return flow, and creation of a new output track/clip with correct Arrangement placement.

## 4. Next actions

- AOPX-01: use this archive to build the official minimal Extension; verify exact compatible Live beta; test AudioClip context menu, pre-FX WAV render, modal Webview, import and new-clip creation. Report any SDK gaps. Do not install or alter production Live 12.5/13.
- AOPX-02: build the Reverse/Gain graph/cache engine as Node/TypeScript modules that can run inside the Extension Host. Keep a standalone test harness if it speeds deterministic testing, but avoid making a native companion application a requirement for Alpha 0.1.
- AOPX-03: implement the first GUI as the SDK modal Webview after the engine interface is stable. Do not assume a persistent webview or live bidirectional host messaging.

## 5. What was not done

- No SDK package was installed.
- No Node dependencies were installed.
- No Extension was built or run.
- No Live installation or Set was opened or modified.
- No audio was rendered.
- No compatibility claim for stable Live 12.5 or Live 13 is made.
