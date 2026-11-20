# MF Build 3 Banks — Beta 1.2 STARTUP NAMEERROR FIX TEST

**REQUIRES NEW ABLETON / HARDWARE RETEST.** Original Beta 1 was owner-tested: Banks 1 and 3 were accessible but Bank 2 was not. This is a combined-script integration candidate
for owner testing, NOT an accepted stable release. All original standalone ZIPs remain
untouched. No automatic merge, Native Mode activation, hardware reprogramming or new
global transport overlay.

## Beta 1.2 startup repair — confirmed by owner Live 13 Log.txt

**Beta 1.1 FAILED owner hardware test:** all banks inactive, Bank 1 LEDs illuminated.
Live's `Log.txt` contains `RemoteScriptError: NameError: name 'MF4TRKBento' is not defined`
while constructing Bank 2 in `_refresh_all -> _scan_frame -> _monitor_color`.
The exact error also appears in original Beta 1; the crash prevented complete
initialization, which invalidates assumptions from earlier subjective bank tests.

**Two-line repair only:** `FourTrack_Bank2.py` lines inside the
`@staticmethod def _monitor_color(track)` now reference
`FourTrackBank2.MUTE_MONITOR_IN` and `FourTrackBank2.MUTE_MONITOR_AUTO_OFF`
instead of the removed standalone class `MF4TRKBento`.
This fixes both monitoring state branches (IN and AUTO/OFF), with unchanged color
values. No MIDI CC, channel, LED protocol, gesture, startup scheduling, Bank 1,
Bank 3 or `ThreeBankHost.py` code changes versus Beta 1.1.

**Reproduction/verification:** two new tests first failed against unmodified
Beta 1.1 with the identical NameError and passed after the two-line fix. All
14/14 controlled-framework integration tests pass, including a nonempty
four-track Mute-row refresh. Offline Python syntax/ZIP CRC and file hashes pass.
This does **not** establish Live runtime/hardware success; please retest only
in a disposable set. Full independent source review remains pending.

**If currently on Beta 1.1:** quit Live; rename the old `MF_Build_3banks`
installation to `MF_Build_3banks_Beta1_1_BROKEN_BACKUP` (outside the active
Remote Scripts directory if Live scans every subfolder); install only the new
`MF_Build_3banks` folder from this ZIP. Leave previous standalone scripts and
`222.mfs` untouched. In Preferences select the combined script with the Twister
input/output; remove any second Twister Control Surface assignment. Start an
empty Set. Verify Live's Log.txt reports the script loaded **without NameError**,
then test Bank 1 E1 turn/push, Bank 2 E1 turn/push, Bank 3 sequencer, and LEDs.
If any failure persists, close Live, preserve its new `Log.txt`, restore the
known working standalone scripts, and report the failing bank and log.

## Contents / provenance

- Bank 1: exact uploaded Selected Track Bento v2.2 EXP source, unmodified in
  `Bank1_SelectedTrack.py`. This is the accepted source candidate intended for
  v1.0 promotion; the standalone v1.0 release itself is not independently
  published/verified here.
- Bank 2: exact Four-Track Bento v1.0 stable logic with thin host adaptation in
  `FourTrack_Bank2.py`; local control indices 0-15 are bound to physical CC16-31.
- Bank 3: exact Sequencer Beta 2.3 SP1 source adapted using the prior uploaded
  two-bank integration adapter in `Sequencer_Bank3.py`, plus byte-identical
  `scale_sync.py`. Follow Playback remains OFF by default.
- `ThreeBankHost.py`: one ControlSurface hosting all three, using last-touched
  bank to choose Session highlight owner (Bank 2 when initialized).
- `__init__.py`: the sole `create_instance` entrypoint.

## Beta 1.1 Bank 2 routing change

- Root-cause candidate from inspecting failed Beta 1: Four-Track was made a
  companion object, but its ButtonElement callbacks were implicitly assumed
  to be owned and forwarded by the parent ControlSurface. Offline tests had
  auto-delivered them without validating Live's MIDI map registration.
- The host now explicitly maps Ch11 push and Ch12 rotary CC16–31 using
  `Live.MidiMap.forward_midi_cc`, then translates to local 0–15 and calls
  the existing `_push` and `_rotary` logic exactly once.
- The Bank 2 companion no longer independently registers framework buttons,
  preventing duplicate callback execution. Existing Bank 1/3 code and the
  hardware mapping are unchanged. MIDI map rebuild is requested on startup.
- This is a hypothesis-based runtime fix with offline verification, NOT a
  claim of confirmed root cause. Test on a disposable Live Set first. If it
  still fails, capture `Log.txt` diagnostics before further changes.

## MIDI routing (Twister 222.mfs; NO hardware changes)

  Physical Bank 1: rotary Ch 12 / push Ch 11, CC 0-15 — Selected Track Bento
  Physical Bank 2: rotary Ch 12 / push Ch 11, CC 16-31 — Four-Track Bento
  Physical Bank 3: rotary Ch 12 / push Ch 11, CC 32-47 — Sequencer SP1
  Physical Bank 4: CC 48-63 not assigned by this test package

## Installation (test ONLY)

1. Close Ableton Live and make a backup of your MIDI Remote Scripts directory
   and current Control Surface preferences. Keep all standalone banks and
   prior owner-tested two-bank rollback archives intact.
2. Extract **only** the `MF_Build_3banks` directory into your Live 13/Beta
   MIDI Remote Scripts location; do NOT replace existing bank directories.
   Paths depend on your version and install method. For a typical Windows
   Live Beta installation, inspect `C:\ProgramData\Ableton\Live 13 Beta\Resources\MIDI Remote Scripts`.
3. Start Live. In Preferences > Link, Tempo & MIDI, select `MF_Build_3banks`
   as ONE Control Surface with Twister's input/output MIDI ports. Disable any
   old separate Control Surface slots using those same Twister ports during
   this test, or messages and feedback may interfere. Do not modify 222.mfs.
4. On an EMPTY disposable Live Set first, test each physical bank separately:
   push, relative rotary 63/65, LED colors and white rings, clip box ownership,
   selection and release behavior, row utilities, clip/stop safety, 35 ms
   press-contamination handling, scale-aware pitch and Follow Playback OFF.
5. Verify that switching banks doesn't cause unexpected track/parameter edits,
   stuck holds, wrong LED updates, duplicate clip boxes or hanging scheduling.
   If anything is wrong, stop this test and follow rollback below.

## Rollback (no overwrite required)

1. In Live Preferences select your previously working standalone surface or
   verified owner-tested 2-bank package instead of `MF_Build_3banks`.
2. Quit Live; remove/rename ONLY the NEW `MF_Build_3banks` folder from the
   Remote Scripts directory. Leave the original standalone folders untouched.
3. Restart Live and restore your previous working Control Surface/ports.
4. Keep the original uploaded ZIPs for audit; do not delete your rollback.

## Test status / limits

Integration tests use a controlled `_Framework` / Live shim and cover explicit Bank 2 MIDI map forwarding and direct dispatch, plus MIDI
CC ownership, host entrypoint, LED translation, Bank 3 forwarding, highlight
ownership, disconnect and late callbacks. They are useful offline smoke tests
but do NOT establish compatibility with Live 13's actual `ControlSurface`,
`SessionComponent` or Twister MIDI feedback. Existing standalone historical
102/102 and 28/28 PASS results were reported earlier by separate reviewers;
these standalone suites were NOT rerun here.

Global E5/E8 transport remains OUT OF SCOPE pending separate approval.
Issue contract: https://github.com/solidtakes/Music-Development-Projects/issues/63
