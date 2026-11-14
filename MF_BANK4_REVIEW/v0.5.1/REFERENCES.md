# Research provenance and licensing

The existing [PR comparison research](../ISSUE_15_2026_11_13/COMPARABLE_IMPLEMENTATIONS.md) supplies exact pinned links, license distinctions and limitations. No third-party implementation code was copied into this candidate.

- [jeffgca/djtt_twister_16macros at 526e5b9](https://github.com/jeffgca/djtt_twister_16macros/tree/526e5b9a04d973d007ab074c8595481228b6818e): generated script CC0; upstream claims Live 11/12. Pattern: initialize components after base initialization. Its appointed-device binding and absolute ch1 mapping are not used.
- [leolabs/ableton-js at 63bf873](https://github.com/leolabs/ableton-js/tree/63bf873c5f1063a67011c6665d892833fcd54701): MIT, upstream Live 11+. Pattern: selected track view's selected_device and exact object/callback listener ownership. No socket/global registry code used.
- [raphaelquast/beatstep at e394886](https://github.com/raphaelquast/beatstep/tree/e3948866e6d72713f3038a7e3cc773a3886db5a3): GPL-3.0, upstream Live 9–11. Conceptual focus/power comparison only; no code copied, no power gesture adopted.
- [Trinitou/MidiFighterTwisterXT at bf4bacd](https://github.com/Trinitou/MidiFighterTwisterXT/tree/bf4bacd6c663ee68836124715f2d010706b49679): GPL-3.0-or-later, Bitwig integration, conceptual binding lifetime only. No code or Native Mode behavior adopted.
- [Official DJTT firmware at 782f953](https://github.com/DJ-TechTools/Midi_Fighter_Twister_Open_Source/tree/782f9533b01d4513aa7da4aa789250b7fd69a44b): standard-mode address/buffer and zero semantics from the existing protocol audit. No license for redistribution presumed; no firmware source included.
- Available accepted sequencer SP1 at repository commit 372690b15751bbd5bd5c6287cf88fdf89d9dd89e, ZIP SHA-256 223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180: separate RGB/ring state caches and unchanged output suppression are design references. SP1 uses CC32–47, not the new Bank 4 addresses. Working Bento/combined source is unavailable and is not claimed compared at source level.
- [Ableton third-party Remote Scripts](https://help.ableton.com/hc/en-us/articles/209072009-Installing-third-party-remote-scripts): Live 11+ Python 3/install guidance. [DeviceParameter LOM](https://docs.cycling74.com/apiref/lom/deviceparameter/): bounds, enabled/quantized and observable values. Neither certifies Python private API compatibility in Live 12.4.16/13 beta.

The explicit parameter-name tables are candidate assumptions to resolve against the actual host inventory; these references do not establish every target host name. All hardware, host version, physical configuration and shared ownership questions remain owner validation gates.

## v0.5.1 framework interface evidence

[gluon/AbletonLive12_MIDIRemoteScripts, control_surface.py at e83d519](https://github.com/gluon/AbletonLive12_MIDIRemoteScripts/blob/e83d5192f321b24eb9daab843ac49a2d95d862b1/ableton/v2/control_surface/control_surface.py#L193), lines 193–200 and 220–247: receive_midi_chunk is separate from receive_midi and uses framework recipient dispatch. This is a decompiled framework reference, not a permissively licensed source dependency; no implementation code was copied or redistributed. The new six-line batch adapter is original code using the observed API entry point. This Live 12 reference does not certify behavior of the owner's actual Live build.
