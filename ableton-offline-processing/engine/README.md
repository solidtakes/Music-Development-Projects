# AOPX Engine — Alpha 0.1 (AOPX-02)

Edition-independent offline audio engine for the Offline Processing Suite. It covers WAV I/O, Reverse and Gain, an editable history stored as a branch-capable version graph, a content-addressed immutable cache with downstream-only invalidation, and project save/reopen with measured render times and real disk usage.

It has no dependency on the GUI, the Ableton SDK adapter or a plugin host. Those are out of scope for this milestone.

## Stack

- **TypeScript with zero runtime dependencies.** Code runs directly in Node via built-in type stripping, so there is no build step inside the Extension. The code uses erasable syntax only (`erasableSyntaxOnly`, `verbatimModuleSyntax`) and imports with `.ts` extensions.
- **Runtime:** Node ≥ 22.18. The target is the Live-bundled Node 24.22.1, which strips types by default. Development ran on Node 22.23.4; the full check (typecheck, tests, demo) has since also passed on a standalone Node 24.22.1 on Linux (see [Verification status](#verification-status)). Every API used exists in both: `AbortSignal.any`, `node:test`, `fs/promises`, `crypto`.
- **WAV codec:** an in-house reader/writer in `src/wav.ts`. Owning the codec gives exact control over quantization, clipping, chunk validation and deterministic output bytes, and the cache and correctness guarantees depend on all four.
- **Tests:** `node:test` and `node:assert`.
- **Dev-only dependencies:** `typescript` (≥ 5.8, for `erasableSyntaxOnly`; also checked with tsc 7.0.2) and `@types/node`. `package-lock.json` (lockfile v3) pins TypeScript 5.9.3, @types/node 24.19.2 and undici-types 7.24.6, so `npm ci` gives a reproducible install.

## Commands

```sh
cd ableton-offline-processing/engine
npm ci                   # reproducible install from package-lock.json (dev-only: typescript, @types/node)
npm run check            # standard gate: typecheck, then the full test suite, then the acceptance demo
npm run typecheck        # tsc --noEmit
npm test                 # node --test "test/**/*.test.ts"
npm run demo             # acceptance demo alone (30 s stereo 24-bit fixture)
node scripts/demo.ts --seconds 60 --format float32 --verify size --storage ./.demo-storage
```

Demo options:
- `--seconds N`
- `--channels N`
- `--sample-rate N`
- `--format pcm8|pcm16|pcm24|pcm32|float32|float64`
- `--verify hash|size`
- `--storage DIR`
- `--json`

The demo exits non-zero if any check fails, which also fails `npm run check`. It writes `demo-report.json` into the storage directory, which defaults to a fresh OS temp directory, so a default run leaves nothing in the worktree. `.demo-storage/` is git-ignored for runs that use `--storage ./.demo-storage`.

## Modules

| File | Role |
|---|---|
| `src/contract.ts` | Shared cross-workstream contract (unchanged from `7c169c8`). |
| `src/wav.ts` | RIFF/WAVE parse and encode, metadata, typed `WavError`. |
| `src/dsp.ts` | Reverse and Gain kernels (cancellable, block-wise), waveform peaks. |
| `src/operations.ts` | Operation registry, parameter normalization, conversion to and from the contract. |
| `src/processor.ts` | Processor-adapter seam for future native, VST3 and AU processors (design only). |
| `src/hash.ts` | sha256 and canonical JSON. |
| `src/cache.ts` | Content-addressed immutable cache. |
| `src/graph.ts` | Version DAG, branches and the linear projection. |
| `src/project.ts` | Sources, plans, render orchestration, persistence, diagnostics. |
| `scripts/demo.ts` | Acceptance demonstration. |

## WAV support

- **Read:**
  - PCM 8-bit (unsigned) and 16/24/32-bit (signed, little-endian).
  - IEEE float 32/64-bit.
  - `WAVE_FORMAT_EXTENSIBLE` with a PCM or float sub-format.
  - Unknown chunks are skipped, with odd-size padding honoured.
- **Write:**
  - Plain `WAVE_FORMAT_PCM` or `WAVE_FORMAT_IEEE_FLOAT` (float files get a `fact` chunk).
  - No metadata chunks and no timestamps, so identical audio always produces identical bytes.
- **Rejected with typed errors:**
  - Compressed formats (ADPCM, µ-law, A-law and others).
  - RF64/BW64 (files over 4 GiB) and big-endian RIFX.
  - Truncated `data` chunks and partial frames.
  - A `blockAlign` that doesn't match the format.
  - A missing `fmt` or `data` chunk.
  - Non-finite float samples.
- **Format policy:** each node's output keeps the source's sample rate, channel count, frame count and sample format. The engine never changes the format silently.

## DSP semantics

- **Reverse** moves complete interleaved frames, and channel order within a frame is preserved. It is lossless.
- **Gain**
  - Converts dB with `10^(dB/20)`, applies it in float64 and uses one factor for all channels.
  - Accepts the range [`GAIN_MIN_DB`, `GAIN_MAX_DB`] = [-60, +24] dB and refuses values outside it rather than clamping.
  - Canonicalizes values to 1e-6 dB.
- **PCM quantization:** `floor(x·2^(n-1) + 0.5)`, then hard saturation to `[-2^(n-1), 2^(n-1)-1]`. No dither and no normalization. Saturated samples are counted as `clippedSamples` in the node record.
- **Float output:** values above 0 dBFS are preserved, not clipped.
- **Between operations:** each operation consumes the *stored, quantized* output of its upstream node. A node's bytes are therefore identical whether its upstream came from the cache or a fresh render.

## Acceptance tolerance

The acceptance comparison is **bit-exact (tolerance 0)**. It compares the sha256 of the output file after removing Reverse with the sha256 of an independently computed direct Gain on the original.

This is achievable because Reverse is lossless and the re-render runs the same Gain kernel on the same immutable source. A separate test checks Gain plus encode against an independent float64 reference within **0.5 LSB** for PCM, 2⁻²⁵ for float32 and exact for float64. That is the rounding bound of the quantizer; the tolerance was not loosened to make the test pass.

## History model

**Nodes are immutable.**
- Each source gets a root node, `src:<sha256>`.
- An operation node is `n:<sha256(parent node, normalized op)>`.
- A normalized op records its stable operation id, type, schema version, enabled flag and canonical parameters.

**Branches are named heads with revision counters.**
- Committing a plan rebuilds the chain from the root. Because nodes are content-addressed, an unchanged prefix maps to the same nodes.
- An edit at position N therefore creates new nodes only from N on. Earlier versions stay in the graph as alternates.

**The linear list is a projection.** The Alpha 0.1 linear history list (`Project.history(branch)`) is the root→head path of one branch.

**Per-node render records** hold status, cache key, render ms, lookup ms, bytes, format, clipped samples and error.

**Branching** works from any node with `createBranch(name, { node } | { branch })` and `extendBranch`. Committing to one branch never touches another branch's head or nodes.

## Cache identity

`key = sha256(canonicalJson(inputs))`. The inputs are:

| Field | Contents |
|---|---|
| `engineVersion`, `contractVersion` | Engine and contract versions. |
| `sourceFingerprint` | sha256 of the source WAV bytes. |
| `upstreamKey` | Key of the upstream render, or `null` when the input is the source. |
| `operation` | `{ type, schemaVersion }` |
| `processor` | `{ format, uniqueId, version, binaryHash, stateHash }` (see `processor.ts`) |
| `params` | Normalized parameters. |
| `settings` | `{ sampleRate, channels, outputEncoding, outputBitDepth, clipMode, quality, dither }` |

Consequences:
- **Disabling equals removing.** A bypassed operation contributes nothing, and its upstream key passes straight through. Disabling Reverse is therefore identical to removing it, and both produce the same Gain key as a direct Gain on the original.
- **Downstream-only invalidation.** Changing node N changes N's key and, through `upstreamKey`, every downstream key. Upstream keys are untouched and keep hitting.
- **Safe lookups.** A lookup returns an entry only if all of these match the request:
  - the metadata parses;
  - the stored key and full key inputs equal the request;
  - the expected output format matches;
  - the object exists with the recorded size;
  - the WAV header agrees with the recorded format;
  - in `hash` mode (the default), the object's sha256 matches.

  Any mismatch is a miss, and the entry is evicted. `size` mode skips the full re-hash for faster lookups.
- **Atomic publishing.** Entries are written through `staging/`, renamed into place and set to 0444. The metadata file is renamed last and acts as the commit marker.

## Cancellation and stale renders

- `render(branch, { signal })` checks for cancellation between operations and between 65,536-frame blocks.
- A newer `render()` on the same branch aborts the in-flight one.
- A commit to the branch during a render makes that render return `superseded`.
- Cancelled or superseded renders never publish a branch output. Cache entries already committed remain valid, because they are correct for their keys.

## Storage

```
<storageRoot>/project.json            schema-versioned manifest (atomic write, migration table)
<storageRoot>/sources/<sha256>.wav    immutable source copies (0444)
<storageRoot>/cache/objects/…         immutable renders + metadata
<tempRoot>/…                          disposable exports (exportOutput), for Live import
```

`storageRoot` maps to the Extension's `storageDirectory`, and `tempRoot` to its `tempDirectory`.

All byte counts come from `fs.stat`. `collectGarbage()` keeps only the entries referenced by each branch's latest completed output.

## Measurements

These are from `scripts/demo.ts` on Node 22.23.4 in a Linux cloud sandbox, with stereo at 48 kHz unless noted. Times are wall-clock milliseconds. The Node 24.22.1 runs checked pass/fail only; they did not repeat or validate these measurements.

| Fixture | Source size | Reverse miss | Gain miss | Gain re-render after removing Reverse | Hit lookup, `hash` mode | Hit lookup, `size` mode | Cache after demo | Project after demo |
|---|---|---|---|---|---|---|---|---|
| 30 s pcm24 | 8.24 MiB | 96.6 | 61.7 | 57.6 | 11.7 | — | 41.20 MiB | 49.45 MiB |
| 60 s pcm24 | 16.48 MiB | 168.3 | 127.6 | 108.8 | 19.6 | 1.3 | 82.40 MiB | 98.89 MiB |
| 60 s float32 | 21.97 MiB | 181.6 | 64.1 | 79.7 | 39.7 | — | 109.87 MiB | 131.85 MiB |
| 60 s pcm16 mono | 5.49 MiB | 73.9 | 49.5 | 42.1 | 7.5 | — | 27.47 MiB | 32.97 MiB |
| 300 s pcm24 | 82.40 MiB | 762.4 | 419.9 | 610.6 | 88.1 | — | 411.99 MiB | 494.40 MiB |

Render time covers decoding the input (when it isn't already in memory), processing, encoding and the atomic write.

Each rendered node stores one full-size WAV, so the cache grows by roughly the source size per unique node. The demo renders five unique nodes.

## Known limitations

- **Memory and file size.** Files are processed whole in memory as float64: about 8 bytes × samples, plus the input and output buffers. Files over 4 GiB (RF64) are not supported.
- **No automatic eviction.** The cache never evicts on its own. `collectGarbage()` must be called explicitly, and there is no size quota yet.
- **One output format.** The output format always equals the source format. There is no format conversion or dither option.
- **Single process only.** A project is not safe to open from two processes at once; there is no lock file.
- **Hash verification costs time.** `hash` mode re-hashes the whole object on every hit, at about 1 ms per MiB here. `size` mode is faster but cannot detect bit flips of the same length.
- **Standalone Node only.** Node 24.22.1 has been verified as a standalone binary on Windows and Linux CI, not inside Ableton Live's Extension host. The Extension host adapter and the Live round trip are not built or verified yet.
- **Windows file locks.** On Windows, if another process holds a cache object or stored source open (antivirus, a search indexer, or Live reading an exported file), removing or renaming it can fail with `EBUSY` or `EPERM`. The error is surfaced to the caller, not retried. This is untested. (Renaming onto an existing read-only file, which used to fail with `EPERM`, is fixed; see [Verification status](#verification-status).)

## Processor adapter seam (future plugins)

`ProcessorAdapter<P>` in `src/processor.ts` declares:
- `type` and `schemaVersion`;
- `deterministic`, because non-deterministic processors must not be cached without a seed or state contract;
- `normalize`;
- `identity` → `ProcessorIdentity { format: 'native'|'vst3'|'au', uniqueId, version, binaryHash, stateHash }`;
- `outputFormat`;
- an async, cancellable `process`.

`RenderSettings` carries sample rate, channel layout (count), output sample format, clip mode, offline quality and dither. Every one of these fields is part of the cache key.

A future VST3/AU host would implement this interface out of process. It would populate `binaryHash` from the plugin bundle and `stateHash` from the serialized plugin state. **No plugin hosting is implemented in Alpha 0.1.**

## Verification status

Status as of 15 Nov 2026. Canonical `ableton-offline-processing/alpha-0.1` is at `a4f1404`, the merge of PR #36, which landed as the contract-only precursor (`src/contract.ts`, commit `7c169c8`). The engine branch `claude/aopx-02-engine-proof` (PR #41, open and draft) was at `a3868d0` when the runs below were made; that commit merged canonical into the engine branch and changed no engine files.

| Runtime (Linux, standalone Node) | Engine `npm run check` (typecheck + tests) | Engine `npm run demo` | Editor `npm test` | Editor `npm run test:browser` |
|---|---|---|---|---|
| Node 22.23.4 / npm 10.9.9 | pass, 50/50 tests | 15/15 checks | 24/24 | 10/10 |
| Node 24.22.1 / npm 11.19.1 | pass, 50/50 tests | 15/15 checks | 24/24 | 10/10 |

After the lockfile was committed and the demo was added to `npm run check`, a clean `npm ci` followed by `npm run check` passed on both runtimes again: typecheck clean, 50/50 tests and 15/15 demo checks. This was an engine-only run; the editor was unchanged.

### Windows and Linux CI (T4)

Status as of 16 Nov 2026. The workflow `.github/workflows/aopx-engine-windows.yml` runs on `windows-latest` and `ubuntu-latest` with standalone Node 24.22.1 / npm 11.19.1. It does a clean `npm ci`, then `npm run check`, `npm run demo` and `test/fs-portability.test.ts` on its own. That file has 9 tests for read-only (`0444`) cache objects and sources, rename-into-place, eviction, re-publishing over an orphaned object, garbage collection, source re-import, repeated save/reopen and repeated export.

| Commit | Windows (Server 2025, 10.0.26100) | Linux |
|---|---|---|
| `851902b`, `5f8ef49` (tests only, before the fix) | 57/59 tests. 2 × `EPERM` on `rename` onto an existing read-only file, in `ContentCache.publish` and `Project.importSource`. Standalone demo 15/15 | 59/59, 15/15 |
| `58e1aa5` (fix: `writeImmutable` in `src/cache.ts`), [run 43776706507](https://github.com/solidtakes/Music-Development-Projects/actions/runs/43776706507) | **59/59 tests, demo 15/15, fs-portability 9/9** | **59/59, 15/15, 9/9** |

The demo's cache keys are identical on Windows and Linux. The fix never renames onto an existing file: a destination whose sha256 matches is reused, and an invalid one is removed before the staged file is renamed into place.

Not verified:
- **Inside Live.** All runs used a standalone Node binary (Linux locally; Windows and Linux on CI), not Ableton Live's Extension host on any platform.
- **Windows file locks.** Files held open by another process are untested (see [Known limitations](#known-limitations)).
- **Live integration.** The Extension host adapter and the Live round trip (Alpha acceptance tests 11–13) do not exist yet. This engine is a standalone proof.

## Next integration step

Run the engine inside the Live-bundled Node 24.22.1 (Extension host) on Windows. Then wire up the Extension adapter:
1. `renderPreFxAudio` produces a WAV in `tempDirectory`.
2. Call `Project.importSource`.
3. Commit the modal's returned `OperationPlan` with `setPlan`.
4. Call `render`.
5. Call `exportOutput`, then `importIntoProject` and `createAudioClip`.
6. Show the returned `RenderReport` in the diagnostics UI.

The modal envelope (`HostInitialState`, `ModalResult`, `MODAL_ENVELOPE_VERSION`) is defined in `src/contract.ts`. It is parsed and built by the SDK-independent `../host/` package, not by this engine.

**Render timing.** `RenderReport.wallMs` is the measured wall-clock time of the render request, from the start of `render()` until the report is produced. `RenderStep.renderMs` is the time it took to create that cache entry and is carried forward unchanged on a hit, so the sum of step `renderMs` is not the time a render took. Reports saved before `wallMs` existed reopen with `wallMs: null` (unknown) rather than an invented value.
