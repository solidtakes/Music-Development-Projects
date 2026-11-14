# MF4TRKBento v1.2 EXP

Baseline is v1.1 EXP from draft PR #20, commit 1b6b45adfd42c88ad047171c4d2b151665f0b159.
Install folder stays MF4TRKBento. Keep the v1.1 ZIP for rollback.

- The box starts at the first visible track and scene. Track and scene selection do not move it.
- Hold E1 and turn E16 to move horizontally. Hold E1 and turn E12 to move vertically.
  Four consecutive same-direction detents move one slot. Releasing the modifier or reversing
  direction drops the previous partial count. The reverse E12-hold/E1-turn gesture is retained at
  the same four-detent rate. Holding E16 first and tapping E1 still toggles alternate mode.
- E4 and E8 show the corresponding Live scene colors in alternate mode when their row
  is an RClip. The existing palette maps RGB; scene rings stay off. In normal mode E4/E8
  render and launch clips. A lone RClip in row 2 represents the first scene in the box,
  so launch, LEDs and highlight stay aligned.
- MIDI input/output addresses remain from v1.1 (CC0–15). The earlier export identifies
  a CC32–47 group; live routing still needs capture before migration.

Test in a disposable Live set with at least five visible tracks and three scenes.
Back up the current MF4TRKBento installation outside MIDI Remote Scripts. Close Live,
replace the folder in place, and restart using the same isolated MIDI routing as v1.1.
Check selection independence, three versus four detents both ways and both axes,
scroll bounds and no clip launch on modifier release. Compare E4/E8 RGB to differently
colored scenes, fire each, then return to four-clip mode and confirm fourth-track clip
feedback and launch. Check row 2 alone and both rows, and the existing module gestures.
To roll back, close Live and restore the backed-up v1.1 folder in place.
Offline tests and independent source review precede hardware testing; no Live run was performed.

[Scene color documentation](https://docs.cycling74.com/apiref/lom/scene/#color)
