# AOPX S5 T1 — BUILD-ONLY / NOT AUTHORIZED FOR LIVE

**Do not load, connect or run this extension in Ableton. Do not import or create a clip.**
No Live launcher, `start`, install hook, CLI dependency or `run.ps1` is supplied.
The published source candidate is deliberately locked by `LIVE_TRIAL_ENABLED = false`.
Neither environment variables, modal responses nor command arguments can open that gate.
An eventual trial needs a separate scoped owner decision, reviewed unlock/build and exact artifact.
This build/review delivers code and offline evidence, not a host-ready or production release.

## Authority and ancestry

[Owner authorization #6978869323](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6978869323).
Separate branch `codex/aopx-s5-t1-build-only`, based on reviewed design #70 at
`b2c3ac36c8b0357aa1e248417769e7a73e43da20`; its draft PR targets
`codex/aopx-s5-design-safety`. Existing #56/#64/#65/#66/#68/#70 are untouched and unmerged.
Design history is inherited, not reimplemented or silently merged into canonical.

Uses the canonical pure WAV and Reverse/Gain kernels (also used in the read-only T8 lineage).
T8-0 Fix 2 `1ccaed1a6003238a4c8546a5dc93607265c31bfd` supplies the verified context-menu handle,
canonical parent, overlap/read-only render and modal patterns. No old editor/probe is edited.
The standalone T1 UI is deliberately small and does not duplicate the canonical editor task.

SDK types are pinned to `@ableton-extensions/sdk@1.0.0-beta.1`, API `1.0.0`:
[evidence matrix](../s5-design/SDK_EVIDENCE.md). Local static compile uses the installed package's
`dist/index.d.mts`, SHA-256 `b0b6d355c3459c14e7729e3641d26a1592b53f65f65e1664652a8a9b1ad3570a`.
The actual SDK is **never imported or executed by tests/build scripts**. CI uses an explicitly
handwritten minimum declaration stub and test-only mock runtime; those are not SDK distribution.

## Controlled flow and exact future effects

The source is the context-menu AudioClip, whose parent must be a regular Arrangement AudioTrack
present in the current song. Require exactly one clip on the source track, no populated Session
slots, no take lanes, no devices or group routing; source must be unwarped, unlooped, unmuted.
Require finite nonnegative start, two-beat duration and exactly 120 BPM. Resolve **exactly one**
regular AudioTrack named `AOPX RESULT`, separate from source, completely empty of Arrangement and
Session clips, lanes and devices. Duplicate names, type mismatch, unknown/throwing reads or state
drift fail closed. These restrictions are intentionally narrower than general AOPX.

No setter of any source/target property exists. Capture source and target IDs, song ID, source path,
clip markers, names, warp/loop/timing and track state in a private snapshot. Recheck after rendering,
after explicit confirmation/export, before each host request and after creation. Snapshot equality
is not source-file hash identity, a lock on Live, or proof against native changes between calls.

Future owner-controlled invocation, **after a reviewed unlock**, would:

1. Acquire single-flight lock, refuse any prior claim/receipt, preflight and render the source range
   pre-FX to owned temp. Bounded read refuses nonregular/linked/outside-root files and checks size,
   descriptor identity and changes around the read. Never read the source media path directly.
2. Require exactly 48,000 frames, 48 kHz mono/stereo, strict complete RIFF/chunk/byteRate admission,
   non-extensible PCM/IEEE float and finite decode. Apply Reverse then Gain −3 dB in memory,
   output float32 WAV preserving frames/rate/channels and verify full output. At this one-second
   frame cap the kernels do not use their long-buffer event-loop yield path.
3. Show a separate confirmation, default Cancel, checkbox recovery/context attestation and exact
   typed phrase `IMPORT ONCE TO AOPX RESULT`, with a fresh nonce. A dry preview is never Apply.
   It has no host effects. Invalid/cancel/closed/stale/extra-field envelopes cannot authorize import.
4. Persist intent/claim, write an exclusive unique owned-temp WAV, sync and revalidate its hash.
   After another snapshot check, request **one** `resources.importIntoProject(ownedPath)`.
5. Record its returned copy path privately, recheck the snapshot, then request **one**
   `AudioTrack.createAudioClip({ filePath: importedPath, startTime, isWarped: false })` on the
   existing target. No track creation, Session insertion, rename, mute/routing/warp/loop edit,
   replacement, deletion, transaction wrapper, automatic Undo, cleanup or retry is implemented.
6. Verify returned clip identity, parent, returned copy path, start/end within one sample at
   120 BPM (1/24,000 beat), warp/loop off, exactly one result clip and unchanged source snapshot.
   Report `verified` only for those observable checks, never byte-identical saved Set or audio proof.

**Duration decision:** omit optional `duration` so the exactly one-second output supplies natural
length. Explicit two-beat clamping is not presumed correct. Returned geometry is verified after
creation, with finite values; a mismatch is partial/unknown outcome, not success. Native natural
length/rounding and `isWarped:false` are still future host observations. No alternate-duration
experiment is included.

## Recovery and privacy

The first preparation intent obtains a permanent exclusive `CLAIM` under the extension's own
storage `aopx-s5-t1-receipts/`; per-stage JSON records are exclusive, checksummed and synced.
Before request = intent; after acknowledgment = ack. Imported path/handles are local private
receipt details only. Normal logs contain generated UUID, fixed stage/status/event only; raw SDK
exceptions, names, paths, snapshots and modal payloads never go to logs/results. Logs themselves
are not a recovery journal. OS ACL protection (especially Windows) is not guaranteed by Unix mode.

An import/create rejection, timeout (30 s), cancellation/interruption after a request, receipt
write failure or post-create mismatch returns `unknown-outcome`; it never means rolled back.
A timed-out late Promise result cannot schedule creation or replay. There is one attempt per
controller and persistent claim; even a fresh controller refuses residual files. No code releases
the claim, resets operation state, deletes media, invokes Undo, kills Live or reuses saved handles.
Preview cancellation is harmless and does not consume the operation; a later invocation requires
new nonce/confirmation. During requests the SDK supplies no native cancellation mechanism. The
current UI offers Cancel before import only; tests also exercise an AbortSignal between stages.

After a failed/uncertain trial: **stop, retain owned output and all host-managed media/receipts**,
manually inspect the named disposable Set. Normal close without saving and reopen of the verified
separate baseline is the recovery fallback; orphaned project media may remain. Never auto-delete
project media or blindly repeat Ctrl+Z. Restart only produces a reconciliation requirement.
`inspectReceipt` is an offline checksum check returning `reconcile-only`, not a replay tool.

Exclusive writes and file `sync()` are tested; there is **no claim of filesystem transactionality,
power-loss/directory-fsync durability, native host atomicity or stable Set/handle identity**.
Parent-path races/reparse behavior under hostile concurrent filesystem changes are not proven
eliminated on Windows. The owned roots and receipt directory must be trusted, not shared with
concurrent editors; no such concurrency is allowed in the future trial.

## Offline build and tests only

Run from repository/package root as indicated; Node 24.22.1 or 26.13.0. Use the existing pinned
engine compiler dependencies (`npm ci --ignore-scripts` in `ableton-offline-processing/engine`);
there are no new dependencies, upgrades or SDK/CLI install scripts.

```powershell
# Repository root; pure/mock and synthetic scratch-filesystem tests, no Live connection:
node --test --test-reporter=spec ableton-offline-processing/spikes/s5-t1/test/*.test.ts ableton-offline-processing/spikes/s5-design/fake-host.test.mjs
node ableton-offline-processing/spikes/s5-t1/ci/build.mjs
```

For local real-SDK **declaration-only** compilation, append `--sdk-types <absolute index.d.mts>`.
For an already installed external compiler append `--tsc <absolute typescript/lib/tsc.js>`.
The build invokes TypeScript only, emits JS under ignored `.build/` and never loads the SDK/CLI.
No host-load/bundling compatibility claim is made; the source ZIP excludes emitted JS and the SDK.

CI runs mock compile and all tests on Windows/Linux × Node 24/26. Candidate publication is
closed until a coordinator comment headed `## Independent T1 review — PASS` records the exact
head SHA after an actual fresh review. Re-running the `candidate` job then checks out that head,
revalidates the recorded review and emits a deterministic source-only ZIP plus provenance manifest.
This is a publication gate, not a formal GitHub approval or Live authorization. Local/coordinator
must verify the genuine review before posting that marker. No ZIP is published by unreviewed PR CI.

The ZIP contains only this candidate's sources/docs/mock tests, three required engine sources and
the existing engine compiler lockfile, plus design evidence. `BUILD_ONLY_MANIFEST.json` records
reviewed SHA and SHA-256 of every included source, with fixed ZIP timestamps. No SDK, node_modules,
secrets, personal audio, project files, installer or launcher. Re-extract and run offline tests to
verify the source package; do not place it in Live's extension path.

## Evidence boundary / next approval packet

Offline tests exercise the actual controller and adapter against fakes, closed activation against
a mock SDK, Gemini's valid-WAV/missing-expected case, DSP arithmetic, malformed/oversize audio,
source/target admission/drift, duplicate clicks, cancellation, persistent receipts, late ack loss,
partial result/failure, log privacy and owned-filesystem checks. A symlink test may skip where the
OS denies creating a scratch link; disclose skips. No tests open existing media or Sets.

Before **any** future loading/execution, owner must approve the exact reviewed unlocked build and
artifact, allowed one import/one create, disposable Set identity, actual source frames/hash/rate,
120 BPM/source/target isolation and selection, single CLI/stopped transport, manual fade/automation/
routing exclusions (not exposed fully in beta.1), separate collected-media backup and tested
discard/reopen recovery. Existing owner backup verification is accepted within its stated scope;
source/media checksum and current state still need recording. Host Undo/Redo, import retention,
audible correctness, natural-length behavior and crash recovery remain untested. Stop here.
