# S5 T1 controlled source candidate — NOT AUTHORIZED FOR LIVE / DO NOT RUN

This prepares a future one-time disposable-Set test. **Do not install, load, connect or execute it
in Ableton. No import, clip creation, Undo/Redo or merge is authorized.**
[Owner preparation authorization #7025538391](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-7025538391).

Branch `codex/aopx-s5-t1-controlled-candidate` is narrowly based on reviewed PR #71 at
`2be340a28b4db7f21818a3bef7b67a71aa64d43d`; its separate draft PR targets
`codex/aopx-s5-t1-build-only`. Existing PRs #56/#64/#65/#66/#68/#70/#71 and the old ZIP stay
unchanged and unmerged. No existing source file is modified by this candidate.

## Deliberately separate compile-time entry

- Default `../s5-t1/src/extension.ts`, default build and old manifest remain compiled **false**.
  `npm run build` here invokes that default locked static build. No environment variable,
  ordinary command argument or modal response can unlock it.
- Only this new `src/extension.ts` imports the frozen `CONTROLLED_TRIAL_PROFILE`, whose reviewed
  literal `enabled: true` enables the shared controller for this specific source candidate.
  Explicit `npm run build:controlled:offline` compiles it separately under this directory's
  ignored `.build/`. `manifest.trial.json` names that entry and has a DO NOT RUN label.
- Activation/connection merely registers a context-menu command. It never invokes the flow.
  Clicking the command may render/read owned temp audio in a future approved trial; **import and
  clip creation remain behind strict fresh-nonce, phrase, source-proof and approval consent**.
- No launcher, start/install hook, runtime enable switch, SDK binary or auto-start is supplied.
  This is a source package, not a tested ready-to-run extension installer. Host loading remains
  untested; separate future approval must cover the exact local SDK binding/build and emitted files.

## Pinned owner source and verification boundary

The owner reports: mono, 48 kHz, 32-bit WAV, **48,000 frames / 192,080 bytes**, SHA-256
`c897d44b640a602f162e61ed7719d6469722cf22b51fcec894dd6f9231633026`; one original Arrangement
clip at 120 BPM and one existing empty `AOPX RESULT` AudioTrack. Owner reports Collect All and Save,
separate entire-project backup and successful manual reopening of that recovery copy.

These are **owner-measured/reported facts**, not measurements from this preparation session.
No user media or Set was read. No private project path, Windows username or media is packaged.
The exact project identifier/path and baseline checksums stay in the owner's local approval record.
The source hash is public in the owner's authorization and is intentionally pinned in `profile.ts`.

The beta.1 public SDK exposes the source path reference but no authorized source-content hash
readback. Extension filesystem policy permits owned storage/temp, not direct project-media reads.
Therefore the UI requires the owner's separately verified original checksum/size and source-clip
identity attestation. **It does not claim cryptographic proof that the clicked clip points to that
file.** This manual admission is mandatory; if identity cannot be established, Cancel/STOP.

Pre-FX rendering may change container bytes/header metadata. The rendered checksum must **not**
be equated with the original checksum. Runtime instead admits a complete bounded finite WAV with
exactly 48,000 frames, mono 48 kHz and 32-bit samples, then uses the inherited Reverse/Gain −3 dB
processing/output checks. The shared mono/stereo code is not relaxed; this owner-specific profile
intentionally narrows the trial to mono. Other source layouts require another reviewed profile.

## Consent, exact effects and recovery

The trial dialog identifies profile `S5-T1-OWNER-7025538391`, original checksum/byte count and
processed-output checksum separately. Import is disabled until both unchecked boxes, exact
source hash, exact phrase and current nonce are valid. One box explicitly requires a **new owner
approval of the exact reviewed artifact and protocol**; the other attests current source/target,
120 BPM, stopped transport, no concurrent CLI/edits, no fades/FX/automation/routing ambiguity,
and verified separate recovery backup. Only then is trial consent translated into the shared
strict consent envelope. Invalid, stale, malformed, extra-field or ordinary argument consent fails.

Future permitted effects remain exactly one `Resources.importIntoProject(ownedWavPath)` and
one `AudioTrack.createAudioClip({ filePath: returnedImportPath, startTime: sourceStart,
isWarped: false })` on the existing unique empty `AOPX RESULT`. No duration/loop settings are
supplied; expected natural length is two beats and returned finite geometry is checked within
one sample at 120 BPM. No track creation, Session insertion, setters, source replacement,
rename/mute/routing/warp changes, automatic Undo/deletion/retry or transaction wrapper exists.

All reviewed PR #71 protections are reused unchanged: complete source/target snapshot admission
and rereads; owned-temp validation and rehashed export after import-intent receipt; persistent
exclusive claim, private intent/ack journal; late acknowledgment/timeout as unknown; no automatic
replay after restart; freshly read result descriptor after create-ack receipt. Media and receipts
remain for manual reconciliation. [Inherited implementation limits](../s5-t1/README.md) apply.

No native Undo, import retention, source/Set identity across restart, audio audition, natural-length
rounding, host loading or crash/power-loss guarantee follows from offline tests. Source/target
changes between SDK reads remain possible; manual no-concurrent-edit discipline is mandatory.
On uncertainty stop and preserve media; normal close without save/reopen of the verified baseline
is the manual fallback. Never delete project media, force-kill Live or blindly repeat Undo.

## Offline commands only

From extracted/repository root, using the existing pinned compiler dependencies:

```powershell
node ableton-offline-processing/spikes/s5-t1/ci/build.mjs
node ableton-offline-processing/spikes/s5-t1-trial/ci/build.mjs
node --test --test-reporter=spec ableton-offline-processing/spikes/s5-t1-trial/test/*.test.ts ableton-offline-processing/spikes/s5-t1/test/*.test.ts ableton-offline-processing/spikes/s5-design/fake-host.test.mjs
python ableton-offline-processing/spikes/s5-t1-trial/ci/test_package.py
```

Both build scripts accept `--tsc <existing typescript/lib/tsc.js>` and `--sdk-types <actual
beta.1 index.d.mts>` for **declaration-only** static compilation. The actual SDK runtime is never
loaded in build/test. CI uses the existing lockfile compiler and explicitly handwritten mock SDK,
Windows/Linux × Node 24.22.1/26.13.0. No dependency upgrades or native SDK distribution.

Tests cover both activation entries and real adapter through mock SDK, invalid consent, one-shot
effects, profile constraints, source provenance limitation, DOM confirmation behavior and privacy;
the inherited suite covers late ack, timeout, restart, snapshot/hash drift, receipts and failures.
Only synthetic scratch files are used. Local junction creation may skip under sandbox restrictions;
CI must disclose skips. ZIP tests reject traversal, vendor/private/emitted paths and bad SHAs.

## Review-gated source package

No artifact is published until a genuine fresh independent review of the exact commit is recorded
by the coordinator with heading `## Independent controlled T1 review — PASS`. The gate is a
publication mechanism, not human/merge/test approval. It is never a substitute for actual review.
CI checks out that head, then reads **immutable Git blobs**, not private/untracked working files.
The source-only ZIP includes both locked and controlled entries, tests/docs and required engine/
design sources. `CONTROLLED_TRIAL_MANIFEST.json` records the exact reviewed SHA and all source
hashes, profile and separate-approval requirement. No SDK, node_modules, emitted JS, audio or Sets.
Stored ZIP members, fixed timestamps and creator metadata avoid platform compressor variation.

After publication, download and independently verify actual archive/checksum, all manifest hashes,
member safety and exact reviewed source parity. Only then report the final artifact PASS.
The [owner approval packet and prospective Windows protocol](OWNER_APPROVAL.md) are deliberately
locked pending another exact-artifact decision. **STOP after preparation.**
