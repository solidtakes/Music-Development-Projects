# Issue 15 — Bank 4 Selected Device Controls audit

Status: **BLOCKED ON SOURCE RECOVERY — review evidence, no installable repair candidate.**

Current-request revalidation: see [REVALIDATION.md](REVALIDATION.md) for the fresh 29-head audit, repeated offline checks and additional accepted-SP1 comparison. Original inventory below records the initial audit.

Issue: https://github.com/solidtakes/Music-Development-Projects/issues/15

Issue 15 explicitly requires: “If source is missing, report the missing artifact and stop before speculative reconstruction.” That gate applies. No Bank 4 production source, diagnostic correction, parameter mapping, executable ZIP or implementation diff has been invented. The isolated review branch adds only this directory. No Banks 1–3, PR 14, accepted MF2Bank Beta 1, shared routing, colors, firmware settings or Native Mode activation are changed. This is a partial engineering handoff, not completion of the requested repair.

## Source provenance and artifact gate

`artifact_inventory.json` records all 26 fetched branch heads, exact commits, relevant paths and the empty release result. The filename scan also covered objects reachable from fetched refs; it cannot recover inaccessible attachments, deleted/unreachable objects or files never committed. Available user-material directories contained no attachments. Issue 15 had zero comments when read. Bank 4 requirements below come from Issue 15, which supersedes older documents describing Bank 4 as reserved or as the unrelated melodic sequencer.

| Material | Provenance / result |
|---|---|
| Research handoffs | Research branch `a301cd7bcb1a7cc3f82124f40d79ed2d76a379fd`; both named documents read. Research only, no Bank 4 source. |
| Shared rules and freeze | `bento/beta-v2-freeze-20261112` at `4f9f8cd3ee0da218f88d0f4e220e230e5e43d9e1`; shared rulebook, all-thread handoff, freeze registry and seven linked authoritative module documents read. |
| Palette / mapping provenance | `bento/bank4-approved-palette-rule-20261112` at `0da5da2faf901fa1f36ed966d4513c33cbc58da3`; actual Bank 4 configuration remains unverified. |
| Complete selected-device Bank 4 source | **Missing; version, commit and SHA256 unknown.** A diagnostic would not establish parameter order, on/off, navigation or gestures. |
| Diagnostics v0.4.1 / v0.4.2 | **Both missing; SHA256 unknown.** Ch2/ch1 versus ch11/ch12 correction is an issue report, not independently audited source. |
| Historical Live log | **Missing; SHA256 unknown.** Only the `MFBank4Test.log_message` exception text reported in Issue 15 is available. Latest-source avoidance cannot be determined. |
| Configuration `2026 all rel cchold(1).mfs` | Bytes missing. Registry-reported size 2312; reported SHA256 `3ab457f9c427d8933340119cf4cd960f87d98b183f12af0cb406c7902a7694f4`; not independently recomputed here. |
| Working Bento ZIP | Bytes missing. Frozen registry reports `Bento_v0.1.32_REDOWNLOAD.zip`, SHA256 `a1d377fdacb40629bc8454ab48d4ebee984588f933568c02543900ed516ad4fd`; not independently recomputed here. Later current Bento/accepted combined source also missing. |
| Available sequencer reference | `7e6786c80160b20e2f6419f104a2150284981ea6`, `MF_SEQ_STANDALONE_REVIEW/v1.5.0/baseline/MF_SEQ/MF_SEQ.py`; SHA256 `8e4ff43eaa6a0fa30487b069e01cd2780781e0788d49016bd684f7d865d6954d`. This is an older review baseline, not proof of current Bank 2 acceptance or physical assignment. |
| DJTT firmware source | `DJ-TechTools/Midi_Fighter_Twister_Open_Source` commit `782f9533b01d4513aa7da4aa789250b7fd69a44b`; `src/encoders.c` SHA256 `bedf778e1d07d1104edca992dc46efdf98481d738fa139c380d86333bb2972cc`. Installed owner firmware identity is unknown. |

Exact missing-input bundle: complete Bank 4 selected-device implementation with version/install name; both diagnostics; unedited relevant Live log/traceback; actual .mfs bytes and firmware ID; working Bento/sequencer and accepted combined baseline ZIPs. Hash each before extraction, inventory all files, and establish whether diagnostics share implementation code before patching.

## Confirmed behavior versus possible causes

Pinned [DJTT encoders.c](https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/blob/782f9533b01d4513aa7da4aa789250b7fd69a44b/src/encoders.c) and [midi.c](https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/blob/782f9533b01d4513aa7da4aa789250b7fd69a44b/src/midi.c) establish:

- `process_midi_packet` (midi.c:441–523) extracts zero-based channel from the status low nibble. `process_element_midi` (encoders.c:1332–1462) matches stored MIDI number/channel/type across all configured bank encoders. Standard RGB is the switch mapping; white position is the rotary mapping. Bank 4 is not universally fixed to any channel or CC range.
- If physical configuration matches Issue 15, E1–E16 RGB are `(0xBA, 48+i, palette)` and rings `(0xBB, 48+i, position)`, i=0..15. Available sequencer `_led` / `_white_ring` at lines 416–429 use exactly these messages, with separate caches. The missing diagnostic cannot yet be checked for off-by-one channels, output packing, range or send failures.
- `process_sw_rgb_update` (1500–1521): value zero releases override and restores configured inactive color. It is not unconditional black. Values 1–125 select palette entries; 126/127 select configured active color. Thus a source comment saying zero is off needs configuration evidence.
- `process_indicator_update` (1469–1498) ignores zero when detent is enabled. Matching shifted feedback updates its raw state, but only the currently displayed shift state updates the visible-position buffer. This is relevant to white-ring clearing, not an established RGB defect.
- Inactive-bank feedback updates per-bank buffers. `change_encoder_bank` (1729–1775) invalidates prior physical display values and selects the new bank. `update_encoder_display_single` (1646–1711) consumes the selected bank buffers. Firmware does not require an RGB “flush” command for these standard CC writes. Repeated identical CC sends are not a proven repair.
- Duplicate mapping support is enabled (1330). Matching addresses across banks can all update. The system MIDI channel takes a special path, so a system/data-channel collision can prevent ordinary feedback. This needs .mfs and live configuration evidence.
- Display is serviced incrementally; animations/overlays/sleep can affect visible timing. Buffer acceptance is not an acknowledgment of USB delivery, LED visibility or correct Live output-port ownership.

**No source-level Bank 4 root cause is confirmed.** Priorities after recovery:

| Priority | Candidate cause / investigation | Status |
|---|---|---|
| P0 | Constructor abort at `self.log_message`; inspect inheritance, initialization order, full traceback and installed script identity. | Historical exception reported, cause/latest behavior unverified. Do not assume `log_message` is absent from every Live ControlSurface API. |
| P0 | Wrong RGB/ring channel, CC, type or selected output port; compare diagnostics and actual config. | Reported earlier channel error, not source-confirmed here. |
| P1 | Competing Control Surfaces, stale caches after reconnect or failed send, duplicate clearing or periodic overwrite. | Hypotheses; capture timestamped ordered output and surface identity. No routing changes authorized. |
| P1 | Track/device focus mismatch, renamed-device identification, Rack nested selection, deleted device or stale listener. | Unassessed; complete selected-device code required. |
| P1 | Parameter ordering, quantized/bounded scaling, disabled parameters, page boundaries, power button lookup and gesture preservation. | Unassessed; requirements do not specify a replacement mapping. |
| P2 | Physical-bank entry refresh / late callback after teardown. | Unassessed in Bank 4. Separate script lifecycle from firmware buffer refresh. |

Initialization audit must establish base initialization before framework calls, listener/cache state before registration, initial binding before render, output readiness and one owned scheduled loop. Track changes must detach old device/parameter listeners before binding the new context. Disconnect must invalidate queued callbacks and detach only owned listeners before base teardown. These are review criteria, not claims that the missing build violates them.

## Firmware differences and compatibility

[DJTT July release notes](https://store.djtechtools.com/pages/midi-fighter-utility) describe configurable animation/shift channels, alternate palettes and bank animations; July fixes include animation-related audio dropouts. [September beta notes](https://forum.djtechtools.com/t/midi-fighter-utility-3-0-beta/155169) add Native Mode/setup features. The pinned August source versus tag `20260702` adds `sync_indicator_from_raw`: relative encoders retain host-sent ring state across bank/shift changes instead of replacing it with raw detent bookkeeping. It also seeds ring buffers on initialization. This can explain version-dependent rings, not prove a Bank 4 RGB failure.

Native-mode input/display hooks run only when active. Native Mode uses a different input/output contract; direct RGB SysEx must not be substituted into a standard-mode bank script. No activation command, firmware flash, brightness/color experiment or Utility configuration change was performed. The installed experimental binary is not identified by the shared research handoff, so exact compatibility remains open.

Live 11+ uses Python 3 per [Ableton installation guidance](https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-remote-scripts). This host's compile checks do not certify Live 12.4.16 or Live 13 beta's embedded Python or private framework APIs. Official [DeviceParameter LOM documentation](https://docs.cycling74.com/apiref/lom/deviceparameter/) supports bounded values, enabled/quantized state and observable values; it is not a guarantee that every Python listener exists in both target releases.

## Offline validation and limitations

Run `verify_protocol.py` as below. It extracts real pinned firmware functions into a host-C harness with inert hardware/native-mode dependencies and builds with address/undefined-behavior sanitizers. No MIDI ports are opened. Distinct test groups:

1. Bank 4 mapped RGB/ring updates while Bank 1 is active, including unchanged unrelated buffers.
2. RGB zero restores inactive and clears override; 127 restores active.
3. Ring zero detent rejection, then acceptance without detent.
4. RGB/ring separation, shifted-state isolation and out-of-range/unmapped CC.
5. Duplicate mapping updates another bank.
6. System-channel collision bypasses ordinary mapping.
7. Full 16-address mapping coverage (included in the buffer fixture).

The reference Python checks compile the complete available sequencer source and exercise its actual extracted LED helpers: exact 32-message ordered RGB/ring sequence, unchanged-value suppression, explicit cache invalidation, and message bounds. All 7 firmware / 4 Python groups passed. Full target firmware compilation was not run. Harness enums/stubs are test scaffolding, not an AVR build. Sequence ordering is a Python construction result, not measured hardware timing.

**NOT RUN:** Bank 4 syntax, mocked Live selection/device/parameter tests, initialization/disconnect, duplicate callback/leak, physical-bank simulation, controls, cross-bank runtime regression, Live/hardware. They require actual source and cannot be replaced by testing a newly invented implementation. Existing test results do not establish any working Bank 4 functionality.

Reproduce with Python 3, Git and GCC supporting sanitizers, from a scratch directory:

```sh
git clone https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source.git firmware
git -C firmware checkout 782f9533b01d4513aa7da4aa789250b7fd69a44b
git clone https://github.com/solidtakes/Music-Development-Projects.git projects
git -C projects fetch origin bento/bank2-sequencer-v150-review-20261112
git -C projects show 7e6786c80160b20e2f6419f104a2150284981ea6:MF_SEQ_STANDALONE_REVIEW/v1.5.0/baseline/MF_SEQ/MF_SEQ.py > seq_reference.py
python /path/to/verify_protocol.py --firmware firmware --sequencer seq_reference.py --results test_results.json
```

Input file hashes are checked before extraction. No vendor source is bundled. `SHA256SUMS` covers the delivered evidence files. PR diff is the only change diff; there is no production patch. Rollback: do not install this evidence directory as a Remote Script; no installed script has changed.

## Preserved requirements and next action

Issue 15 requires EQ Eight RGB 68 on all 16; Auto Filter RGB 108 on E1–E8 and off on E9–E16; Compressor RGB 72 on all 16; unsupported/no device off. Keep existing parameter order, power/gestures and bank semantics. “Off” must be checked against inactive-color settings. Do not import the 16-macro comparison's absolute mapping or the unrelated sequencer's gestures.

First recover the missing-input bundle above. Then audit source before creating the smallest isolated patch, versioned ZIP and meaningful mocked lifecycle/parameter tests. Do not install a diagnostic as the full control build.

**Hardware test 1 only, optional on the existing unchanged build:** select physical Bank 4, then EQ Eight once; passively capture existing outgoing MIDI with timestamps and the selected script/output-port identity, and record visible LEDs. Do not send extra CC/SysEx or reconfigure routing to perform this test. A “pattern sent” log is not device acknowledgment. If passive capture needs routing changes, stop and recover artifacts first. Further tests are gated on this result; Live 12.4.16 / Live 13 beta and Banks 1–3 regression remain owner tests.

**CROSS-BANK REVIEW REQUIRED** before shared LED ownership/routing, common listener or bank-switch changes. No shared change is proposed or implemented by this review. A safe Bank 4 local repair remains conditional on recovered source and isolated test evidence. No automatic merge or stable promotion.
