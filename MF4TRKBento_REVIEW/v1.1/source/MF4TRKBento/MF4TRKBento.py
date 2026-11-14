# MF4TRKBento v1.1 EXP — two-row modular scaffold with RClip
# Built from the user's Selected Track Bento v2.2 and Four Track Mode v0.9 references.
# Row 1: RClip. Row 2: Blank placeholder.
# MIDI Fighter Twister: rotary ch12 (zero-based 11), push ch11 (zero-based 10).
from _Framework.ControlSurface import ControlSurface
from _Framework.ButtonElement import ButtonElement
from _Framework.InputControlElement import MIDI_CC_TYPE
import time


class MF4TRKBento(ControlSurface):
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
        self._clip_offset = 0
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
        self.show_message("MF4TRKBento v1.1 EXP | Row 1 RClip / Row 2 Blank")
        self.log_message("MF4TRKBento v1.1 EXP loaded")

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
        # RClip box vertical scrolling: E1 held + E12 turn up; E12 held + E1 turn down.
        # The scroll gesture is intentionally reserved for the clip grid and does not
        # fire a clip when the modifier is held.
        if self._row_modules[0] == "RClip":
            if cc == 11 and self._held[0]:
                self._consumed[0] = True
                self._scroll_clip_box(step)
                return
            if cc == 0 and self._held[11]:
                self._consumed[11] = True
                self._scroll_clip_box(-step)
                return

    def _push(self, cc, raw):
        if self._closed:
            return
        down = int(raw) >= 64
        was_down = self._held[cc]
        if down == was_down:
            return
        self._held[cc] = down

        # Consume modifier releases so gestures never accidentally launch clips.
        if not down and self._consumed[cc]:
            self._consumed[cc] = False
            return

        # Alternate mode: hold E16 and tap E1. E16 is a global modifier.
        if cc == 0 and down and self._held[15]:
            self._consumed[0] = True
            self._alt_mode = not self._alt_mode
            self._clip_offset = min(self._clip_offset, self._max_clip_offset())
            self.show_message("MF4TRKBento | " + ("3 Clips + Scene" if self._alt_mode else "4 Clips"))
            self._refresh_all()
            return

        # E16 is only a modifier for the alternate-mode gesture in this first build.
        if cc == 15:
            return

        row = self._row_for_cc(cc)
        if row is not None and self._held[self.ROWS[row][0]] and cc == self.ROWS[row][-1]:
            # Last encoder push is suppressed during module selection.
            return

        if row is not None and self._row_modules[row] == "RClip":
            # Four tracks horizontally; stacked RClip rows address successive scenes.
            # In alternate mode, E4 in each RClip row launches that row's scene.
            if not down:
                column = cc % 4
                if self._alt_mode and column == 3:
                    self._launch_scene(self._clip_offset + row)
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

    def _selected_track(self):
        try:
            return self.song().view.selected_track
        except Exception:
            return None

    def _track_for_column(self, column):
        tracks = self._visible_tracks()
        selected = self._selected_track()
        try:
            start = tracks.index(selected)
        except ValueError:
            start = 0
        index = start + column
        return tracks[index] if 0 <= index < len(tracks) else None

    def _clip_slot(self, column, scene_index):
        track = self._track_for_column(column)
        try:
            slots = tuple(track.clip_slots) if track is not None else ()
            return slots[scene_index] if 0 <= scene_index < len(slots) else None
        except Exception:
            return None

    def _scene_count(self):
        try:
            return len(tuple(self.song().scenes))
        except Exception:
            return 0

    def _clip_count(self):
        return 3 if self._alt_mode else 4

    def _active_clip_rows(self):
        return sum(1 for module in self._row_modules if module == "RClip")

    def _max_clip_offset(self):
        return max(0, self._scene_count() - max(1, self._active_clip_rows()))

    def _scroll_clip_box(self, direction):
        old = self._clip_offset
        self._clip_offset = max(0, min(self._max_clip_offset(), old + direction))
        if self._clip_offset != old:
            self.show_message("RClip | Slots %d-%d" %
                              (self._clip_offset + 1, self._clip_offset + self._clip_count()))
            self._refresh_all()

    def _launch_clip(self, column, row):
        # RClip is horizontal: one clip per track, across up to four tracks.
        # Each RClip module row addresses the corresponding scene row vertically.
        scene_index = self._clip_offset + row
        slot = self._clip_slot(column, scene_index)
        if slot is None:
            return
        try:
            if slot.has_clip:
                slot.fire()
            else:
                track = self._track_for_column(column)
                if (track is not None and bool(getattr(track, "arm", False))) or bool(getattr(slot, "has_stop_button", False)):
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

    def _clip_color(self, clip):
        try:
            rgb = int(clip.color) & 0xFFFFFF
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

    def _refresh_highlight(self, tracks, selected):
        # Highlight box follows the horizontal track grid and stacked scene rows.
        # A dedicated SessionComponent is created only while RClip occupies row 1.
        if self._row_modules[0] != "RClip":
            self._close_highlight()
            self._highlight_error = None
            return
        active_rows = max(1, self._active_clip_rows())
        size = (self._clip_count(), active_rows)
        track_offset = None
        configuring = False
        try:
            if selected not in tracks:
                return
            track_offset = tracks.index(selected)
            if self._highlight_error in ((size, track_offset, None), (size, track_offset, self._clip_offset)):
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
            state = (track_offset, self._clip_offset)
            if state != self._last_highlight:
                self._session_component.set_offsets(track_offset, self._clip_offset)
                self._last_highlight = state
            self._highlight_error = None
        except Exception as exc:
            error = (size, track_offset, None if configuring else self._clip_offset)
            if error != self._highlight_error:
                self.log_message("MF4TRKBento highlight unavailable: %s" % exc)
                self._highlight_error = error
            self._close_highlight()

    def _scan_clips(self):
        tracks = self._visible_tracks()
        selected = self._selected_track()
        start = tracks.index(selected) if selected in tracks else 0
        rows = [row for row, module in enumerate(self._row_modules) if module == "RClip"]
        frame = {}
        if rows:
            for col, track in enumerate(tracks[start:start + self._clip_count()]):
                try:
                    slots = tuple(track.clip_slots)
                except (AttributeError, RuntimeError, TypeError):
                    continue
                for row in rows:
                    index = self._clip_offset + row
                    if index < len(slots):
                        frame[self.ROWS[row][col]] = self._clip_state(slots[index])
        self._clip_frame = frame
        self._refresh_highlight(tracks, selected)

    def _clip_state(self, slot):
        try:
            if not slot.has_clip:
                return (108 if bool(getattr(slot, "is_triggered", False)) else 0, 0, None)
            clip = slot.clip
            if bool(getattr(clip, "is_recording", False)):
                return (72, 8, None)
            if bool(getattr(clip, "is_triggered", False)):
                return (108, 8, None)
            color = self._clip_color(clip)
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
