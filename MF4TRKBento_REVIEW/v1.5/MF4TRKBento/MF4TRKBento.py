# MF4TRKBento v1.4 EXP - five focused work packages including vertical Arm chords
# Experimental hardware-test build. Bank 2 MIDI routing retained from v1.2.
from _Framework.ControlSurface import ControlSurface
from _Framework.ButtonElement import ButtonElement
from _Framework.InputControlElement import MIDI_CC_TYPE
import time

try:
    import Live
except ImportError:  # Permits syntax checking without the Live runtime.
    Live = None


class MF4TRKBento(ControlSurface):
    ROTARY_CH = 11   # Twister channel 12 (zero-based)
    PUSH_CH = 10     # Twister channel 11 (zero-based)
    SCROLL_DETENTS = 4
    ROWS = ((0, 1, 2, 3), (4, 5, 6, 7), (8, 9, 10, 11), (12, 13, 14, 15))
    MODULES = ("RClip", "Arm", "Solo", "Pan", "Mute", "Sends")
    ARM_COLOR = 72       # solid red available / flashing red armed
    SOLO_COLOR = 68      # solid light blue available / flashing blue soloed
    MUTE_MONITOR_AUTO_OFF = 108  # yellow regardless of mute state
    MUTE_MONITOR_IN = 68        # blue while monitor IN
    SEND_COLORS = (32, 96, 68, 108)  # Send A/B/C/D row identities
    PAN_COLOR = 68       # light blue, normal track pan
    MASTER_PAN_COLOR = 96 # purple, master pan
    SCENE_OCCUPIED = 108 # yellow
    SCENE_PLAYING = 76  # green
    SCENE_QUEUED = 52  # pink
    SCENE_RECORDING = 72
    CLIP_COLOR_FALLBACK = 76
    CLIP_PALETTE = (
        (76, (45, 190, 75)), (108, (245, 205, 40)),
        (32, (240, 135, 40)), (72, (235, 45, 50)),
        (68, (65, 160, 235)), (96, (155, 75, 205)),
        (52, (225, 75, 160)), (32, (35, 180, 165))
    )

    def __init__(self, c_instance):
        super(MF4TRKBento, self).__init__(c_instance)
        self._elements = []
        self._held = [False] * 16
        self._consumed = [False] * 16
        self._turn_accum = [0] * 4
        # Blank removed. One RClip row is available immediately; other rows
        # start in harmless stateful modules, and can all be cycled.
        self._row_modules = ["RClip", "Pan", "Mute", "Sends"]
        self._arm_chord = set()
        # A consumed cross-row chord must never execute the ordinary release action.
        self._vertical_chord = set()
        self._alt_mode = False
        self._alternate_press = False
        self._track_offset = 0
        self._scene_offset = 0
        self._scroll_steps = {"track": 0, "scene": 0}
        self._closed = False
        self._frame = {}
        self._ticks_until_scan = 0
        self._color_cache = {}
        self._rgb_cache = {}
        self._ring_cache = {}
        self._session_component = None
        self._session_size = None
        self._last_highlight = None
        self._highlight_error = None
        with self.component_guard():
            for cc in range(16):
                for ch, callback in ((self.ROTARY_CH, self._make_rotary(cc)),
                                     (self.PUSH_CH, self._make_push(cc))):
                    element = ButtonElement(True, MIDI_CC_TYPE, ch, cc,
                                            name="MF4TRKBento_%s_%02d" %
                                            ("Rotary" if ch == self.ROTARY_CH else "Push", cc))
                    element.add_value_listener(callback)
                    self._elements.append((element, callback))
        self._refresh_all()
        self.schedule_message(1, self._tick)
        self.show_message("MF4TRKBento v1.4 EXP | RClip/Pan/Mute/Sends")
        self.log_message("MF4TRKBento v1.4 EXP loaded - CC0-15 unchanged")

    def _make_rotary(self, cc):
        return lambda value: self._rotary(cc, value)

    def _make_push(self, cc):
        return lambda value: self._push(cc, value)

    def _send(self, channel, cc, value):
        return self._send_midi((0xB0 | channel, int(cc), max(0, min(127, int(value)))))

    def _rgb(self, cc, value):
        value = max(0, min(127, int(value)))
        if self._rgb_cache.get(cc) != value and self._send(self.PUSH_CH, cc, value) is not False:
            self._rgb_cache[cc] = value

    def _ring(self, cc, value):
        value = max(0, min(127, int(value)))
        if self._ring_cache.get(cc) != value and self._send(self.ROTARY_CH, cc, value) is not False:
            self._ring_cache[cc] = value

    @staticmethod
    def _relative(raw):
        return 1 if raw == 65 else (-1 if raw == 63 else 0)

    @staticmethod
    def _row_for_cc(cc):
        return cc // 4 if 0 <= cc < 16 else None

    def _visible_tracks(self):
        try:
            return tuple(self.song().visible_tracks)
        except (AttributeError, RuntimeError, TypeError):
            return ()

    def _all_tracks(self):
        # The scene itself launches clips across the song, not just the visible grid.
        try:
            return tuple(self.song().tracks)
        except (AttributeError, RuntimeError, TypeError):
            return self._visible_tracks()

    def _scenes(self):
        try:
            return tuple(self.song().scenes)
        except (AttributeError, RuntimeError, TypeError):
            return ()

    def _clip_count(self):
        return 3 if self._alt_mode else 4

    def _active_rows(self):
        return [row for row, module in enumerate(self._row_modules) if module == "RClip"]

    def _scene_index(self, row):
        return self._scene_offset + self._active_rows().index(row)

    def _track_for_column(self, col):
        tracks = self._visible_tracks()
        index = self._track_offset + col
        return tracks[index] if 0 <= index < len(tracks) else None

    def _clamp_offsets(self, tracks, scenes):
        self._track_offset = max(0, min(self._track_offset, max(0, len(tracks) - self._clip_count())))
        self._scene_offset = max(0, min(self._scene_offset,
                                           max(0, len(scenes) - max(1, len(self._active_rows())))))

    def _rotary(self, cc, raw):
        step = self._relative(raw)
        if self._closed or not step:
            return
        # E1 is the global clip-grid navigation modifier. It takes priority
        # over Row 3/Row 4 module-switch gestures when both modifiers are held.
        if self._held[0] and not self._alternate_press and cc in (11, 15) and self._active_rows():
            self._consumed[0] = True
            self._consumed[cc] = self._held[cc] or self._consumed[cc]
            self._scroll_grid("scene" if cc == 11 else "track", step)
            return
        row = self._row_for_cc(cc)
        first, last = self.ROWS[row][0], self.ROWS[row][-1]
        if self._held[first] and cc == last:
            self._consumed[first] = True
            self._consumed[last] = self._held[last] or self._consumed[last]
            self._turn_accum[row] += step
            if abs(self._turn_accum[row]) >= 1:
                self._turn_accum[row] = 0
                self._cycle_module(row, step)
            return
        if self._row_modules[row] == "Pan":
            self._turn_pan(row, cc % 4, step)
        elif self._row_modules[row] == "Sends" and not (self._alt_mode and cc % 4 == 3):
            self._turn_send(row, cc % 4, step)

    def _push(self, cc, raw):
        if self._closed:
            return
        down = int(raw) >= 64
        if down == self._held[cc]:
            return
        self._held[cc] = down
        if cc == 0 and not down:
            self._scroll_steps["track"] = 0
            self._scroll_steps["scene"] = 0
            self._alternate_press = False
        if cc == 11 and not down:
            self._scroll_steps["scene"] = 0
        if not down:
            self._arm_chord.discard(cc)
            self._vertical_chord.discard(cc)
        if not down and self._consumed[cc]:
            self._consumed[cc] = False
            return

        # E16 held FIRST, then E1 pressed: change alternate mode.
        if cc == 0 and down and self._held[15]:
            self._consumed[0] = True
            self._consumed[15] = True
            self._alternate_press = True
            self._alt_mode = not self._alt_mode
            self._clamp_offsets(self._visible_tracks(), self._scenes())
            self.show_message("MF4TRKBento | " + ("3 Clips + Scene" if self._alt_mode else "4 Clips"))
            self._refresh_all()
            return

        row = self._row_for_cc(cc)
        first, last = self.ROWS[row][0], self.ROWS[row][-1]
        # Vertical cross-row chords are physical pairs: an Arm encoder and
        # the encoder directly above it (same column). The Arm row controls
        # which track is affected, irrespective of the above row's module.
        # Holding Arm + tapping above toggles SOLO; holding above + tapping
        # Arm toggles MUTE. Both releases are consumed to prevent a clip
        # launch, Pan reset, or exclusive-arm action from firing accidentally.
        # No wraparound: Arm on the top row has no valid above pair.
        if down and self._dispatch_vertical_arm_chord(cc):
            return
        # A second Arm press while another Arm encoder is held forms a chord.
        # Chord presses arm all participating tracks without disarming other
        # armed tracks. Release events are consumed; ordinary single presses
        # continue to arm *exclusively* on release.
        if down and self._row_modules[row] == "Arm" and not (self._alt_mode and cc % 4 == 3):
            partners = [index for index in self.ROWS[row]
                        if index != cc and self._held[index]
                        and not (self._alt_mode and index % 4 == 3)
                        and (not self._consumed[index] or index in self._arm_chord)]
            if partners:
                chord = partners + [cc]
                self._arm_chord.update(chord)
                for button in chord:
                    self._consumed[button] = True
                self._multi_arm(chord)
                return
        if cc == last and self._held[first]:
            # Row's first encoder is held for module cycling, not launching.
            self._consumed[cc] = down or self._consumed[cc]
            return
        if down:
            return
        module = self._row_modules[row]
        col = cc % 4
        if module == "RClip":
            self._clamp_offsets(self._visible_tracks(), self._scenes())
            if self._alt_mode and col == 3:
                self._launch_scene(self._scene_index(row))
            else:
                self._launch_clip(col, row)
        elif module in ("Arm", "Solo", "Mute"):
            if not (self._alt_mode and col == 3):
                if module == "Arm":
                    self._toggle_exclusive_arm(col)
                else:
                    self._toggle_track_flag(col, "solo" if module == "Solo" else "mute")
        elif module == "Pan":
            self._reset_pan(col)
        elif module == "Sends" and not (self._alt_mode and col == 3):
            self._reset_send(row, col)

    def _dispatch_vertical_arm_chord(self, pressed):
        # Called only for fresh key-down. The two gesture directions must not
        # depend on the module assigned to the neighboring row.
        row, column = divmod(pressed, 4)
        candidate = None
        action = None
        if row > 0 and self._row_modules[row] == "Arm":
            # Above held first, Arm button tapped -> MUTE.
            above = pressed - 4
            if self._held[above]:
                candidate, action = above, "mute"
        if candidate is None and row < 3 and self._row_modules[row + 1] == "Arm":
            # Arm held first, above button tapped -> SOLO.
            below_arm = pressed + 4
            if self._held[below_arm]:
                candidate, action = below_arm, "solo"
        if candidate is None:
            return False
        arm_cc = pressed if self._row_modules[row] == "Arm" else candidate
        if self._alt_mode and arm_cc % 4 == 3:
            return False   # The 4th Arm button is deliberately inactive.
        self._consumed[pressed] = True
        self._consumed[candidate] = True
        self._vertical_chord.update((pressed, candidate))
        self._toggle_track_flag(arm_cc % 4, action)
        return True

    def _cycle_module(self, row, direction):
        current = self.MODULES.index(self._row_modules[row])
        # One Arm and one Solo across the entire bank, all four rows.
        for hops in range(1, len(self.MODULES) + 1):
            next_module = self.MODULES[(current + hops * direction) % len(self.MODULES)]
            if next_module in ("Arm", "Solo") and any(
                    index != row and active == next_module
                    for index, active in enumerate(self._row_modules)):
                continue
            self._row_modules[row] = next_module
            self._clamp_offsets(self._visible_tracks(), self._scenes())
            self.show_message("MF4TRKBento | Row %d: %s" % (row + 1, next_module))
            self._refresh_all()
            return

    def _scroll_grid(self, axis, step):
        prior = self._scroll_steps[axis]
        total = prior + step if prior * step > 0 else step
        self._scroll_steps[axis] = total
        if abs(total) < self.SCROLL_DETENTS:
            return
        self._scroll_steps[axis] = 0
        old = (self._track_offset, self._scene_offset)
        if axis == "track":
            self._track_offset += step
        else:
            self._scene_offset += step
        self._clamp_offsets(self._visible_tracks(), self._scenes())
        if (self._track_offset, self._scene_offset) != old:
            for i, held in enumerate(self._held):
                if held:
                    self._consumed[i] = True
            self.show_message("RClip | Track %d / Scene %d" %
                              (self._track_offset + 1, self._scene_offset + 1))
            self._refresh_all()

    def _launch_clip(self, col, row):
        track = self._track_for_column(col)
        if track is None:
            return
        try:
            slots = tuple(track.clip_slots)
            index = self._scene_index(row)
            if 0 <= index < min(len(slots), len(self._scenes())):
                slot = slots[index]
                if slot.has_clip or bool(getattr(track, "arm", False)) or bool(getattr(slot, "has_stop_button", False)):
                    slot.fire()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento clip launch error: %s" % exc)
        self._refresh_all()

    def _launch_scene(self, index):
        try:
            scenes = self._scenes()
            if 0 <= index < len(scenes):
                scenes[index].fire()
                self.show_message("RClip | Scene %d" % (index + 1))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento scene launch error: %s" % exc)
        self._refresh_all()

    def _toggle_track_flag(self, col, flag):
        track = self._track_for_column(col)
        if track is None:
            return
        try:
            setattr(track, flag, not bool(getattr(track, flag)))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento %s error: %s" % (flag, exc))
        self._refresh_all()

    def _toggle_exclusive_arm(self, col):
        track = self._track_for_column(col)
        if track is None or not bool(getattr(track, "can_be_armed", False)):
            return
        try:
            target = not bool(track.arm)
            if target:
                for other in self._all_tracks():
                    if other is not track and bool(getattr(other, "can_be_armed", False)) \
                            and bool(getattr(other, "arm", False)):
                        other.arm = False
            track.arm = target
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento exclusive arm error: %s" % exc)
        self._refresh_all()

    def _multi_arm(self, buttons):
        for cc in buttons:
            track = self._track_for_column(cc % 4)
            if track is None or not bool(getattr(track, "can_be_armed", False)):
                continue
            try:
                track.arm = True
            except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                self.log_message("MF4TRKBento multi-arm error: %s" % exc)
        self._refresh_all()

    def _send_index(self, row):
        # Count Sends modules *above* this row. Reassigns A/B/C/D when moved.
        return sum(1 for active in self._row_modules[:row] if active == "Sends")

    def _send_parameter(self, row, col):
        if self._alt_mode and col == 3:
            return None
        track = self._track_for_column(col)
        if track is None:
            return None
        try:
            sends = tuple(track.mixer_device.sends)
            index = self._send_index(row)
            return sends[index] if index < len(sends) else None
        except (AttributeError, RuntimeError, TypeError):
            return None

    def _turn_send(self, row, col, step):
        parameter = self._send_parameter(row, col)
        if parameter is None:
            return
        try:
            minimum, maximum = float(parameter.min), float(parameter.max)
            if maximum > minimum:
                delta = (maximum - minimum) / 64.0
                parameter.value = max(minimum, min(maximum, float(parameter.value) + step * delta))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento send turn error: %s" % exc)
        self._refresh_all()

    def _reset_send(self, row, col):
        parameter = self._send_parameter(row, col)
        if parameter is None:
            return
        try:
            parameter.value = max(float(parameter.min), min(float(parameter.max), 0.0))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento send reset error: %s" % exc)
        self._refresh_all()

    def _pan_parameter(self, col):
        try:
            if self._alt_mode and col == 3:
                track = self.song().master_track
            else:
                track = self._track_for_column(col)
            return track.mixer_device.panning if track is not None else None
        except (AttributeError, RuntimeError, TypeError):
            return None

    def _turn_pan(self, row, col, step):
        parameter = self._pan_parameter(col)
        if parameter is None:
            return
        try:
            value = float(parameter.value)
            minimum = float(parameter.min)
            maximum = float(parameter.max)
            if maximum <= minimum:
                return
            # 1/64th of the standard [-1,+1] range per detent.
            delta = (maximum - minimum) / 64.0
            parameter.value = max(minimum, min(maximum, value + step * delta))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento pan turn error: %s" % exc)
        self._refresh_all()

    def _reset_pan(self, col):
        parameter = self._pan_parameter(col)
        if parameter is None:
            return
        try:
            parameter.value = max(float(parameter.min), min(float(parameter.max), 0.0))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento pan reset error: %s" % exc)
        self._refresh_all()

    def _palette_color(self, item):
        try:
            rgb = int(item.color) & 0xFFFFFF
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return self.CLIP_COLOR_FALLBACK
        if rgb not in self._color_cache:
            r, g, b = (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255
            if len(self._color_cache) > 255:
                self._color_cache.clear()
            self._color_cache[rgb] = min(
                self.CLIP_PALETTE,
                key=lambda item: sum((a - b) ** 2 for a, b in zip((r, g, b), item[1]))
            )[0]
        return self._color_cache[rgb]

    def _clip_state(self, slot):
        try:
            if not slot.has_clip:
                return (108 if bool(getattr(slot, "is_triggered", False)) else 0, 0, None, False)
            clip = slot.clip
            if bool(getattr(clip, "is_recording", False)):
                return (72, 8, None, False)
            if bool(getattr(clip, "is_triggered", False)):
                return (108, 8, None, False)
            color = self._palette_color(clip)
            if bool(getattr(clip, "is_playing", False)):
                return (color, 4, clip, False)
            return (color, 0, None, False)
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return (0, 0, None, False)

    def _scene_state(self, index, tracks):
        """Aggregate a scene across song tracks; never use the scene's static color."""
        recording = queued = playing = occupied = False
        candidates = []
        for track in tracks:
            try:
                slots = track.clip_slots
                if index < 0 or index >= len(slots):
                    continue
                slot = slots[index]
                if not slot.has_clip:
                    if bool(getattr(slot, "is_triggered", False)):
                        queued = True
                    continue
                occupied = True
                clip = slot.clip
                recording = recording or bool(getattr(clip, "is_recording", False))
                queued = queued or bool(getattr(slot, "is_triggered", False)) or bool(getattr(clip, "is_triggered", False))
                if bool(getattr(clip, "is_playing", False)):
                    playing = True
                    try:
                        length = float(clip.loop_end) - float(clip.loop_start)
                        if length > 0:
                            candidates.append((length, clip))
                    except (AttributeError, RuntimeError, TypeError, ValueError, OverflowError):
                        pass
            except (AttributeError, RuntimeError, TypeError, ValueError):
                continue
        clip_reference = max(candidates, key=lambda item: item[0])[1] if candidates else None
        if recording:
            return (self.SCENE_RECORDING, 8, clip_reference, True)
        if queued:
            return (self.SCENE_QUEUED, 8, None, True)
        if playing:
            return (self.SCENE_PLAYING, 2, clip_reference, True)
        if occupied:
            return (self.SCENE_OCCUPIED, 0, None, True)
        return (0, 0, None, True)

    @staticmethod
    def _playing_ring(clip):
        try:
            start = float(clip.loop_start)
            length = max(0.001, float(clip.loop_end) - start)
            return max(0, min(127, int(127 * ((float(clip.playing_position) - start) % length) / length)))
        except (AttributeError, RuntimeError, TypeError, ValueError, OverflowError):
            return 0

    def _beat_position(self):
        try:
            song = self.song()
            # A queued launch can occur while the song transport is idle;
            # still animate the waiting LED in that case.
            if not bool(getattr(song, "is_playing", True)):
                return time.monotonic() * float(song.tempo) / 60.0
            return float(song.current_song_time)
        except (AttributeError, RuntimeError, TypeError, ValueError):
            try:
                return time.monotonic() * float(self.song().tempo) / 60.0
            except (AttributeError, RuntimeError, TypeError, ValueError):
                return time.monotonic() * 2.0

    @staticmethod
    def _monitor_color(track):
        try:
            states = Live.Track.Track.monitoring_states
            if track.current_monitoring_state == states.IN:
                return MF4TRKBento.MUTE_MONITOR_IN
        except (AttributeError, RuntimeError, TypeError):
            pass
        return MF4TRKBento.MUTE_MONITOR_AUTO_OFF

    def _scan_frame(self):
        tracks, scenes = self._visible_tracks(), self._scenes()
        self._clamp_offsets(tracks, scenes)
        frame = {}
        rclip_rows = self._active_rows()
        all_scene_tracks = self._all_tracks() if self._alt_mode and rclip_rows else ()
        for row, module in enumerate(self._row_modules):
            if module == "RClip":
                index = self._scene_offset + rclip_rows.index(row)
                if index >= len(scenes):
                    continue
                for col, cc in enumerate(self.ROWS[row]):
                    if self._alt_mode and col == 3:
                        frame[cc] = self._scene_state(index, all_scene_tracks)
                        continue
                    track = self._track_for_column(col)
                    try:
                        frame[cc] = self._clip_state(track.clip_slots[index]) if track is not None else (0, 0, None, False)
                    except (AttributeError, IndexError, RuntimeError, TypeError):
                        frame[cc] = (0, 0, None, False)
            elif module in ("Arm", "Solo"):
                attr = "arm" if module == "Arm" else "solo"
                color = self.ARM_COLOR if module == "Arm" else self.SOLO_COLOR
                for col, cc in enumerate(self.ROWS[row]):
                    if self._alt_mode and col == 3:
                        continue
                    track = self._track_for_column(col)
                    try:
                        if track is not None:
                            if module == "Arm" and not bool(getattr(track, "can_be_armed", False)):
                                continue
                            active = bool(getattr(track, attr))
                            frame[cc] = (color, 4 if active else 0, 127 if active else 0, False)
                    except (AttributeError, RuntimeError, TypeError):
                        pass
            elif module == "Mute":
                for col, cc in enumerate(self.ROWS[row]):
                    if self._alt_mode and col == 3:
                        continue
                    track = self._track_for_column(col)
                    if track is None:
                        continue
                    try:
                        muted = bool(track.mute)
                        # Color conveys MONITOR status, not mute state. The
                        # white ring shows whether the track is muted.
                        frame[cc] = (self._monitor_color(track), 0, 127 if muted else 0, False)
                    except (AttributeError, RuntimeError, TypeError):
                        pass
            elif module == "Pan":
                for col, cc in enumerate(self.ROWS[row]):
                    p = self._pan_parameter(col)
                    if p is None:
                        continue
                    try:
                        minimum, maximum, val = float(p.min), float(p.max), float(p.value)
                        pos = int(round(127.0 * (val - minimum) / (maximum - minimum))) if maximum > minimum else 64
                        color = self.MASTER_PAN_COLOR if self._alt_mode and col == 3 else self.PAN_COLOR
                        frame[cc] = (color, 0, max(0, min(127, pos)), False)
                    except (AttributeError, RuntimeError, TypeError, ValueError, ZeroDivisionError):
                        pass
            elif module == "Sends":
                send_index = self._send_index(row)
                color = self.SEND_COLORS[min(send_index, len(self.SEND_COLORS) - 1)]
                for col, cc in enumerate(self.ROWS[row]):
                    if self._alt_mode and col == 3:
                        continue
                    parameter = self._send_parameter(row, col)
                    if parameter is None:
                        continue
                    try:
                        minimum = float(parameter.min)
                        maximum = float(parameter.max)
                        value = float(parameter.value)
                        if maximum > minimum:
                            ring = int(round(127.0 * (value - minimum) / (maximum - minimum)))
                            frame[cc] = (color, 0, max(0, min(127, ring)), False)
                    except (AttributeError, RuntimeError, TypeError, ValueError, ZeroDivisionError):
                        pass
        self._frame = frame
        self._refresh_highlight(rclip_rows, tracks, scenes)

    def _render_frame(self, update_rings):
        now = time.monotonic()
        beat = self._beat_position() if self._alt_mode else 0.0
        for cc in range(16):
            color, rate, ring_data, scene = self._frame.get(cc, (0, 0, None, False))
            if scene and rate:
                # Playing: green 1/4-note flash. Queued: pink 1/16-note.
                # Recording: red 1/16-note. Stopped occupied: solid yellow.
                # Empty scene: completely dark.
                is_off = int(beat * rate) % 2 == 1
            else:
                # Leave previously accepted RClip flashing cadence intact.
                is_off = rate and int(now * rate) % 2 == 1
            self._rgb(cc, 0 if is_off else color)
            if update_rings:
                if ring_data is None:
                    ring = 0
                elif isinstance(ring_data, (int, float)):
                    ring = ring_data
                else:
                    ring = self._playing_ring(ring_data)
                self._ring(cc, ring)

    def _refresh_all(self):
        self._scan_frame()
        self._ticks_until_scan = 2
        self._render_frame(update_rings=True)

    def _tick(self):
        if self._closed:
            return
        try:
            self._ticks_until_scan -= 1
            if self._ticks_until_scan <= 0:
                self._refresh_all()
            else:
                self._render_frame(update_rings=False)
        except Exception as exc:
            self.log_message("MF4TRKBento v1.4 refresh error: %s" % exc)
        if not self._closed:
            self.schedule_message(1, self._tick)

    def _refresh_highlight(self, rows, tracks, scenes):
        if not rows or not tracks or not scenes:
            self._close_highlight()
            self._highlight_error = None
            return
        size = (self._clip_count(), len(rows))
        track_offset = self._track_offset
        configuring = False
        try:
            if self._highlight_error in ((size, track_offset, None), (size, track_offset, self._scene_offset)):
                return
            if self._session_component is None or self._session_size != size:
                configuring = True
                self._close_highlight()
                from _Framework.SessionComponent import SessionComponent
                with self.component_guard():
                    component = SessionComponent(size[0], size[1],
                                                 name="MF4TRKBento RClip", is_root=False)
                    self._session_component = component
                    self._session_size = size
                    self.set_highlighting_session_component(component)
                    component.set_enabled(True)
                configuring = False
                self._last_highlight = None
            state = (track_offset, self._scene_offset)
            if state != self._last_highlight:
                self._session_component.set_offsets(track_offset, self._scene_offset)
                self._last_highlight = state
            self._highlight_error = None
        except Exception as exc:
            error = (size, track_offset, None if configuring else self._scene_offset)
            if error != self._highlight_error:
                self.log_message("MF4TRKBento highlight unavailable: %s" % exc)
                self._highlight_error = error
            self._close_highlight()

    def _close_highlight(self):
        component = self._session_component
        self._session_component = None
        self._session_size = None
        self._last_highlight = None
        if component is not None:
            try:
                self.set_highlighting_session_component(None)
            except Exception:
                pass
            try:
                component.set_enabled(False)
            except Exception:
                pass
            try:
                component.disconnect()
            except Exception:
                pass

    def refresh_state(self):
        super(MF4TRKBento, self).refresh_state()
        if not self._closed:
            self._rgb_cache.clear()
            self._ring_cache.clear()
            self._highlight_error = None
            self._last_highlight = None
            self._refresh_all()

    def disconnect(self):
        self._closed = True
        try:
            self._close_highlight()
        except Exception:
            pass
        for element, callback in self._elements:
            try:
                element.remove_value_listener(callback)
            except (AttributeError, RuntimeError, ValueError):
                pass
        self._elements.clear()
        self._frame.clear()
        self._arm_chord.clear()
        self._vertical_chord.clear()
        for cc in range(16):
            try:
                self._send(self.ROTARY_CH, cc, 0)
                self._send(self.PUSH_CH, cc, 0)
            except Exception:
                pass
        super(MF4TRKBento, self).disconnect()


def create_instance(c_instance):
    return MF4TRKBento(c_instance)
