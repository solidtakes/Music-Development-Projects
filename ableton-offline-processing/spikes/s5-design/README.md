# S5 readiness and recovery investigation

**DESIGN ONLY — no Live experiment or mutating adapter is authorized.** 2026-11-18.
[Owner authorization](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6974147627).
[API evidence and provenance](SDK_EVIDENCE.md). [Proposed gated trial](TRIAL_PROTOCOL.md).

## Decision and readiness

S5 documentation/offline investigation is ACCEPTED. **Real S5 implementation/trials remain
BLOCKED on owner authorization and the recovery/semantic questions below.** Prefer a **new
separate processed track and clip**, leaving the original's objects, media, routing and devices
untouched. For the smallest first proof, prefer an **owner-precreated empty result track** in a
discardable Set: it removes dependent track creation from the experiment. Automatic new-track
creation is a later, explicitly separate trial with multiple Undo entries expected.

The beta.1 transaction contract groups requests made during a synchronous callback. Its guide
explicitly requires sequential transactions when later operations need the newly returned track.
It does not verify rollback on exceptions, rejected operations, interruption, or restart.
No exposed programmatic Undo/Redo or imported-file removal exists in the inspected surface.
**Never promise one atomic new-track/new-clip Undo, automatic rollback, or “Set unchanged” after
an import request.** The old T8 design's step 9 and D15 assumptions are superseded by this memo.

## Baselines and existing evidence

- Canonical base: `ableton-offline-processing/alpha-0.1` at
  `a57d5aa25a68f8a40b8e07b8e3cef8df12baea10`. Separate branch
  `codex/aopx-s5-design-safety`; no competing S5 branch/open PR found at acceptance.
- #56/#64/#65/#66/#68 were verified open/draft/unmerged and are not modified. #66 Fix 2
  `1ccaed1a6003238a4c8546a5dc93607265c31bfd`; #68 editor
  `fd1112201252dc1a3ce9d788d45034cc3a9d12ee`. This PR does not duplicate #55's general doc cleanup.
- [Earlier official-example S5 host report](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6908336792)
  proves basic imported Session/Arrangement playback and single Arrangement-clip Ctrl+Z/Ctrl+Y.
  It excludes warped path, multi-step rollback, cleanup and complete handle/timing semantics.
- [S4 engine decode](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6937786925)
  and [Fix 2 in-memory DSP](https://github.com/solidtakes/Music-Development-Projects/issues/40#issuecomment-6964326119)
  are accepted within their stated scope; neither proves processed-audio import or recovery.
  No prior owner test needs repeating to establish those existing milestones.

## Design comparison

| Approach | Isolation and supported mechanics | Fidelity and safety tradeoff | Disposition |
|---|---|---|---|
| A. New separate result track + Arrangement clip | Verified create-track and create-clip APIs; original left in place; independent result objects | Dependent async operations require separate groups; track insertion follows selection. Defaults/routing/device chain differ. Result and original can both sound; audition one at a time under owner control. | Preferred eventual return design, once gated trials establish recovery. |
| B. Owner-precreated empty separate track + one clip | Uses supported Arrangement creation on an existing track; no automated track creation | Preserves original; still imports host-owned media and has an unknown failure window. Single clip Undo has prior basic evidence, not complete import Undo. | Smallest proposed disposable proof. |
| C. Same-track, disjoint Arrangement region | Supported creation API | Changes source track context; cannot exclude accidental overlap/truncation without complete validation; effects/routing change output semantics. | Reject as first proof. |
| D. Empty Session slot or take lane | Both have creation APIs | Session lacks Arrangement timing; take-lane comping/audibility and recovery not established. Source track isolation weaker. | Defer. |
| E. Export for manual user import | Host-side import can remain a manual user action outside adapter | Avoids adapter Set mutations but still needs a separately authorized export path and user workflow. Does not meet automatic return goal. | Non-destructive fallback proposal only. |

The first proof is a **flattened pre-FX render**, not reconstruction of the original source clip.
Reverse/Gain should preserve channel count, sample rate and frame count. Reject unsupported
formats/channel layouts rather than silently downmix/resample. Existing track render can combine
overlaps/take lanes and possibly apply clip playback/fades; exact inclusion remains unverified.
Require one isolated plain clip, no overlap/unknown lanes, no FX, no fades, no looping/warp,
constant tempo and no automation for the first proposed proof. No post-FX result claim.

Arrangement create/render positions are documented in beats. Frames are an independent audio
boundary: at constant tempo, seconds = beats × 60 / BPM; compare expected frames at sample rate
with a documented measured rounding tolerance (propose ≤1 frame for the synthetic future trial;
if it fails, stop and report, do not widen tolerance silently). A tempo map cannot be replaced
by current BPM. The first trial excludes tempo automation. Natural-length capping can shorten a
requested non-looping clip. Verify returned start/end/duration and waveform bounds explicitly.

Do **not** copy original warp/loop markers onto audio that already baked those transformations.
Explicit `isWarped: false`, omit loop settings for the first trial, and verify looping is off.
Arbitrary warp maps, fades, clip gain/pitch envelopes, group routing and device chains cannot be
reliably recreated with the inspected surface. A later warped/looped input may be flattened only
after render-isolation and timing tests; it is not a lossless editable reconstruction.

## Failure-safety proposal (not implemented against Live)

1. **Admission:** new scoped owner approval, disposable saved Set identity and baseline backup,
   compatible observed Live/SDK versions, no concurrent commands/user edits, valid temp/storage
   getters, bounded operation count (≤16), source/track/type/timing/overlap checks, target empty,
   clear dry preview of requested objects and possible residual media. No persistent Set identity
   API is verified; user confirmation and an external trial manifest are required.
2. **Source mapping:** capture available source handle, parent, path reference, name, timing,
   warp/loop reads, tempo and object counts. Record render bytes SHA-256, output bytes SHA-256,
   complete operation-plan hash and engine/SDK versions under a fresh operation UUID. Render
   fingerprint identifies rendered content, **not** a unique clip: two clips may sound identical.
   Bind history to this context; path/name/hash alone cannot authorize mutation or recovery.
3. **Bounded validation:** proposed pre-read stat cap 32 MiB; reject nonregular/symlink targets
   and paths outside extension-owned roots, then bounded read on an open file with size/identity
   recheck to prevent check/read races. Validate RIFF/WAVE structure, format, chunk bounds,
   whole frames and full finite-sample decode. Proposed first policy: mono/stereo, 8–192 kHz,
   ≤600 s, ≤16 million decoded channel samples (128 MB Float64 payload), same frames/rate/channels
   as source. Hash exact immutable bytes used for import. Memory tests cover byte/header/decode
   admission, **not OS stat, symlink, locks, disk limits or durability**.
4. **Prepare files:** future extension-only temp export, fresh UUID filename, exclusive creation,
   no overwrites, close and revalidate hash before import. Persist an intent manifest in owned
   storage with schema/version/checksum and atomic publish/fsync strategy to be reviewed/tested
   separately. Temp is not durable. Storage is not a backup of a Set or native host transaction.
   No actual exports, journals, source writes or SDK calls occur in this investigation.
5. **Import boundary:** record intent **before** request; import is already a host/project-file
   effect even before clip creation. Await settlement; use only its returned path. Record receipt
   after acknowledgment. Do not read/delete arbitrary project paths from extension code. Exact
   copy hash readback through an authorized host mechanism is unavailable; fake readback is
   stronger than current SDK evidence and must never be advertised as a real check.
6. **Object sequence:** recheck source/target state before each request. For A, create result track
   and await it before creating clip; track creation, naming/muting and dependent clip creation
   may form separate Undo entries. For B only create on the user-designated empty track. Do not
   hold an async callback open and call it atomic. Record intent/ack per request; no blind retry.
7. **Success verification:** reconcile object inventory, returned parent/handle, file-path receipt,
   timing, duration, warp/loop reads, original snapshot and media hashes available in owned roots.
   No general target output hash or saved-Set byte equality is claimed. User visually checks
   original and audibility; if inspection cannot establish success, mark uncertain and stop.
8. **Cancel/interruption:** before import, stop with no new Set objects (owned temp may remain).
   During import/create the SDK exposes no cancel signal: stop scheduling, await result if
   possible, then reconcile partial effects. A timeout is **unknown outcome**, not failed effect.
   Ignore late UI publication for obsolete operations but retain the operation receipt. After
   any host request never promise “nothing changed”. Prevent concurrent/repeated Apply with an
   operation lock; SDK-side idempotency is not verified.
9. **Undo and compensation:** user Undo/Redo is distinct from automatic recovery. Inspect current
   objects after each user Undo; never guess an undo count or undo over unrelated edits. Keep
   imported and referenced files while redo or recovery might need them. Verified delete-track/
   delete-clip signatures are merely future compensation candidates: use only separately
   authorized, exact newly owned objects after revalidation; never delete a source/user-edited
   track or project media. Failure of compensation is itself partial failure. No compensation
   mutator exists in this PR.
10. **Restart recovery:** durable intent without matching receipt means uncertain, including a
    crash after effect/before ack. Do not reuse serialized handles or auto-replay imports.
    Require the owner to identify the same disposable Set, inspect candidates and reconcile with
    the manifest. Names are labels, not ownership proof. Retain ambiguous files/objects and stop.
    Recovery fallback is close **without saving** and reopen the verified pretrial Set copy;
    project orphan media may remain. Never auto-delete those files. Saved-over originals or
    modified baselines require external backup restoration, not an alleged SDK rollback.

## Blockers and risks register

| ID / severity | Evidence or uncertainty | Required resolution before the relevant Live trial |
|---|---|---|
| B1 / gate | No permission for actual S5 import/Undo/rollback or mutating implementation | Fresh owner approval of exact trial operations, reviewed SHA and recovery plan. |
| B2 / high | Dependent new-track/clip single-Undo assumption contradicted by synchronous guide | First use B; later A accepts observed sequential Undo entries or requires a newly verified API. No false atomicity claim. |
| B3 / high | Exception/rejection/crash rollback and native host internals unavailable | Treat every started request as potentially effective; observe separately gated failures; preserve discard/reopen recovery. |
| B4 / high | Import copy lifetime/collision/undo cleanup and hash readback unspecified | Retain media; observe file reuse/redo/reopen in disposable project only; no project-file deletion. |
| B5 / high | Stable Set/object identity and durable recovery receipts not exposed | Manual same-Set identification; review durable journal before implementation; no restart auto-replay. |
| B6 / high | Clip/render isolation, warp/fades/loop and frame rounding semantics incomplete | Restricted synthetic plain input first; expand only with separately approved cases. |
| R1 / medium | Default `.asd`/Auto-Warp, natural-duration cap, track insertion/routing | Explicit warp false; verify returned geometry and target track; no playback-equivalence claim. |
| R2 / medium | Host request cannot be cooperatively cancelled; user edits can invalidate snapshot | Single-flight flow, stage guards, no timeout retries; uncertain-state report. |
| R3 / medium | Windows locks, read bounds, free space, temp purge and journal durability untested | Separate owned-filesystem tests before implementation; no OS guarantees inferred from memory tests. |
| R4 / medium | Bundled prose has stale signatures; public deep docs unavailable | Pin package hash/types/source; record conflicts; reverify future SDK versions explicitly. |

## Offline evidence and limits

From repository root, Node ≥24.16 (no install or new dependencies):

```powershell
node --test --test-reporter=spec ableton-offline-processing/spikes/s5-design/fake-host.test.mjs
```

The fixture internally constructs `FakeHost`; no actual/injected host, SDK import, filesystem
write or network operation exists. Production WAV metadata/decode is reused in memory. It models
original invariants, 16 before/after stage faults, 8 settled-stage cancellations, retained partial
effects, immutable input bytes, bounded malformed output rejection, source drift, lost receipts
and read-only restart reconciliation. A separate sync-scope counterexample illustrates why an
async dependent request cannot be assumed in one group. It does not emulate Live's Undo engine.
The fake's project hashes and restart snapshots are capabilities of the model, not beta.1.

Faults are deterministic throws at stage edges; they do not kill a process, test disk durability,
exercise a real late native callback, or prove concurrency/idempotency. The manifest/locking/
filesystem policy above is a design proposal. **FakeHost PASS never proves actual Undo support,
rollback, audible equivalence, OS cleanup, or crash recovery.**
