# MF4TRKBento v1.6 EXP performance and RGB investigation

## MIDI path and palette

The 2026 DJ TechTools guide, page 4, shows **96 orange**, **104 dark blue** and **48 violet** in the Extended palette. That accounts for the reported orange as long as the active RGB path uses the Extended palette. Older Bento source labels 96 and 104 as purples, so its symbolic names were insufficient evidence. The experimental Sends RGB value is 48. The script emits `BA CC 30` in hex for an eligible Sends cell and retains `BB CC value` for rings. The exact 222.mfs export corroborates push channel 11 and rotary channel 12. Its multiple bank CC ranges alone cannot identify the active feedback address. No channel or CC was migrated. [DJ TechTools 2026 guide](https://drive.google.com/file/d/0B-QvIds_FsH3Z0ZLT041VnZfOTA/view?usp=sharing)

The exact export sets global tag 33 to 1 (Extended/MF64) and all 64 encoder records set inactive-color tag 20 to 0 (black). Vendor firmware confirms that Extended maps 48 to bright purple and 96 to bright orange. The vendor guide explains that an RGB zero restores the configured inactive color. The source trace and tests verify final RGB and ring bytes and availability clears. Another Live surface or mapping could still write the same address. Physical feedback and competing writers remain to be checked in a passive Live MIDI capture. [DJ TechTools firmware color map](https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/blob/master/src/colorMap.c)

## Polling and cache

`_audio_mixer` gates track Pan and Sends using the documented output capability rather than a meter. It is read once per used column per scan and checked again for actions so an intervening device change is respected. Alternate Master Pan bypasses that gate. `_scan_frame` shares a rendered Pan value across duplicate Pan rows, uses the native send collection without copying it and drops unavailable reads from the frame. A later scan sees changes to device I/O or send count. Sends press remains inert. Normal refreshes preserve the existing RGB/ring caches and retry semantics. Scan cadence, scene playback, wire protocol and callback cleanup retain v1.5 behavior. [Live Object Model Track reference](https://docs.cycling74.com/apiref/lom/track/)

| Workload | v1.5 → v1.6 median µs/tick | Script MIDI attempts |
| --- | ---: | ---: |
| Idle available mixer | 13.44 → 12.26 | 0 → 0 |
| Idle with two non-audio MIDI tracks | 13.45 → 9.14 | 0 → 0 |
| Audio availability and send-count transitions | 13.22 → 11.44 | 80 → 180 |
| Stopped grid | 74.39 → 74.13 | 0 → 0 |
| Animated grid | 111.00 → 118.73 | 8,000 → 8,000 |
| Input dispatch | 72.37 → 73.12 | 112 → 112 |

Nine alternating trials of 800 ticks with the same 64-track Python workload. For repeated Pan rows, min/max/value reads fell 5,600 → 4,000 each in the fully available mixer and 5,600 → 1,600 each with two ineligible tracks. Additional transition sends carry the new RGB and ring clears/restores. Other measured MIDI streams match byte for byte after warm-up. Animated-grid mock timing was 7.0% slower in this run although its code path, call counts and output are unchanged. The event workload was 1.0% slower. These results are instrumented Python timings and script MIDI attempts, not Live CPU, hardware latency or wire traffic. Raw counters and reproduction commands are included.

Deferred from v1.5: event-listener scene caching, ring cadence changes and private SessionComponent registry changes need integration testing. This build keeps two-tick state polling.
