# S5 SDK evidence matrix — 1.0.0-beta.1

Research date: 2026-11-18. **Static inspection only; no SDK runtime or Live invocation.**
Companion [readiness memo](README.md) controls the design and gates.

## Provenance and interpretation

The user-supplied `extensions-sdk-1.0.0-beta.1.zip` is 2,144,848 bytes, SHA-256
`eae6918f786a854cd5248967676eb132491f3d0d49e0bf95df768aa2b8347ca2`.
Its root is `extensions-sdk-1.0.0-beta.1/`. The installed reference root inspected read-only was
`F:/Downloads/extensions-sdk-1.0.0-beta.1/extensions-sdk-1.0.0-beta.1/`.
Paths below are relative to that SDK root, **not repository paths**.

The package `ableton-extensions-sdk-1.0.0-beta.1.tgz` declares
`@ableton-extensions/sdk@1.0.0-beta.1`, Node `>=24.16.0`, targeting API `1.0.0`.
Its SHA-256 is `1770f795c18901023d9df8129575c9a86b4e7255011c5295b2b98d0b73010c8e`.
Within that tarball, `package/dist/index.d.mts` has SHA-256
`b0b6d355c3459c14e7729e3641d26a1592b53f65f65e1664652a8a9b1ad3570a`.
Declaration line numbers below refer to that exact file (the CJS equivalent is `index.d.cts`).

`package/dist/index.mjs.map` includes original TypeScript in `sourcesContent`, with paths
`../src/*.ts`. Source references below name those embedded files, with their own line numbers.
The distributed JS wrapper is available, **not the implementation of Live's native host**.
No SDK content is copied into this PR. The modified installed `audio-clips` example contains
owner test edits; example citations use the unmodified source from the original ZIP instead.

**Verified** means a declaration, wrapper implementation, guide or example was inspected;
it does not mean real-host behavior was tested. **Inferred** means design reasoning from those
facts. **Unavailable** means absent from the inspected public SDK surface, not impossible
inside Live. Prior **owner-observed** results are separately attributed.

## Signatures and limits

Here `V` means the SDK's `Version extends ApiVersion` generic.

| Need | Exact public surface / evidence | Status and safety consequence |
|---|---|---|
| Pre-FX render | `Resources<V>.renderPreFxAudio(track: AudioTrack<V>, startTime: number, endTime: number): Promise<string>`; declarations 770–774; embedded `src/Resources.ts:19`; ZIP `examples/strip-silence/src/extension.ts:113` | **Verified**: Arrangement positions in beats; track/range pre-effects audio in extension temp; format follows Record File Type. Not raw individual-clip identity or post-FX audio. No signal parameter. |
| Import | `Resources<V>.importIntoProject(filePath: string): Promise<string>`; declarations 780; `src/Resources.ts:41`; ZIP `examples/audio-clips/src/extension.ts:39` | **Verified**: host copies into project; returned copy path must be used. No delete-import, durable receipt, hash-readback, overwrite/collision, deduplication, crash, cancellation or Undo contract exposed. |
| New track | `Song<V>.createAudioTrack(): Promise<AudioTrack<V>>`; declarations 672; `src/Song.ts:104` | **Verified**: inserted after last selected track, or appended if none selected. Does not guarantee adjacency to source; no index argument. Properties/clip creation depend on the returned object. |
| Arrangement clip | `AudioTrack<V>.createAudioClip(args: { filePath: string; startTime: number; duration?: number; isWarped?: boolean; loopSettings?: ClipLoopSettings }): Promise<AudioClip<V>>`; declarations 598–604; `src/AudioTrack.ts:53`; ZIP example 40 | **Verified**: start/duration in beats; non-looping duration capped at natural sample length; default duration follows natural length at current tempo. Omitted warp flag uses saved `.asd` settings or Auto-Warp preference; explicitly pass `false` for proposed first trial. |
| Loop settings | `ClipLoopSettings { looping: boolean; startMarker: number; endMarker: number; loopStart: number; loopEnd: number }`; declarations 62–86 | **Verified**: all positions in beats; start ≤ end; loop at least 0.25 beats; when not looping, loop/start/end markers must match; unwarped positions nonnegative and looping false. Existence of these fields does not prove exact original playback reconstruction. |
| Session alternative | `ClipSlot<V>.createAudioClip(args: { filePath: string; isWarped?: boolean; loopSettings?: ClipLoopSettings }): Promise<AudioClip<V>>`; declarations 437–441 | **Verified**: no Arrangement position/duration. ZIP example 18–19 contains fixed markers; owner report found them unsafe for a short sample. Not chosen for Arrangement return. |
| Existing take lane alternative | `TakeLane<V>.createAudioClip(args: { filePath: string; startTime: number; duration?: number; isWarped?: boolean; loopSettings?: ClipLoopSettings }): Promise<AudioClip<V>>`; declarations 482–488 | **Verified** API; **unavailable** evidence for a complete comping/audibility/recovery policy. Not chosen. |
| Transactions | `ExtensionContext<V>.withinTransaction<T>(fn: () => T): T`; declarations 870–886; embedded `src/Initialize.ts:59,95`; `src/transaction.ts:18,40` | **Verified** synchronous scope, nested grouping; async wrappers initiate a request inside a transaction and resolve its callback later. The context binds directly to the host method. No rollback logic in wrapper. A Promise return does not extend a synchronous scope across `await`. |
| Dependent new-track/clip operations | `docs/essentials/concepts/4-transaction.html`, sections “Synchronous Logic and Async Operations”, “Chaining Modifications” | **Verified** guide explicitly requires sequential transactions for creation followed by modification of the returned objects. **Inferred**: new track + dependent clip cannot be promised as one Undo entry with the documented pattern. |
| Undo/Redo | Same guide and `withinTransaction` declaration document grouped user Undo/Redo | **Verified** grouping contract; **unavailable** public programmatic `undo`, `redo`, rollback, commit/abort, undo-stack tokens or exception/crash reversal guarantee. **Owner-observed** single Arrangement clip Ctrl+Z/Ctrl+Y only, [report](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6908336792). |
| Compensation candidates | `Song<V>.deleteTrack(track: Track<V>): Promise<void>` (684); `Track<V>.deleteClip(clip: Clip<V>): Promise<void>` (540); `ClipSlot<V>.deleteClip(): Promise<void>` (427) | **Verified** public deletion requests. **Unavailable** proof of reliable compensation, ownership across restart, atomicity, or imported-file reclamation. Not implemented or exercised here. Deletion is another mutation, not rollback. |
| Clip/source identity | `DataModelObject<V>.handle: Handle`, `get parent(): DataModelObject<V> \| null` (369–377); `Handle { id: bigint }` (21–23); `AudioClip<V>.get filePath(): string` (402) | **Verified** handle/object hierarchy and file path reads. Handles must come from host. **Unavailable** persistent Set/clip/source identity across restart, stable source content hash, unrestricted read of project media. Never construct/reuse saved handles blindly. |
| Clip timing and playback reads | `Clip<V>` getters `startTime`, `endTime`, `duration`, `startMarker`, `endMarker`, `loopStart`, `loopEnd`; read/write `name`, `muted`, `looping`; declarations 380–396 | **Verified** surface. Timeline beat units are documented for render/create; getter-specific edge semantics still need observation. Enabling looping on an unwarped clip enables warping. |
| Warping | `AudioClip<V>` read/write `warping: boolean`, `warpMode: WarpMode`; read-only `warpMarkers: WarpMarker[]`; `WarpMarker { sampleTime: number; beatTime: number }`; declarations 35–38, 403–407 | **Verified** getters/setters as listed. **Unavailable** warp-marker setter or full arbitrary map reconstruction. No constructor option for warp mode. |
| Source replacement | `AudioClip.filePath` has getter only; no AudioClip replace-source method. `Simpler.replaceSample(filePath: string): Promise<Sample<V>>` exists at 973 | **Unavailable** AudioClip source replacement; Simpler is a different device API and is outside S5. No overwrite of original files is permitted. |
| Fades/gain/pitch/post-FX | No clip fade-envelope, clip gain/pitch setters, post-FX render or full routing reconstruction in inspected declarations | **Unavailable** public surface for reliable original-state reconstruction. Do not invent Live Object Model names as SDK members. |
| Progress/cancel | `Ui<V>.withinProgressDialog(text: string, options: { progress?: number }, callback: (update: (updateText: string, progress?: number) => Promise<void>, abortSignal: AbortSignal) => Promise<unknown>): Promise<unknown>`; declarations 834–836 | **Verified** signal supplied to callback, update percentage 0–100. Import/render/create signatures accept no AbortSignal. **Unavailable** mid-request host cancellation guarantee. |
| Storage/temp | `Environment.storageDirectory`, `Environment.tempDirectory`: getters `string \| undefined`; declarations 743–752; filesystem guide | **Verified** extension-owned persistent/temp roots; temp may be cleaned between sessions. Project copy is host-managed, not extension-owned cleanup material. |

## Documentation conflicts and access

The bundled filesystem guide demonstrates positional `createAudioClip(importedPath, false)`;
this conflicts with the actual object-argument declaration and original `audio-clips` example.
Use the **beta.1 types and implementation**, not that stale guide snippet. The guide also calls
the rendered path a WAV, whereas `Resources` explicitly permits AIFF according to preferences.
Validate bytes. The transaction guide's user-visible atomic/UI grouping paragraph does not
state that rejected async operations or thrown callbacks reverse prior host/file effects.

Bundled guide checksums:

| Path | SHA-256 |
|---|---|
| `docs/essentials/concepts/4-transaction.html` | `4e4bbe2ffb941f23ba03c6f44d67da16bf39fb84f93b08093619dfe2ed7d145a` |
| `docs/essentials/concepts/6-resources-and-filesystem.html` | `52b63a8ce8fb88e0267a69d6e7b182fa9afd6b4030c6f24122ad62dd2c2f8e59` |

The [public Ableton SDK page](https://ableton.github.io/extensions-sdk/) was fetched on the
research date. It states beta availability and links to the SDK/documentation download on
Centercode; it does not publish these versioned signatures. Deep public guide URLs were
unavailable to the web tool. No private Centercode login or latest-version equivalence is claimed.
Published documentation was inspected from the user's exact bundled release HTML, including
`api/classes/{Resources,AudioTrack,AudioClip,Song}.html`. The downloadable bundle is the
reproducible evidence source; online beta changes cannot silently supersede it.
