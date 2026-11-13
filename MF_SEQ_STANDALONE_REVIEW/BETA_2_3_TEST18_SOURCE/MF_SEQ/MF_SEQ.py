"""MF SEQ Beta V2 Test 18 - Bank 3 direct bar selection and playback follow.
No Live 13 Step Sequencer API dependencies. No interaction with other Twister banks.
"""
from __future__ import absolute_import
from _Framework.ControlSurface import ControlSurface
import Live

ROT_CHANNEL = 11  # MIDI channel 12, zero based
PUSH_CHANNEL = 10 # MIDI channel 11, zero based
FIRST_CC = 32
STEPS = 16
STEP_BEATS = 0.25
BAR_BEATS = 4.0
DEFAULT_PITCH = 60  # C3 in Live's usual octave display; see README
MIN_PITCH = 36     # Three-octave active window: C1 (MIDI 36) through C4 (MIDI 72)
MAX_PITCH = 72     # requested upper bound (MIDI note number)
NOTE_START = 66  # experimental blue candidate; value 96 appeared yellow on hardware
HELD = 104        # calibrated light purple
BLUE = 68
OFF = 0
# Twister system RGB brightness: MIDI channel 3 (zero-based 2), CC0..15, values 17..47.
# Keep color CCs on the existing Bank 3 push channel. Experimental: verify hardware.
RGB_BRIGHTNESS_CHANNEL = 2
RGB_BRIGHTNESS_START = 47
RGB_BRIGHTNESS_SUSTAIN = 17  # diagnostic: documented minimum, compare against 47
# Scale-aware pitch editing: C major by default. Change these constants to
# choose another root (0=C, 1=C#, ... 11=B) and pitch-class intervals.
# Feature 1: configure root and scale here; CHROMATIC disables scale filtering.
SCALE_ROOT = 0  # C=0, C#=1, ... B=11
SCALE_NAME = 'MAJOR'  # MAJOR, MINOR, PENTATONIC, MINOR_PENTATONIC, CHROMATIC
SCALE_PRESETS = {
    'MAJOR': (0, 2, 4, 5, 7, 9, 11),
    'MINOR': (0, 2, 3, 5, 7, 8, 10),
    'PENTATONIC': (0, 2, 4, 7, 9),
    'MINOR_PENTATONIC': (0, 3, 5, 7, 10),
    'CHROMATIC': tuple(range(12)),
}
SCALE_INTERVALS = SCALE_PRESETS.get(SCALE_NAME.upper(), SCALE_PRESETS['MAJOR'])
MAX_PAGES = 4  # User-approved four-bar editing/page navigation cap.


class MF_SEQ(ControlSurface):
    def __init__(self, c_instance):
        super(MF_SEQ, self).__init__(c_instance)
        self._pressed = [False] * STEPS
        self._rotated = [False] * STEPS
        self._pitch_accum = [0] * STEPS
        self._last_white_rings = [None] * STEPS
        self._tie_consumed = [False] * STEPS
        self._press_order = []
        self._last_leds = [None] * STEPS
        self._last_rgb_brightness = [None] * STEPS
        self._cached_brightness = [RGB_BRIGHTNESS_START] * STEPS
        self._last_clip = None
        self._last_playhead = -1
        self._cached_colors = [OFF] * STEPS
        self._cached_rings = [0] * STEPS
        self._last_pitch_view = None  # legacy name; now tracks the entire ring mode
        self._last_note_scan_tick = -100
        self._page = 0
        self._ring_view = 'velocity'  # retained for existing ring calculation
        self._edit_mode = 'notes'  # notes, velocity, pitch, length, cc1
        self._last_edit_mode = 'velocity'  # selected parameter, even in Notes mode
        self._held_edit_feedback = [False] * STEPS
        self._ring_reassert_steps = set()
        self._cc1_unavailable_reported = False
        self._cc1_cache = {}  # legacy compatibility; CC1 excluded from active mode cycle
        self._bar_turn_accum = 0
        self._loop_turn_accum = 0
        self._param_turn_accum = 0
        self._loop_origin = None
        self._loop_clip = None
        self._follow_playback = False
        self._follow_was_playing = False
        self._follow_manual_pause = False
        self._tick_count = 0
        self._dirty = True
        self._last_error = None
        self._disconnected = False
        self.request_rebuild_midi_map()
        self.schedule_message(1, self._tick)

    def disconnect(self):
        self._disconnected = True
        try:
            for step in range(STEPS):
                self._led(step, OFF)
                self._rgb_brightness(step, RGB_BRIGHTNESS_START)
                self._white_ring(step, 0)
        finally:
            super(MF_SEQ, self).disconnect()

    def build_midi_map(self, midi_map_handle):
        # Explicit forwarding is essential: receive_midi is not called for
        # arbitrary CC messages unless Live routes them to this surface.
        super(MF_SEQ, self).build_midi_map(midi_map_handle)
        for channel in (PUSH_CHANNEL, ROT_CHANNEL):
            for cc in range(FIRST_CC, FIRST_CC + STEPS):
                Live.MidiMap.forward_midi_cc(self._c_instance.handle(), midi_map_handle, channel, cc)

    def _set_mode(self, mode):
        if mode != 'notes':
            self._last_edit_mode = mode
        if mode != self._edit_mode:
            self._edit_mode = mode
            self._ring_view = 'pitch' if mode == 'pitch' else 'velocity'
            self._pitch_accum = [0] * STEPS
            self._held_edit_feedback = [False] * STEPS
            self._dirty = True
            # Force all 16 rings to be resent after switching views.
            self._last_white_rings = [None] * STEPS
            self._cc1_unavailable_reported = False
        if mode == 'notes':
            self.show_message('MF SEQ - NOTES | PARAM: {}'.format(self._last_edit_mode.upper()))
        else:
            self.show_message('MF SEQ - PARAM: {}'.format(mode.upper()))

    def _advance_param(self, direction):
        modes = ('velocity', 'pitch', 'length', 'probability')
        index = modes.index(self._last_edit_mode) if self._last_edit_mode in modes else 0
        selected = modes[(index + direction) % len(modes)]
        if self._edit_mode == 'notes':
            self._last_edit_mode = selected
            self._last_white_rings = [None] * STEPS
            self._dirty = True
            self.show_message('MF SEQ - NOTES | PARAM SELECT: {}'.format(selected.upper()))
        else:
            self._set_mode(selected)

    def _content_origin(self, clip):
        if self._loop_origin is not None and self._same_clip(clip, self._loop_clip):
            return self._loop_origin
        return float(clip.loop_start)

    def _loop_state(self, clip):
        origin = self._content_origin(clip)
        bar = self._bar_beats(clip)
        start = int(round((float(clip.loop_start) - origin) / bar)) + 1
        length = int(round((float(clip.loop_end) - float(clip.loop_start)) / bar))
        return origin, bar, start, length

    def _apply_loop(self, clip, start, length):
        if start < 1 or length not in (1, 2, 4) or start + length - 1 > MAX_PAGES:
            return
        origin, bar, old_start, old_length = self._loop_state(clip)
        new_start = origin + (start - 1) * bar
        new_end = new_start + length * bar
        old_a, old_b = float(clip.loop_start), float(clip.loop_end)
        try:
            # Expand end first when necessary to avoid transient invalid loops.
            if new_start >= old_b - 0.0001:
                clip.loop_end = new_end
                clip.loop_start = new_start
            else:
                clip.loop_start = new_start
                clip.loop_end = new_end
            self._loop_origin = origin
            self._loop_clip = clip
            self._dirty = True
            self._last_playhead = -1
            self.show_message('MF SEQ - LOOP BAR {} | {} BAR(S)'.format(start, length))
        except Exception as exc:
            try:
                clip.loop_start = old_a
                clip.loop_end = old_b
            except Exception:
                pass
            self._report('Loop edit blocked: {}: {}'.format(type(exc).__name__, exc))

    def _cycle_loop_length(self):
        clip = self._target(False)
        if clip is None:
            return
        try:
            _, _, start, length = self._loop_state(clip)
            if start < 1 or start > MAX_PAGES:
                return
            valid = [n for n in (1, 2, 4) if start + n - 1 <= MAX_PAGES]
            next_length = next((n for n in valid if n > length), valid[0])
            self._apply_loop(clip, start, next_length)
        except Exception as exc:
            self._report('Loop length error: {}: {}'.format(type(exc).__name__, exc))

    def _shift_loop_start(self, direction):
        clip = self._target(False)
        if clip is None:
            return
        try:
            _, _, start, length = self._loop_state(clip)
            next_start = start + direction
            if length not in (1, 2, 4) or next_start < 1 or next_start + length - 1 > MAX_PAGES:
                self.show_message('MF SEQ - LOOP BOUNDARY')
                return
            self._apply_loop(clip, next_start, length)
        except Exception as exc:
            self._report('Loop start error: {}: {}'.format(type(exc).__name__, exc))

    def receive_midi(self, midi_bytes):
        if len(midi_bytes) != 3:
            return
        status, number, value = [int(x) for x in midi_bytes]
        if not FIRST_CC <= number < FIRST_CC + STEPS or (status & 0xF0) != 0xB0:
            return
        step = number - FIRST_CC
        channel = status & 0x0F
        if channel == PUSH_CHANNEL:
            down = value > 0
            if down and not self._pressed[step]:
                # Ordered chord: E16 first, then E1 toggles follow.
                if step == 0 and self._pressed[15]:
                    self._pressed[0] = True
                    self._rotated[0] = False
                    self._tie_consumed[0] = True
                    self._tie_consumed[15] = True
                    self._press_order.append(0)
                    self._follow_playback = not self._follow_playback
                    self._follow_manual_pause = False
                    self.show_message('MF SEQ - FOLLOW {}'.format('ON' if self._follow_playback else 'OFF'))
                    return
                # Ordered chord: E13 first, then E1-E4 chooses editing page.
                if step in (0, 1, 2, 3) and self._pressed[12]:
                    self._pressed[step] = True
                    self._rotated[step] = False
                    self._tie_consumed[step] = True
                    self._tie_consumed[12] = True
                    self._press_order.append(step)
                    new_page = step
                    if self._page != new_page:
                        self._page = new_page
                        self._dirty = True
                        self._last_playhead = -1
                    self._follow_manual_pause = True
                    self.show_message('MF SEQ - EDIT BAR {} / {}'.format(step + 1, MAX_PAGES))
                    return
                # E1+E13 selects parameters; E1+E14 toggles Notes/PARAM.
                # E1+E15 cycles loop length; chord presses never create ties.
                if step in (12, 13, 14) and self._pressed[0]:
                    self._tie_consumed[0] = True
                    self._tie_consumed[step] = True
                    self._pressed[step] = True
                    self._rotated[step] = False
                    self._press_order.append(step)
                    if step == 12:
                        self._advance_param(1)
                    elif step == 13:
                        self._set_mode(self._last_edit_mode if self._edit_mode == 'notes' else 'notes')
                    else:
                        self._cycle_loop_length()
                    return
                self._pressed[step] = True
                self._rotated[step] = False
                self._held_edit_feedback[step] = False
                self._pitch_accum[step] = 0
                self._tie_consumed[step] = False
                if self._edit_mode == 'notes' and not (step in (14, 15) and self._pressed[0]) and step != 15:
                    starts = [i for i in self._press_order if self._pressed[i] and i != step]
                    if starts:
                        start = starts[0]
                        self._tie_consumed[start] = True
                        self._tie_consumed[step] = True
                        self._extend_note(start, step)
                self._press_order.append(step)
                # Hardware can clear the rotary white ring on push/hold.
                # Reassert the authoritative value after the next clip scan.
                self._ring_reassert_steps.add(step)
                self._dirty = True
                # Pitch inspection: read the actual clip note on press, no edit.
                # Modifier chords are handled above, and do not inspect notes.
                if self._edit_mode == 'pitch' and not self._pressed[0]:
                    self._inspect_pitch(step)
            elif not down and self._pressed[step]:
                self._pressed[step] = False
                was_rotated = self._rotated[step]
                self._rotated[step] = False
                self._held_edit_feedback[step] = False
                self._pitch_accum[step] = 0
                if step in self._press_order:
                    self._press_order.remove(step)
                consumed = self._tie_consumed[step]
                self._tie_consumed[step] = False
                if step == 0:
                    self._bar_turn_accum = 0
                    self._loop_turn_accum = 0
                    self._param_turn_accum = 0
                if self._edit_mode == 'notes' and not consumed and not was_rotated:
                    self._toggle(step)
                elif self._edit_mode == 'probability' and not consumed and not was_rotated:
                    self._cycle_probability_preset(step)
                self._ring_reassert_steps.add(step)
                self._dirty = True
            return
        if channel == ROT_CHANNEL:
            delta = -1 if value == 63 else (1 if value == 65 else 0)
            if not delta:
                return
            # E1+twist E13: deliberately slow parameter selection.
            if step == 12 and self._pressed[0]:
                self._tie_consumed[0] = True
                self._param_turn_accum += delta
                if abs(self._param_turn_accum) >= 8:
                    direction = 1 if self._param_turn_accum > 0 else -1
                    self._param_turn_accum = 0
                    self._advance_param(direction)
                return
            # E1+twist E15: shift loop start, with hard four-bar boundary.
            if step == 14 and self._pressed[0]:
                self._tie_consumed[0] = True
                self._loop_turn_accum += delta
                if abs(self._loop_turn_accum) >= 4:
                    direction = 1 if self._loop_turn_accum > 0 else -1
                    self._loop_turn_accum = 0
                    self._shift_loop_start(direction)
                return
            # E1 + twist E16 navigates bars in EVERY mode, no wrap.
            # Four relative CC increments per bar; no clock/timer.
            if step == 15 and self._pressed[0]:
                self._tie_consumed[0] = True
                self._tie_consumed[15] = True if self._pressed[15] else self._tie_consumed[15]
                self._bar_turn_accum += delta
                if abs(self._bar_turn_accum) >= 4:
                    direction = 1 if self._bar_turn_accum > 0 else -1
                    self._bar_turn_accum = 0
                    new_page = max(0, min(MAX_PAGES - 1, self._page + direction))
                    if new_page != self._page:
                        self._follow_manual_pause = True
                        self._page = new_page
                        self._dirty = True
                        self._last_playhead = -1
                        self.show_message('MF SEQ - BAR {} / {}'.format(self._page + 1, MAX_PAGES))
                return
            if self._tie_consumed[step]:
                return
            # Notes mode: unheld rotation remains inert. Held rotation edits
            # the remembered parameter after four qualifying increments,
            # preserving fast note toggles and the accepted tie gesture.
            if self._edit_mode == 'notes':
                if not self._pressed[step]:
                    return
                self._pitch_accum[step] += delta
                if abs(self._pitch_accum[step]) < 4:
                    return
                direction = 1 if self._pitch_accum[step] > 0 else -1
                self._pitch_accum[step] = 0
                self._rotated[step] = True
                self._held_edit_feedback[step] = True
                self._ring_reassert_steps.add(step)
                self._dirty = True
                if self._last_edit_mode == 'pitch':
                    self._adjust_pitch(step, direction)
                elif self._last_edit_mode == 'length':
                    self._adjust_length(step, direction)
                elif self._last_edit_mode == 'probability':
                    self._adjust_probability(step, direction * 0.04)
                elif self._last_edit_mode == 'cc1':
                    self._adjust_cc1(step, direction * 4)
                else:
                    self._adjust_velocity(step, direction * 4)
                return
            # Length mode: one relative rotary increment selects the next
            # musical duration for the note starting at this step. Note presses
            # remain disabled in submodes; no timers or deferred work are added.
            if self._edit_mode == 'length':
                self._adjust_length(step, delta)
                return
            # Velocity submode: original 1:1 rotary response. Keep pitch,
            # Notes-mode hold+turn, and E1+E16 bar navigation at 4 increments.
            if self._edit_mode in ('velocity', 'cc1', 'probability'):
                if self._edit_mode == 'cc1':
                    self._adjust_cc1(step, delta * 4)
                    return
                if self._edit_mode == 'probability':
                    self._adjust_probability(step, delta * 0.04)
                    return
                self._pitch_accum[step] = 0
                if self._pressed[step]:
                    self._rotated[step] = True
                self._adjust_velocity(step, delta * 4)
                return
            pending = self._pitch_accum[step] + delta
            if abs(pending) >= 4:
                self._pitch_accum[step] = 0
                if self._pressed[step]:
                    self._rotated[step] = True
                if self._edit_mode == 'pitch':
                    self._adjust_pitch(step, 1 if pending > 0 else -1)
                else:
                    self._adjust_velocity(step, 4 if pending > 0 else -4)
            else:
                self._pitch_accum[step] = pending
            return

    def _target(self, allow_create=False):
        song = self.song()
        view = song.view
        clip = getattr(view, 'detail_clip', None)
        # A selected slot takes precedence, so stale detail clips cannot be edited.
        slot = getattr(view, 'highlighted_clip_slot', None)
        if slot is not None:
            track = self._track_for_slot(slot)
            if track is None or not getattr(track, 'has_midi_input', False):
                return None
            if getattr(slot, 'has_clip', False):
                candidate = slot.clip
                return candidate if getattr(candidate, 'is_midi_clip', False) else None
            if allow_create:
                if not hasattr(Live.Clip, 'MidiNoteSpecification'):
                    self._report('Cannot create clip: modern note API unavailable')
                    return None
                try:
                    slot.create_clip(self._bar_beats(None))
                    return slot.clip if slot.has_clip and slot.clip.is_midi_clip else None
                except Exception as exc:
                    self._report('Cannot create MIDI clip: {}'.format(exc))
            return None
        if clip is not None and getattr(clip, 'is_midi_clip', False):
            return clip
        return None

    def _track_for_slot(self, slot):
        try:
            for track in list(self.song().tracks):
                if slot in list(track.clip_slots):
                    return track
        except Exception:
            pass
        return None

    def _bar_beats(self, clip):
        # Live MIDI note positions are in quarter-note beats.
        try:
            numerator = getattr(clip, 'signature_numerator', None)
            denominator = getattr(clip, 'signature_denominator', None)
            if numerator is None or denominator is None:
                song = self.song()
                if numerator is None:
                    numerator = song.signature_numerator
                if denominator is None:
                    denominator = song.signature_denominator
            numerator, denominator = int(numerator), int(denominator)
            if numerator > 0 and denominator in (1, 2, 4, 8, 16, 32):
                return numerator * 4.0 / denominator
        except Exception:
            pass
        return BAR_BEATS

    def _step_beats(self, clip):
        # Sixteen equal encoder steps per musical bar, including non-4/4 meters.
        return self._bar_beats(clip) / float(STEPS)

    def _page_start(self, clip):
        return self._content_origin(clip) + self._page * self._bar_beats(clip)

    def _step_time(self, clip, step):
        return self._page_start(clip) + step * self._step_beats(clip)

    def _clip_pages(self, clip):
        if clip is None:
            return 1
        try:
            length = max(0.0, float(clip.loop_end) - self._content_origin(clip))
            import math
            return max(1, int(math.ceil((length - 0.00001) / self._bar_beats(clip))))
        except Exception:
            return 1

    def _modern_api(self, clip):
        return (callable(getattr(clip, 'get_notes_extended', None)) and
                callable(getattr(clip, 'add_new_notes', None)) and
                callable(getattr(clip, 'remove_notes_by_id', None)) and
                hasattr(Live.Clip, 'MidiNoteSpecification'))

    def _read(self, clip):
        # Live Python Remote Scripts return MidiNote objects, NOT Max dictionaries.
        if not self._modern_api(clip):
            raise RuntimeError('Modern note API unavailable; no legacy fallback')
        # Preserve the C++-backed MidiNoteVector; tuple/list coercion caused
        # ArgumentError with apply_note_modifications in v0.4 and v0.4.1.
        return clip.get_notes_extended(0, 128, 0.0, max(1.0, float(getattr(clip, 'loop_end', BAR_BEATS)), self._content_origin(clip) + MAX_PAGES * self._bar_beats(clip)) + self._bar_beats(clip))

    def _step_notes(self, clip, notes, step):
        pos = self._step_time(clip, step)
        return [note for note in notes
                if abs(float(note.start_time) - pos) < 0.0001]

    def _occupancy(self, clip, notes):
        # Ephemeral per-edit index; NEVER treat it as an independent note history.
        # Read fresh notes on every edit so piano-roll edits/Undo cannot stale it.
        entries = []
        ids = set()
        for note in notes:
            note_id = int(note.note_id)
            if note_id in ids:
                raise RuntimeError('Duplicate note IDs; edit blocked')
            ids.add(note_id)
            start = float(note.start_time)
            end = start + float(note.duration)
            if end <= start:
                continue
            entries.append((start, end, note_id, note))
        return entries

    def _intersections(self, occupancy, start, end):
        eps = 0.0001
        return [entry for entry in occupancy
                if entry[0] < end - eps and entry[1] > start + eps]

    def _ensure_page_length(self, clip):
        # Extend only when adding a note on a later page; never shorten loops.
        required = self._page_start(clip) + self._bar_beats(clip)
        try:
            if self._loop_origin is None and float(clip.loop_end) < required:
                clip.loop_end = required
            return True
        except Exception as exc:
            self._report('Cannot extend clip to bar {}: {}'.format(self._page + 1, exc))
            return False

    def _write_toggle(self, clip, existing, step):
        pos = self._step_time(clip, step)
        if existing:
            # Do not remove ambiguous/chord steps. Delete one exact note ID.
            if len(existing) != 1:
                self._report('Step has multiple notes; no changes made')
                return False
            note_id = getattr(existing[0], 'note_id', None)
            if note_id is None:
                raise RuntimeError('Note has no note_id; deletion blocked')
            clip.remove_notes_by_id((int(note_id),))
        else:
            if not self._ensure_page_length(clip):
                return False
            spec = Live.Clip.MidiNoteSpecification(
                pitch=int(DEFAULT_PITCH), start_time=float(pos),
                duration=float(self._step_beats(clip) / 2.0), velocity=100.0, mute=False)
            clip.add_new_notes((spec,))
        self._dirty = True
        return True

    def _extend_note(self, start_step, end_step):
        # Strict mono: the NEW interval owns its time regardless of pitch.
        # A spanning note is blocked until two-tail splitting is safely tested.
        if end_step <= start_step:
            self._report('Tie must end after its start; nothing changed')
            return
        clip = self._target(allow_create=False)
        if clip is None:
            self._report('Select an existing MIDI clip for tying notes')
            return
        try:
            notes = self._read(clip)
            occupancy = self._occupancy(clip, notes)
            pos = self._step_time(clip, start_step)
            end = pos + (end_step - start_step + 1) * self._step_beats(clip)
            starts = [entry[3] for entry in occupancy if abs(entry[0] - pos) < 0.0001]
            if len(starts) > 1:
                self._report('Multiple notes start here; tie blocked')
                return
            source = starts[0] if starts else None
            pitch = int(source.pitch) if source is not None else int(DEFAULT_PITCH)
            collisions = [e for e in self._intersections(occupancy, pos, end)
                          if source is None or e[2] != int(source.note_id)]
            # No partial mutation when one old note crosses BOTH edges.
            if any(left < pos - 0.0001 and right > end + 0.0001
                   for left, right, _, _ in collisions):
                self._report('Tie intersects a spanning note; no changes made')
                return
            remove_ids = []
            trims = []
            for left, right, note_id, other in collisions:
                if left >= pos - 0.0001 and right <= end + 0.0001:
                    remove_ids.append(note_id)
                elif left < pos - 0.0001:
                    trims.append((other, left, pos - left))
                else:
                    trims.append((other, end, right - end))
            modifier = getattr(clip, 'apply_note_modifications', None)
            if (trims or source is not None) and not callable(modifier):
                raise RuntimeError('Modern note modification API unavailable')
            if not self._ensure_page_length(clip):
                return
            original = [(n, float(n.start_time), float(n.duration)) for n in notes]
            for note, new_start, new_duration in trims:
                note.start_time = float(new_start)
                note.duration = float(new_duration)
            if source is not None:
                source.duration = float(end - pos)
            if trims or source is not None:
                try:
                    modifier(notes)
                except Exception:
                    for n, old_start, old_duration in original:
                        n.start_time, n.duration = old_start, old_duration
                    raise
            if remove_ids:
                clip.remove_notes_by_id(tuple(remove_ids))
            if source is None:
                spec = Live.Clip.MidiNoteSpecification(
                    pitch=pitch, start_time=float(pos),
                    duration=float(end - pos), velocity=100.0, mute=False)
                clip.add_new_notes((spec,))
            self._dirty = True
        except Exception as exc:
            self._report('Mono tie overwrite failed: {}: {}'.format(type(exc).__name__, exc))

    def _split_held_note(self, clip, notes, held, step):
        # Only split a single unambiguous sustained note. The native note vector
        # must remain intact when applying modifications through Live's API.
        pos = self._step_time(clip, step)
        start = float(held.start_time)
        original_duration = float(held.duration)
        shortened = pos - start
        if shortened <= 0.0001 or shortened >= original_duration - 0.0001:
            return False
        modifier = getattr(clip, 'apply_note_modifications', None)
        if not callable(modifier):
            raise RuntimeError('Modern note modification API unavailable')
        if not self._ensure_page_length(clip):
            return False
        # Copy the source note's musical identity, not the default C3/100.
        spec = Live.Clip.MidiNoteSpecification(
            pitch=int(held.pitch), start_time=float(pos),
            duration=float(self._step_beats(clip)),
            velocity=float(held.velocity), mute=bool(held.mute))
        held_id = int(held.note_id)
        held.duration = float(shortened)
        try:
            modifier(notes)
        except Exception:
            held.duration = original_duration
            raise
        try:
            clip.add_new_notes((spec,))
        except Exception:
            # Best-effort rollback, using a fresh native vector. Never claim
            # the split succeeded if the insertion failed.
            try:
                fresh = self._read(clip)
                originals = [n for n in fresh if int(n.note_id) == held_id]
                if len(originals) == 1:
                    originals[0].duration = original_duration
                    modifier(fresh)
            except Exception as rollback_exc:
                self._report('Split insertion failed; rollback also failed: {}'.format(rollback_exc))
            raise
        self._dirty = True
        return True

    def _toggle(self, step, clip=None):
        # Clip is authoritative. At a populated step, delete all intersecting
        # notes regardless of pitch, including notes starting earlier.
        if clip is None:
            clip = self._target(allow_create=True)
        if clip is None:
            self._report('Select an existing MIDI clip')
            return
        try:
            notes = self._read(clip)
            occupancy = self._occupancy(clip, notes)
            pos = self._step_time(clip, step)
            step_end = pos + self._step_beats(clip)
            overlaps = self._intersections(occupancy, pos, step_end)
            if overlaps:
                # Never leave an inaccessible different-pitch note underneath.
                clip.remove_notes_by_id(tuple(sorted(set(e[2] for e in overlaps))))
                self._dirty = True
                return
            self._write_toggle(clip, (), step)
        except Exception as exc:
            self._report('Mono note toggle failed: {}: {}'.format(type(exc).__name__, exc))

    def _adjust_velocity(self, step, delta):
        # Empty steps and sustained portions of tied notes are not editable.
        # Only a single note starting exactly on this step can be adjusted.
        clip = self._target(allow_create=False)
        if clip is None:
            return
        try:
            notes = self._read(clip)
            matches = self._step_notes(clip, notes, step)
            if len(matches) != 1:
                return
            note = matches[0]
            old_velocity = float(note.velocity)
            new_velocity = max(1.0, min(127.0, old_velocity + delta))
            if new_velocity == old_velocity:
                return
            modifier = getattr(clip, 'apply_note_modifications', None)
            if not callable(modifier):
                raise RuntimeError('Modern note modification API unavailable')
            # Pass the original note object returned by get_notes_extended,
            # preserving note_id, pitch, start, duration and mute.
            note.velocity = new_velocity
            # Preserve the native vector returned by Live.
            modifier(notes)
            self._dirty = True
            self.show_message('MF SEQ | Step {} | Velocity: {}/127'.format(step + 1, int(round(new_velocity))))
        except Exception as exc:
            self._report('Velocity edit failed safely: {}: {}'.format(type(exc).__name__, exc))

    def _adjust_probability(self, step, delta):
        clip = self._target(allow_create=False)
        if clip is None:
            return
        try:
            # apply_note_modifications expects the original Live MidiNoteVector,
            # not the Python list returned by _step_notes filtering.
            full_notes = self._read(clip)
            matching = self._step_notes(clip, full_notes, step)
            if len(matching) != 1:
                return
            note = matching[0]
            if not hasattr(note, 'probability'):
                self._report('Live note probability property unavailable; no edit')
                return
            modify = getattr(clip, 'apply_note_modifications', None)
            if not callable(modify):
                return
            old = float(note.probability)
            note.probability = max(0.0, min(1.0, old + delta))
            if abs(float(note.probability) - old) < 0.000001:
                return
            modify(full_notes)
            self._dirty = True
            self.show_message('MF SEQ | Step {} | Chance: {}%'.format(step + 1, int(round(note.probability * 100))))
        except Exception as exc:
            self._report('Probability edit blocked safely: {}: {}'.format(type(exc).__name__, exc))

    def _cycle_probability_preset(self, step):
        """PARAM Chance view: tap an occupied note start to cycle fixed chance presets.

        No changes on empty steps, sustained portions, or ambiguous multiple starts.
        Uses the original Live MidiNoteVector as required by Live 12.
        """
        clip = self._target(allow_create=False)
        if clip is None:
            return
        try:
            notes = self._read(clip)
            matches = self._step_notes(clip, notes, step)
            if len(matches) != 1:
                return
            note = matches[0]
            if not hasattr(note, 'probability'):
                return
            modify = getattr(clip, 'apply_note_modifications', None)
            if not callable(modify):
                return
            presets = (1.0, 0.75, 0.50, 0.25, 0.0)
            old = float(note.probability)
            nearest = min(range(len(presets)), key=lambda i: abs(presets[i] - old))
            next_value = presets[(nearest + 1) % len(presets)]
            note.probability = next_value
            modify(notes)
            self._dirty = True
            self.show_message('MF SEQ | Step {} | Chance preset: {}%'.format(
                step + 1, int(round(next_value * 100))))
        except Exception as exc:
            self._report('Chance preset blocked safely: {}: {}'.format(type(exc).__name__, exc))

    def _cc1_device_parameter(self):
        # Only use a real automatable CC Control Mod Wheel parameter; never
        # pretend that clip MIDI Ctrl envelopes are exposed in Python LOM.
        try:
            track = self.song().view.selected_track
            for device in track.devices:
                name = str(getattr(device, 'name', '')).lower()
                class_name = str(getattr(device, 'class_name', '')).lower()
                if 'cc control' not in name and 'cccontrol' not in class_name:
                    continue
                for param in device.parameters:
                    label = str(getattr(param, 'name', '')).lower()
                    if 'mod wheel' in label or 'modwheel' in label:
                        return param
        except Exception:
            pass
        return None

    def _cc1_envelope(self, clip):
        # Experimental API adapter. No fake persistence: only a genuine MIDI
        # controller envelope object with a step insertion method is accepted.
        parameter = self._cc1_device_parameter()
        if parameter is None:
            return None
        getter = getattr(clip, 'automation_envelope', None)
        if not callable(getter):
            return None
        try:
            return getter(parameter)
        except Exception:
            return None

    def _read_cc1_rings(self, clip):
        rings = [0] * STEPS
        try:
            envelope = self._cc1_envelope(clip)
            if envelope is None:
                return rings
            value_at = getattr(envelope, 'value_at_time', None)
            if not callable(value_at):
                return rings
            for step in range(STEPS):
                param = self._cc1_device_parameter()
                if param is None or float(param.max) <= float(param.min):
                    return rings
                raw = float(value_at(self._step_time(clip, step)))
                rings[step] = max(1, min(127, int(round(127.0 * (raw - float(param.min)) / (float(param.max) - float(param.min))))))
        except Exception as exc:
            self._report('CC1 envelope read unavailable: {}'.format(exc))
        return rings

    def _adjust_cc1(self, step, delta):
        clip = self._target(allow_create=False)
        if clip is None:
            self.show_message('MF SEQ | CC1: select an existing MIDI clip')
            return
        try:
            envelope = self._cc1_envelope(clip)
            if envelope is None:
                if not self._cc1_unavailable_reported:
                    self.show_message('MF SEQ | CC1 unavailable in Live clip API - no data written')
                    self._cc1_unavailable_reported = True
                return
            value_at = getattr(envelope, 'value_at_time', None)
            insert_step = getattr(envelope, 'insert_step', None)
            if not callable(value_at) or not callable(insert_step):
                self.show_message('MF SEQ | CC1 step envelope API unavailable - no data written')
                return
            time = self._step_time(clip, step)
            param = self._cc1_device_parameter()
            if param is None:
                return
            minimum, maximum = float(param.min), float(param.max)
            span = maximum - minimum
            if span <= 0:
                return
            old = max(0, min(127, int(round(127.0 * (float(value_at(time)) - minimum) / span))))
            new = max(0, min(127, old + delta))
            if old != new:
                # Device automation envelope uses parameter-native range, not raw CC.
                param = self._cc1_device_parameter()
                if param is None:
                    return
                minimum, maximum = float(param.min), float(param.max)
                normalized = minimum + (maximum - minimum) * (new / 127.0)
                insert_step(time, self._step_beats(clip), normalized)
                self._dirty = True
                self.show_message('MF SEQ | Step {} | CC1: {}/127'.format(step + 1, new))
        except Exception as exc:
            self._report('CC1 edit blocked safely: {}: {}'.format(type(exc).__name__, exc))
            self.show_message('MF SEQ | CC1 write unavailable - no data written')

    def _length_choices(self, clip):
        # Sixteenth-grid relative durations, 1/128 through 1/2.
        # Keep all five previously available values, adding 1/128, 3/32,
        # 1/4 and 1/2 without changing existing values or note entry.
        step = float(self._step_beats(clip))
        return tuple(step * factor for factor in
                     (0.125, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0, 8.0))

    def _adjust_length(self, step, direction):
        # Edit only a unique note starting exactly on the addressed step.
        # Preserve its note ID, pitch, velocity, mute state and all other fields.
        clip = self._target(allow_create=False)
        if clip is None:
            return
        try:
            notes = self._read(clip)
            matches = self._step_notes(clip, notes, step)
            if len(matches) != 1:
                return
            note = matches[0]
            choices = self._length_choices(clip)
            old_duration = float(note.duration)
            # Select the nearest supported musical value, then move one slot.
            index = min(range(len(choices)),
                        key=lambda i: abs(choices[i] - old_duration))
            new_index = max(0, min(len(choices) - 1, index + (1 if direction > 0 else -1)))
            new_duration = float(choices[new_index])
            # Do not extend an existing note beyond the four-bar edit cap.
            max_end = self._content_origin(clip) + MAX_PAGES * self._bar_beats(clip)
            if float(note.start_time) + new_duration > max_end + 0.00001:
                self.show_message('MF SEQ: Length limited by four-bar boundary')
                return
            if abs(new_duration - old_duration) < 0.00001:
                return
            modifier = getattr(clip, 'apply_note_modifications', None)
            if not callable(modifier):
                raise RuntimeError('Modern note modification API unavailable')
            # Apply the same strict monophonic ownership rule as tie extension.
            # The edited note owns its new interval; notes completely covered
            # are removed, and notes crossing the right edge are shortened from
            # their left edge or shifted to begin at the new end.
            occupancy = self._occupancy(clip, notes)
            start = float(note.start_time)
            end = start + new_duration
            collisions = [entry for entry in self._intersections(occupancy, start, end)
                          if entry[2] != int(note.note_id)]
            if any(left < start - 0.0001 and right > end + 0.0001
                   for left, right, _, _ in collisions):
                self._report('Length intersects spanning note; unchanged')
                return
            remove_ids = []
            trims = []
            for left, right, note_id, other in collisions:
                if left >= start - 0.0001 and right <= end + 0.0001:
                    remove_ids.append(note_id)
                elif left < start - 0.0001:
                    trims.append((other, left, start - left))
                else:
                    trims.append((other, end, right - end))
            originals = [(n, float(n.start_time), float(n.duration)) for n in notes]
            note.duration = new_duration
            for other, new_start, new_length in trims:
                other.start_time = float(new_start)
                other.duration = float(new_length)
            try:
                modifier(notes)  # Native MidiNoteVector, not a Python list.
            except Exception:
                for original, old_start, old_length in originals:
                    original.start_time = old_start
                    original.duration = old_length
                raise
            if remove_ids:
                clip.remove_notes_by_id(tuple(sorted(set(remove_ids))))
            self._dirty = True
            labels = ('1/128', '1/64', '1/32', '3/64', '1/16', '3/32', '1/8', '1/4', '1/2')
            self.show_message('MF SEQ: Step {} length {}'.format(step + 1, labels[new_index]))
        except Exception as exc:
            self._report('Length edit failed safely: {}: {}'.format(type(exc).__name__, exc))

    def _inspect_pitch(self, step):
        clip = self._target(allow_create=False)
        if clip is None:
            return
        try:
            notes = self._read(clip)
            matches = self._step_notes(clip, notes, step)
            if len(matches) == 1:
                pitch = int(matches[0].pitch)
                self.show_message('MF SEQ: Step {} pitch {} (MIDI {})'.format(
                    step + 1, self._pitch_name(pitch), pitch))
            elif len(matches) > 1:
                self.show_message('MF SEQ: Step {} has {} notes'.format(step + 1, len(matches)))
        except Exception as exc:
            self._report('Pitch inspect failed safely: {}: {}'.format(type(exc).__name__, exc))

    def _next_scale_pitch(self, pitch, direction):
        # Find the next note in the configured scale, skipping chromatic
        # pitches outside the scale; clamp safely at the supported range.
        direction = 1 if direction > 0 else -1
        candidate = int(pitch) + direction
        while MIN_PITCH <= candidate <= MAX_PITCH:
            if ((candidate - SCALE_ROOT) % 12) in SCALE_INTERVALS:
                return candidate
            candidate += direction
        return int(pitch)

    def _adjust_pitch(self, step, delta):
        # Only a unique note starting on this step is editable.
        # Preserve note_id, velocity, duration, and other note metadata.
        clip = self._target(allow_create=False)
        if clip is None:
            return
        try:
            notes = self._read(clip)
            matches = self._step_notes(clip, notes, step)
            if len(matches) != 1:
                return
            note = matches[0]
            old_pitch = int(note.pitch)
            new_pitch = self._next_scale_pitch(old_pitch, delta)
            if new_pitch == old_pitch:
                return
            modifier = getattr(clip, 'apply_note_modifications', None)
            if not callable(modifier):
                raise RuntimeError('Modern note modification API unavailable')
            note.pitch = int(new_pitch)
            modifier(notes)  # Original native MidiNoteVector, never a list.
            self._dirty = True
            self.show_message('MF SEQ: Step {} pitch {} (MIDI {})'.format(step + 1, self._pitch_name(new_pitch), new_pitch))
        except Exception as exc:
            self._report('Pitch edit failed safely: {}: {}'.format(type(exc).__name__, exc))

    def _led(self, step, value):
        # Twister Extended Color Mode: PUSH channel drives inner RGB.
        # ROT channel drives outer white rings; do not overwrite those.
        if self._last_leds[step] != value:
            self._send_midi((0xB0 | PUSH_CHANNEL, FIRST_CC + step, int(value)))
            self._last_leds[step] = value

    def _rgb_brightness(self, step, value):
        # Test 12/13 channel-3 experiment produced no visible brightness change.
        # Avoid shared/system MIDI output pending isolated hardware verification.
        return

    def _white_ring(self, step, value):
        # Rotary channel is the Twister's white outer LED ring.
        # Values 1..127 indicate velocity or pitch; 0 means empty.
        value = max(0, min(127, int(value)))
        if self._last_white_rings[step] != value:
            self._send_midi((0xB0 | ROT_CHANNEL, FIRST_CC + step, value))
            self._last_white_rings[step] = value

    @staticmethod
    def _pitch_name(pitch):
        names = ('C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B')
        # Live project octave naming: MIDI 60 = C3.
        return '{}{}'.format(names[int(pitch) % 12], int(pitch) // 12 - 2)

    @staticmethod
    def _scaled_ring(value, minimum, maximum):
        if maximum <= minimum:
            return 1
        ratio = (float(value) - float(minimum)) / (float(maximum) - float(minimum))
        return max(1, min(127, 1 + int(round(126.0 * ratio))))

    def _velocity_to_ring(self, velocity):
        return self._scaled_ring(velocity, 1.0, 127.0)

    def _pitch_to_ring(self, pitch):
        return self._scaled_ring(pitch, MIN_PITCH, MAX_PITCH)

    def _length_to_ring(self, duration, step_beats):
        # Display each of the nine selectable musical durations at an evenly
        # spaced ring position; linear time scaling crowds short notes near 1.
        factors = (0.125, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0, 8.0)
        index = min(range(len(factors)), key=lambda i: abs(float(duration) - step_beats * factors[i]))
        return self._scaled_ring(index, 0, len(factors) - 1)

    def _note_to_ring(self, note, mode, step_beats):
        if mode == 'pitch':
            return self._pitch_to_ring(note.pitch)
        if mode == 'probability':
            return self._scaled_ring(float(getattr(note, 'probability', 1.0)), 0.0, 1.0)
        if mode == 'length':
            return self._length_to_ring(note.duration, step_beats)
        # Notes mode preserves the accepted velocity-based ring display.
        return self._velocity_to_ring(note.velocity)

    @staticmethod
    def _same_clip(left, right):
        # Live wrappers may be distinct Python objects for one LOM object.
        # Equality is scoped to this comparison; never retain a native pointer.
        try:
            return left is right or (left is not None and right is not None and left == right)
        except Exception:
            return False  # Uncertain/deleted object: refresh rather than reuse.

    def _tick(self):
        if self._disconnected:
            return
        try:
            self._tick_count += 1
            clip = self._target()
            ring_mode = self._edit_mode if self._edit_mode != 'notes' else self._last_edit_mode
            if not self._same_clip(clip, self._last_clip):
                # Page is a user-selected 16-step editing bank, not a property
                # of the transient Python clip wrapper. Live may return a new
                # wrapper every tick; never reset the page on this comparison.
                # This also allows changing clips while retaining the chosen
                # bar, as on common banked hardware step sequencers.
                self._last_clip = clip
                if not self._same_clip(clip, self._loop_clip):
                    self._loop_origin = None
                    self._loop_clip = None
                self._cc1_unavailable_reported = False
                self._dirty = True
                self._last_playhead = -1
                self._cached_colors = [OFF] * STEPS
                self._cached_brightness = [RGB_BRIGHTNESS_START] * STEPS
                self._last_rgb_brightness = [None] * STEPS
                self._cached_rings = [0] * STEPS
                self._last_white_rings = [None] * STEPS

            # Follow only on a change of playback bar; respect shortened loops.
            playing = bool(clip is not None and getattr(clip, 'is_playing', False))
            if playing and not self._follow_was_playing:
                self._follow_manual_pause = False
            self._follow_was_playing = playing
            if playing and self._follow_playback and not self._follow_manual_pause:
                try:
                    bar_beats = self._bar_beats(clip)
                    origin = self._content_origin(clip)
                    loop_a = float(clip.loop_start)
                    loop_b = float(clip.loop_end)
                    length = loop_b - loop_a
                    if length > 0 and bar_beats > 0:
                        playpos = float(clip.playing_position)
                        within = loop_a + ((playpos - loop_a) % length)
                        follow_page = int((within - origin + 0.00001) / bar_beats)
                        if 0 <= follow_page < MAX_PAGES and follow_page != self._page:
                            self._page = follow_page
                            self._dirty = True
                            self._last_playhead = -1
                except Exception as exc:
                    self._report('Follow playback failed: {}'.format(exc))

            # Fast path: calculate playhead BEFORE reading MIDI notes or sending
            # any ring feedback. The only messages on most ticks are the two
            # inner RGB changes for old and new playhead steps.
            position = -1
            if clip is not None:
                try:
                    if getattr(clip, 'is_playing', False):
                        loop_start = float(getattr(clip, 'loop_start', 0.0))
                        step_beats = self._step_beats(clip)
                        loop_length = max(step_beats, float(getattr(clip, 'loop_end', BAR_BEATS)) - loop_start)
                        pos = loop_start + ((float(clip.playing_position) - loop_start) % loop_length)
                        absolute_step = int((pos - self._content_origin(clip)) / step_beats)
                        if self._page * STEPS <= absolute_step < (self._page + 1) * STEPS:
                            position = absolute_step - self._page * STEPS
                except Exception as exc:
                    self._report('Playhead read failed: {}'.format(exc))
            needs_scan = (self._dirty or ring_mode != self._last_pitch_view or
                          self._tick_count - self._last_note_scan_tick >= 4)
            old_position = self._last_playhead
            if position != old_position:
                # A scan below restores the old step using its fresh color.
                # Avoid sending its stale cached color immediately beforehand.
                if 0 <= old_position < STEPS and not needs_scan:
                    self._rgb_brightness(old_position, self._cached_brightness[old_position])
                    self._led(old_position, self._cached_colors[old_position])
                if 0 <= position < STEPS:
                    self._rgb_brightness(position, RGB_BRIGHTNESS_START)
                    self._led(position, BLUE)
                self._last_playhead = position

            # Read notes at most every four ticks during steady playback,
            # but immediately after any local edit, clip change or ring-mode
            # change. Periodic scans still pick up external piano-roll edits.
            if needs_scan:
                self._last_note_scan_tick = self._tick_count
                self._last_pitch_view = ring_mode
                colors = [OFF] * STEPS
                rings = [0] * STEPS
                if clip is not None:
                    try:
                        notes = self._read(clip)
                        # Snapshot timing once per scan, including non-4/4 meters.
                        bar_beats = self._bar_beats(clip)
                        step_beats = bar_beats / float(STEPS)
                        page_start = self._content_origin(clip) + self._page * bar_beats
                        page_end = page_start + bar_beats
                        step_times = [page_start + step * step_beats for step in range(STEPS)]
                        ordered_notes = sorted(notes, key=lambda n: (float(n.start_time), int(n.note_id)))
                        for n in ordered_notes:
                            start = float(n.start_time)
                            end = start + float(n.duration)
                            if start < page_start and end > page_start:
                                for step in range(STEPS):
                                    if step_times[step] < end - 0.0001:
                                        colors[step] = HELD
                            if start < page_start - 0.0001 or start >= page_end - 0.0001:
                                continue
                            idx = int(round((start - page_start) / step_beats))
                            if idx >= STEPS or abs(start - (page_start + idx * step_beats)) > 0.001:
                                continue
                            ring_value = self._note_to_ring(n, ring_mode, step_beats)
                            if rings[idx] == 0:
                                rings[idx] = ring_value
                            for step in range(idx + 1, STEPS):
                                if step_times[step] < end - 0.0001:
                                    if colors[step] != NOTE_START:
                                        colors[step] = HELD
                        for n in ordered_notes:
                            start = float(n.start_time)
                            if start < page_start - 0.0001 or start >= page_end - 0.0001:
                                continue
                            idx = int(round((start - page_start) / step_beats))
                            if idx >= STEPS or abs(start - (page_start + idx * step_beats)) > 0.001:
                                continue
                            colors[idx] = NOTE_START
                            rings[idx] = self._note_to_ring(n, ring_mode, step_beats)
                    except Exception as exc:
                        self._report('Clip read failed: {}'.format(exc))
                        # Preserve the last known display on a transient read
                        # failure rather than clearing all LEDs.
                        colors = self._cached_colors
                        rings = self._cached_rings
                if ring_mode == 'cc1':
                    rings = self._read_cc1_rings(clip) if clip is not None else [0] * STEPS
                # In NOTES, color the entire note by the selected parameter.
                # Sustained steps use an experimentally darker same-family
                # palette index. Exact luminance needs hardware calibration.
                # CC1 is writable only when a compatible CC Control parameter envelope exists;
                # never simulate persisted values.
                param = ring_mode
                palettes = {
                    'velocity': 76,  # green
                    'pitch': 72,     # red start (user requested swap)
                    'length': 32,    # teal
                    'probability': 96, # purple
                    'cc1': 52,      # pink
                }
                active_color = palettes.get(param, NOTE_START)
                brightness = [RGB_BRIGHTNESS_SUSTAIN if c == HELD else
                              RGB_BRIGHTNESS_START for c in colors]
                sustain_colors = {
                    'velocity': 88,     # darker green, user-approved family
                    'pitch': 108,       # orange sustain
                    'length': 68,       # light blue sustain, teal note start
                    'probability': 104, # light purple sustain
                    'cc1': 52,
                }
                held_color = sustain_colors.get(param, active_color)
                colors = [active_color if c == NOTE_START else
                          held_color if c == HELD else c for c in colors]
                # Held editing gets immediate selected-parameter feedback,
                # while note-start/sustain contrast remains consistent.
                self._cached_colors = colors
                self._cached_brightness = brightness
                self._cached_rings = rings
                # Playhead overlay always wins over the underlying note color.
                # Send RGB first, then low-priority white-ring changes.
                for step, color in enumerate(colors):
                    self._rgb_brightness(step, RGB_BRIGHTNESS_START if step == position else brightness[step])
                    self._led(step, BLUE if step == position else color)
                for step, ring in enumerate(rings):
                    # Push/turn may alter Twister's local white ring without
                    # changing our last-sent MIDI value. Invalidate just the
                    # touched encoder, not all 16, to avoid a MIDI flood.
                    if step in self._ring_reassert_steps:
                        self._last_white_rings[step] = None
                    self._white_ring(step, ring)
                # Reassert note-start white ring after the RGB/brightness pass.
                for step in tuple(self._ring_reassert_steps):
                    if 0 <= step < STEPS and rings[step] > 0:
                        self._last_white_rings[step] = None
                        self._white_ring(step, rings[step])
                self._ring_reassert_steps.clear()
                self._dirty = False
        finally:
            if not self._disconnected:
                self.schedule_message(1, self._tick)

    def _report(self, message):
        if message != self._last_error:
            self._last_error = message
            self.log_message('MF SEQ: ' + message)
            self.show_message('MF SEQ: ' + message)
