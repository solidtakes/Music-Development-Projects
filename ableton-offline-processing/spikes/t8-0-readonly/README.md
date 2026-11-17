# AOPX T8-0 — experimental read-only Arrangement probe

**Status: DRAFT, not independently reviewed. This is NOT the full T8 production adapter.**
The owner approved proceeding with an Arrangement-only read-only proof after S2/S3/S4 real Windows Live 13 Beta evidence.

This package vendors the canonical AOPX engine WAV decoder, DSP (Reverse/Gain),
fingerprint helper, host modal parser, shared contract and editor HTML from the recorded baseline.
**T8-0 exception:** the vendored DSP scheduler explicitly imports the timer from
`node:timers/promises` instead of assuming the Live extension host exposes a global
`setImmediate`. The core canonical engine source is not modified in this PR.
The vendored copies let the experimental extension install inside the owner's standalone
SDK examples folder without importing the whole repository at runtime.

## Hard safety boundary

**No Live Set mutations, no import, track or clip creation, no transactions, no Project
persistence, no stored handles.** The probe calls S2 handle/parent/beat-range getters,
S4 pre-FX render (the SDK writes a temporary WAV), and S3 modal API.
After a valid Apply, canonical Reverse/Gain run on decoded buffers **in memory only**,
printing only metadata and 12-digit fingerprint prefixes. The result is NOT saved to disk or Live.

The modal displays an orange warning and a "READ-ONLY TEST — NO AUDIO WILL BE SAVED"
source label. Apply means **DRY RUN**, not importing processed audio.

**Not supported or validated:** Session/TakeLane, overlapping Arrangement clips, file-based modal
delivery, fades/crossfades, automated track isolation, full warp-marker reconstruction,
persistent edit history, output tracks, Live undo/rollback.

## Install on owner Windows PC

1. Use the working SDK beta.1 at
   F:\Downloads\extensions-sdk-1.0.0-beta.1\extensions-sdk-1.0.0-beta.1.
2. Place the CONTENTS of this package under SDK\examples\aopx-t8-0-readonly\
   (not inside a nested "ableton-offline-processing/spikes" directory).
3. The official SDK and CLI .tgz tarballs must be under the SDK root.
4. Start Live 13 Beta FULLY with a disposable Set, an isolated Arrangement audio clip
   on its own audio track, and Live Record File Type set to WAV.
5. Stop prior S2/S3/S4 extension CLIs. From the new package folder, run:
   powershell.exe -ExecutionPolicy Bypass -File .\run.ps1
   This performs npm install, FakeHost tests, tsc --noEmit, esbuild, then Live connection.
   A failure stops before connecting. Do not run npm audit fix.
6. Right-click the disposable audio clip:
   AOPX T8-0 Preview (READ-ONLY — does not save)
7. On the first test press CANCEL. Expected: AOPX_T8_0_CANCELLED user-cancel
   (or modal-closed when closing using the window X).
8. On the next test, optionally reorder Reverse/Gain and press APPLY.
   Expected: AOPX_T8_0_DRY_RUN_COMPLETE with audio frame counts and fingerprint prefixes.
   Verify the Set still has NO newly created track or clip.

## Strict limits

- Refuse anything not a direct Arrangement AudioClip parented to a known AudioTrack.
- Refuse unresolved or positive-overlapping ranges. Verified adjacent boundaries are allowed.
- Reject zero/nonfinite beat ranges. Do not treat source markers as Arrangement boundaries.
- Reject AIFF/non-RIFF WAVE; Live's Record File Type must be WAV.
- Reject rendered files larger than 32 MiB before reading; decoded buffers allocate more memory.
- Reject Base64 modal URL lengths above 1,500,000 chars. S3 B2 worked at 1,449,944
  and S3 B3 failed in Live at 2,889,180. File/temp delivery is not proven.
- Reject more than 16 operations. Malformed, nonstring or empty modal returns mean cancel.
- Do not log full paths, clip names, source file contents or raw SDK exceptions.

## Real-host gates

- S2: owner Windows pass for handle/parent, Arrangement timing, warp/loop,
  trim and adjacent clips. Crossfade/positive overlap NOT verified.
- S3: Live modal delivery via small bounded Base64 data URL, Apply/Cancel flow proved.
- S4: one real Live pre-FX render, 48 kHz mono float32, 32s, decoded by canonical AOPX engine.
- Full T8 implementation gate stays CLOSED until S5 import/rollback and further explicit approval.
- The S3 parent branch and PR #56 remain separate, draft and unmerged. No merges authorized.

## Windows owner finding: multi-block DSP compatibility

The first real-host Apply test logged `AOPX_T8_0_BLOCKED failed-dsp-ReferenceError` with
approximately 2.82 s of 48 kHz mono WAV, after the editor opened. The original
64-frame FakeHost test never executed a block-boundary event-loop yield.
The probable cause is the implicit global `setImmediate` in the vendored DSP.
This revision explicitly imports an asynchronous immediate from `node:timers/promises`
and adds a long-buffer test that removes the global `setImmediate` while exercising
Reverse and Gain across a block boundary. **The diagnosis remains provisional until a
successful owner rerun in the actual Live host.** The safety boundary is unchanged:
no clip/track creation, import, or Set writes. PR stays draft.
