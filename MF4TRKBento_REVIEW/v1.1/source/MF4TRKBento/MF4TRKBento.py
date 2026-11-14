# MF4TRKBento v1.2 EXP — two-row modular scaffold with RClip
# Built from the user's Selected Track Bento v2.2 and Four Track Mode v0.9 references.
# Row 1: RClip. Row 2: Blank placeholder.
# MIDI Fighter Twister: rotary ch12 (zero-based 11), push ch11 (zero-based 10).
from _Framework.ControlSurface import ControlSurface
from _Framework.ButtonElement import ButtonElement
from _Framework.InputControlElement import MIDI_CC_TYPE
import time


class MF4TRKBento(ControlSurface):
    SCROLL_DETENTS = 4
    ROTARY_CH = 11
    PUSH_CH = 10
    ROWS = ((0, 1, 2, 3), (4, 5, 6, 7))
    MODULES = ("RClip", "Blank")
    ALT_LABELS = ("4 Clips", "3 Clips + Scene")
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
        self._turn_accum = [0] * 16
        self._row_modules = ["RClip", "Blank"]
        self._alt_mode = False
        self._track_offset = 0
        self._scene_offset = 0
        self._scroll_steps = {"track": 0, "scene": 0}
        self._alternate_press = False
        self._closed = False
        self._clip_frame = {}
        self._ticks_until_scan = 0
        self._color_cache = {}
        self._highlight_error = None
        self._rgb_cache = {}
        self._ring_cache = {}
        self._session_component = None
        self._session_size = None
        self._last_highlight = None
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
        self.show_message("MF4TRKBento v1.2 EXP | Row 1 RClip / Row 2 Blank")
        self.log_message("MF4TRKBento v1.2 EXP loaded")

    def _make_rotary(self, cc):
        return lambda value: self._rotary(cc, value)

    def _make_push(self, cc):
        return lambda value: self._push(cc, value)

    def _send(self, channel, cc, value):
        return self._send_midi((0xB0 | channel, int(cc), max(0, min(127, int(value)))))

    def _rgb(self, cc, value):
        value = int(value)
        if self._rgb_cache.get(cc) != value and self._send(self.PUSH_CH, cc, value) is not False:
            self._rgb_cache[cc] = value

    def _ring(self, cc, value):
        value = max(0, min(127, int(value)))
        if self._ring_cache.get(cc) != value and self._send(self.ROTARY_CH, cc, value) is not False:
            self._ring_cache[cc] = value

    @staticmethod
    def _relative(raw):
        if raw == 65:
            return 1
        if raw == 63:
            return -1
        return 0

    def _row_for_cc(self, cc):
        if cc < 4:
            return 0
        if cc < 8:
            return 1
        return None

    def _rotary(self, cc, raw):
        step = self._relative(raw)
        if self._closed or not step:
            return
        row = self._row_for_cc(cc)
        # Hold first encoder of a row + twist last encoder to choose module.
        if row is not None and self._held[self.ROWS[row][0]] and cc == self.ROWS[row][-1]:
            self._turn_accum[row] += step
            self._consumed[self.ROWS[row][0]] = True
            if abs(self._turn_accum[row]) >= 1:
                self._turn_accum[row] = 0
                self._cycle_module(row, step)
            return
        if not self._active_rows():
            return
        if self._held[0] and not self._alternate_press and cc in (11, 15):
            self._consumed[0] = True
            self._scroll_grid("scene" if cc == 11 else "track", step)
        elif cc == 0 and self._held[11] and not self._alternate_press:
            self._consumed[11] = True
            if self._held[0]:
                self._consumed[0] = True
            self._scroll_grid("scene", -step)

    def _push(self, cc, raw):
        if self._closed:
            return
        down = int(raw) >= 64
        was_down = self._held[cc]
        if down == was_down:
            return
        self._held[cc] = down

        if cc in (0, 11) and not down:
            self._scroll_steps["scene"] = 0
        if cc == 0 and not down:
            self._scroll_steps["track"] = 0
            self._alternate_press = False

        # Consume modifier releases so gestures never accidentally launch clips.
        if not down and self._consumed[cc]:
            self._consumed[cc] = False
            return

        # Alternate mode: hold E16 and tap E1. E16 is a global modifier.
        if cc == 0 and down and self._held[15]:
            self._consumed[0] = True
            self._alternate_press = True
            self._alt_mode = not self._alt_mode
            self.show_message("MF4TRKBento | " + ("3 Clips + Scene" if self._alt_mode else "4 Clips"))
            self._refresh_all()
            return

        # E16 is only a modifier for the alternate-mode gesture in this first build.
        if cc == 15:
            return

        row = self._row_for_cc(cc)
        if row is not None and self._held[self.ROWS[row][0]] and cc == self.ROWS[row][-1]:
            # Suppress the release even if the modifier lifts first.
            self._consumed[cc] = down
            return

        if row is not None and self._row_modules[row] == "RClip":
            # Four tracks horizontally; stacked RClip rows address successive scenes.
            # In alternate mode, E4 in each RClip row launches that row's scene.
            if not down:
                column = cc % 4
                if self._alt_mode and column == 3:
                    self._clamp_offsets(self._visible_tracks(), self._scenes())
                    self._launch_scene(self._scene_index(row))
                else:
                    self._launch_clip(column, row)
            return

    def _cycle_module(self, row, direction):
        # v1 intentionally exposes only RClip and Blank. Row 1 starts RClip;
        # Row 2 starts Blank. This validates row gestures before more modules arrive.
        choices = ("RClip", "Blank")
        current = choices.index(self._row_modules[row])
        self._row_modules[row] = choices[(current + direction) % len(choices)]
        self.show_message("MF4TRKBento | Row %d: %s" % (row + 1, self._row_modules[row]))
        self._refresh_all()

    def _visible_tracks(self):
        try:
            return tuple(self.song().visible_tracks)
        except Exception:
            return ()

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

    def _clamp_offsets(self, tracks, scenes):
        self._track_offset = max(0, min(self._track_offset, len(tracks) - self._clip_count()))
        self._scene_offset = max(0, min(self._scene_offset, len(scenes) - max(1, len(self._active_rows()))))

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
        if old != (self._track_offset, self._scene_offset):
            for cc, held in enumerate(self._held):
                if held:
                    self._consumed[cc] = True
            self.show_message("RClip | Track %d / Scene %d" % (self._track_offset + 1, self._scene_offset + 1))
            self._refresh_all()

    def _launch_clip(self, column, row):
        tracks, scenes = self._visible_tracks(), self._scenes()
        self._clamp_offsets(tracks, scenes)
        index = self._track_offset + column
        if index >= len(tracks):
            return
        track = tracks[index]
        try:
            slots = track.clip_slots
            scene_index = self._scene_index(row)
            if scene_index < min(len(slots), len(scenes)):
                slot = slots[scene_index]
                if slot.has_clip or bool(getattr(track, "arm", False)) or bool(getattr(slot, "has_stop_button", False)):
                    slot.fire()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento RClip launch error: %s" % exc)
        self._refresh_all()

    def _launch_scene(self, scene_index):
        try:
            scenes = tuple(self.song().scenes)
            if 0 <= scene_index < len(scenes):
                scenes[scene_index].fire()
                self.show_message("RClip | Scene %d" % (scene_index + 1))
                self._ticks_until_scan = 0
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento scene launch error: %s" % exc)

    def _palette_color(self, item):
        try:
            rgb = int(item.color) & 0xFFFFFF
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return self.CLIP_COLOR_FALLBACK
        if rgb not in self._color_cache:
            r, g, b = (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255
            if len(self._color_cache) >= 256:
                self._color_cache.clear()
            self._color_cache[rgb] = min(
                self.CLIP_PALETTE,
                key=lambda item: sum((a - b) ** 2 for a, b in zip((r, g, b), item[1]))
            )[0]
        return self._color_cache[rgb]

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
                # Live 13 injects register_component while component_guard is active.
                # Treat the highlight box as optional so it cannot abort surface startup.
                with self.component_guard():
                    component = SessionComponent(size[0], size[1],
                                                 name="MF4TRKBento RClip",
                                                 is_root=False)
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

    def _scan_clips(self):
        tracks, scenes = self._visible_tracks(), self._scenes()
        self._clamp_offsets(tracks, scenes)
        rows = self._active_rows()
        frame = {}
        start = self._track_offset
        for col, track in enumerate(tracks[start:start + self._clip_count()]):
            try:
                slots = tuple(track.clip_slots)
            except (AttributeError, RuntimeError, TypeError):
                continue
            for rank, row in enumerate(rows):
                index = self._scene_offset + rank
                if index < min(len(slots), len(scenes)):
                    frame[self.ROWS[row][col]] = self._clip_state(slots[index])
        if self._alt_mode:
            for rank, row in enumerate(rows):
                index = self._scene_offset + rank
                if index < len(scenes):
                    frame[self.ROWS[row][3]] = (self._palette_color(scenes[index]), 0, None)
        self._clip_frame = frame
        self._refresh_highlight(rows, tracks, scenes)

    def _clip_state(self, slot):
        try:
            if not slot.has_clip:
                return (108 if bool(getattr(slot, "is_triggered", False)) else 0, 0, None)
            clip = slot.clip
            if bool(getattr(clip, "is_recording", False)):
                return (72, 8, None)
            if bool(getattr(clip, "is_triggered", False)):
                return (108, 8, None)
            color = self._palette_color(clip)
            if bool(getattr(clip, "is_playing", False)):
                return (color, 4, clip)
            return (color, 0, None)
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return (0, 0, None)

    @staticmethod
    def _playing_ring(clip):
        try:
            start = float(clip.loop_start)
            length = max(0.001, float(clip.loop_end) - start)
            return int(127 * ((float(clip.playing_position) - start) % length) / length)
        except (AttributeError, RuntimeError, TypeError, ValueError, OverflowError):
            return 0

    def _render_frame(self, update_rings):
        now = time.monotonic()
        for cc in range(16):
            color, rate, clip = self._clip_frame.get(cc, (0, 0, None))
            self._rgb(cc, 0 if rate and int(now * rate) % 2 else color)
            if update_rings:
                self._ring(cc, self._playing_ring(clip) if clip is not None else 0)

    def _refresh_all(self):
        self._scan_clips()
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
            self.log_message("MF4TRKBento refresh error: %s" % exc)
        if not self._closed:
            self.schedule_message(1, self._tick)

    def refresh_state(self):
        super(MF4TRKBento, self).refresh_state()
        if not self._closed:
            self._rgb_cache.clear()
            self._ring_cache.clear()
            self._highlight_error = None
            self._last_highlight = None
            self._refresh_all()

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
        self._clip_frame.clear()
        for cc in range(16):
            try:
                self._send(self.ROTARY_CH, cc, 0)
                self._send(self.PUSH_CH, cc, 0)
            except Exception:
                pass
        super(MF4TRKBento, self).disconnect()


def create_instance(c_instance):
    return MF4TRKBento(c_instance)
