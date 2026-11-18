# Proposed disposable S5 trial — LOCKED pending new owner approval

This is a reviewable proposal, **not instructions to run now**. No trial extension, build/load
command or actual SDK mutator is supplied. [Readiness/blockers](README.md) and
[versioned evidence](SDK_EVIDENCE.md) apply. Existing basic owner S5 evidence is preserved;
these new cases specifically concern processed output, dependent operations and recovery.

## Approval packet required

Before implementation or execution, the owner must explicitly approve: exact reviewed source
SHA and source-only test artifact; Live/SDK versions; named disposable Set/project directory;
synthetic media and limits; selected cases and exact allowed mutators; user opt-in wording;
expected Undo entries; retained files; stop conditions; and verified close-without-save/reopen
recovery. Implementation itself requires scoped approval; passing offline tests does not open it.
Do not infer permission from ACCEPTED, review PASS, a green CI run or this protocol.

## Recovery preparation (must be verified before import)

1. Owner creates a new, throwaway project with no personal material. Use a synthetic one-second
   48-kHz mono/stereo WAV at constant 120 BPM, one plain unwarped, unlooped clip at a known beat.
   No FX, fades, overlapping clips, tempo automation, take-lane content or routing experiments.
2. Owner manually precreates/names one empty result audio track and leaves original unchanged.
   Save this baseline and make a separate copy of the entire throwaway project, including media.
   Record Set/media checksums outside Live and baseline object counts. Capture screenshots and
   clip properties. Record Live build, SDK package hash, actual host Node and Windows versions.
3. Confirm the backup opens correctly **before** the mutating trial and that the owner can close
   a disposable changed copy without saving and reopen that baseline. If any autosave/recovery
   prompt makes the recovery ambiguous, STOP. No script kills Live or deletes recovery files.
   Keep original and baseline paths distinct. Never use the backup itself as the experiment Set.
4. Stop other extension CLIs manually; no production Live session. Keep playback stopped during
   mutation/inspection, no unrelated user edits. The owner remains in control of every action.

## Case T1: smallest proposed return to a precreated result track

Only after explicit scoped approval and reviewed future implementation:

- Read/render the isolated original pre-FX range, bounded decode, apply Reverse/Gain in memory,
  export a unique owned-temp WAV, hash it, and present a confirmation showing scope and limits.
- Permitted proposed host effects: **one** `importIntoProject` and **one** `createAudioClip` on
  the owner-designated empty result track. Use returned import path, original start beat,
  expected two-beat duration, explicit `isWarped: false`, no loop settings. No automatic naming,
  muting, routing, track creation or original modifications in T1.
- Record intent and acknowledgment, returned path reference/handles and snapshots. Verify one
  new clip on that target, unchanged original, expected timing/frame duration, no unwanted warp/
  loop and no extra clips. Exact copy hash needs an authorized observation mechanism; do not
  assume extension can read the project directory. Owner may inspect disposable media externally.
- Owner auditions original and result separately, controlling playback so both do not sum.
  Document whether intended Reverse/Gain is audible; do not infer this from waveform geometry.
- Owner presses Ctrl+Z once, observes objects, then Ctrl+Y and observes playback/media. Expected
  hypothesis: one clip creation Undo entry; import-file behavior is unknown. If more/less or
  unrelated effects appear, STOP. No automatic repeated Undo or imported-file deletion.
- Close trial **without saving**; reopen verified baseline and check counts/media. If Undo or
  redo is faulty, this discard/reopen procedure is the fallback, not SDK rollback. Project media
  residue is allowed and recorded; preserve it for analysis.

## Separate later approvals

| Case | Additional proposed operations / fault | Required observation and recovery |
|---|---|---|
| T2: new result track | One create-track, await result, then one create-clip using imported copy. Any name/mute writes must be enumerated separately. | Expect sequential Undo entries; enumerate observed entries. Never claim one transaction. Discard/reopen baseline if any ambiguity. |
| T3: stage failure/cancel | Chosen single case per approval: cancel before import; cancel after import acknowledgment; fail after new-track acknowledgment before clip; reject clip request. | Verify exact residuals and original snapshot. No automatic cleanup or blanket Set-unchanged message. No mid-request cancellation guarantee. |
| T4: recovery/restart | First normal close/reopen of a deliberately **saved separate trial copy** with journal and media retained. Process termination/crash injection requires additional explicit approval. | No persisted-handle reuse or automatic retry. Identify same Set manually; reconcile receipts/objects/media, prove no duplicate import. Restore/discard from baseline copy manually. |
| T5: retention/repeat | Two explicitly approved unique output/import operations; Undo/Redo and reopen as enumerated. | Observe collisions/deduplication, temp removal sensitivity, redo media and retained project files. No garbage collection or project-source deletion. |
| T6: fidelity expansion | Individual mono/stereo, source rate, trimmed boundaries, warped/looped/faded input cases, each scoped | Measure render isolation and boundaries; do not copy original markers onto flattened audio. Block unsupported reconstructions. |

Stop immediately on invalid WAV, unresolved overlap/type, source/tempo drift, unexpected object
count, path mismatch, unavailable environment roots, source edits, UI hang or unknown outcome.
Capture redacted evidence and report to Issue #40; do not retry or broaden the trial. No automatic
merge, no production use, and no actual import experiment is authorized by this document.
