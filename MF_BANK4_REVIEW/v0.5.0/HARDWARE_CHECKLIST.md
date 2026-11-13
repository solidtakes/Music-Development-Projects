# Owner hardware queue — one test at a time

Status: every hardware test NOT RUN. Use only the isolated owner-approved setup described in README. Do not activate Native Mode or alter firmware, Utility settings, brightness or other bank mappings. If shared routing changes would be needed, stop for cross-bank review. Preserve MF2Bank Beta 1 and current working scripts.

**Test 1 — startup and EQ Eight status only.** In a blank, disposable Live test set, add an EQ Eight to the selected track and select the device. Start the standalone candidate in the isolated setup. Do not turn encoders yet. Report Live version, candidate startup success or full traceback, whether all sixteen RGB LEDs are light blue, white-ring state, current Twister firmware identity if already known, and whether any unrelated-bank display unexpectedly changes. “Script loaded” or a MIDI send is not hardware acknowledgment. If it fails, stop; do not change channels/settings or run later tests.

After test 1 is reviewed, proceed one item at a time:

2. E1 one clockwise then counterclockwise tick: confirm EQ Eight band 1 Frequency A moves in the intended direction, no other parameter changes, ring follows, and sensitivity is usable. Check E2 Gain A separately. Host-exposed names may leave slots unbound; report those instead of substituting an assignment.
3. Change that parameter with the Live mouse; ring follows. Verify device renaming does not change binding. Test boundaries without changing the approved sensitivity silently.
4. Select Auto Filter: E1–E8 yellow, E9–E16 inactive/off per existing config. Test Frequency E1 separately, then each available proposed control; unavailable slots must remain inert. Record actual host names before proposing aliases.
5. Select Compressor: sixteen red. Check Threshold E1, then separately verify the available proposed controls. A red status LED does not prove the parameter is mapped. No push actions should occur.
6. Select an unsupported device, empty track and another track: no previous device controls move, colors/rings clear per physical config. Remove a selected device; check for errors. Test nested Rack selection only if Live exposes the selected nested device; never accept unintended appointed-device fallback.
7. Change parameters externally and alternate tracks/devices repeatedly. Check stale rings, duplicate callbacks, held push inertness and safe removal/reload.
8. Physical bank entry/exit and host refresh: expected firmware buffer retention, no stale palette/rings after returning. Do not add shared bank-switch interception without cross-bank review.
9. After separate cross-bank review, restore and verify accepted Banks 1–3 / MF2Bank Beta 1 behavior in their original configuration. This standalone candidate's address-scoped tests do not establish combined runtime regression success.

Collect full relevant Log.txt if startup/runtime fails. Any report of nonzero inactive color or ring-zero failure must be compared with the existing .mfs and firmware; do not experiment with settings to force a pass.
