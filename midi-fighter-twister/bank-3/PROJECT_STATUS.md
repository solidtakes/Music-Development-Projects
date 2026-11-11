# Bank 3 — MF Clips n Scenes

**Latest test build:** v0.3.0 Mixer & Meter Fix Test. **Rollback:** v0.2.9; older known launcher fallback v0.2.4.

**Input mapping:** rotary CC32–47 on MIDI channel 12, Relative ENC 3FH/41H (63/65), sensitivity 360; push CC32–47 on channel 11, CC Hold.

**Pages:** (1) 4 tracks × 3 scenes, track stop controls; (2) 3 tracks × 4 scenes and scene launch controls; (3) selected-track mixer E1/E5 sends, E9 pan/monitor, E13 volume/arm/mute; scene launches E3/E7/E11/E15 and E4/E8/E12/E16; E2/E6/E10/E14 meter. E14 push cycles Channel / Beat-Bar / Master.

**v0.3.0 changes, hardware validation pending:** FX sends use Selected CH palette 47; E9 monitor temporary IN blue/AUTO yellow/OFF dark then returns to Pan blue; E13 monitor OFF yellow with Arm red priority; Channel MIDI white rings use independent thresholds rather than duplicated 0–127; four-bar quarter-note counter with queued yellow / recording red / normal green.

**Preserve:** working clip/scene scrolling, E15+E16 page switch, relative input, send clearing, click timing, scene colors and progress, Channel/Master audio meter physical order.

**Known test questions:** hardware FX color appearance, quarter-note beat pulses and queued/record colors, independent MIDI meter segments, 16th-note LED smoothness. No claim of hardware validation of v0.3.0.

**Next:** test on hardware and report outcomes before promoting to stable.
