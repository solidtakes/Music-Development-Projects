# MF4TRKBento v1.1 EXP, Issue #19

## Baseline and scope

Baseline is the owner-supplied `MF4TRKBento_v1.0.1.zip`, SHA-256
`67bc7f64bd1e30be677f000d9050599ca15e1b5c4625d85580285f1b0e14cb32`.
Its script SHA-256 is
`a1b8687ccbc88ed5bbb2256a235c0b5781d850eae8eb35ad906195822277937c`.
Use the original ZIP for rollback. This candidate uses the same internal `MF4TRKBento` folder.
The branch is `bento/mf4trkbento-v1.1-experimental`.

The renderer sends one final value per changed RGB or ring address. Clip state takes
priority at E1 and E5. The source scans each visible track's slots once per state
refresh, caches palette matches without altering the palette or tie-break order,
and samples RGB phase every host tick. Clip state, ring position, and highlight
checks run every two host ticks, with immediate refresh where existing actions
change the grid. SessionComponents are rebuilt on dimension changes. Explicit
refresh resynchronizes output, and teardown removes owned listeners and disarms
the scheduled callback.

Reference is the supplied Selected Track Bento v2.2 EXP ZIP, SHA-256
`59fc6d6f732a8e4f7ee969caa1224bbf10bf03b9a3acb79c85ec07655be07a4b`.
In `MF_Build_Selectedtrack_Bento/MidiFighterTwister_Custom.py`, `_send_cc` at
884–889 and `_render_clips` at 1381–1412 show final-value sends and a slot
snapshot. `disconnect` at 2044–2069 shows explicit control listener cleanup.
The source's sign-aware detent accumulation is a reference for later navigation
work. v1.1 preserves the existing one-detent gestures to avoid a behavioral
change. The hardware-accepted v0.1.32 archive was unavailable in this session.

## MIDI mapping migration blocked

Windows MIDI listed Twister endpoints, but no physical message capture was available.
The local 2312-byte `updated%20mf%20settings.mfs`, SHA-256
`526d96305286136127619862fd00904aaeab53eb0b750a8903314b5be22509d4`, differs from
the archived hash `3ab457f9c427d8933340119cf4cd960f87d98b183f12af0cb406c7902a7694f4`.
Under the upstream firmware field layout, the local export's CC32–47 records
show absolute rotary CC on ch12, with mixed switch behavior. E1–E8 use ch12 CC Hold,
E9–E12 ch11 Encoder Reset, and E13–E16 ch11 CC Hold. This is an offline interpretation
of an older-format export and does not establish the active profile.
[Upstream field layout](https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/blob/782f9533b01d4513aa7da4aa789250b7fd69a44b/src/config.c#L299-L308)
[Upstream enums](https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/blob/782f9533b01d4513aa7da4aa789250b7fd69a44b/src/encoders.h#L60-L86)

Per Issue #19, the test build retains CC0–15, turn/ring channel 12 and push/RGB
channel 11. A migration needs input and output capture on the actual Bank 2 setup:
E1–E16, both rotary directions (3F/41), press and release, and both LED streams,
with the active Utility export and firmware version. Keep Utility settings as-is.

## Offline results

Two active RClip rows, four tracks. After warmup with frozen phase/position, stopped
refresh requests dropped 17 to 0 and playing refresh requests 33 to 0. In a separate
moving simulation over 80 equal host ticks, they dropped 532 to 448. Median script
wall time per forced refresh measured 56.36 to 10.43 microseconds stopped and 100.63
to 11.81 microseconds playing. Process CPU estimates and all run details are in
BENCHMARK.txt. The harness times stubbed execution and counts calls before host
coalescing. Live callback cadence, actual MIDI traffic, CPU load, and visible
latency require hardware testing.

Independent review verified the source changes, independently reran the final
harness and reproduced the moving-send counts. Reported limitations include the
unverified physical routing, real timing, and inherited modifier-release edge
cases. Scene feedback and independent grid navigation remain Stage 3. No audio
VU was added; the rings in this build display clip playback position.

## Isolated hardware test and rollback

1. Back up the current installed folder outside MIDI Remote Scripts. Close Live and
   replace that folder in place with the ZIP's `MF4TRKBento` folder. Restart with
   the same isolated test setup and exclusive Twister ports. This build still
   emits CC0–15. Keep any other controls owning those addresses off that test port.
2. Confirm four horizontal clips, both RClip rows, module gestures, scene launches
   in alternate mode, and color updates when moving the box. Confirm E1/E5 show
   their clip colors. The clip box still follows track selection.
3. Check stopped clips stay solid and playing rings advance. Try queued,
   recording, play/stop and clip-loop wrap. Check both modifier release orders
   in a disposable set and report any unexpected launch. Reconnect and verify resync.
4. Compare against v1.0.1 with the same set and routing. Record the MIDI capture
   described above, along with any actual timing or visible difference. Roll back
   by closing Live and restoring the original folder in place.
