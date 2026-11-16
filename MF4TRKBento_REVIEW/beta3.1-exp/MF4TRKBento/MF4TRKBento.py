# MF4TRKBento Beta 3.1 EXP
# Fixed mixer rotaries and top-down Device Control replacement.
# Bank 2 MIDI routing retained from Beta 2 (CC0-15, channels 11/12).
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
    # Physical rows from TOP to BOTTOM. Device Control replaces these slots
    # in order: Send B, Send A, Pan, Volume. Button-only modules never change
    # their row's rotary assignment; Blank disables the push only.
    MODULES = ("Blank", "Clip Launch", "Arm", "Solo", "Mute", "Stop", "Device Control")
    BUTTON_ONLY_MODULES = ("Clip Launch", "Arm", "Solo", "Mute", "Stop")
    MIXER_ROTARY_FUNCTIONS = ("Send B", "Send A", "Pan", "Volume")
    DEVICE_COLOR = 68  # Blue; primary top-row power indicator uses yellow.
    DEVICE_POWER_COLOR = 108
    STOP_HOLD_SECONDS = 0.5
    STOP_COLOR = 72
    ARM_COLOR = 72       # solid red available / flashing red armed
    SOLO_COLOR = 68      # solid blue available / flashing blue soloed
    MUTE_MONITOR_AUTO_OFF = 108  # yellow regardless of mute state
    MUTE_MONITOR_IN = 68        # blue while monitor IN
    SEND_COLOR = 47  # Selected Track Bento reference: FX purple
    UNSOLO_COLOR = 32  # Teal/cyan global status
    VOLUME_PRESS_GUARD_SECONDS = 0.035
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
        # Beta 3.0 approved button defaults remain intact; Device Control
        # modules are added from the TOP down by the existing row selector.
        self._row_modules = ["Clip Launch", "Arm", "Solo", "Mute"]
        self._device_bank = 0  # 4 parameters per banking step, no wrap label assumptions.
        self._last_device = None  # Detect external device/track selection changes.
        self._multi_chord = set()
        self._press_order = []
        self._alt_mode = False
        self._alternate_press = False
        self._fx_mode = False
        self._track_offset = 0
        self._regular_track_offset = 0
        self._return_track_offset = 0
        self._scene_offset = 0
        # Last immediate volume step per encoder, reversible if its push CC
        # follows within the press-contamination window.
        self._mute_volume_last_turn = {}
        self._scroll_steps = {"track": 0, "scene": 0}
        # Module selection requires four encoder detents per module step (4x slower).
        self._module_scroll_steps = [0, 0, 0, 0]
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
        self.show_message("MF4TRKBento Beta 3.1 EXP | Device Rows")
        self.log_message("MF4TRKBento Beta 3.1 EXP loaded - priority Device Control replacement; CC0-15 unchanged")

    def _make_rotary(self, cc):
        return lambda value: self._rotary(cc, value)

    def _make_push(self, cc):
        return lambda value: self._push(cc, value)

    def _send(self, channel, cc, value):
        return self._send_midi((0xB0 | channel, int(cc), max(0, min(127, int(value)))))

    def _rgb(self, cc, value):
        if self._closed:
            return
        value = max(0, min(127, int(value)))
        if self._rgb_cache.get(cc) != value and self._send(self.PUSH_CH, cc, value) is not False:
            self._rgb_cache[cc] = value

    def _ring(self, cc, value):
        if self._closed:
            return
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

    def _return_tracks(self):
        try:
            return tuple(self.song().return_tracks)
        except (AttributeError, RuntimeError, TypeError):
            return ()

    def _control_tracks(self):
        # The same four-column target list drives mixer actions and the
        # SessionComponent highlight, including Return tracks in FX mode.
        return self._return_tracks() if self._fx_mode else self._visible_tracks()

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
        return [row for row, module in enumerate(self._row_modules) if module == "Clip Launch"]

    def _button_module_rows(self):
        return [row for row, module in enumerate(self._row_modules)
                if module in self.BUTTON_ONLY_MODULES]

    def _device_row_count(self):
        # A contiguous top-down prefix avoids unexpected movement of track
        # volume/pan when a Device row is inserted or removed.
        count = 0
        for module in self._row_modules:
            if module != "Device Control":
                break
            count += 1
        return count

    def _rotary_function(self, row):
        if not 0 <= row < 4:
            return None
        return ("Device Control" if row < self._device_row_count()
                else self.MIXER_ROTARY_FUNCTIONS[row])

    def _selected_device(self):
        """Read only the currently selected track's selected device."""
        try:
            song_view = self.song().view
            track = song_view.selected_track
            if track is None:
                return None
            return track.view.selected_device
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return None

    def _device_parameters(self, device=None, raw_parameters=None):
        device = device if device is not None else self._selected_device()
        if device is None:
            return ()
        try:
            parameters = (tuple(device.parameters) if raw_parameters is None
                          else raw_parameters)
        except (AttributeError, RuntimeError, TypeError):
            return ()
        # Live's first device parameter is usually 'Device On'. Keep it for
        # E1 push, not for the rotary parameters numbered 1–4 / 5–8 etc.
        try:
            if parameters and getattr(parameters[0], "name", None) == "Device On":
                return parameters[1:]
        except (AttributeError, RuntimeError, TypeError):
            return ()
        return parameters

    def _device_power(self, device, raw_parameters=None):
        if device is None:
            return None
        try:
            parameters = (device.parameters if raw_parameters is None
                          else raw_parameters)
            for param in parameters:
                if getattr(param, "name", None) == "Device On":
                    return param
        except (AttributeError, RuntimeError, TypeError):
            return None
        return None

    def _device_parameter(self, row, col, params=None):
        if row >= self._device_row_count():
            return None
        if params is None:
            params = self._device_parameters()
        index = 4 * (self._device_bank + row) + col
        return params[index] if 0 <= index < len(params) else None

    def _select_adjacent_device(self, direction):
        try:
            track = self.song().view.selected_track
            current = self._selected_device()
            if track is None or current is None:
                return
            # Rack-chain devices are siblings in their canonical parent; the
            # selected track's top-level devices omit those nested devices.
            parent = getattr(current, "canonical_parent", None)
            devices = tuple(parent.devices if parent is not None else track.devices)
            if current not in devices or not devices:
                return
            index = devices.index(current) + direction
            if not 0 <= index < len(devices):
                return
            view = self.song().view
            selector = getattr(view, "select_device", None)
            if not callable(selector):
                self.log_message("MF4TRKBento Song.View.select_device unavailable")
                return  # Track.View.selected_device is read-only in Live.
            new_device = devices[index]
            selector(new_device)
            self._last_device = new_device
            self._device_bank = 0
            self._refresh_all()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento device navigation error: %s" % exc)

    def _device_next_bank(self):
        params = self._device_parameters()
        if not params:
            return
        banks = max(1, (len(params) + 3) // 4)
        self._device_bank = (self._device_bank + 1) % banks
        self.show_message("MF4TRKBento | Device bank %d" % (self._device_bank + 1))
        self._refresh_all()

    def _device_push(self, row, col):
        if row != 0:
            return  # Secondary rows are blue, with NO duplicate navigation.
        device = self._selected_device()
        if device is None:
            return
        if col == 0:
            power = self._device_power(device)
            if power is None:
                return
            try:
                power.value = float(power.min) if float(power.value) > float(power.min) else float(power.max)
            except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                self.log_message("MF4TRKBento device power error: %s" % exc)
            self._refresh_all()
        elif col == 1:
            self._device_next_bank()
        elif col == 2:
            self._select_adjacent_device(-1)
        elif col == 3:
            self._select_adjacent_device(1)

    def _turn_device(self, row, col, step):
        parameter = self._device_parameter(row, col)
        if parameter is None:
            return
        try:
            if not bool(getattr(parameter, "is_enabled", True)):
                return
            minimum, maximum = float(parameter.min), float(parameter.max)
            if maximum <= minimum:
                return
            old = float(parameter.value)
            if bool(getattr(parameter, "is_quantized", False)):
                new = max(minimum, min(maximum, old + step))
            else:
                new = max(minimum, min(maximum,
                                        old + step * (maximum - minimum) / 64.0))
            parameter.value = new
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento device parameter error: %s" % exc)
            return
        self._refresh_inherited_cell(row, col)

    def _scene_index(self, row):
        return self._scene_offset + self._active_rows().index(row)

    def _track_for_column(self, col):
        tracks = self._control_tracks()
        index = self._track_offset + col
        return tracks[index] if 0 <= index < len(tracks) else None

    def _toggle_fx_mode(self):
        if not self._fx_mode and not self._return_tracks():
            self.show_message("MF4TRKBento | No FX Returns")
            return
        if self._fx_mode:
            self._return_track_offset = self._track_offset
            self._fx_mode = False
            self._track_offset = self._regular_track_offset
            label = "Tracks"
        else:
            self._regular_track_offset = self._track_offset
            self._fx_mode = True
            self._track_offset = self._return_track_offset
            label = "FX Returns"
        self._scroll_steps["track"] = 0
        self._mute_volume_last_turn.clear()
        self._clamp_offsets(self._control_tracks(), self._scenes())
        # Recreate the highlight component so its track source switches
        # between visible_tracks and return_tracks even when the offset is 0.
        self._close_highlight()
        self._highlight_error = None
        self.show_message("MF4TRKBento | " + label)
        self._refresh_all()

    def _clamp_offsets(self, tracks, scenes):
        self._track_offset = max(0, min(self._track_offset, max(0, len(tracks) - self._clip_count())))
        self._scene_offset = max(0, min(self._scene_offset,
                                           max(0, len(scenes) - max(1, len(self._active_rows())))))

    def _rotary(self, cc, raw):
        step = self._relative(raw)
        if self._closed or not step:
            return
        # E1 is the global navigation modifier. Track banking remains usable
        # even when no Clip Launch row is assigned; scene banking only applies
        # when at least one Clip Launch row exists. These take priority over
        # row module-selection gestures when the same modifiers are held.
        if self._held[0] and not self._alternate_press:
            if cc == 15:
                self._consume_held()
                self._scroll_grid("track", step)
                return
            if cc == 11 and self._active_rows():
                self._consume_held()
                self._scroll_grid("scene", step)
                return
        row = self._row_for_cc(cc)
        first, last = self.ROWS[row][0], self.ROWS[row][-1]
        if self._held[first] and cc == last:
            self._consume_held()
            accumulated = self._module_scroll_steps[row] + step
            if abs(accumulated) >= 4:
                direction = 1 if accumulated > 0 else -1
                self._module_scroll_steps[row] = accumulated - (4 * direction)
                self._cycle_module(row, direction)
            else:
                self._module_scroll_steps[row] = accumulated
            return
        function = self._rotary_function(row)
        if self._held[cc]:
            return
        if function == "Volume":
            # In alternate mode the fourth encoder becomes Master Volume.
            if self._alt_mode and cc % 4 == 3:
                self._turn_master_volume(row, cc % 4, step)
            else:
                self._turn_volume(row, cc % 4, step)
        elif function == "Pan":
            self._turn_pan(row, cc % 4, step)
        elif function == "Send A":
            self._turn_send(row, cc % 4, step, 0)
        elif function == "Send B":
            self._turn_send(row, cc % 4, step, 1)
        elif function == "Device Control":
            self._turn_device(row, cc % 4, step)

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
        if not down and cc % 4 == 0:
            self._module_scroll_steps[cc // 4] = 0
        if not down and self._consumed[cc]:
            self._consumed[cc] = False
            return

        # E1 held FIRST, then E16 pressed: switch the controlled group and
        # Session highlight between regular tracks and FX Returns.
        if cc == 15 and down and self._held[0]:
            if self._rotary_function(3) == "Volume":
                self._cancel_press_induced_volume_step(cc)
            self._consume_held()
            self._toggle_fx_mode()
            return

        # E16 held FIRST, then E1 pressed: change alternate mode.
        if cc == 0 and down and self._held[15]:
            self._consume_held()
            self._alternate_press = True
            self._alt_mode = not self._alt_mode
            self._clamp_offsets(self._control_tracks(), self._scenes())
            self.show_message("MF4TRKBento | " + ("3 Clips + Scene" if self._alt_mode else "4 Clips"))
            self._refresh_all()
            return

        row = self._row_for_cc(cc)
        first, last = self.ROWS[row][0], self.ROWS[row][-1]
        if down and self._rotary_function(row) == "Volume":
            self._cancel_press_induced_volume_step(cc)
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
        if module == "Device Control":
            self._device_push(row, col)
        elif module == "Clip Launch":
            self._clamp_offsets(self._control_tracks(), self._scenes())
            if self._alt_mode and col == 3:
                self._launch_scene(self._scene_index(row))
            else:
                self._launch_clip(col, row)
        elif module in ("Arm", "Solo", "Mute"):
            if self._alt_mode and col == 3:
                # Mute retains the established Master Unsolo push action.
                # Arm and Solo have no Master-track button action.
                if module == "Mute":
                    self._unsolo_all()
            elif module == "Arm":
                self._toggle_exclusive_arm(col)
            elif module == "Solo":
                self._toggle_exclusive_solo(col)
            else:
                self._toggle_track_flag(col, "mute")
        elif module == "Stop" and stop_press is not None:
            pressed_at, target = stop_press
            if time.monotonic() - pressed_at < self.STOP_HOLD_SECONDS:
                self._stop_clips(col, target)

    def _consume_held(self):
        for cc, held in enumerate(self._held):
            if held:
                self._consumed[cc] = True
        self._multi_chord.clear()


    def _cycle_module(self, row, direction):
        current_count = self._device_row_count()
        # Only the lowest active Device row can be removed. This prevents
        # holes/reordering in the top-down replacement chain.
        if row < current_count - 1:
            self.show_message("MF4TRKBento | Change lowest Device row first")
            return
        current = self.MODULES.index(self._row_modules[row])
        for hops in range(1, len(self.MODULES) + 1):
            next_module = self.MODULES[(current + hops * direction) % len(self.MODULES)]
            # The next Device slot is ALWAYS the first mixer row under the
            # existing Device stack; no arbitrary noncontiguous Device rows.
            if next_module == "Device Control" and row != current_count:
                continue
            if next_module in ("Arm", "Solo", "Mute") and any(
                    index != row and active == next_module
                    for index, active in enumerate(self._row_modules)):
                continue
            self._row_modules[row] = next_module
            if next_module == "Device Control":
                self._device_bank = 0
            self._mute_volume_last_turn.clear()
            self._clamp_offsets(self._control_tracks(), self._scenes())
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
        self._clamp_offsets(self._control_tracks(), self._scenes())
        if (self._track_offset, self._scene_offset) != old:
            if axis == "track":
                self._mute_volume_last_turn.clear()
            self.show_message("Clip Launch | Track %d / Scene %d" %
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
                self.show_message("Clip Launch | Scene %d" % (index + 1))
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

    def _inherited_parameter(self, row, col, columns=None, mixers=None,
                             device_params=None):
        """Resolve the rotary parameter independent of its push module."""
        function = self._rotary_function(row)
        if function is None:
            return None
        if function == "Device Control":
            return self._device_parameter(row, col, device_params)
        if function == "Volume":
            if self._alt_mode and col == 3:
                try:
                    return self.song().master_track.mixer_device.volume
                except (AttributeError, RuntimeError, TypeError):
                    return None
            track = (columns[col] if columns is not None and col < len(columns)
                     else self._track_for_column(col))
            try:
                return track.mixer_device.volume if track is not None else None
            except (AttributeError, RuntimeError, TypeError):
                return None
        if function == "Pan":
            if self._alt_mode and col == 3:
                try:
                    return self.song().master_track.mixer_device.panning
                except (AttributeError, RuntimeError, TypeError):
                    return None
            track = (columns[col] if columns is not None and col < len(columns)
                     else self._track_for_column(col))
            mixer = (self._frame_mixer(col, columns, mixers)
                     if columns is not None and mixers is not None
                     else self._audio_mixer(track))
            try:
                return mixer.panning if mixer is not None else None
            except (AttributeError, RuntimeError, TypeError):
                return None
        if function in ("Send A", "Send B"):
            # There are no Master Sends. E16 is reserved for Master functions
            # only when the inherited function is Volume or Pan.
            if self._alt_mode and col == 3:
                return None
            track = (columns[col] if columns is not None and col < len(columns)
                     else self._track_for_column(col))
            mixer = (self._frame_mixer(col, columns, mixers)
                     if columns is not None and mixers is not None
                     else self._audio_mixer(track))
            if mixer is None:
                return None
            try:
                sends = mixer.sends
                index = 0 if function == "Send A" else 1
                return sends[index] if index < len(sends) else None
            except (AttributeError, IndexError, RuntimeError, TypeError, ValueError):
                return None
        return None

    def _parameter_ring(self, parameter):
        state = self._parameter_state(parameter, 0) if parameter is not None else None
        return state[2] if state is not None else None

    def _refresh_inherited_cell(self, row, col):
        """Refresh only the rotary ring, preserving the module's push LED state."""
        if self._closed:
            return
        cc = row * 4 + col
        color, rate, _old_ring, scene = self._frame.get(cc, (0, 0, None, False))
        parameter = self._inherited_parameter(row, col)
        ring = self._parameter_ring(parameter)
        self._frame[cc] = (color, rate, ring, scene)
        self._render_cell(cc)

    def _turn_master_volume(self, row, col, step):
        cc = row * 4 + col
        if self._closed or self._held[cc]:
            return
        try:
            parameter = self._inherited_parameter(row, col)
            if parameter is None:
                return
            minimum, maximum = float(parameter.min), float(parameter.max)
            if maximum <= minimum:
                return
            previous = float(parameter.value)
            updated = max(minimum, min(maximum,
                                       previous + step * (maximum - minimum) / 64.0))
            if updated == previous:
                return
            parameter.value = updated
            self._mute_volume_last_turn[cc] = (
                time.monotonic(), self.song().master_track, parameter, previous, updated)
            self._refresh_inherited_cell(row, col)
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento Master Volume turn error: %s" % exc)

    def _turn_volume(self, row, col, step):
        cc = row * 4 + col
        if self._closed or self._held[cc]:
            return
        track = self._track_for_column(col)
        if track is None:
            return
        try:
            parameter = self._inherited_parameter(row, col)
            if parameter is None:
                return
            minimum, maximum = float(parameter.min), float(parameter.max)
            if maximum <= minimum:
                return
            previous = float(parameter.value)
            updated = max(minimum, min(maximum,
                                       previous + step * (maximum - minimum) / 64.0))
            if updated == previous:
                return
            parameter.value = updated
            self._mute_volume_last_turn[cc] = (
                time.monotonic(), track, parameter, previous, updated)
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento Volume turn error: %s" % exc)
            return
        self._refresh_inherited_cell(row, col)

    def _cancel_press_induced_volume_step(self, cc):
        # No delayed callback: if the rotary detent arrives just before the
        # push-down CC, restore that one step immediately on the push event.
        # Normal turns are never delayed; a push after 35 ms leaves the turn.
        event = self._mute_volume_last_turn.pop(cc, None)
        if event is None:
            return
        timestamp, track, parameter, previous, applied = event
        if time.monotonic() - timestamp > self.VOLUME_PRESS_GUARD_SECONDS:
            return
        try:
            current = float(parameter.value)
            if abs(current - applied) <= 0.000001:
                parameter.value = previous
                self._refresh_inherited_cell(cc // 4, cc % 4)
                self._record_diagnostic("volume_press_detent_rollbacks")
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento volume press guard error: %s" % exc)

    def _any_soloed(self):
        try:
            song = self.song()
            tracks = list(song.tracks) + list(song.return_tracks)
            try:
                tracks.append(song.master_track)
            except (AttributeError, RuntimeError, TypeError):
                pass
        except (AttributeError, RuntimeError, TypeError):
            return False
        for track in tracks:
            try:
                if bool(track.solo):
                    return True
            except (AttributeError, RuntimeError, TypeError, ValueError):
                continue
        return False

    def _unsolo_all(self):
        try:
            song = self.song()
            tracks = list(song.tracks) + list(song.return_tracks)
            try:
                tracks.append(song.master_track)
            except (AttributeError, RuntimeError, TypeError):
                pass
            for track in tracks:
                try:
                    if bool(track.solo):
                        track.solo = False
                except (AttributeError, RuntimeError, TypeError, ValueError):
                    continue
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento Unsolo error: %s" % exc)
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
                # Regular mode preserves the accepted regular-track-only scope.
                # FX mode also clears any other soloed Return tracks.
                scope = tuple(self._all_tracks())
                if self._fx_mode:
                    scope += self._return_tracks()
                for other in scope:
                    if other is not target and bool(other.solo):
                        other.solo = False
                target.solo = True
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento exclusive solo error: %s" % exc)
        self._refresh_all()

    def _multi_targets(self, buttons, flag):
        tracks = self._control_tracks()
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

    def _turn_send(self, row, col, step, send_index):
        parameter = self._inherited_parameter(row, col)
        if parameter is None:
            return
        try:
            minimum, maximum = float(parameter.min), float(parameter.max)
            if maximum > minimum:
                delta = (maximum - minimum) / 64.0
                parameter.value = max(minimum, min(maximum,
                                                   float(parameter.value) + step * delta))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento %s turn error: %s" %
                             ("Send A" if send_index == 0 else "Send B", exc))
            return
        self._refresh_inherited_cell(row, col)

    def _turn_pan(self, row, col, step):
        parameter = self._inherited_parameter(row, col)
        if parameter is None:
            return
        try:
            value = float(parameter.value)
            minimum = float(parameter.min)
            maximum = float(parameter.max)
            if maximum <= minimum:
                return
            delta = (maximum - minimum) / 64.0
            parameter.value = max(minimum, min(maximum, value + step * delta))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message("MF4TRKBento Pan turn error: %s" % exc)
            return
        self._refresh_inherited_cell(row, col)

    def _render_cell(self, cc):
        """Render one cached cell without touching any other Live object."""
        if self._closed:
            return
        now = time.monotonic()
        color, rate, ring_data, scene = self._frame.get(cc, (0, 0, None, False))
        if scene and rate:
            is_off = int(self._beat_position() * rate) % 2 == 1
        else:
            is_off = bool(rate and int(now * rate) % 2 == 1)
        self._rgb(cc, 0 if is_off else color)
        if ring_data is None:
            ring = 0
        elif isinstance(ring_data, (int, float)):
            ring = ring_data
        else:
            ring = self._playing_ring(ring_data)
        self._ring(cc, ring)

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
        # Returns banking accepts any number of Returns. Missing columns are
        # represented by an empty frame cell, which clears both LED and ring.
        if self._fx_mode:
            try:
                returns_now = tuple(self.song().return_tracks)
            except (AttributeError, RuntimeError, TypeError):
                returns_now = None
            if returns_now == ():
                self._fx_mode = False
                self._track_offset = self._regular_track_offset
                self._scroll_steps["track"] = 0
                self._mute_volume_last_turn.clear()
                self._close_highlight()
                self._highlight_error = None
                self.show_message("MF4TRKBento | FX Returns removed — Tracks restored")
        tracks, scenes = self._control_tracks(), self._scenes()
        self._clamp_offsets(tracks, scenes)
        frame = {}
        window = tracks[self._track_offset:self._track_offset + self._clip_count()]
        columns = window + (None,) * (4 - len(window))
        mixers = {}
        clip_rows = self._active_rows()
        all_scene_tracks = self._all_tracks() if self._alt_mode and clip_rows else ()
        scene_slots = [self._slot_list(track) for track in all_scene_tracks]
        clip_slots = [self._slot_list(track) for track in columns] if clip_rows else []
        any_soloed = self._any_soloed() if any(m == "Mute" for m in self._row_modules) and self._alt_mode else False

        device = self._selected_device() if self._device_row_count() else None
        try:
            device_changed = device != self._last_device
        except (RuntimeError, TypeError, ValueError):
            device_changed = True
        if device_changed:
            self._device_bank = 0
            self._last_device = device
        device_params, power = (), None
        if device is not None:
            try:
                raw_device_params = tuple(device.parameters)
            except (AttributeError, RuntimeError, TypeError):
                raw_device_params = ()
            device_params = self._device_parameters(device, raw_device_params)
            power = self._device_power(device, raw_device_params)
            max_bank = max(0, (len(device_params) - 1) // 4)
            if self._device_bank > max_bank:
                self._device_bank = 0
        for row, module in enumerate(self._row_modules):
            for col, cc in enumerate(self.ROWS[row]):
                parameter = self._inherited_parameter(
                    row, col, columns, mixers, device_params)
                ring = self._parameter_ring(parameter)

                if module == "Device Control":
                    if device is None:
                        continue
                    if row == 0:
                        if col == 0:
                            enabled = False
                            try:
                                enabled = power is not None and float(power.value) > float(power.min)
                            except (AttributeError, RuntimeError, TypeError, ValueError):
                                pass
                            color = self.DEVICE_POWER_COLOR if enabled else 0
                        else:
                            color = self.DEVICE_COLOR
                    else:
                        color = self.DEVICE_COLOR if parameter is not None else 0
                    frame[cc] = (color, 0, ring, False)

                elif module == "Clip Launch":
                    if self._alt_mode and col == 3:
                        index = self._scene_offset + clip_rows.index(row)
                        if index < len(scenes):
                            state = self._scene_state(index, all_scene_tracks, scene_slots)
                        else:
                            state = (0, 0, None, True)
                    else:
                        try:
                            index = self._scene_index(row)
                            state = self._clip_state(clip_slots[col][index])
                        except (AttributeError, IndexError, RuntimeError, TypeError, ValueError):
                            state = (0, 0, None, False)
                    # The ring belongs to the inherited rotary function, not
                    # clip progress. Clip/scene colour and flash state remain.
                    frame[cc] = (state[0], state[1], ring, state[3])

                elif module == "Arm":
                    if self._alt_mode and col == 3:
                        # No Master Arm; keep the inherited Master Volume/Pan
                        # ring available where applicable, with no button LED.
                        if ring is not None:
                            frame[cc] = (0, 0, ring, False)
                        continue
                    track = columns[col]
                    try:
                        if track is not None and bool(getattr(track, "can_be_armed", False)):
                            active = bool(getattr(track, "arm"))
                            frame[cc] = (self.ARM_COLOR, 4 if active else 0, ring, False)
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        pass

                elif module == "Solo":
                    if self._alt_mode and col == 3:
                        if ring is not None:
                            frame[cc] = (0, 0, ring, False)
                        continue
                    track = columns[col]
                    try:
                        if track is not None:
                            active = bool(getattr(track, "solo"))
                            frame[cc] = (self.SOLO_COLOR, 4 if active else 0, ring, False)
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        pass

                elif module == "Mute":
                    if self._alt_mode and col == 3:
                        # Preserve the established Master Unsolo push action.
                        frame[cc] = (self.UNSOLO_COLOR, 4 if any_soloed else 0, ring, False)
                        continue
                    track = columns[col]
                    if track is None:
                        continue
                    try:
                        muted = bool(track.mute)
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        muted = False
                    frame[cc] = (self._monitor_color(track), 4 if muted else 0, ring, False)

                elif module == "Stop":
                    if columns[col] is not None or (self._alt_mode and col == 3):
                        frame[cc] = (self.STOP_COLOR, 0, ring, False)

                # Blank and unavailable push functions must not erase an
                # independently assigned Volume/Pan/Send white ring.
                if cc not in frame and ring is not None:
                    frame[cc] = (0, 0, ring, False)

        self._frame = frame
        self._refresh_highlight(clip_rows, tracks, scenes)

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
        if self._closed:
            return
        now = time.monotonic()
        beat = None
        ring_samples = {}
        for cc in range(16):
            if self._closed:
                return
            color, rate, ring_data, scene = self._frame.get(cc, (0, 0, None, False))
            if scene and rate:
                # Playing: green 1/4-note flash. Queued: pink 1/16-note.
                # Recording: red 1/16-note. Stopped occupied: solid yellow.
                # Empty scene: completely dark.
                if beat is None:
                    beat = self._beat_position()
                is_off = int(beat * rate) % 2 == 1
            else:
                # Leave previously accepted Clip Launch flashing cadence intact.
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
            # A refresh_state() request made during a render-only tick is
            # deferred here, rather than nesting a scan/render inside that tick.
            if self._refresh_pending:
                self._refresh_pending = False
                self._ticks_until_scan = 0
            self._ticks_until_scan -= 1
            if self._ticks_until_scan <= 0:
                self._refresh_all()
            else:
                self._render_frame(update_rings=False)
        except Exception as exc:
            self.log_message("MF4TRKBento Beta 3 refresh error: %s" % exc)
        finally:
            if tick_started is not None:
                self._record_duration("tick", max(0.0, time.monotonic() - tick_started))
            self._tick_running = False
            self._schedule_tick()

    def _refresh_highlight(self, rows, tracks, scenes):
        if self._closed:
            return
        if not rows or not tracks or not scenes:
            self._close_highlight()
            self._highlight_error = None
            return
        size = (min(self._clip_count(), len(tracks)), len(rows))
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
                    class BentoSessionComponent(SessionComponent):
                        def __init__(self, surface, num_tracks, num_scenes, **kwargs):
                            self._bento_surface = surface
                            SessionComponent.__init__(self, num_tracks, num_scenes, **kwargs)

                        def tracks_to_use(self):
                            return list(self._bento_surface._control_tracks())

                    component = BentoSessionComponent(self, size[0], size[1],
                                                      name="MF4TRKBento Clip Launch", is_root=False)
                    self._session_component = component
                    self._session_size = size
                    self.set_highlighting_session_component(component)
                    component.set_enabled(True)
                configuring = False
                self._last_highlight = None
            # Group changes recreate the component in _toggle_fx_mode;
            # keep the steady-state cache independent of transient LOM proxy ids.
            state = (self._fx_mode, track_offset, self._scene_offset)
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
            if self._tick_running and not self._refresh_running:
                # Do not run a nested scan/render from a render-only tick.
                # The next one-shot callback consumes this coalesced request.
                self._refresh_pending = True
                self._record_diagnostic("reentrant_refreshes")
            else:
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
        self._mute_volume_last_turn.clear()
        for cc in range(16):
            try:
                self._send(self.ROTARY_CH, cc, 0)
                self._send(self.PUSH_CH, cc, 0)
            except Exception:
                pass
        super(MF4TRKBento, self).disconnect()


def create_instance(c_instance):
    return MF4TRKBento(c_instance)
