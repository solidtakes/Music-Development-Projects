# MF Build 3 — Bank 1 Navigation

Approved design (not implemented/tested).

- Hold **E1** and twist **E16 clockwise**: select next Ableton track to the right.
- Hold **E1** and twist **E16 counterclockwise**: select previous Ableton track to the left.
- Hold **E1** and twist **E15**: reserve for secondary scrolling; exact target not yet assigned.
- Show selected track name in Ableton status bar.
- Refresh active selected-track modules upon track changes; inactive modules remain unsubscribed.
- No change to the four-column architecture or Standard Color Mode.
- Gesture priority: E1+E15/E16 navigation supersedes E1 hold+twist column-module switching when these gestures are detected. Avoid triggering E1 ordinary button actions while acting as modifier. E15/E16 normal functions remain when E1 is not held.
- One deliberate encoder increment per navigation step; tune sensitivity in hardware testing.
- Confirm actual Live track ordering and handling of return/master tracks before implementation.
