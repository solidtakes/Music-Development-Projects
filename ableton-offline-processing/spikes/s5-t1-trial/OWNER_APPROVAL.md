# Owner approval packet — LOCKED / NOT AUTHORIZED FOR LIVE / DO NOT RUN

This is a **prospective protocol for a later owner decision**, not permission or an instruction
to run now. Preparation authority is [Issue #40 comment 7025538391](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-7025538391).
The final Issue #40 delivery report supplies exact candidate commit, independent review link,
artifact URL and ZIP checksum. Copy those immutable values into the owner's local approval record;
do not approve a moving branch or rebuild with changed source.

## Exact requested future scope

| Item | Approval constraint |
|---|---|
| Source candidate | Exact final reviewed commit and `CONTROLLED_TRIAL_MANIFEST.json`; default locked entry remains unchanged; only separate trial entry enabled. |
| Artifact | Exact published `AOPX_S5_T1_CONTROLLED_NOT_AUTHORIZED_FOR_LIVE.zip`, checksum from final delivery report; no private media or SDK included. |
| SDK | Installed `@ableton-extensions/sdk 1.0.0-beta.1`, API 1.0.0, declaration SHA-256 `b0b6d355c3459c14e7729e3641d26a1592b53f65f65e1664652a8a9b1ad3570a`. Any different SDK requires re-review. |
| Live | Owner records actual Live 13 Beta build and executable locally before approval. Build number was not observed in this preparation; do not infer it from SDK version. |
| Set/project | ONLY owner's isolated working disposable project, collected media and separate verified recovery copy; record private identity/path locally. Never production or recovery copy as experiment. |
| Original WAV | Mono 48 kHz, 32-bit, exactly 48,000 frames, 192,080 bytes; SHA-256 `c897d44b640a602f162e61ed7719d6469722cf22b51fcec894dd6f9231633026`. Owner reports this checksum; no agent media access. |
| Source clip | Its isolated Arrangement AudioClip at known nonnegative start, two-beat length, unwarped/unlooped/unmuted; source track contains only it, no Session content/take lanes/devices/group. No source edits. |
| Target | Exactly one existing completely empty regular AudioTrack named `AOPX RESULT`; separate from source; no clips/Session content/lanes/devices/group. No creating or renaming a target. |
| Global state | 120 BPM, stopped transport, no tempo/clip/track automation, fades/FX/routing ambiguity; one CLI, no concurrent edits. Manual checks where SDK does not expose evidence. |
| Future effects | One pre-FX owned-temp render/read, Reverse + Gain −3 dB, unique owned-temp export/private receipt; then exactly one import and one Arrangement clip on target, returned imported path, explicit `isWarped:false`. No extra setters, track creation, Session insertion, replacement/deletion/retry. |
| Expected geometry | Output 48,000 frames mono 48 kHz; result starts at original beat and lasts approximately two beats (≤one-sample measured tolerance). Duration argument omitted; host behavior is an observation target. |
| Recovery | Owner already reports separate whole-project copy, collected media and successful backup opening. Confirm that baseline/current state remain intact. Unknown outcome → stop/manual inspect, retain media/receipts; normal close without save, reopen verified baseline. No forced kill or media deletion. |

## Required new owner decision (not granted here)

Approval must explicitly cover **the exact delivered SHA/ZIP/protocol**, staging and static build/
SDK binding below, one command invocation and one confirmed import/create, manual separate audio
audition, and at most one deliberate Ctrl+Z followed by Ctrl+Y after inspection. The owner must
acknowledge residuals: import copies may outlive Undo; timeout does not cancel native work;
unacknowledged effects may exist; no automatic rollback/cleanup/retry; current source identity
depends on owner's external checksum/clip mapping; host loading and native Undo are untested.

The final source package is **not a prebuilt installable extension**. Future staging must record
emitted entry and manifest checksums and exact SDK/runtime resolution before loading. If source,
profile, SDK version, build method or allowed effects change, stop for updated review/approval.
Separate source preparation approval and review PASS do not authorize any of these Windows steps.

## Prospective Windows sequence — ONLY after that separate approval

1. **Verify delivered source ZIP/provenance.** Owner would download the exact artifact, hash the
   inner ZIP against the final report, inspect manifest and all source hashes, extract into a
   new isolated scratch folder outside projects/backups/production. No overwriting old #71 package.
2. **Record current environment and private baseline.** Owner would record Live build, host/development
   Node, SDK package/declaration checksum, Set/media identities/checksums locally. Independently check
   the original file size/hash/frame metadata against the table; confirm clicked clip actually uses
   it. This original-file identity is manual: the extension does not read project media directly.
   A rendered WAV hash may differ and must not substitute for the original hash. Mismatch → STOP.
3. **Confirm recovery readiness.** Owner would preserve the verified recovery copy, confirm it opens
   with its own collected media and no missing files, then close it without save and open only the
   working disposable Set. Existing accepted backup milestone need not be repeated unnecessarily;
   record any later changes and stop if recovery is uncertain. Do not alter the backup.
4. **Prospective offline staging/build.** With the approval explicitly covering this procedure, owner
   would use the existing locked compiler dependencies and exact installed SDK declarations to
   compile `spikes/s5-t1-trial/ci/build.mjs`. `npm run build` still builds the locked default;
   the trial path must be explicitly selected. The static compiler emits the new trial entry under
   `spikes/s5-t1-trial/.build/`. No script launches a host.
   The trial manifest is `manifest.trial.json`, not an automatically installed `manifest.json`.
   In the **new scratch trial workspace only**, the owner-approved staging procedure would copy that
   reviewed manifest to the CLI-required `manifest.json`, with identical bytes/checksum, and make
   the exact locally installed beta.1 SDK resolvable to the emitted entry (no SDK payload in ZIP).
   The already-installed matching SDK CLI would be used; no registry upgrades or new build hooks.
   Record exact source/emitted/manifest checksums and paths locally. Loader compatibility is untested:
   if the existing CLI rejects the ESM static build or module resolution, STOP and report before
   any mutation; do not improvise a bundler, change code or relax guards without review.
5. **Manual preflight before a future approved load.** Owner would stop other extension CLIs,
   keep production closed, confirm stopped transport/120 BPM/source and target table conditions,
   record baseline screenshots/object counts. Check FX, fades, automation, group/routing and exact
   selected source manually. A populated/duplicate/wrong target or uncertain source means STOP.
6. **One owner-controlled load, only as explicitly approved.** Owner would load only the staged
   controlled candidate through the approved existing SDK CLI. Connection should merely register
   `AOPX CONTROLLED T1 — DO NOT RUN WITHOUT APPROVAL`, with no render/import/create. Unexpected
   activity/errors → STOP. No automatic command execution or ordinary argument unlock is allowed.
7. **One command and explicit confirmation.** Owner would right-click that original Arrangement
   AudioClip and choose the controlled command once. The read/render preview must precede effects.
   Check profile/source/output summary. The dialog starts with all boxes unchecked and Import
   disabled. Only after confirming the new exact-artifact approval and all recovery/context facts,
   paste externally verified original SHA-256 and type `T1 CONTROLLED ONE IMPORT TO AOPX RESULT`.
   Cancel on doubt; do not treat connection, a bare click or a successful dry preview as opt-in.
8. **Observe one result.** Owner would expect one imported copy and one new clip only on AOPX RESULT,
   same start, approximately two beats, warp/loop off; original and track inventory unchanged.
   Check actual returned status and private receipts. `unknown-outcome`, timeout, receipt error,
   unexpected length/path/parent/count or source change → STOP/manual inspect, never retry.
9. **Audition separately, then single Undo/Redo only if included in approval.** Owner would manually
   audition original/result one at a time to avoid summed playback. Then stop playback, inspect,
   press Ctrl+Z once and inspect, then Ctrl+Y once and inspect. Do not guess more Undo steps or
   claim this reverses the imported media file. No automation sends these keys. On any mismatch
   do not repeat, delete media or attempt another command.
10. **Normal discard/reopen and report.** Owner would close the working changed Set without saving,
    normally reopen the verified baseline and check source/target/media. Retain ambiguous project
    copies and owned exports/receipts for analysis. Never delete project folders/media/recovery
    files or force-kill Live. Report redacted status, observed geometry/counts/audition/Undo behavior,
    exact build/artifact and native limitations to #40; keep private paths/names/media local.

## Stop triggers and unanswered native questions

STOP for wrong source hash/bytes/frames, wrong build/SDK, source/target mismatch, unknown isolation,
missing roots, malformed render, unexpected callbacks, receipt/timeout/claim state, import/create
failure, result drift, unexpected Undo entry or any uncertainty. Do not clear the claim to retry.
Original-file hash readback through the SDK, imported-copy hash/retention/deduplication, natural
length, asynchronous failure atomicity, native cancellation, loader compatibility, one-clip Undo
versus file Undo, redo after temp purge and crash recovery remain **unverified**. Tests demonstrate
mock behavior and source safety, not these host guarantees. This packet grants no test permission.
