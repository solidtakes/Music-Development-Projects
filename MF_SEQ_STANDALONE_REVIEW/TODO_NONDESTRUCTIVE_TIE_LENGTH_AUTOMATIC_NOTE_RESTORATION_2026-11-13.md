# Owner decision — Automatic restoration of covered notes

Status: APPROVED BEHAVIOR, ROADMAP ONLY; NOT IMPLEMENTED.
Baseline: Beta 2.3 Test 18 remains frozen.

## Requirement
When extending a note's length or creating a tie covers subsequent notes, do not permanently discard the covered notes. Preserve their original note properties in a reversible shadow model. As soon as shortening or removing the long note/tie uncovers a step, restore the previously covered note automatically. Do not require removal of the entire tie.

Preserve original pitch, velocity, length, probability and any supported timing/nudge properties. Respect mono collision rules and avoid doubled notes or overlapping playback. A note still partly covered must not be restored as a conflicting playable note; define restoration/trim behavior for partial overlap.

## Engineering investigation
- Determine how covered notes can persist across Live project save/reopen, clip duplication, undo/redo, external clip edits, clip replacement, and script reload. An in-memory-only shadow store is insufficient for durable restoration.
- Specify identity, versioning, precedence, restoration ordering and conflict resolution for nested/overlapping ties and repeated length changes.
- Define what happens if the user edits or deletes a covered note via Live while hidden, or intentionally deletes the covering note.
- Validate 1/2/4 bars and all 64 step positions, loop boundaries, page changes, and swing/nudge compatibility.
- Ensure no silent changes to frozen gestures or LED colors. Provide a design, feasibility, persistence plan and isolated test proposal before implementation.

Owner selected **automatic restoration immediately upon uncovering each step**, not only when entire tie is removed. No code edits, merges or promotion without separate owner approval.
