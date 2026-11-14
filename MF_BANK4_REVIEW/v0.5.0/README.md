# Bank 4 Selected Device Controls v0.5.0 — Rebuild Candidate

**New standalone prototype; not recovered source, a repair of the original, or a hardware-accepted release.** Supersedes the missing-source development gate under the owner's PR #17 rebuild assignment (comment 6867557597). Keep PR #17 draft and unmerged. Hardware/Live compatibility is pending; Banks 1–3 and MF2Bank Beta 1 are protected.

## Candidate behavior

Select an EQ Eight, Auto Filter or Compressor in the selected track's device view. The script reads that actual selected_device, uses class_name (not a renamed device label), resolves explicit named controls from runtime introspection, and updates RGB plus white rings. There is no appointed-device fallback. Nested devices work only when Live exposes them as that view's selected_device; no Rack traversal or fallback selection is inferred.

See [PARAMETER_MAPPING.md](PARAMETER_MAPPING.md) for the proposed encoder table and missing-name policy. EQ Eight gets eight frequency/gain A pairs; Auto Filter gets up to eight named controls; Compressor gets up to sixteen named controls. Unavailable/ambiguous controls remain unbound with zero rings. The device's requested status palette still spans the specified encoders. No power/page/reset/hold/push function is implemented. No parameter bank navigation in this minimum slice; device/parameter-list changes rebind the fixed table.

The controller subscribes only to its selected-track/device/parameter objects. A single five-host-tick scheduled chain polls selection and feedback when notifications are unavailable, and becomes inert after disconnect. Target Live timing depends on the host. Context changes remove previous owned listeners and invalidate caches. Every rotation rechecks focus; unavailable/deleted objects fail closed. Continuous sensitivity is raw-range /128 per tick, quantized values move one integer step, values clamp to host bounds. This sensitivity and all new assignments require owner approval through testing.

MIDI is standard CC only: RGB channel 11 (0xBA), rings/rotation channel 12 (0xBB), CC48–63. Input forwarding registers only those sixteen channel-12 CCs; values 63/65 mean decrease/increase. All other input is inert. Push ch11 is intentionally unregistered/inert. The sender bypasses framework MIDI optimization so explicit refresh can resend a full frame; controller caches suppress unchanged output and retry explicit failed sends. No SysEx, Native Mode, brightness, firmware or Utility modification.

EQ Eight RGB 68 x16; Auto Filter RGB 108 E1–E8 and zero E9–E16; Compressor RGB 72 x16; unsupported/no device zero. Ring positions normalize host parameter values to 0–127. **Zero restores configured inactive RGB in the pinned firmware, and ring zero may be ignored with detent.** No configuration fix or physical darkness is claimed. Actual .mfs, firmware identity and output ownership still need owner verification. Standard firmware buffers should retain off-bank values; no side-button/bank listener or repeated forced bank refresh is added. A host refresh_state forces resend; physical bank-switch behavior is unverified.

## Files / reproducibility

- `source/MF_Bank4_Selected_Device_v050/`: complete original Python implementation and Live entry point; no external Python dependencies beyond Live's built-in ableton.v2 and Live modules.
- `MF_Bank4_Selected_Device_v0.5.0_Rebuild_Candidate.zip`: installable folder plus README, parameter table and hardware checklist.
- `tests/test_bank4.py`: inert host mocks, including MIDI map forwarding and scheduled lifecycle.
- `MIDI_FIXTURES.json`: explicit startup and teardown frames for a documented normalized fixture; tests compare actual output with these frames.
- `SOURCE.patch`: new-file source/test diff against the PR's pre-candidate tree. This is a new implementation, not a patch to the diagnostic. See DIAGNOSTIC_COMPARISON.md.
- `TEST_RESULTS.txt`, `SHA256SUMS`, `build_candidate.py`: test evidence, hashes and deterministic ZIP builder.

From this directory, Python 3:

```
python3 -m unittest discover -s tests -v
python3 build_candidate.py
sha256sum -c SHA256SUMS
```

22 automated tests PASS on the cloud Python host. They cover exact MIDI frames, palette/unsupported cases, continuous/quantized boundaries, malformed/wrong-bank inputs, actual selected-device focus without appointed fallback, rapid focus change, parameter reorder/removal/ambiguity, original names, polling fallback, deleted objects, send retry/cache invalidation, fifty alternating device switches, teardown/no duplicate subscriptions, adapter forwarding and late scheduled callbacks. This is mocked validation, not certification of Live private APIs or device parameter names.

**NOT RUN:** real Live 12.4.16 / Live 13 beta import/runtime, actual host parameter inventory, encoder direction/sensitivity on Twister, firmware behavior, physical LEDs/bank switching, combined-build or Banks 1–3 runtime regression. No script was deployed and no hardware MIDI was sent during development.

## Install, remove and rollback — owner hardware gate

1. Preserve the existing accepted scripts, Live Control Surface assignments and saved Utility configuration. Do not overwrite MF2Bank Beta 1 or any previous folder. Verify the ZIP SHA-256 against SHA256SUMS.
2. Use an **owner-approved isolated test setup with no other script/output owner for Bank 4 CC48–63**. Do not install alongside a combined script that owns these addresses. If exclusivity requires changing shared routing or a combined build, stop for CROSS-BANK REVIEW REQUIRED; this candidate does not make those changes.
3. Extract only `MF_Bank4_Selected_Device_v050` into the existing Live User Library `Remote Scripts` directory (or the appropriate third-party Remote Scripts location for the owner's Live install). Preserve the folder name and all four .py files. Consult Ableton installation guidance linked in REFERENCES.md. Restart Live and select the candidate only in the isolated test setup, with the existing Twister port. Do not change Utility mappings to accommodate it.
4. Perform only hardware test 1 in HARDWARE_CHECKLIST.md first, then report the outcome and any startup traceback. Do not run the remaining queue until the preceding result has been reviewed.
5. Remove: deselect the candidate in the isolated test setup, close Live, remove its new folder, and restart. Restore the saved accepted configuration if it was changed with owner approval. The original accepted folders/ZIPs are not modified. Disconnect attempts zero output only on Bank 4 addresses; visible cleanup remains configuration-dependent.

No shared code changes are proposed. This ZIP is not a combined-bank release. **CROSS-BANK REVIEW REQUIRED** before any later integration, shared ownership/listener/routing or bank-switch change. No automatic merge or deployment.
