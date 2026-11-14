# MF Device Aware — Alpha 1 owner acceptance (2026-11-13)

## Artifact and provenance
- Product name: **MF Device Aware**
- Owner designation: **Alpha 1**
- Exact baseline: `MF_BANK4_REVIEW/v0.5.1/MF_Bank4_Selected_Device_v0.5.1_Rebuild_Candidate.zip`
- SHA-256: `34571e5e24dd7acfffeceaee668066977463ad9bd4ba7452ffb9dc1bef79e5e6`
- Internal Live Remote Script folder: `MF_Bank4_Selected_Device_v051` (retain this install name; changing it is not part of acceptance).
- Owner reports: **"control works great many encoders are controlling many paramaters"**. This supersedes the earlier v0.5.0 startup-blocker report for the newer v0.5.1 build.
- **Validated by owner**: selected-device encoder control works on hardware with many parameters.
- **Not yet fully validated**: every mapped parameter, every device, all RGB/ring states, push gestures, switching, disconnect, startup across all Live versions, and regression to other banks.
- **Do not confuse** owner acceptance with complete test-suite or production certification.

## Engineering learning for all MF threads
1. v0.5.0 intercepted only `receive_midi`, while the Live framework can deliver batched MIDI through `receive_midi_chunk`; v0.5.1 routes batch events through the same scoped handler in order and under component guard. Review whether each bank's input path already correctly handles both routes; **do not assume other banks share the defect**.
2. Preserve MIDI ownership boundaries, especially CC48–63, rotary channel 12, push/RGB channel 11, rings channel 12 on Bank 4. Cross-bank behavior is bank-specific; do not globally apply these CC ranges.
3. Preserve listener cleanup, device/track focus, graceful handling of absent/ambiguous parameters, MIDI send suppression, color conventions and LED lifecycle. Compare implementations and test before making changes.
4. Hardware-confirmed functioning of Alpha 1 does not establish that every LED color/ring/gesture is verified.
5. Treat native-mode firmware research as informational only. No firmware/Utility/Native Mode changes.

## Cross-bank review assignment
- Bank 1 Selected Track Bento: inspect for a potential single-vs-batched MIDI dispatch gap and compare device mapping, listener ownership and LED lifecycle; report findings and isolated tests.
- Bank 2 sequencer: inspect input dispatch path without altering approved SP1 Beta 3.0 behavior; review combo gesture input ordering only if supported by evidence.
- Bank 3 Clips/Scenes: inspect press/release and combo dispatch for batch parity; preserve launch-on-release, page mappings and approved colors.
- Experimental Integration: consider shared test fixtures that exercise single and batched input equivalence, event order, CC/channel isolation, device selection and cleanup. Propose only, no integration without review.
- Bank 4: retain Alpha 1 as immutable rollback baseline; future changes on new candidate branches.

**Mandatory:** CROSS-BANK REVIEW REQUIRED before shared MIDI routing/listeners/LED ownership changes. Preserve Banks 1–3, MF2Bank Beta 1, accepted sequencer SP1, firmware and Utility settings. No automatic merge, no speculative fixes. Report each bank's audit as confirmed / not applicable / needs test, with source and test evidence.
