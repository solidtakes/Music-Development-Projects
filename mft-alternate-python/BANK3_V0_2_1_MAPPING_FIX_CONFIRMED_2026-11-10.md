# MF Clips n Scenes — Bank 3 v0.2.1 mapping repair

User confirmed E1–E8 now launch clips and E8 scene scrolling works after correcting MIDI Fighter Utility button MIDI channels from 12 to 11. No Python fix was needed for that fault.

Canonical Bank 3 mapping: rotary CC32–47 channel 12 Relative ENC 3FH/41H sensitivity 360; push CC32–47 channel 11 CC Hold; Expanded Color Mode. E8 hold+twist scrolls scenes, E12 hold+twist scrolls tracks. E12 scroll sensitivity was reduced to 25% in v0.2.1; verify user preference before further adjustment.

Previously confirmed: E9–E16 operation, Session Box, clip populated colors, playing/recording LED feedback, loop-length-aware white-ring progress. User now reports clip launching and scrolling working after hardware configuration correction. Non-looping clip progression remains an older known issue. Avoid changing stable behavior. Verify any remaining gesture and animation edge cases on hardware.
