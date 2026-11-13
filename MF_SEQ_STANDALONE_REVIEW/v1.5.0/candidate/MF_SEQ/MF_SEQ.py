"""MF SEQ V1.5.0 review candidate - bounded rendering work; V1.4.9 gestures.
No Live 13 Step Sequencer API dependencies. No interaction with other Twister banks.
"""
from __future__ import absolute_import
from _Framework.ControlSurface import ControlSurface
import Live

ROT_CHANNEL = 11  # MIDI channel 12, zero based
PUSH_CHANNEL = 10 # MIDI channel 11, zero based
FIRST_CC = 48
STEPS = 16
STEP_BEATS = 0.25
BAR_BEATS = 4.0
DEFAULT_PITCH = 60  # C3 in Live's usual octave display; see README
MIN_PITCH = 12     # Live octave display observed by user: MIDI 0 = C-2, MIDI 12 = C-1
MAX_PITCH = 72     # requested upper bound (MIDI note number)
NOTE_START = 66  # experimental blue candidate; value 96 appeared yellow on hardware
HELD = 104        # calibrated light purple
BLUE = 68
OFF = 0
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
        self._last_clip = None
        self._last_playhead = -1
        self._cached_colors = [OFF] * STEPS
        self._cached_rings = [0] * STEPS
        self._last_pitch_view = None
        self._last_note_scan_tick = -100
        self._page = 0
        self._ring_view = 'velocity'  # persistent until explicitly toggled
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

    def receive_midi(self, midi_bytes):
        if len(midi_bytes) != 3:
            return
        status, number, value = [int(x) for x in midi_bytes]
        if not FIRST_CC <= number < FIRST_CC + STEPS:
            return
        if (status & 0xF0) != 0xB0:
            return
        step = number - FIRST_CC
        channel = status & 0x0F
        if channel == PUSH_CHANNEL:
            down = value > 0
            if down and not self._pressed[step]:
                # E1 chords: E14 next bar, E15 previous bar, E16 view toggle.
                # Consume both presses so neither creates/ties a note on release.
                if step in (13, 14, 15) and self._pressed[0]:
                    self._tie_consumed[0] = True
                    self._pressed[step] = True
                    self._rotated[step] = False
                    self._tie_consumed[step] = True
                    self._press_order.append(step)
                    if step == 15:
                        self._ring_view = 'pitch' if self._ring_view == 'velocity' else 'velocity'
                        self._pitch_accum = [0] * STEPS
                        self._dirty = True
                        self.show_message('MF SEQ: White rings {}'.format(self._ring_view))
                    else:
                        new_page = max(0, min(MAX_PAGES - 1, self._page + (1 if step == 13 else -1)))
                        if new_page != self._page:
                            self._page = new_page
                            self._dirty = True
                            self._last_playhead = -1
                            self.show_message('MF SEQ: Bar {} / {} (steps {}-{})'.format(self._page + 1, self._clip_pages(self._target()), self._page * STEPS + 1, (self._page + 1) * STEPS))
                    return
                self._pressed[step] = True
                self._rotated[step] = False
                self._pitch_accum[step] = 0
                self._tie_consumed[step] = False
                # Defer a normal tap until release: a held first step is
                # never toggled before we know whether this is a tie gesture.
                starts = [i for i in self._press_order if self._pressed[i] and i != step]
                if starts:
                    start = starts[0]
                    self._tie_consumed[start] = True
                    self._tie_consumed[step] = True
                    self._extend_note(start, step)
                self._press_order.append(step)
            elif not down and self._pressed[step]:
                self._pressed[step] = False
                was_rotated = self._rotated[step]
                self._rotated[step] = False
                self._pitch_accum[step] = 0
                if step in self._press_order:
                    self._press_order.remove(step)
                consumed = self._tie_consumed[step]
                self._tie_consumed[step] = False
                if not consumed and not was_rotated:
                    # Immediate on release, preserving hold-to-tie and push+turn.
                    self._toggle(step)
                self._dirty = True
            return
        if channel == ROT_CHANNEL:
            # Twister relative ENC 3FH/41H: 63 = down, 65 = up.
            # Other CC values are ignored rather than risking a large edit.
            delta = -1 if value == 63 else (1 if value == 65 else 0)
            if delta:
                # Push+twist edits pitch, normal twist edits velocity.
                # Suppress note toggle on release after a push+turn gesture.
                if self._pressed[step]:
                    self._rotated[step] = True
                    # Four relative detents per semitone. Opposite turns cancel
                    # pending movement, avoiding unexpected jumps on reversal.
                    pending = self._pitch_accum[step] + delta
                    if abs(pending) >= 4:
                        self._pitch_accum[step] = 0
                        self._adjust_pitch(step, 1 if pending > 0 else -1)
                    else:
                        self._pitch_accum[step] = pending
                else:
                    if self._ring_view == 'pitch':
                        # Same four-detent semitone resolution as push+twist.
                        pending = self._pitch_accum[step] + delta
                        if abs(pending) >= 4:
                            self._pitch_accum[step] = 0
                            self._adjust_pitch(step, 1 if pending > 0 else -1)
                        else:
                            self._pitch_accum[step] = pending
                    else:
                        self._pitch_accum[step] = 0
                        self._adjust_velocity(step, delta)
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
        return float(getattr(clip, 'loop_start', 0.0)) + self._page * self._bar_beats(clip)

    def _step_time(self, clip, step):
        return self._page_start(clip) + step * self._step_beats(clip)

    def _clip_pages(self, clip):
        if clip is None:
            return 1
        try:
            length = max(0.0, float(clip.loop_end) - float(clip.loop_start))
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
        return clip.get_notes_extended(0, 128, 0.0, max(1.0, float(getattr(clip, 'loop_end', BAR_BEATS)), self._page_start(clip) + self._bar_beats(clip)) + self._bar_beats(clip))

    def _step_notes(self, clip, notes, step):
        pos = self._step_time(clip, step)
        return [note for note in notes
                if abs(float(note.start_time) - pos) < 0.0001]

    def _ensure_page_length(self, clip):
        # Extend only when adding a note on a later page; never shorten loops.
        required = self._page_start(clip) + self._bar_beats(clip)
        try:
            if float(clip.loop_end) < required:
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
                duration=float(self._step_beats(clip)), velocity=100.0, mute=False)
            clip.add_new_notes((spec,))
        self._dirty = True
        return True

    def _extend_note(self, start_step, end_step):
        # First iteration: forward-only, no wrap, and fail closed for overlaps.
        if end_step <= start_step:
            self._report('Tie must end after its start; nothing changed')
            return
        clip = self._target(allow_create=False)
        if clip is None:
            self._report('Select an existing MIDI clip for tying notes')
            return
        try:
            notes = self._read(clip)
            starts = self._step_notes(clip, notes, start_step)
            if len(starts) > 1:
                self._report('Tie start has multiple notes; nothing changed')
                return
            note = starts[0] if starts else None
            pos = self._step_time(clip, start_step)
            new_duration = (end_step - start_step + 1) * self._step_beats(clip)
            # Reject other note starts within the proposed span.
            for other in notes:
                if note is not None and int(other.note_id) == int(note.note_id):
                    continue
                t = float(other.start_time)
                if pos - 0.0001 <= t < pos + new_duration - 0.0001:
                    self._report('Tie overlaps another note; nothing changed')
                    return
            if note is None:
                if not self._ensure_page_length(clip):
                    return
                # An empty starting step creates one sustained note.
                spec = Live.Clip.MidiNoteSpecification(
                    pitch=int(DEFAULT_PITCH), start_time=float(pos),
                    duration=float(new_duration), velocity=100.0, mute=False)
                clip.add_new_notes((spec,))
            else:
                # Live Python note objects from get_notes_extended carry IDs.
                # Modify the original note and submit it through the modern API;
                # do not pass note_id to MidiNoteSpecification constructor.
                if not callable(getattr(clip, 'apply_note_modifications', None)):
                    raise RuntimeError('Modern note modification API unavailable')
                note.duration = float(new_duration)
                # Live expects the original native MidiNoteVector, not [note].
                clip.apply_note_modifications(notes)
            self._dirty = True
        except Exception as exc:
            self._report('Tie failed safely: {}: {}'.format(type(exc).__name__, exc))

    def _toggle(self, step, clip=None):
        # Create a one-bar clip only for a highlighted empty MIDI Session slot.
        # Never create on audio tracks or when no slot is selected.
        if clip is None:
            clip = self._target(allow_create=True)
        if clip is None:
            self._report('Select an existing MIDI clip')
            return
        try:
            notes = self._read(clip)
            self._write_toggle(clip, self._step_notes(clip, notes, step), step)
        except Exception as exc:
            self._report('Note toggle failed: {}: {}'.format(type(exc).__name__, exc))

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
            self.show_message('MF SEQ: Step {} velocity {}'.format(step + 1, int(round(new_velocity))))
        except Exception as exc:
            self._report('Velocity edit failed safely: {}: {}'.format(type(exc).__name__, exc))

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
            self.show_message('MF SEQ: Step {} pitch MIDI {}'.format(step + 1, new_pitch))
        except Exception as exc:
            self._report('Pitch edit failed safely: {}: {}'.format(type(exc).__name__, exc))

    def _led(self, step, value):
        # Twister Extended Color Mode: PUSH channel drives inner RGB.
        # ROT channel drives outer white rings; do not overwrite those.
        if self._last_leds[step] != value:
            self._send_midi((0xB0 | PUSH_CHANNEL, FIRST_CC + step, int(value)))
            self._last_leds[step] = value

    def _white_ring(self, step, value):
        # Rotary channel is the Twister's white outer LED ring.
        # Values 1..127 indicate velocity or pitch; 0 means empty.
        value = max(0, min(127, int(value)))
        if self._last_white_rings[step] != value:
            self._send_midi((0xB0 | ROT_CHANNEL, FIRST_CC + step, value))
            self._last_white_rings[step] = value

    def _velocity_to_ring(self, velocity):
        # 0 means no note; 1..127 is the visible range for existing notes.
        return max(1, min(127, int(round(float(velocity)))))

    def _note_to_ring(self, note, pitch_view):
        return (self._pitch_to_ring(note.pitch) if pitch_view
                else self._velocity_to_ring(note.velocity))

    def _pitch_to_ring(self, pitch):
        return 1 + int(round((max(MIN_PITCH, min(MAX_PITCH, int(pitch))) - MIN_PITCH)
                             * 126.0 / float(MAX_PITCH - MIN_PITCH)))

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
            pitch_view = self._ring_view == 'pitch'
            if not self._same_clip(clip, self._last_clip):
                # Page is a user-selected 16-step editing bank, not a property
                # of the transient Python clip wrapper. Live may return a new
                # wrapper every tick; never reset the page on this comparison.
                # This also allows changing clips while retaining the chosen
                # bar, as on common banked hardware step sequencers.
                self._last_clip = clip
                self._dirty = True
                self._last_playhead = -1
                self._cached_colors = [OFF] * STEPS
                self._cached_rings = [0] * STEPS

            # Fast path: calculate playhead BEFORE reading MIDI notes or sending
            # any ring feedback. The only messages on most ticks are the two
            # inner RGB changes for old and new playhead steps.
            position = -1
            if clip is not None:
                try:
                    if getattr(clip, 'is_playing', False):
                        loop_start = float(getattr(clip, 'loop_start', 0.0))
                        step_beats = self._step_beats(clip)
                        pos = (float(clip.playing_position) - loop_start) % max(step_beats, float(getattr(clip, 'loop_end', BAR_BEATS)) - loop_start)
                        absolute_step = int(pos / step_beats)
                        if self._page * STEPS <= absolute_step < (self._page + 1) * STEPS:
                            position = absolute_step - self._page * STEPS
                except Exception as exc:
                    self._report('Playhead read failed: {}'.format(exc))
            needs_scan = (self._dirty or pitch_view != self._last_pitch_view or
                          self._tick_count - self._last_note_scan_tick >= 4)
            old_position = self._last_playhead
            if position != old_position:
                # A scan below restores the old step using its fresh color.
                # Avoid sending its stale cached color immediately beforehand.
                if 0 <= old_position < STEPS and not needs_scan:
                    self._led(old_position, self._cached_colors[old_position])
                if 0 <= position < STEPS:
                    self._led(position, BLUE)
                self._last_playhead = position

            # Read notes at most every four ticks during steady playback,
            # but immediately after any local edit, clip change or ring-mode
            # change. Periodic scans still pick up external piano-roll edits.
            if needs_scan:
                self._last_note_scan_tick = self._tick_count
                self._last_pitch_view = pitch_view
                colors = [OFF] * STEPS
                rings = [0] * STEPS
                if clip is not None:
                    try:
                        notes = self._read(clip)
                        # Snapshot timing once per scan, including non-4/4 meters.
                        bar_beats = self._bar_beats(clip)
                        step_beats = bar_beats / float(STEPS)
                        page_start = float(getattr(clip, 'loop_start', 0.0)) + self._page * bar_beats
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
                                        rings[step] = self._note_to_ring(n, pitch_view)
                            if start < page_start - 0.0001 or start >= page_end - 0.0001:
                                continue
                            idx = int(round((start - page_start) / step_beats))
                            if idx >= STEPS or abs(start - (page_start + idx * step_beats)) > 0.001:
                                continue
                            ring_value = self._note_to_ring(n, pitch_view)
                            if rings[idx] == 0:
                                rings[idx] = ring_value
                            for step in range(idx + 1, STEPS):
                                if step_times[step] < end - 0.0001:
                                    if colors[step] != NOTE_START:
                                        colors[step] = HELD
                                    if rings[step] == 0:
                                        rings[step] = ring_value
                        for n in ordered_notes:
                            start = float(n.start_time)
                            if start < page_start - 0.0001 or start >= page_end - 0.0001:
                                continue
                            idx = int(round((start - page_start) / step_beats))
                            if idx >= STEPS or abs(start - (page_start + idx * step_beats)) > 0.001:
                                continue
                            colors[idx] = NOTE_START
                            rings[idx] = self._note_to_ring(n, pitch_view)
                    except Exception as exc:
                        self._report('Clip read failed: {}'.format(exc))
                        # Preserve the last known display on a transient read
                        # failure rather than clearing all LEDs.
                        colors = self._cached_colors
                        rings = self._cached_rings
                self._cached_colors = colors
                self._cached_rings = rings
                # Playhead overlay always wins over the underlying note color.
                # Send RGB first, then low-priority white-ring changes.
                for step, color in enumerate(colors):
                    self._led(step, BLUE if step == position else color)
                for step, ring in enumerate(rings):
                    self._white_ring(step, ring)
                self._dirty = False
        finally:
            if not self._disconnected:
                self.schedule_message(1, self._tick)

    def _report(self, message):
        if message != self._last_error:
            self._last_error = message
            self.log_message('MF SEQ: ' + message)
            self.show_message('MF SEQ: ' + message)
