# Recovered diagnostic v0.4.1 — source audit

Recovered from the user-uploaded `MF_Bank_4_LED_DIAG_v0.4.1.zip` in this conversation. Original ZIP is preserved unchanged at `/workspace/attachments/0b83e7c2-d417-4fea-adf6-4fdc8623de77/MF_Bank_4_LED_DIAG_v0.4.1.zip` for this execution environment; this path is not a durable repository artifact.

- Archive: 2032 bytes; SHA-256 `aa0d3cf8b702c568a9f1b12ad5f6363c25ffefd9510386975fccf0348002b4e9`; ZIP CRC check passed.
- Members: `README.txt` (323 bytes), `MF_Bank_4_LED_DIAG/__init__.py` (109 bytes), `MF_Bank_4_LED_DIAG/MF_Bank_4_Test.py` (4684 bytes).
- Python implementation SHA-256: `962557197b0ea0c20543ba5d36051c45d81c87985df1c5eff6b09deb7efd0632`.

This supersedes the prior “v0.4.1 missing” inventory entry only. **Complete Bank 4 controller, v0.4.2, original traceback, actual .mfs and working Bento/combined comparison source remain missing. No repair ZIP built.**

## Confirmed source behavior

1. FIRST_CC=48, COUNT=16, RGB_CHANNEL=1, RING_CHANNEL=0 (zero-based). Startup sends 16 ring-zero messages on human channel 1 (0xB0), then 16 RGB messages on human channel 2 (0xB1). These differ from the assignment's intended channel 11 RGB / channel 12 rings, conditional on physical configuration. This confirms the reported v0.4.1 source-channel discrepancy, not actual hardware reception or the physical .mfs.
2. _probe_active is initialized True and never disabled. _refresh computes approved device palettes but suppresses _set_colors while the probe is active. Fixed groups of four red/yellow/blue/green are sent independently of selected device. Therefore absence of changing device colors is expected in this diagnostic; it cannot validate the full controller's device following.
3. _selected_device returns selected track's selected device, then falls back to song.appointed_device. That fallback can target a different context; there is no parameter writing here. Do not infer that the missing full controller shares this policy.
4. __init__ no longer contains an unguarded log_message call. _refresh still attempts self.log_message inside broad try/except Exception: pass. A mock base without log_message initializes successfully, confirming that this particular absent-method exception is swallowed. README's broad claim that ControlSurface.log_message is nonexistent is not an API-wide finding, and no historical Live traceback was recovered.
5. Constructor listener attachment invokes _refresh, then constructor calls it again. With probe active neither sends RGB. refresh_state clears rings and repeats the probe; disconnect removes normal-path listeners and sends RGB zeros on channel 2. RGB zero and ring zero retain the previously documented firmware/configuration caveats.
6. No receive_midi handler, encoder binding, parameter mappings/writes, parameter listeners or navigation/gesture implementation exists in the archive. It is not the complete Selected Device Controls build.

## Offline checks

Six focused checks PASS using the actual source with only the ControlSurface import replaced by a minimal inert mock: Python syntax; exact startup frame and order; no RGB changes across four selected-device classes during probe; appointed-device fallback; refresh repeats probe; normal disconnect detaches registered listeners and emits the expected zeros. Missing log_message deliberately omitted from mock base.

The reproducible harness is [verify_recovered_diag041.py](verify_recovered_diag041.py). No script was installed or executed against Live, and no MIDI ports were opened. Mocks do not certify Live API availability, exceptional teardown, physical bank switching, hardware LEDs or a full controller. Bank 4 controller tests and hardware tests remain NOT RUN.

## Next source gate

Recover one ZIP of the **complete original Bank 4 Selected Device Controls script folder**, including __init__.py, all implementation modules and local dependencies. v0.4.2 is still useful for the diagnostic comparison, but a diagnostic alone cannot recover accepted parameter order/gestures. No speculative channel-only diagnostic ZIP is presented as a controller repair.

No Banks 1–3, shared listeners/output ownership/routing, accepted builds, firmware or Utility settings changed. No Native Mode activation, hardware messages or merge. CROSS-BANK REVIEW REQUIRED before shared changes.
