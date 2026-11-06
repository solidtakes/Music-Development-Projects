# Roland AIRA Modular — Native Apple Silicon macOS Driver
Target: Roland AIRA Modular BITRAZER / DEMORA (currently DEMORA firmware), VID 0582 PID 01AF.
Priority: Core Audio full-duplex 10 input / 10 output at 96 kHz; CoreMIDI input/output and SysEx before Customizer features.
Known USB: interface 3 alt 0 bulk MIDI IN 0x84 / OUT 0x03; audio interface 1 OUT 0x0D and interface 2 IN 0x8E with isochronous alternate settings.
Progress: MIDI enumeration and endpoint discovery were previously demonstrated; audio skeleton compiles with 10-channel objects and buffers but streaming is deliberately disabled.
Prior checkpoint: offline builds and tests passed; not a functioning audio driver yet.
Rule: Do not install, enable streaming, or claim hardware success without verified testing.
Next: Import actual source and capture analysis summaries; verify current Codex branch, commit and tests.
Avoid uploading giant PCAP files or proprietary Roland binaries.
