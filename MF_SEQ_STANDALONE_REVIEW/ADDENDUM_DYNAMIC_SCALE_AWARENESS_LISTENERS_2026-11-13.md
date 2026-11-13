# Codex Addendum — Dynamic Ableton Scale Awareness Synchronization
Date: 2026-11-13
Applies to BUG_SCALE_AWARE_OFF_STILL_QUANTIZES_PITCH_2026-11-13.md.
Owner requirement: listen for Ableton Scale Awareness ON/OFF, scale root changes, and scale type changes in software and react immediately.

## Acceptance
- Scale Awareness OFF: chromatic semitone-by-semitone pitch adjustments, subject to existing pitch bounds.
- Scale Awareness ON: pitch edits use Ableton's current root and scale type, not hardcoded C Major.
- Root or scale type changes in Live update the next pitch edit without script reload, whether transport running or stopped.
- Existing MIDI notes are not silently retuned or quantized when settings change.
- If switching selected clip/track changes effective scale context, bind to the correct context and refresh when selection changes.
- Keep all frozen Beta 2.3 gestures, colors, note/tie/velocity/probability, loop and Follow behavior intact.

## Engineering requirements
1. Identify actual Live 12.4.16 supported properties, listener availability, and ownership (Song vs Clip vs View) from authoritative LOM or introspection. Distinguish scale highlighting, Scale Awareness, and clip scale modes; do not assume they are identical.
2. Subscribe to available change listeners for enable/disable, root and scale type; handle attach/detach on song/clip/track changes. Avoid duplicate listeners, stale references and leaks.
3. If a property has no listener, implement bounded, change-detection polling through existing update_display; never block MIDI input or create background threads.
4. Recompute a small cached pitch-class mask only on relevant change. Do not reread all clip notes or redraw all LEDs on every poll.
5. Provide exact tests for ON/OFF, root changes C→D, Major→Minor/Dorian, selection changes, stop/play, script reload and pitch bounds.
6. On unavailable API, clearly surface unsupported synchronization and propose a controller-owned fallback; never silently lock C Major.
7. Submit an isolated experimental patch/ZIP and test evidence for owner review. No merge, no modifications to frozen Beta 2.3.
