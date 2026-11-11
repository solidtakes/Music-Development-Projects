# Bank 2 — Selected Channel / 4-Track Mixer

Scope: Selected Channel and 4-track mixing, volume/pan, monitor IN/AUTO/OFF, Arm/Mute/Solo, FX Sends, calibrated color feedback and four-stage meters.

Reference packages tested in the ChatGPT workspace include Selected CH v1.0 compatibility fix and 4TRK v0.9 volume/device test; their exact bank-specific deployed versions must be confirmed on hardware.

**Reusable behavior reference:** Selected CH script defines `RGB_FX_SEND=47` for deep purple under its calibrated Expanded palette; Pan E9 temporarily displays monitor state then reverts to Pan blue; E13 retains Arm/Mute/Solo priority; MIDI meter uses thresholds 1/127, 43/127, 86/127, 115/127.

**Important:** MIDI Fighter Utility mapping and output color mode must be recorded per bank. Numeric color values may not look identical across different configurations.

**Next:** verify which selected/4-track script actually owns Bank 2 and its stable version; import source only after hash/ownership checks.
