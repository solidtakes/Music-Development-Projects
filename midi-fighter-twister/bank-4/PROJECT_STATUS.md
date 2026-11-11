# Bank 4 — Mono Melodic Sequencer

**Last reported test:** v1.51; not independently verified against a GitHub source commit.

**Utility mapping:** encoder rotary CC48–63, MIDI channel 12, Relative ENC 3FH/41H, sensitivity 360, center detent and dot; encoder push CC48–63 on channel 11, CC Hold.

**Scope:** mono melodic step sequencing, pitch entry, hold/rotate note duration, double-click/page switching, bar paging. Target cap: 4 bars.

**User observations:** v1.51 double-click switching appeared good; bar 2 accepted notes and extended the loop; occasionally clip position moved unexpectedly on E1+E15 or E1+E16 combination (not reproducible); note entry lag to investigate without harming double-click recognition. A route to 8 bars was observed; cap at 4 requested.

**Next:** validate current source and investigate 4-bar cap, note-entry latency, and rare clip-selection movement. Keep sequencer gesture timing isolated from Bank 3 launch behavior.
