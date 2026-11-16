# MF4TRKBento Beta 3.4 EXP — Custom rotary row layout with temporary RGB preview

**Status:** experimental, draft PR, no physical Live/Twister test claimed. Stable rollback: owner-accepted Beta 3.3 ZIP SHA-256 `7af1cb6d99f884b0ddc607745bed15ad28396f17293cd06efabac60f41cf06c7`. This experimental build derives from exact Beta 3.3 source commit `8106e68c`; untouched existing `beta3.3-exp` sources and CI remain intact.

## Owner-requested 3.4 design
- Preserve default physical rotary functions top-down Send A, Send B, Pan, Volume until the user customizes a row.
- Retain **hold row's first encoder push + turn last encoder rotary** for push-button module selection.
- New mirrored gesture: **hold row's last push + turn first rotary** (four detents per step) to select Volume, Pan, any currently available Send A/B/C/..., Device Control. The first custom edit snapshots prior assignments so all other physical rows stay still.
- During last-push hold, four row RGB LEDs preview selected rotary type: green Volume 76, light-blue Pan 68, purple Sends 96, yellow Device 108. Restore push-module LEDs on release; white ring always continues to show parameter/meter.
- A Device rotary may be assigned to any row; gaps are supported; device row indices use active physical Device rows in ascending order. The primary device push row is whichever Device rotary row has a Device Control push module. Button modules remain independently configurable.
- Four max Device banks, each spanning all active Device rows; 35ms Volume guard, E1+E16, E16+E1, clip/scene scrolling, master/return behavior and no-audio MIDI dark rings preserved.
- No dedicated colored VU display module in 3.4; that is deferred to a later build, per owner "I will add a new one later."

## Mock verification
GitHub Actions checks Python compile, full regression suite with preview, symmetry, preservation, noncontiguous Device rows, Sends and standard inputs, plus deterministic 3-file installable ZIP. Verify actual Live hardware separately, especially the mirrored modifier, preview restoration, E3/E4 navigation and active audio VU; no auto merge, no unreviewed changes to accepted Beta 3.3.
