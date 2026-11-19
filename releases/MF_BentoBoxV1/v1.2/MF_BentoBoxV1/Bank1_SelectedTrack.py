"""MF Selected Track Bento v0.1.18: four independent columns, exclusivity, original device parameter offset and lifecycle repair.

Bank 1: relative rotary CC 0..15 on channel 12; CC Hold pushes channel 11.
All four columns active. Hold top + twist bottom to switch modules; E1+E16 scrolls tracks. Standard RGB colors.
"""
import time
import Live
from _Framework.ControlSurface import ControlSurface
from _Framework.ButtonElement import ButtonElement
from _Framework.InputControlElement import MIDI_CC_TYPE
from _Framework.SessionComponent import SessionComponent


class MidiFighterTwisterCustom(ControlSurface):
    ROTARY_CHANNEL = 11
    PUSH_CHANNEL = 10
    COLUMNS = ((0, 4, 8, 12), (1, 5, 9, 13), (2, 6, 10, 14), (3, 7, 11, 15))
    MODES = ('Mixer Channel', 'Device Controls', '4 FX Sends', 'Master Mixer', 'VU / Beat', 'Clip Launcher', 'I/O', 'LED Diagnostics', 'Transport 1')
    DIAG_PALETTE = (0, 96, 52, 72, 76, 108, 68, 104, 32, 127)
    TRACK_TICKS = 2
    SWITCH_TICKS = 8
    DOUBLE_CLICK_SECONDS = 0.131
    VU_INTERVAL = 1
    # Semantic palette: values below are first-pass Extended/MF64 test candidates,
    # NOT manufacturer-certified numeric color codes. Calibrate on the user's device.
    # Keep semantic names stable; only this table changes between palettes.
    LED_COLORS = {
        'red': 72, 'green': 76, 'yellow': 108, 'orange': 64,
        'light_blue': 68, 'pink': 52, 'teal': 32,
        'purple': 96, 'light_purple': 104, 'dim_green': 88,
    }
    BLUE = LED_COLORS['light_blue']
    YELLOW = LED_COLORS['yellow']
    RED = LED_COLORS['red']
    PURPLE = LED_COLORS['purple']
    PINK = LED_COLORS['pink']
    VU_GREEN = LED_COLORS['green']
    VU_YELLOW = LED_COLORS['yellow']
    VU_ORANGE = LED_COLORS['orange']
    VU_RED = LED_COLORS['red']
    VU_ACTIVE_THRESHOLD = 0.015
    # v0.1.20: isolate first FX-module RGB encoder from transient yellow feedback.
    FX_COLOR_DIAGNOSTIC = False  # Legacy switch retained for compatibility; no longer used

    def __init__(self, c_instance):
        super().__init__(c_instance)
        self._controls = []
        self._listeners = []
        self._rotary_handlers = []
        self._push_handlers = []
        self._last_midi = {}
        self._selected_track = None
        self._selected_device = None
        self._mode = 0
        self._mode3 = 1
        self._e3_held = False
        self._e3_consumed = False
        self._switch3_accum = 0
        self._column3_listeners = []
        self._e1_held = False
        self._e1_consumed = False
        self._e2_held = False
        self._e2_consumed = False
        self._track_accum = 0
        self._switch_accum = 0
        self._volume_pending = False
        self._volume_token = 0
        self._volume_deadline = 0.0
        self._volume_feedback_deadline = 0.0
        self._pan_held = False
        self._pan_turned = False
        self._solo_pending = False
        self._solo_token = 0
        self._solo_deadline = 0.0
        self._monitor_accum = 0
        self._monitor_feedback_until = 0.0
        self._send_offset = 0
        self._vu_running = True
        self._device_params = ()
        self._device_bank = 0
        self._device_identity = None
        self._disconnected = False
        self._identify_generation = 0
        self._identify_active = None
        self._device_override = None
        self._modes = [0, 2, 1, 1]
        self._held = [False] * 16
        self._consumed = [False] * 16
        self._switch_steps = [0] * 4
        self._device_banks = [0] * 4
        self._column_listeners = [[] for _ in range(4)]
        self._mixer_pan_held = None
        self._mixer_combo_used = [False] * 4
        self._mixer_pan_turned = False
        self._active_device = None
        self._device_columns = [2, 3]
        self._device_page = 0
        self._fx_offsets = {1: 2}
        self._fx_shared_offset = 0
        self._button_down = [False] * 16
        self._press_generation = [-1] * 16
        self._press_track = [None] * 16
        self._transport_last = None
        self._binding_generation = 0
        self._device_feedback_until = 0.0
        self._device_feedback_cc = None
        self._clip_warning_until = 0.0
        self._mixer_combo_used = [False] * 4
        self._diag_indices = [[1, 2, 3, 4] for _ in range(4)]
        self._diag_channel = [10] * 4  # 0-based: channel 11, the usual push RGB channel
        self._diag_pulse = [False] * 4
        self._diag_last = {}
        self._fx_rgb_trace = {}
        # Runtime-calibrated FX color. Startup defaults to hardware-tested 104. No disk persistence.
        self._fx_color_value = self.LED_COLORS['light_purple']
        self._session_highlight_error_reported = False
        self._track_category = 0  # 0=tracks, 1=returns, 2=master
        self._last_regular_track = None
        self._category_guard_until = 0.0
        self._vu_modes = [0] * 4  # selected VU, beat/bar, master VU
        self._vu_peak_until = [0.0] * 4
        self._vu_scroll_hold = [0] * 4
        self._clip_scene_offset = 0
        self._clip_track_start = None
        self._clip_scroll_accum = [0] * 4
        self._clip_suppress_release = [False] * 16
        self._clip_ack_until = [0.0] * 16
        self._session_highlight_state = None
        self._session_component = None
        self._session_component_size = None
        with self.component_guard():
            for cc in range(16):
                handler = self._make_rotary(cc)
                element = ButtonElement(True, MIDI_CC_TYPE, self.ROTARY_CHANNEL, cc,
                                        name='MF3_Rotary_{}'.format(cc))
                element.add_value_listener(handler)
                self._controls.append((element, handler))
            for cc in range(16):
                handler = self._make_push(cc)
                element = ButtonElement(True, MIDI_CC_TYPE, self.PUSH_CHANNEL, cc,
                                        name='MF3_Push_{}'.format(cc))
                element.add_value_listener(handler)
                self._controls.append((element, handler))
            song = self.song()
            self._listen(song.view, 'selected_track', self._track_changed)
            self._listen(song, 'return_tracks', self._structure_changed)
            self._listen(song, 'tracks', self._structure_changed)
            self._track_changed()
            self.schedule_message(self.VU_INTERVAL, self._vu_tick)
            self.show_message('MF Bento v2.1.1 EXP | Transport and VU LED test')
            self._startup_sweep()

    def _listen(self, obj, prop, callback):
        add = getattr(obj, 'add_{}_listener'.format(prop), None)
        if add is None:
            return False
        try:
            add(callback)
            self._listeners.append((obj, prop, callback))
            return True
        except Exception as exc:
            self.log_message('MF3 listener {}: {}'.format(prop, exc))
            return False

    def _unlisten(self, listeners):
        for obj, prop, callback in reversed(listeners):
            try:
                has = getattr(obj, '{}_has_listener'.format(prop), None)
                remove = getattr(obj, 'remove_{}_listener'.format(prop), None)
                if remove and (has is None or has(callback)):
                    remove(callback)
            except Exception:
                pass

    def _make_rotary(self, cc):
        return lambda value: self._rotate(cc, value)

    def _make_push(self, cc):
        return lambda value: self._push(cc, value)

    def _direction(self, value):
        # Hardware Relative ENC 3FH/41H: left=63, right=65.
        return 1 if int(value) == 65 else -1 if int(value) == 63 else 0

    def _rotate(self, cc, value):
        self._cancel_identification()
        direction = self._direction(value)
        if not direction:
            return
        if cc == 15 and self._e1_held:
            self._e1_consumed = True
            if self._track_accum and (self._track_accum > 0) != (direction > 0):
                self._track_accum = 0
            self._track_accum += direction
            if abs(self._track_accum) >= self.TRACK_TICKS:
                self._track_accum = 0
                self._scroll_track(direction)
            return
        if cc == 13 and self._e2_held:
            self._e2_consumed = True
            if self._switch_accum and (self._switch_accum > 0) != (direction > 0):
                self._switch_accum = 0
            self._switch_accum += direction
            if abs(self._switch_accum) >= self.SWITCH_TICKS:
                self._switch_accum = 0
                self._switch_mode(direction)
            return
        if cc == 14 and self._e3_held:
            self._e3_consumed = True
            if self._switch3_accum and (self._switch3_accum > 0) != (direction > 0):
                self._switch3_accum = 0
            self._switch3_accum += direction
            if abs(self._switch3_accum) >= self.SWITCH_TICKS:
                self._switch3_accum = 0
                self._switch_column3(direction)
            return
        if cc == 8 and self._pan_held:
            self._monitor_turn(direction)
            return
        if cc in self.COLUMNS[0]:
            if cc == 0 and self._e1_held:
                self._e1_consumed = True
                return  # C1 deliberately fixed; do not accidentally change send A.
            self._turn_mixer(cc, direction)
        elif cc in self.COLUMNS[2]:
            if self._mode3 == 0:
                self._turn_mixer(self._column3_to2(cc), direction)
            elif self._mode3 == 1:
                self._nudge(self._column3_device_param(cc), direction)
            elif self._mode3 == 2:
                self._turn_fx(self._column3_to2(cc), direction)
            else:
                self._nudge(self._master_param(cc), direction)
        elif cc in self.COLUMNS[1]:
            if self._mode == 0:
                self._turn_mixer(cc, direction)
            elif self._mode == 1:
                self._turn_device(cc, direction)
            elif self._mode == 2:
                self._turn_fx(cc, direction)
            else:
                self._nudge(self._master_param(self.COLUMNS[2][self.COLUMNS[1].index(cc)]), direction)

    def _push(self, cc, value):
        self._cancel_identification()
        down = bool(int(value))
        if cc == 0:
            if down:
                self._e1_held = True
                self._e1_consumed = False
                self._track_accum = 0
            else:
                self._e1_held = False
                if not self._e1_consumed:
                    self._mixer_push(cc)
            return
        if cc == 1:
            if down:
                self._e2_held = True
                self._e2_consumed = False
                self._switch_accum = 0
            else:
                self._e2_held = False
                if not self._e2_consumed:
                    self._module_push(cc)
                self._refresh_leds()
            return
        if cc == 2:
            if down:
                self._e3_held = True
                self._e3_consumed = False
                self._switch3_accum = 0
            else:
                self._e3_held = False
                if not self._e3_consumed:
                    self._column3_push(cc)
                self._refresh_leds()
            return
        if cc in self.COLUMNS[2]:
            if down:
                self._column3_push(cc)
            return
        if cc == 8:
            if down:
                self._pan_held = True
                self._pan_turned = False
                self._monitor_accum = 0
                self._monitor_feedback_until = time.monotonic() + 0.3
            else:
                self._pan_held = False
                if not self._pan_turned:
                    self._pan_click()
                self._monitor_feedback_until = time.monotonic() + 0.3
            return
        if cc in (12, 13) and (cc == 12 or self._mode == 0):
            if down:
                self._volume_click()
            return
        if not down:
            return
        if cc in self.COLUMNS[0]:
            self._mixer_push(cc)
        elif cc in self.COLUMNS[1]:
            self._module_push(cc)

    def _module_push(self, cc):
        if self._mode == 0:
            self._mixer_push(cc)
        elif self._mode == 1:
            if cc == 1:
                power = self._device_power(self._selected_device)
                if power is not None:
                    self._toggle_parameter(power)
            elif cc == 5:
                self._device_bank += 1
                self._rebind_device_params()
                self._announce_device_bank()
            elif cc in (9, 13):
                self._navigate_device(-1 if cc == 9 else 1)
        elif self._mode == 2:
            param = self._fx_param(cc)
            if param is not None:
                self._reset(param)
        elif cc in (9, 13):
            self._reset(self._master_param(self.COLUMNS[2][self.COLUMNS[1].index(cc)]))

    def _bank_sends(self, direction):
        """Shared offset for Mixer A/B and a future FX column C-F."""
        track = self._selected_track
        sends = tuple(getattr(getattr(track, 'mixer_device', None), 'sends', ()))
        maximum = max(0, len(sends) - 2)
        target = max(0, min(maximum, self._send_offset + direction))
        if target == self._send_offset:
            return
        self._send_offset = target
        # Rebind parameter listeners to the new send positions.
        self._track_changed()
        first = chr(65 + target) if target < 26 else str(target + 1)
        second = chr(65 + target + 1) if target + 1 < 26 else str(target + 2)
        self.show_message('MF Bento | Mixer sends {}-{}'.format(first, second))

    def _selected(self):
        try:
            return self.song().view.selected_track
        except Exception:
            return None

    def _mixer_param(self, cc):
        track = self._selected_track
        if track is None or not hasattr(track, 'mixer_device'):
            return None
        mixer = track.mixer_device
        if cc in (8, 9):
            return mixer.panning
        if cc in (12, 13):
            return mixer.volume
        # MIDI-only tracks cannot feed audio Return sends; match FX module.
        if track is self.song().master_track or not bool(getattr(track, 'has_audio_output', True)):
            return None
        send_index = self._send_offset + (0 if cc in (0, 1) else 1)
        try:
            return mixer.sends[send_index] if send_index < len(mixer.sends) else None
        except Exception:
            return None

    def _turn_mixer(self, cc, direction):
        self._nudge(self._mixer_param(cc), direction)
        if cc in (12, 13):
            self._volume_feedback_deadline = time.monotonic() + 0.45

    def _mixer_push(self, cc):
        track = self._selected_track
        if track is None:
            return
        try:
            if cc == 0:
                self._bank_sends(1)
            elif cc == 4:
                self._bank_sends(-1)
            elif cc in (1, 5):
                self._reset(self._mixer_param(cc))
            elif cc in (8, 9):
                self._solo_toggle()
            elif cc in (12, 13):
                self._volume_click()
        except Exception as exc:
            self.log_message('MF3 mixer push: {}'.format(exc))
        self._refresh_leds()

    def _volume_click(self):
        # v1.8 gesture: single press = exclusive arm; double press = mute.
        now = time.monotonic()
        if self._volume_pending and now <= self._volume_deadline:
            self._volume_pending = False
            self._volume_token += 1
            track = self._selected_track
            if track is not None and hasattr(track, 'mute'):
                try:
                    track.mute = not bool(track.mute)
                except Exception:
                    pass
            self._refresh_leds()
            return
        self._volume_pending = True
        self._volume_token += 1
        token = self._volume_token
        self._volume_deadline = now + self.DOUBLE_CLICK_SECONDS
        self.schedule_message(1, lambda: self._finish_volume_click(token))

    def _finish_volume_click(self, token):
        if not self._volume_pending or token != self._volume_token:
            return
        if time.monotonic() < self._volume_deadline:
            self.schedule_message(1, lambda: self._finish_volume_click(token))
            return
        self._volume_pending = False
        track = self._selected_track
        if track is None or not bool(getattr(track, 'can_be_armed', False)):
            return
        try:
            target = not bool(track.arm)
            if target:
                for other in tuple(self.song().tracks):
                    if other is not track and bool(getattr(other, 'can_be_armed', False)) and bool(other.arm):
                        other.arm = False
            track.arm = target
        except Exception as exc:
            self.log_message('MF3 arm: {}'.format(exc))
        self._refresh_leds()

    def _pan_click(self):
        now = time.monotonic()
        if self._solo_pending and now <= self._solo_deadline:
            self._solo_pending = False
            self._solo_token += 1
            self._reset(self._mixer_param(8), 0.0)
            self.show_message('Bento | Pan reset to center')
            self._refresh_leds()
            return
        self._solo_pending = True
        self._solo_token += 1
        token = self._solo_token
        self._solo_deadline = now + self.DOUBLE_CLICK_SECONDS
        self.schedule_message(1, lambda: self._finish_pan_click(token))

    def _finish_pan_click(self, token):
        if not self._solo_pending or token != self._solo_token or self._disconnected:
            return
        if time.monotonic() < self._solo_deadline:
            self.schedule_message(1, lambda: self._finish_pan_click(token))
            return
        self._solo_pending = False
        self._solo_toggle()

    def _solo_toggle(self):
        track = self._selected_track
        if track is None or track == self.song().master_track:
            return
        try:
            target = not bool(track.solo)
            if target:
                for other in tuple(self.song().tracks) + tuple(self.song().return_tracks):
                    if other is not track and hasattr(other, 'solo') and other.solo:
                        other.solo = False
            track.solo = target
        except Exception as exc:
            self.log_message('MF3 solo: {}'.format(exc))
        self._refresh_leds()

    def _monitor_turn(self, direction):
        self._pan_turned = True
        self._monitor_accum += direction
        if abs(self._monitor_accum) < 20:
            return
        step = 1 if self._monitor_accum > 0 else -1
        self._monitor_accum = 0
        track = self._selected_track
        if track is None or not bool(getattr(track, 'can_be_armed', False)):
            return
        try:
            states = (Live.Track.Track.monitoring_states.IN, Live.Track.Track.monitoring_states.AUTO, Live.Track.Track.monitoring_states.OFF)
            current = states.index(track.current_monitoring_state)
            new_index = max(0, min(2, current + step))
            track.current_monitoring_state = states[new_index]
            self._monitor_feedback_until = time.monotonic() + 0.3
            self.show_message('MF3 Monitor: {}'.format(('IN', 'AUTO', 'OFF')[new_index]))
        except Exception as exc:
            self.log_message('MF3 monitor: {}'.format(exc))

    def _vu_tick(self):
        if self._disconnected or not self._vu_running:
            return
        try:
            track = self._selected_track
            if track is not None:
                self._refresh_leds()
                for cc in (12, 13):
                    if cc == 13 and self._mode != 0:
                        continue
                    param = self._mixer_param(cc)
                    fader = self._ring(param)
                    if time.monotonic() < self._volume_feedback_deadline:
                        ring = fader
                    else:
                        try:
                            has_audio = bool(getattr(track, 'has_audio_output', True))
                            level = max(float(getattr(track, 'output_meter_left', 0.0)),
                                        float(getattr(track, 'output_meter_right', 0.0)))
                            meter_level = level if has_audio else 0.0
                            ring = max(0, min(127, int(round(level * 127.0)))) if level >= 0.015 else fader
                        except Exception:
                            ring = fader
                    self._send_cc(self.ROTARY_CHANNEL, cc, ring)
        finally:
            if not self._disconnected and self._vu_running:
                self.schedule_message(self.VU_INTERVAL, self._vu_tick)

    def _device_for_track(self):
        track = self._selected_track
        if track is None:
            return None
        devices = []
        def collect(owner):
            for device in tuple(getattr(owner, 'devices', ())):
                devices.append(device)
                for chain in tuple(getattr(device, 'chains', ())):
                    collect(chain)
        collect(track)
        selected = getattr(getattr(track, 'view', None), 'selected_device', None)
        if selected in devices:
            return selected
        if self._device_override in devices:
            return self._device_override
        return devices[0] if devices else None

    def _device_power(self, device):
        if device is None:
            return None
        params = tuple(getattr(device, 'parameters', ()))
        if not params:
            return None
        # Live exposes the device activator at index zero. Localized names
        # differ, so do not rely on English labels for rotary indexing.
        return params[0]

    def _device_all_params(self):
        device = self._selected_device
        params = tuple(getattr(device, 'parameters', ()))
        power = self._device_power(device)
        return tuple(p for p in params if p is not power)

    def _navigate_device(self, direction):
        track = self._selected_track
        if track is None:
            return
        try:
            devices = tuple(getattr(track, 'devices', ()))
            if not devices:
                self.show_message('Bento | No devices on selected track')
                return
            current = self._selected_device
            index = devices.index(current) if current in devices else (-1 if direction > 0 else len(devices))
            new_index = max(0, min(len(devices) - 1, index + direction))
            target = devices[new_index]
            if target is current:
                self.show_message('Bento | {} | End of device chain'.format(getattr(target, 'name', 'Device')))
                return
            # Never assign Track.View.selected_device: read-only in Live 13.
            self.song().view.selected_track = track
            self.song().view.select_device(target)
            # Live may update Track.View.selected_device asynchronously.
            # Bind explicitly to the requested target now; selection listener
            # will reconcile with Live on its next notification.
            self._device_override = target
            self._device_bank = 0
            self._deactivate_column2()
            self._selected_device = target
            self._rebind_device_params()
            self.show_message('Bento | Device {}/{} | {}'.format(new_index + 1, len(devices), getattr(target, 'name', 'Device')))
        except Exception as exc:
            self.log_message('MF Bento device navigation failed: {}'.format(exc))
            self.show_message('Bento | Device navigation failed (see Log.txt)')

    def _announce_device_bank(self):
        params = self._device_all_params()
        total = len(params)
        banks = max(1, (total + 3) // 4)
        first = self._device_bank * 4 + 1 if total else 0
        last = min(total, first + 3) if total else 0
        name = getattr(self._selected_device, 'name', 'No device')
        self.show_message('Bento | {} | Bank {}/{} | Parameters {}-{}'.format(name, self._device_bank + 1, banks, first, last))

    def _rebind_device_params(self):
        if self._mode != 1:
            return
        active = list(self._column2_listeners)
        self._unlisten(active)
        self._listeners = [item for item in self._listeners if item not in active]
        self._column2_listeners = []
        params = self._device_all_params()
        bank_count = max(1, (len(params) + 3) // 4)
        self._device_bank %= bank_count
        self._device_params = params[self._device_bank * 4:self._device_bank * 4 + 4]
        observed = list(self._device_params)
        power = self._device_power(self._selected_device)
        if power is not None:
            observed.append(power)
        for param in observed:
            def changed():
                if not self._disconnected and self._mode == 1:
                    self._refresh_leds()
            if self._listen(param, 'value', changed):
                self._column2_listeners.append(self._listeners[-1])
        # Force both LED channels to be sent after remapping, including zeros.
        for cc in self.COLUMNS[1]:
            self._last_midi.pop((self.ROTARY_CHANNEL, cc), None)
            self._last_midi.pop((self.PUSH_CHANNEL, cc), None)
        self._refresh_leds()

    def _device_param(self, cc):
        try:
            index = self.COLUMNS[1].index(cc)
            return self._device_params[index]
        except (IndexError, ValueError):
            return None

    def _turn_device(self, cc, direction):
        self._nudge(self._device_param(cc), direction)

    def _fx_param(self, cc):
        track = self._selected_track
        if track is None or not hasattr(track, 'mixer_device'):
            return None
        try:
            index = self.COLUMNS[1].index(cc)
            index += self._send_offset + 2
            return track.mixer_device.sends[index] if index < len(track.mixer_device.sends) else None
        except (ValueError, IndexError):
            return None

    def _turn_fx(self, cc, direction):
        self._nudge(self._fx_param(cc), direction)

    def _nudge(self, param, direction):
        if param is None or not getattr(param, 'is_enabled', True):
            return
        try:
            if getattr(param, 'is_quantized', False):
                step = 1.0
            else:
                step = (float(param.max) - float(param.min)) / 128.0
            param.value = max(float(param.min), min(float(param.max),
                                    float(param.value) + step * direction))
        except Exception as exc:
            self.log_message('MF3 parameter nudge: {}'.format(exc))

    def _reset(self, param, target=None):
        if param is None or not getattr(param, "is_enabled", True):
            return
        try:
            param.value = float(param.default_value if target is None else target)
        except Exception:
            pass

    def _toggle_parameter(self, param):
        try:
            midpoint = (float(param.min) + float(param.max)) / 2.0
            param.value = float(param.min if float(param.value) > midpoint else param.max)
        except Exception:
            pass

    def _switch_mode(self, direction):
        new = self._mode
        for _ in range(len(self.MODES)):
            new = (new + direction) % len(self.MODES)
            if new == 0 and self._mode3 == 0:
                continue
            if new == 3 and self._mode3 == 3:
                continue
            if new == 2 and self._mode3 == 2:
                continue
            break
        if new == self._mode:
            return
        self._deactivate_column2()
        self._mode = new
        self._activate_column2()
        self.show_message('MF Bento | Column 2: {}'.format(self.MODES[new]))


    def _column3_to2(self, cc):
        return self.COLUMNS[1][self.COLUMNS[2].index(cc)]

    def _master_param(self, cc):
        master = self.song().master_track
        mixer = master.mixer_device
        index = self.COLUMNS[2].index(cc)
        if index == 2:
            return mixer.panning
        if index == 3:
            return mixer.volume
        try:
            return mixer.sends[index] if index < len(mixer.sends) else None
        except Exception:
            return None

    def _clear_column3_listeners(self):
        active = self._column3_listeners
        self._unlisten(active)
        self._listeners = [item for item in self._listeners if item not in active]
        self._column3_listeners = []

    def _switch_column3(self, direction):
        choices = len(self.MODES)
        candidate = self._mode3
        for _ in range(choices):
            candidate = (candidate + direction) % choices
            # One track mixer, one master mixer; at most two FX modules.
            if candidate == 0 and self._mode == 0:
                continue
            if candidate == 3 and self._mode == 3:
                continue
            if candidate == 2 and self._mode == 2:
                continue
            break
        self._mode3 = candidate
        self._refresh_leds()
        self.show_message('MF Bento | Column 3: {}'.format(self.MODES[candidate]))

    def _column3_push(self, cc):
        mapped = self._column3_to2(cc)
        if self._mode3 == 0:
            self._mixer_push(mapped)
        elif self._mode3 == 1:
            # Shared device focus; independent column-3 physical controls.
            if cc == 2:
                self._toggle_parameter(self._device_power(self._selected_device))
            elif cc == 6:
                self._device_bank += 1
                self._rebind_device_params()
                self._announce_device_bank()
            elif cc in (10, 14):
                self._navigate_device(-1 if cc == 10 else 1)
        elif self._mode3 == 2:
            self._reset(self._fx_param(mapped))
        else:
            if cc in (10, 14):
                self._reset(self._master_param(cc))
        self._refresh_leds()

    def _cancel_identification(self):
        if self._identify_active is not None:
            self._identify_generation += 1
            self._identify_active = None
            for cc in (2, 3, 6, 7, 10, 11, 14, 15):
                self._send_cc(self.PUSH_CHANNEL, cc, 0)
            self._last_midi.clear()
            self._refresh_leds()

    def _startup_sweep(self):
        """One-time, nonflashing left-to-right color sweep, then restore LEDs."""
        self._identify_generation += 1
        generation = self._identify_generation
        self._identify_active = -1
        columns = ((0, 4, 8, 12), (1, 5, 9, 13), (2, 6, 10, 14), (3, 7, 11, 15))
        colors = (self.BLUE, self.YELLOW, self.PURPLE, self.LED_COLORS['teal'])
        def step(index):
            if self._disconnected or generation != self._identify_generation:
                return
            if index >= len(columns):
                self._identify_active = None
                for cc in (2, 3, 6, 7, 10, 11, 14, 15):
                    self._send_cc(self.PUSH_CHANNEL, cc, 0)
                self._last_midi.clear()
                self._refresh_leds()
                return
            for cc in columns[index]:
                self._send_cc(self.PUSH_CHANNEL, cc, colors[index])
            self.schedule_message(3, lambda: step(index + 1))
        step(0)

    def _deactivate_column2(self):
        # Parameter listeners are isolated by control ownership, and only active
        # module listeners are retained. Never remove the primary song listeners.
        active = getattr(self, '_column2_listeners', [])
        self._unlisten(active)
        self._listeners = [item for item in self._listeners if item not in active]
        self._column2_listeners = []
        self._device_params = ()
        self._selected_device = None
        for cc in self.COLUMNS[1]:
            self._send_cc(self.ROTARY_CHANNEL, cc, 0, force=True)
            self._send_cc(self.PUSH_CHANNEL, cc, 0, force=True)

    def _activate_column2(self):
        self._column2_listeners = []
        if self._mode == 1:
            self._selected_device = self._device_for_track()
            self._rebind_device_params()
        else:
            for cc in self.COLUMNS[1]:
                param = self._mixer_param(cc) if self._mode == 0 else self._fx_param(cc) if self._mode == 2 else self._master_param(self.COLUMNS[2][self.COLUMNS[1].index(cc)])
                if param is None:
                    continue
                def changed():
                    if not self._disconnected:
                        self._refresh_leds()
                if self._listen(param, 'value', changed):
                    self._column2_listeners.append(self._listeners[-1])
        self._refresh_leds()

    def _track_changed(self):
        if self._disconnected:
            return
        self._deactivate_column2()
        self._clear_column3_listeners()
        active = getattr(self, '_column1_listeners', [])
        self._unlisten(active)
        self._listeners = [item for item in self._listeners if item not in active]
        self._column1_listeners = []
        self._volume_pending = False
        self._volume_token += 1
        self._selected_track = self._selected()
        self._clamp_fx_window()
        self._device_override = None
        self._solo_pending = False
        self._solo_token += 1
        self._device_bank = 0
        if self._selected_track is not None:
            for prop in (() if self._selected_track is self.song().master_track else ('arm', 'mute')):
                def state_changed():
                    if not self._disconnected:
                        self._refresh_leds()
                if self._listen(self._selected_track, prop, state_changed):
                    self._column1_listeners.append(self._listeners[-1])
            try:
                view = self._selected_track.view
                if self._listen(view, 'selected_device', self._device_selection_changed):
                    self._column1_listeners.append(self._listeners[-1])
            except Exception:
                pass
        for cc in self.COLUMNS[0]:
            param = self._mixer_param(cc)
            if param is None:
                continue
            def changed():
                if not self._disconnected:
                    self._refresh_leds()
            if self._listen(param, 'value', changed):
                self._column1_listeners.append(self._listeners[-1])
        self._activate_column2()
        self._refresh_leds()

    def _device_selection_changed(self):
        if self._mode == 1:
            device = self._device_for_track()
            if device is not self._selected_device:
                self._device_bank = 0
                self._deactivate_column2()
                self._activate_column2()
            else:
                self._refresh_leds()

    def _structure_changed(self):
        self._track_changed()

    def _scroll_track(self, direction):
        try:
            tracks = list(self.song().visible_tracks)
            current = self._selected()
            if not tracks:
                return
            if current not in tracks:
                index = -1 if direction > 0 else len(tracks)
            else:
                index = tracks.index(current)
            target = tracks[max(0, min(len(tracks)-1, index + direction))]
            if target is not current:
                self.song().view.selected_track = target
                self.show_message('MF Build 3 | Track: {}'.format(target.name))
        except Exception as exc:
            self.log_message('MF3 track scroll: {}'.format(exc))

    def _send_cc(self, channel, cc, value, force=False):
        value = max(0, min(127, int(value)))
        key = (channel, cc)
        if force or self._last_midi.get(key) != value:
            self._last_midi[key] = value
            self._send_midi((0xB0 | channel, cc, value))

    def _ring(self, param):
        if param is None:
            return 0
        try:
            span = float(param.max) - float(param.min)
            if span <= 0:
                return 0
            return max(0, min(127, int(round(127.0 *
                       (float(param.value)-float(param.min)) / span))))
        except Exception:
            return 0

    def disconnect(self):
        self._disconnected = True
        self._identify_generation += 1
        self._identify_active = None
        self._vu_running = False
        self._volume_pending = False
        self._solo_pending = False
        self._clear_column3_listeners()
        self._unlisten(self._listeners)
        self._listeners = []
        for control, callback in self._controls:
            try:
                control.remove_value_listener(callback)
            except Exception:
                pass
        for cc in self.COLUMNS[0] + self.COLUMNS[1] + self.COLUMNS[2]:
            self._send_cc(self.ROTARY_CHANNEL, cc, 0, force=True)
            self._send_cc(self.PUSH_CHANNEL, cc, 0, force=True)
        super().disconnect()

    # v0.1.10: all routing, banks, listeners and LEDs use the same per-column model.
    def _col(self, cc):
        return cc % 4

    def _row(self, cc):
        return cc // 4

    def _mode_for(self, cc):
        return self._modes[self._col(cc)]

    def _device_all_params(self):
        # Restore original Selected Track Mixer / v0.1.6 indexing exactly:
        # parameters[0] is the activator, controls begin at parameters[1].
        device = self._active_device
        params = tuple(getattr(device, 'parameters', ())) if device is not None else ()
        return params[1:] if params else ()

    def _column_param(self, col, row):
        track = self._selected_track
        mode = self._modes[col]
        if mode == 1:
            params = self._device_all_params()
            index = (self._device_page + self._device_columns.index(col)) * 4 + row
            return params[index] if index < len(params) else None
        if mode == 6:
            return None
        if mode == 3:
            try:
                mixer = self.song().master_track.mixer_device
                return mixer.panning if row == 2 else mixer.volume if row == 3 else None
            except Exception:
                return None
        if track is None:
            return None
        try:
            mixer = track.mixer_device
            if mode == 0:
                if row == 2:
                    return mixer.panning
                if row == 3:
                    return mixer.volume
                # Use the same audio eligibility as the dedicated FX Sends module.
                if track is self.song().master_track or not bool(getattr(track, 'has_audio_output', True)):
                    return None
                index = self._fx_shared_offset + row  # shared bank, first two sends
            else:
                fx_columns = [i for i, m in enumerate(self._modes) if m == 2]
                if track is self.song().master_track or not bool(getattr(track, 'has_audio_output', True)):
                    # MIDI-only tracks cannot send audio to Return FX. Avoid stale purple LEDs.
                    return None
                index = self._fx_shared_offset + (2 if 0 in self._modes else 0) + fx_columns.index(col) * 4 + row
            return mixer.sends[index] if index < len(mixer.sends) else None
        except Exception:
            return None

    def _rotate(self, cc, value):
        self._cancel_identification()
        direction = self._direction(value)
        if not direction:
            return
        col, row = self._col(cc), self._row(cc)
        # Track scroll always wins over E4+E16 module switching.
        if cc == 15 and self._held[0]:
            if time.monotonic() < self._category_guard_until:
                return
            self._consumed[0] = True
            if self._held[3]:
                self._consumed[3] = True
            self._track_accum = self._accumulate(self._track_accum, direction)
            if abs(self._track_accum) >= self.TRACK_TICKS:
                self._track_accum = 0
                self._scroll_track(direction)
            return
        # Clip scroll: hold bottom encoder, rotate TOP encoder. This never
        # collides with hold-top/twist-bottom column switching.
        if self._modes[col] == 5 and row == 0 and self._button_down[self.COLUMNS[col][3]]:
            self._clip_suppress_release[self.COLUMNS[col][3]] = True
            if self._held[col]:
                self._consumed[col] = True
            self._clip_scroll_accum[col] = self._accumulate(self._clip_scroll_accum[col], direction)
            if abs(self._clip_scroll_accum[col]) >= 4:
                self._clip_scroll_accum[col] = 0
                self._scroll_clips(col, direction)
            return
        if row == 3 and self._held[col]:
            self._switch_steps[col] = self._accumulate(self._switch_steps[col], direction)
            if abs(self._switch_steps[col]) >= self.SWITCH_TICKS:
                self._consumed[col] = True
                self._switch_steps[col] = 0
                self._switch_column(col, direction)
            return
        if self._held[col]:
            # Ignore rotary jitter while a top button is held. Only a completed
            # switch/scroll or another push consumes its ordinary release action.
            return
        if row == 2 and self._modes[col] == 6 and self._mixer_pan_held == col:
            self._mixer_pan_turned = True
            self._monitor_turn(direction)
            return
        if self._modes[col] == 6 and row == 3 and self._button_down[cc]:
            # E4 hold+turn changes monitor mode, not the selected output subrouting.
            self._monitor_accum = self._accumulate(self._monitor_accum, direction)
            if abs(self._monitor_accum) >= 12:
                self._monitor_accum = 0
                self._monitor_step(direction)
                self._refresh_leds()
            return
        if self._modes[col] == 7:
            self._diag_indices[col][row] = (self._diag_indices[col][row] + direction) % len(self.DIAG_PALETTE)
            self._diag_emit(col, 'twist E{}'.format(row + 1))
            return
        if self._modes[col] in (4, 5):
            return
        if self._modes[col] == 6:
            self._cycle_routing(row, direction)
            self._refresh_leds()
            return
        self._nudge(self._column_param(col, row), direction)
        if self._modes[col] == 0 and row == 3:
            self._volume_feedback_deadline = time.monotonic() + 0.45

    def _accumulate(self, prior, direction):
        return (prior if prior * direction > 0 else 0) + direction

    def _push(self, cc, value):
        self._cancel_identification()
        down = bool(int(value))
        if down == self._button_down[cc]:
            return
        self._button_down[cc] = down
        col, row = self._col(cc), self._row(cc)
        if down:
            self._press_generation[cc] = self._binding_generation
            self._press_track[cc] = self._selected_track
        elif self._press_track[cc] is not self._selected_track or self._press_generation[cc] != self._binding_generation:
            self._consumed[cc] = True
            self._clip_suppress_release[cc] = False
            if row == 0:
                self._held[col] = False
            return
        # Global E1 + E16 category switch must win over Mixer arm.
        if cc == 15 and down and self._held[0]:
            self._consumed[0] = True
            self._consumed[15] = True
            self._clip_suppress_release[15] = True
            self._switch_track_category()
            return
        # Top-held modifiers own their column before normal Mixer actions.
        if self._modes[col] == 0 and row in (2, 3) and self._held[col]:
            self._consumed[col] = True
            self._consumed[cc] = True
            return
        if self._modes[col] == 0 and row in (2, 3):
            other_cc = self.COLUMNS[col][5 - row]  # 2 <-> 3
            if down:
                self._mixer_combo_used[col] = False if not self._button_down[other_cc] else True
                if (self._button_down[other_cc] and self._press_generation[other_cc] == self._binding_generation
                        and self._press_track[other_cc] is self._selected_track):
                    # Second press executes immediately. Both releases are consumed.
                    if row == 2:
                        # Bottom held + E3: PAN RESET.
                        self._reset(self._column_param(col, 2), 0.0)
                    else:
                        # Second-from-bottom held, then bottom tapped: SOLO.
                        self._solo_toggle()
                    self._consumed[cc] = True
                    self._consumed[other_cc] = True
                else:
                    self._consumed[cc] = False
            else:
                if not self._consumed[cc] and not self._mixer_combo_used[col]:
                    if row == 2:
                        self._toggle_mute()
                    else:
                        self._toggle_arm()
                self._consumed[cc] = True
                if not self._button_down[other_cc]:
                    self._mixer_combo_used[col] = False
            self._refresh_leds()
            return
        if self._modes[col] == 5 and not down and self._clip_suppress_release[cc]:
            self._clip_suppress_release[cc] = False
            if row == 0:
                self._held[col] = False
                self._consumed[col] = True
            return
        # Clip Launcher Beta: hold E3 + tap E4 to stop the clip track.
        # Both button releases are consumed, preserving normal single-release launches.
        if self._modes[col] == 5 and row == 3 and down:
            e3 = self.COLUMNS[col][2]
            if (self._button_down[e3] and self._press_generation[e3] == self._binding_generation
                    and self._press_track[e3] is self._selected_track):
                try:
                    target = self._clip_track(col)
                    if target is not None:
                        target.stop_all_clips()
                    self._clip_ack_until[cc] = time.monotonic() + 0.120
                except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                    self.log_message('Bento clip E3+E4 stop: {}'.format(exc))
                self._clip_suppress_release[e3] = True
                self._clip_suppress_release[cc] = True
                return
        # Stop the selected track using either E1 or E4 + a Clip column bottom.
        # E1+E16 remains the global track-category command. E1+E13 is
        # intentionally unavailable when column 1 is a Clip Launcher.
        if row == 3 and self._modes[col] == 5 and down and (self._held[0] or self._held[3]):
            if cc == 15 and self._held[0]:
                self._consumed[0] = True
                self._clip_suppress_release[cc] = True
                self._switch_track_category()
                return
            elif not (cc == 12 and self._held[0] and not self._held[3]):
                try:
                    self._selected_track.stop_all_clips()
                    self._clip_ack_until[cc] = time.monotonic() + 0.120
                except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                    self.log_message('Bento clip track stop: {}'.format(exc))
                for modifier in (0, 3):
                    if self._held[modifier]:
                        self._consumed[modifier] = True
                self._clip_suppress_release[cc] = True
                return
        if row == 0:
            if down:
                self._held[col] = True
                self._consumed[col] = False
                self._switch_steps[col] = 0
                if col == 0:
                    self._track_accum = 0
            else:
                self._held[col] = False
                if not self._consumed[col]:
                    if self._modes[col] == 7:
                        # Diagnostic E1 is globally intercepted as a modifier.
                        # Apply calibration on release so hold+twist still switches modules.
                        if self._diag_channel[col] == self.PUSH_CHANNEL:
                            self._fx_color_value = self.DIAG_PALETTE[self._diag_indices[col][0]]
                            self._fx_rgb_trace.clear()
                            for fx_col, fx_mode in enumerate(self._modes):
                                if fx_mode == 2:
                                    for fx_cc in self.COLUMNS[fx_col]:
                                        self._last_midi.pop((self.PUSH_CHANNEL, fx_cc), None)
                            self.log_message('Bento FX COLOR CALIBRATED: value={} midi_ch={}'.format(self._fx_color_value, self.PUSH_CHANNEL + 1))
                            self.show_message('Bento FX color set to {} (this session)'.format(self._fx_color_value))
                        else:
                            self.show_message('Bento FX calibration requires diagnostic MIDI channel 11')
                    elif self._modes[col] == 5:
                        self._launch_clip(col, row)
                    else:
                        self._column_push(col, row)
                self._refresh_leds()
            return
        if cc == 15 and self._held[0]:
            self._consumed[0] = True
            if down:
                self._clip_suppress_release[cc] = True
                self._switch_track_category()
            return
        if self._held[col]:
            self._consumed[col] = True
            return
        if self._modes[col] == 7:
            if down:
                if row == 0:
                    # Apply the color visibly selected on diagnostic E1 to FX Sends.
                    # The other three diagnostics remain unchanged.
                    if self._diag_channel[col] == self.PUSH_CHANNEL:
                        self._fx_color_value = self.DIAG_PALETTE[self._diag_indices[col][0]]
                        self._fx_rgb_trace.clear()
                        for fx_col, fx_mode in enumerate(self._modes):
                            if fx_mode == 2:
                                for fx_cc in self.COLUMNS[fx_col]:
                                    self._last_midi.pop((self.PUSH_CHANNEL, fx_cc), None)
                        self.log_message('Bento FX COLOR CALIBRATED: value={} midi_ch={}'.format(self._fx_color_value, self.PUSH_CHANNEL + 1))
                        self.show_message('Bento FX color set to {} (this session)'.format(self._fx_color_value))
                        self._refresh_leds()
                    else:
                        self.show_message('Bento FX calibration requires diagnostic MIDI channel 11')
                elif row == 1:
                    self._diag_channel[col] = 11 if self._diag_channel[col] == 10 else 10
                elif row == 2:
                    self._diag_pulse[col] = not self._diag_pulse[col]
                elif row == 3:
                    pass  # resend unchanged values on demand
                self._diag_emit(col, 'press E{}'.format(row + 1))
            return
        if self._modes[col] == 6 and row == 3:
            # Bottom encoder is the persistent monitor-status LED. Press alone
            # does not change monitoring; hold+turn does.
            if down:
                self._monitor_accum = 0
            self._refresh_leds()
            return
        if self._modes[col] == 5:
            # Clip launch is a single release-triggered action. No double-click
            # recognition or waiting timer is used by Clip Launcher controls.
            if not down and not self._held[col]:
                self._launch_clip(col, row)
            return
        if down and not self._held[col]:
            self._column_push(col, row)

    def _clamp_fx_window(self):
        track = self._selected_track
        try:
            sends = tuple(getattr(getattr(track, 'mixer_device', None), 'sends', ()))
            fx_count = self._modes.count(2)
            base = 2 if 0 in self._modes else 0
            maximum = max(0, len(sends) - base - fx_count * 4)
            self._fx_shared_offset = max(0, min(maximum, self._fx_shared_offset))
        except (AttributeError, RuntimeError, TypeError, ValueError):
            self._fx_shared_offset = 0

    def _bank_fx(self, col, direction):
        track = self._selected_track
        sends = tuple(getattr(getattr(track, 'mixer_device', None), 'sends', ()))
        fx_count = self._modes.count(2)
        base = 2 if 0 in self._modes else 0
        maximum = max(0, len(sends) - base - fx_count * 4)
        previous = self._fx_shared_offset
        self._fx_shared_offset = max(0, min(maximum, previous + direction))
        self._device_feedback_cc = self.COLUMNS[col][0 if direction < 0 else 1]
        self._device_feedback_until = time.monotonic() + 0.45
        if self._fx_shared_offset == previous:
            self.show_message('Bento | FX sends: {} limit'.format('Last' if direction > 0 else 'First'))
        else:
            self._bind_columns()
            self.show_message('Bento | FX sends shifted by {}'.format(self._fx_shared_offset))

    def _clip_columns(self):
        return [c for c, mode in enumerate(self._modes) if mode == 5]

    def _clip_track(self, col):
        # Every Clip Launcher column belongs to the SAME selected track.
        return self._selected_track if col in self._clip_columns() else None

    def _clip_index(self, col, row):
        return self._clip_scene_offset + self._clip_columns().index(col) * 4 + row

    def _update_clip_highlight(self):
        """Own Ableton's actual Session highlight box for the clip grid."""
        columns = self._clip_columns()
        if self._session_highlight_error_reported:
            return
        if not columns:
            if self._session_component is not None:
                try:
                    self._session_component.set_enabled(False)
                    self._session_component.disconnect()
                except (AttributeError, RuntimeError, TypeError):
                    pass
                self._session_component = None
                self._session_component_size = None
                self._session_highlight_state = None
            return
        try:
            tracks = tuple(self.song().visible_tracks)
            selected = self._selected_track
            if selected not in tracks:
                return
            track_offset = tracks.index(selected)
            scene_count = min(16, max(4, 4 * len(columns)))
            size = (1, scene_count)
            if self._session_component is None or self._session_component_size != size:
                if self._session_component is not None:
                    try:
                        self._session_component.set_enabled(False)
                        self._session_component.disconnect()
                    except (AttributeError, RuntimeError, TypeError):
                        pass
                component = SessionComponent(1, scene_count,
                                             name='MF Bento Clip Box',
                                             is_root=False,
                                             enable_skinning=True)
                self._session_component = component
                self._session_component_size = size
                self.set_highlighting_session_component(component)
                component.set_enabled(True)
                self._session_highlight_state = None
            state = (track_offset, self._clip_scene_offset)
            if state != self._session_highlight_state:
                self._session_component.set_offsets(track_offset, self._clip_scene_offset)
                self._session_highlight_state = state
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            # Do not retry an unsupported host highlighting API 10x/second.
            if not self._session_highlight_error_reported:
                self.log_message('Bento Session highlight unavailable: {}'.format(exc))
                self._session_highlight_error_reported = True
            self._session_component = None
            self._session_component_size = None
            self._session_highlight_state = None

    def _clip_color(self, clip):
        # Approximate Ableton's 24-bit clip RGB with the configured Twister palette.
        try:
            rgb = int(clip.color) & 0xFFFFFF
            r, g, b = (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255
            palette = ((self.LED_COLORS['green'], (45, 190, 75)),
                       (self.LED_COLORS['yellow'], (245, 205, 40)),
                       (self.LED_COLORS['orange'], (240, 135, 40)),
                       (self.LED_COLORS['red'], (235, 45, 50)),
                       (self.LED_COLORS['light_blue'], (65, 160, 235)),
                       (self.LED_COLORS['purple'], (155, 75, 205)),
                       (self.LED_COLORS['pink'], (225, 75, 160)),
                       (self.LED_COLORS['teal'], (35, 180, 165)))
            # Nearest-color matching is a first-pass RGB approximation.
            return min(palette, key=lambda entry: sum((a-b)**2 for a,b in zip((r,g,b), entry[1])))[0]
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return self.VU_GREEN

    def _clip_slots(self, col):
        track = self._clip_track(col)
        try:
            return tuple(track.clip_slots) if track is not None else ()
        except (AttributeError, RuntimeError, TypeError):
            return ()

    def _scroll_clips(self, col, direction):
        columns = self._clip_columns()
        if not columns:
            return
        max_slots = max((len(self._clip_slots(c)) for c in columns), default=0)
        maximum = max(0, max_slots - 4 * len(columns))
        old = self._clip_scene_offset
        self._clip_scene_offset = max(0, min(maximum, old + direction))
        if old != self._clip_scene_offset:
            self.show_message('Bento | Scenes {}-{}'.format(self._clip_scene_offset + 1, self._clip_scene_offset + 4 * len(columns)))
        self._update_clip_highlight()
        self._render_all_clips()

    def _launch_clip(self, col, row):
        slots = self._clip_slots(col)
        index = self._clip_index(col, row)
        if index >= len(slots):
            return
        try:
            slot = slots[index]
            # Every click fires/retriggers the clip. Individual clip-stop is
            # intentionally disabled; stop the whole track with E1/E4 + bottom.
            if slot.has_clip:
                slot.fire()
            else:
                # Native Ableton slot semantics: armed empty slots can record;
                # unarmed empty slots stop only when a stop button is present.
                track = self._clip_track(col)
                if track is not None and bool(getattr(track, 'arm', False)):
                    slot.fire()
                elif bool(getattr(slot, 'has_stop_button', False)):
                    slot.fire()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('Bento clip launch: {}'.format(exc))
        self._clip_ack_until[self.COLUMNS[col][row]] = time.monotonic() + 0.120
        self._render_all_clips()

    def _render_all_clips(self):
        for col in self._clip_columns():
            self._render_clips(col)

    def _render_clips(self, col):
        slots = self._clip_slots(col)
        offset = self._clip_scene_offset
        now = time.monotonic()
        scrolling = any(self._button_down[self.COLUMNS[c][3]] for c in self._clip_columns())
        for row, cc in enumerate(self.COLUMNS[col]):
            index = self._clip_index(col, row)
            color = 0
            white = 0
            if index < len(slots):
                try:
                    slot = slots[index]
                    if slot.has_clip:
                        clip = slot.clip
                        color = self._clip_color(clip)
                        if bool(getattr(clip, 'is_recording', False)):
                            color = self.LED_COLORS['red'] if int(now * 8) % 2 == 0 else 0
                        elif bool(getattr(clip, 'is_triggered', False)):
                            color = self.LED_COLORS['yellow'] if int(now * 8) % 2 == 0 else 0
                        elif bool(getattr(clip, 'is_playing', False)):
                            color = self._clip_color(clip) if int(now * 4) % 2 == 0 else 0
                            if not scrolling:
                                length = max(0.001, float(clip.loop_end) - float(clip.loop_start))
                                white = int(127 * ((float(clip.playing_position) - float(clip.loop_start)) % length) / length)
                    elif bool(getattr(slot, 'is_triggered', False)):
                        color = 108
                except (AttributeError, RuntimeError, TypeError, ValueError):
                    pass
            if now < self._clip_ack_until[cc]:
                white = 0 if white >= 64 else 127
            self._send_cc(self.ROTARY_CHANNEL, cc, white)
            self._send_cc(self.PUSH_CHANNEL, cc, color)

    def _column_push(self, col, row):
        mode = self._modes[col]
        if mode == 0:
            if row == 0:
                self._bank_fx(col, -1)
            elif row == 1:
                self._bank_fx(col, 1)
            elif row == 2:
                self._reset(self._column_param(col, 2), 0.0)
            else:
                self._toggle_mute()
        elif mode == 1:
            if col != self._device_columns[0]:
                return
            if row == 0:
                self._toggle_parameter(self._device_power(self._active_device))
            elif row == 1:
                pages = max(1, (len(self._device_all_params()) + 3) // 4 - len(self._device_columns) + 1)
                self._device_page = (self._device_page + 1) % pages
                self._bind_columns()
                self._announce_column_bank(col)
                self._device_feedback_cc = self.COLUMNS[col][row]
                self._device_feedback_until = time.monotonic() + 0.45
                if pages == 1:
                    self.show_message('Bento | Device parameters fit in one bank')
                elif self._device_page == 0:
                    self.show_message('Bento | Device bank wrapped to first bank')
            elif row in (2, 3):
                self._navigate_column_device(-1 if row == 2 else 1)
                self._device_feedback_cc = self.COLUMNS[col][row]
                self._device_feedback_until = time.monotonic() + 0.45
        elif mode == 2:
            if row in (0, 1) and col == min((c for c, m in enumerate(self._modes) if m == 2), default=-1):
                self._bank_fx(col, -1 if row == 0 else 1)
            elif row in (2, 3):
                self._reset(self._column_param(col, row))
        elif mode == 6:
            if row < 3:
                self._cycle_routing(row, 1)
            # Bottom I/O push is reserved for hold+turn monitor selection.
        elif mode == 5:
            return  # clip buttons launch on release in _push
        elif mode == 8:
            song = self.song()
            try:
                if row == 0:
                    song.loop = not bool(song.loop)
                elif row == 1:
                    song.record_mode = not bool(song.record_mode)
                elif row == 2:
                    song.session_record = not bool(song.session_record)
                elif row == 3:
                    if bool(song.is_playing):
                        song.stop_playing()
                    else:
                        song.is_playing = True
            except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
                self.log_message('Bento Transport 1: {}'.format(exc))
        elif mode == 4:
            if row == 0:
                self._vu_modes[col] = (self._vu_modes[col] + 1) % 3
                self._vu_peak_until[col] = 0.0
                self.show_message('Bento | VU column {}: {}'.format(col + 1, ('Track VU', 'Beat / Bar', 'Master VU')[self._vu_modes[col]]))
        elif row in (2, 3):
            self._reset(self._column_param(col, row))
        self._refresh_leds()

    def _monitor_step(self, direction):
        track = self._selected_track
        if track is None or not bool(getattr(track, 'can_be_armed', False)):
            return
        try:
            states = (Live.Track.Track.monitoring_states.IN,
                      Live.Track.Track.monitoring_states.AUTO,
                      Live.Track.Track.monitoring_states.OFF)
            current = states.index(track.current_monitoring_state)
            track.current_monitoring_state = states[(current + direction) % 3]
            self.show_message('Bento Monitor: {}'.format(('IN', 'AUTO', 'OFF')[(current + direction) % 3]))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('Bento monitor: {}'.format(exc))

    def _toggle_mute(self):
        track = self._selected_track
        if track is None or track is self.song().master_track:
            return
        try:
            track.mute = not bool(track.mute)
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('Bento mute: {}'.format(exc))

    def _toggle_arm(self):
        track = self._selected_track
        if track is None or not bool(getattr(track, 'can_be_armed', False)):
            return
        try:
            target = not bool(track.arm)
            if target:
                for other in tuple(self.song().tracks):
                    if other is not track and bool(getattr(other, 'can_be_armed', False)) and bool(other.arm):
                        other.arm = False
            track.arm = target
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('Bento arm: {}'.format(exc))

    def _cycle_routing(self, row, direction):
        """I/O boxes: input routing, input subrouting, output routing, output subrouting."""
        track = self._selected_track
        if track is None or track is self.song().master_track:
            return
        keys = (('input_routings', 'current_input_routing', 'Input'),
                ('input_sub_routings', 'current_input_sub_routing', 'Input channel'),
                ('output_routings', 'current_output_routing', 'Output'),
                ('output_sub_routings', 'current_output_sub_routing', 'Output channel'))
        options_name, current_name, label = keys[row]
        try:
            options = tuple(getattr(track, options_name, ()))
            if not options:
                return
            current = getattr(track, current_name)
            index = options.index(current) if current in options else 0
            target = options[max(0, min(len(options) - 1, index + direction))]
            setattr(track, current_name, target)
            self.show_message('Bento | {}: {}'.format(label, target))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('Bento routing: {}'.format(exc))

    def _switch_column(self, col, direction):
        old = self._modes[col]
        counts = {mode: self._modes.count(mode) for mode in range(len(self.MODES))}
        for offset in range(1, len(self.MODES) + 1):
            candidate = (old + offset * direction) % len(self.MODES)
            if candidate == 0 and counts[0] >= 1:
                continue
            if candidate == 3 and counts[3] >= 1:
                continue
            if candidate == 2 and counts[2] >= 2:
                continue
            if candidate == 4 and counts[4] >= 2:
                continue
            if candidate == 5 and counts[5] >= 4:
                continue
            if candidate == old:
                return
            self._volume_pending = self._solo_pending = False
            self._volume_token += 1
            self._solo_token += 1
            self._mixer_pan_held = None
            self._mixer_combo_used[col] = False
            if old == 7:
                for cc in self.COLUMNS[col]:
                    self._send_cc(11, cc, 0, force=True)
                self._diag_pulse[col] = False
            for held_cc in self.COLUMNS[col]:
                if self._button_down[held_cc]:
                    self._clip_suppress_release[held_cc] = True
                    self._consumed[held_cc] = True
            self._modes[col] = candidate
            self._clamp_fx_window()
            self._device_banks[col] = 0
            self._bind_columns()
            self.show_message('MF Bento | Column {}: {}'.format(col + 1, self.MODES[candidate]))
            self._render_all_clips()
            if candidate == 7:
                self._diag_emit(col, 'module selected')
            return

    def _announce_column_bank(self, col):
        total = len(self._device_all_params())
        columns = max(1, len(self._device_columns))
        banks = max(1, (total + 3) // 4 - columns + 1)
        bank = self._device_page
        first = bank * 4 + 1 if total else 0
        last = min(total, first + columns * 4 - 1) if total else 0
        name = getattr(self._active_device, 'name', 'No device')
        self.show_message('Bento | Column {} | {} | Bank {}/{} | Parameters {}-{}'.format(
            col + 1, name, bank + 1, banks, first, last))

    def _navigate_column_device(self, direction):
        track = self._selected_track
        if track is None:
            return
        try:
            devices = tuple(getattr(track, 'devices', ()))
            if not devices:
                self.show_message('Bento | No devices on selected track')
                return
            current = self._active_device
            index = devices.index(current) if current in devices else (-1 if direction > 0 else len(devices))
            index = max(0, min(len(devices) - 1, index + direction))
            target = devices[index]
            if target is current:
                return
            self._device_override = target
            self._active_device = target
            self._device_page = 0
            self._device_banks = [0] * 4
            # Live 13 uses Song.View.select_device; Track.View.selected_device is read-only.
            self.song().view.select_device(target)
            self._bind_columns()
            self.show_message('Bento | Device {}/{} | {}'.format(index + 1, len(devices), target.name))
        except Exception as exc:
            self.log_message('MF Bento device navigation: {}'.format(exc))

    def _clear_column_bindings(self):
        self._binding_generation += 1
        for bindings in self._column_listeners:
            self._unlisten(bindings)
            for item in bindings:
                if item in self._listeners:
                    self._listeners.remove(item)
            bindings[:] = []

    def _bind_columns(self):
        self._clear_column_bindings()
        self._device_columns = [c for c in range(4) if self._modes[c] == 1]
        pages = (len(self._device_all_params()) + 3) // 4
        self._device_page = min(self._device_page, max(0, pages - len(self._device_columns)))
        fx = [c for c in range(4) if self._modes[c] == 2]
        self._fx_offsets = {c: self._fx_shared_offset for c in fx}
        generation = self._binding_generation
        topology = []
        def watch_racks(owner):
            for device in tuple(getattr(owner, 'devices', ())):
                if bool(getattr(device, 'can_have_chains', False)):
                    topology.append((device, 'chains', self._device_selection_changed))
                    for chain in tuple(getattr(device, 'chains', ())):
                        topology.append((chain, 'devices', self._device_selection_changed))
                        watch_racks(chain)
        if self._selected_track is not None:
            watch_racks(self._selected_track)
        if self._active_device is not None:
            topology.append((self._active_device, "parameters", self._device_selection_changed))
        mixer = getattr(self._selected_track, "mixer_device", None)
        if mixer is not None:
            topology.append((mixer, "sends", self._bind_columns))
        for obj, prop, callback in topology:
            def current_callback(callback=callback):
                if not self._disconnected and generation == self._binding_generation:
                    callback()
            if self._listen(obj, prop, current_callback):
                self._column_listeners[0].append(self._listeners[-1])
        for col in range(4):
            params = [self._column_param(col, row) for row in range(4)]
            if self._modes[col] == 1:
                params.append(self._device_power(self._active_device))
            for param in params:
                if param is None:
                    continue
                def changed():
                    if not self._disconnected and generation == self._binding_generation:
                        self._refresh_leds()
                if self._listen(param, 'value', changed):
                    self._column_listeners[col].append(self._listeners[-1])
            for cc in self.COLUMNS[col]:
                self._last_midi.pop((self.ROTARY_CHANNEL, cc), None)
                self._last_midi.pop((self.PUSH_CHANNEL, cc), None)
        for col, mode in enumerate(self._modes):
            if mode in (0, 3):
                self._send_cc(self.ROTARY_CHANNEL, self.COLUMNS[col][3], self._ring(self._column_param(col, 3)))
        self._refresh_leds()

    def _track_changed(self):
        if self._disconnected:
            return
        self._binding_generation += 1
        self._clear_column_bindings()
        old = getattr(self, '_column1_listeners', [])
        self._unlisten(old)
        for item in old:
            if item in self._listeners:
                self._listeners.remove(item)
        self._column1_listeners = []
        self._volume_pending = False
        self._volume_token += 1
        self._solo_pending = False
        self._solo_token += 1
        self._mixer_pan_held = None
        self._mixer_combo_used = [False] * 4
        self._mixer_pan_turned = False
        self._clip_suppress_release = [bool(v) for v in self._button_down]
        self._monitor_accum = 0
        self._monitor_feedback_until = 0.0
        self._volume_feedback_deadline = 0.0
        scrolling = self._held[0] and self._consumed[0] and self._button_down[0]
        self._held = [False] * 16
        self._held[0] = scrolling
        self._consumed = [True] * 16
        self._switch_steps = [0] * 4
        self._selected_track = self._selected()
        self._clamp_fx_window()
        if self._selected_track in tuple(self.song().tracks):
            self._last_regular_track = self._selected_track
            self._track_category = 0
        elif self._selected_track is self.song().master_track:
            self._track_category = 2
        elif self._selected_track in tuple(self.song().return_tracks):
            self._track_category = 1
        self._device_page = 0
        self._device_override = None
        self._device_banks = [0] * 4
        self._active_device = self._device_for_track()
        track = self._selected_track
        if track is not None:
            if self._listen(track, 'devices', self._device_selection_changed):
                self._column1_listeners.append(self._listeners[-1])
            if track is not self.song().master_track:
                props = ('mute', 'solo') + (('arm', 'current_monitoring_state') if bool(getattr(track, 'can_be_armed', False)) else ())
                for prop in props:
                    def changed():
                        if not self._disconnected:
                            self._refresh_leds()
                    if self._listen(track, prop, changed):
                        self._column1_listeners.append(self._listeners[-1])
            try:
                if self._listen(track.view, 'selected_device', self._device_selection_changed):
                    self._column1_listeners.append(self._listeners[-1])
            except Exception:
                pass
        self._bind_columns()

    def _device_selection_changed(self):
        if self._disconnected:
            return
        new = self._device_for_track()
        if new is not self._active_device:
            self._active_device = new
            self._device_page = 0
            self._device_banks = [0] * 4
            self._bind_columns()
        else:
            self._bind_columns()

    def _bank_sends(self, direction):
        track = self._selected_track
        try:
            sends = tuple(track.mixer_device.sends)
        except Exception:
            sends = ()
        maximum = max(0, len(sends) - 2)
        target = max(0, min(maximum, self._send_offset + direction))
        if target != self._send_offset:
            self._send_offset = target
            self._bind_columns()
            self.show_message('MF Bento | Mixer sends {}-{}'.format(chr(65 + target), chr(66 + target)))

    def _diag_emit(self, col, reason):
        """Send uncached test RGB CCs; log real channel/CC/value for each knob."""
        channel = self._diag_channel[col]
        for row, cc in enumerate(self.COLUMNS[col]):
            value = self.DIAG_PALETTE[self._diag_indices[col][row]]
            if self._diag_pulse[col]:
                value = 0 if int(time.monotonic() * 2) % 2 else value
            # Clear prior channel when switching so no stale colors survive.
            other = 11 if channel == 10 else 10
            self._send_cc(other, cc, 0, force=True)
            self._send_cc(channel, cc, value, force=True)
            self.log_message('Bento LED DIAG {} col={} E{} midi_ch={} cc={} value={} force=1'.format(reason, col + 1, row + 1, channel + 1, cc, value))
        self.show_message('Bento LED test | column {} | channel {} | {}'.format(col + 1, channel + 1, reason))

    def _fx_led_color(self, param):
        """Single owner for FX Sends RGB; never borrow mixer/device feedback."""
        return self._fx_color_value if param is not None and bool(getattr(param, 'is_enabled', True)) else 0

    def _refresh_leds(self):
        if self._disconnected:
            return
        track = self._selected_track
        for col in range(4):
            mode = self._modes[col]
            if mode == 7:
                # Diagnostic owns its LEDs; do not run FX/mixer RGB logic.
                # Pulse mode deliberately resends to defeat stale MIDI caching.
                if self._diag_pulse[col]:
                    phase = int(time.monotonic() * 2) % 2
                    if self._diag_last.get(col) != phase:
                        self._diag_last[col] = phase
                        self._diag_emit(col, 'pulse')
                continue
            if mode in (4, 5):
                continue  # dedicated meter/clip LEDs are rendered in _vu_tick
            for row, cc in enumerate(self.COLUMNS[col]):
                param = self._column_param(col, row)
                available = param is not None and bool(getattr(param, 'is_enabled', True))
                if not ((mode in (0, 3) and row == 3) or (mode == 3 and row < 2)):
                    if mode == 8:
                        continue_ring = True
                    else:
                        continue_ring = False
                    if not continue_ring:
                        self._send_cc(self.ROTARY_CHANNEL, cc, self._ring(param) if available else 0)
                color = self._fx_led_color(param) if mode == 2 else self.BLUE if available else 0
                if mode == 6:
                    # Three routing selectors stay pink; E4 always reflects
                    # actual monitoring state (including when OFF).
                    color = self.PINK if row < 3 else 0
                    if row == 3 and track is not None:
                        try:
                            states = Live.Track.Track.monitoring_states
                            color = (self.BLUE if track.current_monitoring_state == states.IN else
                                     self.YELLOW if track.current_monitoring_state == states.AUTO else 0)
                        except (AttributeError, RuntimeError, ValueError):
                            color = 0
                if mode == 0:
                    if row in (0, 1):
                        # Track Mixer sends use the exact same calibrated RGB
                        # and enabled-parameter rule as dedicated FX Sends.
                        color = self._fx_led_color(param)
                    elif row == 3:
                        if track is not None and track is not self.song().master_track:
                            try:
                                if bool(getattr(track, 'arm', False)):
                                    color = self.RED
                                elif bool(getattr(track, 'can_be_armed', False)):
                                    states = Live.Track.Track.monitoring_states
                                    color = self.BLUE if track.current_monitoring_state == states.IN else self.YELLOW
                                else:
                                    color = self.YELLOW
                            except Exception:
                                color = self.YELLOW
                        else:
                            color = self.YELLOW if available else 0
                    elif row == 2 and track is not None and track is not self.song().master_track:
                        try:
                            if track.solo:
                                color = self.BLUE if time.monotonic() % 0.5 < 0.25 else 0
                            # Monitoring feedback is owned by the I/O module.
                        except Exception:
                            pass
                # FX bank acknowledgment belongs in Live's status text, not RGB:
                # otherwise transient yellow overrides obscure send colors.
                if mode == 1 and self._active_device is None:
                    color = 0
                if mode == 1 and row == 0:
                    # Only the physically leftmost Device column owns power actions/LED.
                    if self._device_columns and col == self._device_columns[0]:
                        power = self._device_power(self._active_device)
                        if power is not None:
                            try:
                                color = self.YELLOW if float(power.value) > (float(power.min) + float(power.max)) / 2 else self.BLUE
                            except Exception:
                                color = 0
                        else:
                            color = 0
                    else:
                        # Secondary columns still display the first parameter in blue.
                        color = self.BLUE if available else 0
                if mode == 1 and self._device_columns and col == self._device_columns[0] and row in (1, 2, 3):
                    if self._device_feedback_cc == cc and time.monotonic() < self._device_feedback_until:
                        color = self.YELLOW
                if mode == 8:
                    try:
                        song = self.song()
                        # Persistent color identifies function. White ring shows state.
                        flags = (bool(song.loop), bool(song.record_mode),
                                 bool(song.session_record), bool(song.is_playing))
                        color = (self.YELLOW, self.RED, self.RED, self.VU_GREEN)[row]
                        self._send_cc(self.ROTARY_CHANNEL, cc, 127 if flags[row] else 18)
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        color = 0
                if mode == 3 and row < 2:
                    self._send_cc(self.ROTARY_CHANNEL, cc, 0)
                    self._send_cc(self.PUSH_CHANNEL, cc, 0)
                    continue
                if mode == 3 and row == 3:
                    # Bottom Master RGB is owned by the meter tick, not by
                    # static parameter availability. Keep its last VU color.
                    continue
                if row == 0 and self._held[col] and mode not in (0, 2, 6, 8) and not (mode == 1 and self._active_device is None):
                    color = self.YELLOW
                if mode == 0 and row in (0, 1):
                    # Track Mixer top two are SEND controls, not general-purpose
                    # held-button indicators. Always use the final send state.
                    color = self._fx_led_color(param)
                if mode == 2 and self._fx_rgb_trace.get(cc) != color:
                    self._fx_rgb_trace[cc] = color
                    self.log_message('Bento FX LED command: midi_ch={} cc={} col={} row={} value={} available={} cached={}'.format(self.PUSH_CHANNEL + 1, cc, col, row, color, available, self._last_midi.get((self.PUSH_CHANNEL, cc))))
                if self._identify_active is None:
                    self._send_cc(self.PUSH_CHANNEL, cc, color)

    @staticmethod
    def _midi_track_activity(track):
        """Return (is_midi_track, activity) without using audio as MIDI data.

        Live's meter_level fields report MIDI or audio according to track
        routing. For a MIDI track feeding an instrument, prefer the MIDI
        INPUT meter, not the post-instrument output audio meter. For a pure
        MIDI-output track, the output meter reflects its MIDI stream. These
        are Live-provided meter proxies, not individual MIDI note events.
        Missing/unavailable meter data is displayed as silence (fail closed).
        """
        if track is None:
            return False, 0.0
        try:
            is_midi = bool(getattr(track, 'has_midi_input', False))
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return False, 0.0
        if not is_midi:
            return False, 0.0
        try:
            has_audio_output = bool(getattr(track, 'has_audio_output', True))
            meter_field = ('input_meter_level' if has_audio_output
                           else 'output_meter_level')
            value = float(getattr(track, meter_field, 0.0))
            return True, max(0.0, min(1.0, value))
        except (AttributeError, RuntimeError, TypeError, ValueError):
            return True, 0.0

    def _render_midi_mixer_white_ladder(self, col, level):
        """4-segment bottom-to-top MIDI activity, white rings ONLY.

        Keep the module's RGB push-button semantics (arm, mute, monitor)
        intact and never override another column's LEDs. Selected Track
        Mixer parameter handling and physical controls remain unchanged.
        """
        level = max(0.0, min(1.0, float(level)))
        count = (0 if level <= self.VU_ACTIVE_THRESHOLD else
                 max(1, min(4, int(level * 4.0 + 0.999999))))
        for row, cc in enumerate(self.COLUMNS[col]):
            self._send_cc(self.ROTARY_CHANNEL, cc,
                          127 if (3 - row) < count else 0)

    def _vu_tick(self):
        if self._disconnected or not self._vu_running:
            return
        try:
            self._refresh_leds()
            now = time.monotonic()
            self._update_clip_highlight()
            for col, mode in enumerate(self._modes):
                if mode == 4:
                    self._render_vu_beat(col)
                    continue
                if mode == 5:
                    self._render_clips(col)
                    continue
                if mode not in (0, 3):
                    continue
                track = self._selected_track if mode == 0 else self.song().master_track
                if track is None:
                    self._send_cc(self.ROTARY_CHANNEL, self.COLUMNS[col][3], 0)
                    continue
                # On MIDI tracks the Track Mixer column's four WHITE
                # encoders become a bottom-to-top activity ladder. Audio
                # tracks keep their existing fader/level ring behavior.
                if mode == 0:
                    midi_track, midi_activity = self._midi_track_activity(track)
                    if midi_track:
                        self._render_midi_mixer_white_ladder(col, midi_activity)
                        continue
                cc = self.COLUMNS[col][3]
                fader = self._ring(self._column_param(col, 3))
                ring = fader
                meter_level = None
                if now >= self._volume_feedback_deadline:
                    try:
                        if bool(getattr(track, 'has_audio_output', True)):
                            level = max(float(getattr(track, 'output_meter_left', 0.0)),
                                        float(getattr(track, 'output_meter_right', 0.0)))
                            meter_level = level
                            if level >= 0.015:
                                ring = max(0, min(127, int(round(level * 127.0))))
                            # Below the activity threshold, show fader position,
                            # including on Master Mixer, like Selected Track Mixer.
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        if mode == 3:
                            ring = 0
                self._send_cc(self.ROTARY_CHANNEL, cc, ring)
                if mode == 3 and self._identify_active is None:
                    # Independent RGB VU for Master bottom encoder. The white
                    # ring above retains its existing meter/fader behavior.
                    try:
                        raw_level = meter_level if meter_level is not None else max(
                            float(getattr(track, 'output_meter_left', 0.0)),
                            float(getattr(track, 'output_meter_right', 0.0)))
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        raw_level = 0.0
                    if raw_level < self.VU_ACTIVE_THRESHOLD:
                        meter_color = 0
                    elif raw_level >= 1.0:
                        meter_color = self.VU_RED
                    elif raw_level >= 0.90:
                        meter_color = self.VU_ORANGE
                    else:
                        meter_color = self.VU_GREEN
                    self._send_cc(self.PUSH_CHANNEL, cc, meter_color)

        finally:
            if not self._disconnected and self._vu_running:
                self.schedule_message(self.VU_INTERVAL, self._vu_tick)

    def _switch_track_category(self):
        song = self.song()
        returns = tuple(song.return_tracks)
        next_category = (self._track_category + 1) % 3
        if next_category == 1 and not returns:
            next_category = 2
        try:
            if next_category == 0:
                tracks = tuple(song.visible_tracks)
                target = self._last_regular_track if self._last_regular_track in tracks else (tracks[0] if tracks else None)
            elif next_category == 1:
                target = returns[0]
            else:
                target = song.master_track
            if target is None:
                return
            self._category_guard_until = time.monotonic() + 0.4
            self._track_category = next_category
            song.view.selected_track = target
            self.show_message('Bento | Navigation: {}'.format(('Tracks', 'Returns', 'Master')[next_category]))
        except (AttributeError, RuntimeError, TypeError) as exc:
            self.log_message('Bento category navigation: {}'.format(exc))

    def _scroll_track(self, direction):
        try:
            song = self.song()
            if self._track_category == 2:
                return
            tracks = tuple(song.visible_tracks) if self._track_category == 0 else tuple(song.return_tracks)
            if not tracks:
                return
            current = song.view.selected_track
            index = tracks.index(current) if current in tracks else (-1 if direction > 0 else len(tracks))
            target = tracks[max(0, min(len(tracks) - 1, index + direction))]
            if target is not current:
                song.view.selected_track = target
                self.show_message('Bento | {}: {}'.format('Track' if self._track_category == 0 else 'Return', target.name))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('Bento track scroll: {}'.format(exc))

    def _render_vu_beat(self, col):
        mode = self._vu_modes[col]
        now = time.monotonic()
        track = self._selected_track if mode == 0 else self.song().master_track
        if mode == 1:
            try:
                song = self.song()
                playing = bool(song.is_playing)
                beat = float(song.current_song_time)
                numerator = max(1, int(song.signature_numerator))
                quarter = int(beat) % numerator
                recording = bool(song.record_mode)
            except (AttributeError, RuntimeError, TypeError, ValueError):
                playing, quarter, recording = False, 0, False
            for row, cc in enumerate(self.COLUMNS[col]):
                active = playing and row == quarter % 4
                self._send_cc(self.ROTARY_CHANNEL, cc, 127 if active else 0)
                self._send_cc(self.PUSH_CHANNEL, cc, self.LED_COLORS['red'] if active and recording else self.LED_COLORS['green'] if active else self.LED_COLORS['yellow'] if not playing and row == quarter % 4 else self.LED_COLORS['light_blue'])
            return
        if mode == 0:
            midi_track, midi_activity = self._midi_track_activity(track)
            if midi_track:
                self._render_four_segment_vu(col, midi_activity, now)
                return
        try:
            level = max(float(getattr(track, 'output_meter_left', 0.0)), float(getattr(track, 'output_meter_right', 0.0))) if track is not None else 0.0
            level = max(0.0, min(1.0, level))
        except (AttributeError, RuntimeError, TypeError, ValueError):
            level = 0.0
        self._render_four_segment_vu(col, level, now)

    def _render_four_segment_vu(self, col, level, now):
        # Master: audio meter; selected-track: MIDI activity for MIDI tracks,
        # audio meter for audio tracks. This is a meter, not a note-event API.
        # All white outputs are strictly 0 or 127, bottom-to-top.
        level = max(0.0, min(1.0, float(level)))
        if level <= self.VU_ACTIVE_THRESHOLD:
            count = 0
        else:
            count = max(1, min(4, int(level * 4.0 + 0.999999)))
        # RGB color stages: green must fill all four before yellow starts.
        for row, cc in enumerate(self.COLUMNS[col]):
            segment = 3 - row
            on = segment < count
            self._send_cc(self.ROTARY_CHANNEL, cc, 127 if on else 0)
            color = self.VU_GREEN if on else 0
            if count == 4:
                if level >= 0.92:
                    color = (self.VU_RED, self.VU_ORANGE, self.VU_YELLOW, self.VU_GREEN)[row]
                elif level >= 0.75:
                    color = (self.VU_ORANGE, self.VU_ORANGE, self.VU_YELLOW, self.VU_GREEN)[row]
                elif level >= 0.55:
                    color = (self.VU_YELLOW, self.VU_YELLOW, self.VU_YELLOW, self.VU_GREEN)[row]
            self._send_cc(self.PUSH_CHANNEL, cc, color)

    def disconnect(self):
        if self._session_component is not None:
            try:
                self._session_component.set_enabled(False)
                self._session_component.disconnect()
            except (AttributeError, RuntimeError, TypeError):
                pass
            self._session_component = None
        self._clear_column_bindings()
        self._disconnected = True
        self._identify_generation += 1
        self._identify_active = None
        self._vu_running = False
        self._volume_pending = False
        self._solo_pending = False
        self._unlisten(self._listeners)
        self._listeners = []
        for control, callback in self._controls:
            try:
                control.remove_value_listener(callback)
            except Exception:
                pass
        for cc in range(16):
            self._send_cc(self.ROTARY_CHANNEL, cc, 0, force=True)
            self._send_cc(self.PUSH_CHANNEL, cc, 0, force=True)
        super().disconnect()
