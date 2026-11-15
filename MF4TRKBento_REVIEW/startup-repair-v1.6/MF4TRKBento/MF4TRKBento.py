# MF4TRKBento v1.6 EXP
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
    MODULES = ("RClip", "Arm", "Solo", "Pan", "Mute", "Sends", "Stop")
    STOP_HOLD_SECONDS = 0.5
    VERTICAL_ACTIONS = {
        ("Arm", -1): "solo", ("Arm", 1): "mute",
        ("Solo", -1): "mute", ("Solo", 1): "arm",
        ("Mute", 1): "solo",
    }
    STOP_COLOR = 72
    ARM_COLOR = 72       # solid red available / flashing red armed
    SOLO_COLOR = 68      # solid blue available / flashing blue soloed
    MUTE_MONITOR_AUTO_OFF = 108  # yellow regardless of mute state
    MUTE_MONITOR_IN = 68        # blue while monitor IN
    SEND_COLOR = 48  # DJ TechTools 2026 Extended palette: violet
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
        self._stop_press = [None] * 16
        # Blank removed. One RClip row is available immediately; other rows
        # start in harmless stateful modules, and can all be cycled.
        self._row_modules = ["RClip", "Pan", "Mute", "Sends"]
        self._multi_chord = set()
        # A consumed cross-row chord must never execute the ordinary release action.
        self._vertical_modifiers = set()
        self._press_order = []
        self._alt_mode = False
        self._alternate_press = False
        self._track_offset = 0
        self._scene_offset = 0
        self._scroll_steps = {"track": 0, "scene": 0}
        self._closed = False
        # Live's scheduler is one-shot. Track the outstanding callback and
        # reject reentrant ticks so a nested callback cannot fork the loop.
        self._tick_pending = False
        self._tick_running = False
        # Coalesce a refresh requested from inside a scan/render into the next tick.
        self._refresh_running = False
        self._refresh_pending = False
        # Opt-in counters are aggregated in memory and never log per tick.
        self._diagnostics_enabled = False
        self._diagnostics = {}
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
        self._schedule_tick()
        self.show_message("MF4TRKBento v1.6 EXP | RClip/Arm/Solo/Pan/Mute/Sends/Stop")
        self.log_message("MF4TRKBento v1.6 EXP loaded - CC0-15 unchanged")

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
            self._consume_held()
            self._scroll_grid("scene" if cc == 11 else "track", step)
            return
        row = self._row_for_cc(cc)
        first, last = self.ROWS[row][0], self.ROWS[row][-1]
        if self._held[first] and cc == last:
            self._consume_held()
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
        if down:
            self._press_order.append(cc)
        else:
            self._press_order.remove(cc)
        stop_press = self._stop_press[cc]
        self._stop_press[cc] = None
        if cc == 0 and not down:
            self._scroll_steps["track"] = 0
            self._scroll_steps["scene"] = 0
            self._alternate_press = False
        if cc == 11 and not down:
            self._scroll_steps["scene"] = 0
        if not down:
            self._multi_chord.discard(cc)
            self._vertical_modifiers.discard(cc)
        if not down and self._consumed[cc]:
            self._consumed[cc] = False
            return

        # E16 held FIRST, then E1 pressed: change alternate mode.
        if cc == 0 and down and self._held[15]:
            self._consume_held()
            self._alternate_press = True
            self._alt_mode = not self._alt_mode
            self._clamp_offsets(self._visible_tracks(), self._scenes())
            self.show_message("MF4TRKBento | " + ("3 Clips + Scene" if self._alt_mode else "4 Clips"))
            self._refresh_all()
            return

        row = self._row_for_cc(cc)
        first, last = self.ROWS[row][0], self.ROWS[row][-1]
        if down and self._dispatch_vertical_chord(cc):
            return
        module = self._row_modules[row]
        col = cc % 4
        if down and module in ("Arm", "Solo") and col < self._clip_count():
            pending = [index for index in self.ROWS[row]
                       if index != cc and self._held[index]
                       and index % 4 < self._clip_count()
                       and (not self._consumed[index] or index in self._multi_chord)]
            flag = "arm" if module == "Arm" else "solo"
            targets = self._multi_targets(pending + [cc], flag) if pending else {}
            if cc in targets and len(targets) > 1:
                chord = list(targets)
                self._multi_chord.update(chord)
                for button in chord:
                    self._consumed[button] = True
                self._set_multiple_tracks(targets.values(), flag)
                return
        if cc == last and self._held[first]:
            if down:
                self._consumed[cc] = True
                if module == "Stop":
                    self._consumed[first] = True
            return
        if down:
            if module == "Stop":
                target = self._stop_target(col)
                if target is not None:
                    self._stop_press[cc] = (time.monotonic(), target)
            return
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
                elif module == "Solo":
                    self._toggle_exclusive_solo(col)
                else:
                    self._toggle_track_flag(col, "mute")
        elif module == "Pan":
            self._reset_pan(col)
        elif module == "Stop" and stop_press is not None:
            pressed_at, target = stop_press
            if time.monotonic() - pressed_at < self.STOP_HOLD_SECONDS:
                self._stop_clips(col, target)

    def _consume_held(self):
        for cc, held in enumerate(self._held):
            if held:
                self._consumed[cc] = True
        self._multi_chord.clear()
        self._vertical_modifiers.clear()


    def _dispatch_vertical_chord(self, pressed):
        col = pressed % 4
        if col >= self._clip_count():
            return False
        for held in self._press_order:
            distance = pressed - held
            if abs(distance) != 4:
                continue
            if self._consumed[held] and held not in self._vertical_modifiers:
                continue
            action = self.VERTICAL_ACTIONS.get((self._row_modules[held // 4], distance // 4))
            if action is None:
                continue
            track = self._track_for_column(col)
            if track is None:
                return False
            try:
                if action != "arm" or track.can_be_armed:
                    setattr(track, action, not bool(getattr(track, action)))
            except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                self.log_message("MF4TRKBento vertical %s error: %s" % (action, exc))
            self._consumed[held] = self._consumed[pressed] = True
            self._vertical_modifiers.add(held)
            self._refresh_all()
            return True
        return False

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

    def _toggle_exclusive_solo(self, col):
        target = self._track_for_column(col)
        if target is None:
            return
        try:
            if target.solo:
                target.solo = False
            else:
                # song.tracks includes folded tracks and excludes returns and Master.
                for other in self.song().tracks:
                    if other != target and other.solo:
                        other.solo = False
                target.solo = True
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento exclusive solo error: %s" % exc)
        self._refresh_all()

    def _multi_targets(self, buttons, flag):
        tracks = self._visible_tracks()
        targets = {}
        for cc in buttons:
            index = self._track_offset + cc % 4
            if index >= len(tracks):
                continue
            track = tracks[index]
            try:
                if flag != "arm" or track.can_be_armed:
                    targets[cc] = track
            except (AttributeError, RuntimeError, TypeError, ValueError):
                continue
        return targets

    def _set_multiple_tracks(self, tracks, flag):
        for track in tracks:
            try:
                setattr(track, flag, True)
            except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                self.log_message("MF4TRKBento multi-%s error: %s" % (flag, exc))
        self._refresh_all()

    def _stop_target(self, col):
        if self._alt_mode and col == 3:
            # Use a stable marker for the global command rather than a Live proxy.
            return self
        return self._track_for_column(col)

    def _stop_clips(self, col, target):
        try:
            if self._stop_target(col) != target:
                return
            if target is self:
                self.song().stop_all_clips()
            else:
                target.stop_all_clips()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento stop error: %s" % exc)
        self._refresh_all()

    def _send_index(self, row):
        # Count Sends modules *above* this row. Reassigns A/B/C/D when moved.
        return sum(1 for active in self._row_modules[:row] if active == "Sends")

    def _send_parameter(self, row, col):
        if self._alt_mode and col == 3:
            return None
        try:
            mixer = self._audio_mixer(self._track_for_column(col))
            if mixer is None:
                return None
            sends = mixer.sends
            index = self._send_index(row)
            return sends[index] if index < len(sends) else None
        except (AttributeError, IndexError, RuntimeError, TypeError, ValueError):
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

    def _pan_parameter(self, col):
        try:
            if self._alt_mode and col == 3:
                return self.song().master_track.mixer_device.panning
            mixer = self._audio_mixer(self._track_for_column(col))
            return mixer.panning if mixer is not None else None
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

    def _scene_state(self, index, tracks, slot_lists=None):
        """Aggregate a scene across song tracks; never use the scene's static color."""
        recording = queued = playing = occupied = False
        candidates = []
        for track_index, track in enumerate(tracks):
            try:
                slots = track.clip_slots if slot_lists is None else slot_lists[track_index]
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
            except (AttributeError, IndexError, RuntimeError, TypeError, ValueError):
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
        self._record_diagnostic("scans")
        tracks, scenes = self._visible_tracks(), self._scenes()
        self._clamp_offsets(tracks, scenes)
        frame = {}
        window = tracks[self._track_offset:self._track_offset + self._clip_count()]
        columns = window + (None,) * (4 - len(window))
        mixers = {}
        pan_states = {}
        send_parameters = {}
        rclip_rows = self._active_rows()
        all_scene_tracks = self._all_tracks() if self._alt_mode and rclip_rows else ()
        scene_slots = [self._slot_list(track) for track in all_scene_tracks]
        clip_slots = [self._slot_list(track) for track in columns] if rclip_rows else ()
        for row, module in enumerate(self._row_modules):
            if module == "RClip":
                index = self._scene_offset + rclip_rows.index(row)
                if index >= len(scenes):
                    continue
                for col, cc in enumerate(self.ROWS[row]):
                    if self._alt_mode and col == 3:
                        frame[cc] = self._scene_state(index, all_scene_tracks, scene_slots)
                        continue
                    try:
                        frame[cc] = self._clip_state(clip_slots[col][index])
                    except (AttributeError, IndexError, RuntimeError, TypeError):
                        frame[cc] = (0, 0, None, False)
            elif module in ("Arm", "Solo"):
                attr = "arm" if module == "Arm" else "solo"
                color = self.ARM_COLOR if module == "Arm" else self.SOLO_COLOR
                for col, cc in enumerate(self.ROWS[row]):
                    if self._alt_mode and col == 3:
                        continue
                    track = columns[col]
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
                    track = columns[col]
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
                    if col not in pan_states:
                        master = self._alt_mode and col == 3
                        color = self.MASTER_PAN_COLOR if master else self.PAN_COLOR
                        try:
                            mixer = (self.song().master_track.mixer_device if master
                                     else self._frame_mixer(col, columns, mixers))
                            pan_states[col] = self._parameter_state(mixer.panning, color) if mixer is not None else None
                        except (AttributeError, RuntimeError, TypeError, ValueError):
                            pan_states[col] = None
                    if pan_states[col] is not None:
                        frame[cc] = pan_states[col]
            elif module == "Sends":
                send_index = self._send_index(row)
                for col, cc in enumerate(self.ROWS[row]):
                    if columns[col] is None:
                        continue
                    try:
                        if col not in send_parameters:
                            mixer = self._frame_mixer(col, columns, mixers)
                            send_parameters[col] = mixer.sends if mixer is not None else ()
                        sends = send_parameters[col]
                        if send_index < len(sends):
                            state = self._parameter_state(sends[send_index], self.SEND_COLOR)
                            if state is not None:
                                frame[cc] = state
                    except (AttributeError, IndexError, RuntimeError, TypeError, ValueError):
                        pass
            elif module == "Stop":
                for col, cc in enumerate(self.ROWS[row]):
                    if columns[col] is not None or (self._alt_mode and col == 3):
                        frame[cc] = (self.STOP_COLOR, 0, None, False)
        self._frame = frame
        self._refresh_highlight(rclip_rows, tracks, scenes)

    @staticmethod
    def _slot_list(track):
        try:
            return track.clip_slots if track is not None else ()
        except (AttributeError, RuntimeError, TypeError):
            return ()

    def _audio_mixer(self, track):
        # Do not retain Live Track proxies across scans: device-graph changes
        # must be visible on the very next scan. _frame_mixer shares this
        # result across Pan and Sends within one scan.
        try:
            if track is not None:
                self._record_diagnostic("has_audio_output_reads")
                if track.has_audio_output:
                    return track.mixer_device
        except (AttributeError, RuntimeError, TypeError, ValueError):
            pass
        return None

    def _frame_mixer(self, col, columns, mixers):
        if col not in mixers:
            mixers[col] = self._audio_mixer(columns[col])
        return mixers[col]

    @staticmethod
    def _parameter_state(parameter, color):
        if parameter is None:
            return None
        minimum, maximum = float(parameter.min), float(parameter.max)
        if maximum <= minimum:
            return None
        value = float(parameter.value)
        ring = int(round(127.0 * (value - minimum) / (maximum - minimum)))
        return (color, 0, max(0, min(127, ring)), False)

    def _render_frame(self, update_rings):
        now = time.monotonic()
        beat = None
        ring_samples = {}
        for cc in range(16):
            color, rate, ring_data, scene = self._frame.get(cc, (0, 0, None, False))
            if scene and rate:
                # Playing: green 1/4-note flash. Queued: pink 1/16-note.
                # Recording: red 1/16-note. Stopped occupied: solid yellow.
                # Empty scene: completely dark.
                if beat is None:
                    beat = self._beat_position()
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
                    key = id(ring_data)
                    if key not in ring_samples:
                        ring_samples[key] = self._playing_ring(ring_data)
                    ring = ring_samples[key]
                self._ring(cc, ring)

    def _record_diagnostic(self, name):
        if self._diagnostics_enabled:
            self._diagnostics[name] = self._diagnostics.get(name, 0) + 1

    def _record_duration(self, name, elapsed):
        if self._diagnostics_enabled:
            total_key = name + "_seconds_total"
            max_key = name + "_seconds_max"
            self._diagnostics[total_key] = self._diagnostics.get(total_key, 0.0) + elapsed
            self._diagnostics[max_key] = max(self._diagnostics.get(max_key, 0.0), elapsed)

    def _schedule_tick(self):
        if self._closed or self._tick_pending or self._tick_running:
            return
        self._tick_pending = True
        self._record_diagnostic("scheduled_callbacks")
        try:
            self.schedule_message(1, self._tick)
        except Exception as exc:
            self._tick_pending = False
            self._record_diagnostic("schedule_failures")
            self.log_message("MF4TRKBento scheduler unavailable: %s" % exc)

    def _refresh_all(self):
        if self._closed:
            return
        if self._refresh_running:
            self._refresh_pending = True
            self._record_diagnostic("reentrant_refreshes")
            return
        self._refresh_running = True
        self._record_diagnostic("refreshes")
        try:
            scan_started = time.monotonic() if self._diagnostics_enabled else None
            try:
                self._scan_frame()
            finally:
                if scan_started is not None:
                    self._record_duration("scan", max(0.0, time.monotonic() - scan_started))
            if not self._closed:
                self._ticks_until_scan = 2
                self._render_frame(update_rings=True)
        finally:
            self._refresh_running = False
            if self._refresh_pending:
                self._refresh_pending = False
                # One follow-up scan on the already scheduled tick; never recurse.
                self._ticks_until_scan = 0

    def _tick(self):
        if self._closed:
            self._tick_pending = False
            return
        if self._tick_running:
            self._record_diagnostic("reentrant_ticks")
            return
        self._tick_pending = False
        self._tick_running = True
        self._record_diagnostic("ticks")
        tick_started = time.monotonic() if self._diagnostics_enabled else None
        try:
            self._ticks_until_scan -= 1
            if self._ticks_until_scan <= 0:
                self._refresh_all()
            else:
                self._render_frame(update_rings=False)
        except Exception as exc:
            self.log_message("MF4TRKBento v1.6 refresh error: %s" % exc)
        finally:
            if tick_started is not None:
                self._record_duration("tick", max(0.0, time.monotonic() - tick_started))
            self._tick_running = False
            self._schedule_tick()

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
                self._record_diagnostic("highlight_creations")
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
        self._tick_pending = False
        self._refresh_pending = False
        self._record_diagnostic("disconnects")
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
        self._stop_press.clear()
        self._press_order.clear()
        self._multi_chord.clear()
        self._vertical_modifiers.clear()
        for cc in range(16):
            try:
                self._send(self.ROTARY_CH, cc, 0)
                self._send(self.PUSH_CH, cc, 0)
            except Exception:
                pass
        super(MF4TRKBento, self).disconnect()


def create_instance(c_instance):
    return MF4TRKBento(c_instance)
