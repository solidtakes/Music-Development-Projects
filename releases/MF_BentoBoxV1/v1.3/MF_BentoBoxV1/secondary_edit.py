"""Experimental secondary editing overlay for MF BentoBoxV1.

Owned by the single host, not a ControlSurface. No MIDI-map remapping.
Physical right-side Ch4/CC11 enters momentary edit mode and tap locks.
When Transport is visible, Edit lives on E9-E12; otherwise E13-E16.
The editable range is Live's Arrangement loop brace, NOT a UI time selection.
"""
import time


class SecondaryEditMixin:
    EDIT_LOCAL_ROW_TOP = (8, 9, 10, 11)
    EDIT_LOCAL_ROW_BOTTOM = (12, 13, 14, 15)
    EDIT_TICKS_PER_STEP = 4
    EDIT_LED_TICK_FRAMES = 5
    STATUS_REMINDER_FRAMES = 40  # framework ticks; approximately four seconds

    def _edit_initialize(self):
        self._edit_locked = False
        self._edit_visible = False
        self._edit_press_at = 0.0
        self._edit_gesture_used = False
        self._edit_suppressed = set()   # latched through layer changes
        self._edit_native_down = set()
        self._edit_pressed = set()
        self._edit_led_sent = {}
        self._edit_led_tick_pending = False
        self._status_reminder_pending = False
        self._edit_rotary_remainder = {}
        self._edit_last_mode_message = None

    def _edit_row(self):
        if not self._edit_visible:
            return ()
        return (self.EDIT_LOCAL_ROW_TOP if self._transport_visible
                else self.EDIT_LOCAL_ROW_BOTTOM)

    def _edit_mode_message(self):
        if self._edit_visible and self._transport_visible:
            return 'BENTOBOX | EDIT E9-E12 | TRANSPORT E13-E16'
        if self._edit_visible:
            return 'BENTOBOX | EDIT E13-E16'
        if self._transport_visible:
            return 'BENTOBOX | TRANSPORT E13-E16'
        return 'BENTOBOX | NORMAL MODE'

    def _edit_announce(self):
        message = self._edit_mode_message()
        if message != self._edit_last_mode_message:
            self._edit_last_mode_message = message
            self.show_message(message)
        if self._edit_visible or self._transport_visible:
            self._edit_schedule_status_reminder()

    def _edit_schedule_status_reminder(self):
        if (not self._three_bank_closed and (self._edit_visible or self._transport_visible)
                and not self._status_reminder_pending):
            self._status_reminder_pending = True
            self.schedule_message(self.STATUS_REMINDER_FRAMES, self._edit_status_reminder_tick)

    def _edit_status_reminder_tick(self):
        self._status_reminder_pending = False
        if self._three_bank_closed or not (self._edit_visible or self._transport_visible):
            return
        # Best effort: Live owns status bar, so this is not a pinned message.
        self.show_message(self._edit_mode_message())
        self._edit_schedule_status_reminder()

    def _edit_set_visible(self, enabled):
        enabled = bool(enabled)
        if enabled != self._edit_visible:
            self._edit_visible = enabled
            self._edit_rotary_remainder.clear()
            self._edit_led_sent.clear()
            self._edit_repaint_rows()
            if enabled:
                self._edit_schedule_led_tick()
            self._edit_announce()

    def _edit_on_transport_changed(self):
        # Moving Editing between rows is atomic from the host's perspective.
        self._edit_rotary_remainder.clear()
        self._edit_led_sent.clear()
        self._edit_repaint_rows()
        self._edit_announce()

    def _edit_repaint_rows(self):
        if self._three_bank_closed:
            return
        owned = set(self._edit_row())
        if self._transport_visible:
            owned.update(self.TRANSPORT_BOTTOM_CCS)
        for offset in (0, 16, 32):
            for local in range(8, 16):
                if local in owned:
                    continue
                for status in (0xBA, 0xBB):
                    key = (status, offset + local)
                    prior = self._native_bottom_feedback.get(key)
                    # Call the original base LED sender; bypass host interception.
                    from .Bank1_SelectedTrack import MidiFighterTwisterCustom
                    if not self._bank_animation_suppress_for_key(status, offset + local):
                        MidiFighterTwisterCustom._send_midi(
                            self, prior if prior is not None else (status, offset + local, 0))
        if self._transport_visible:
            self._transport_led_sent.clear()
            self._render_transport_feedback(force=True)
        if self._edit_visible:
            self._edit_led_sent.clear()
            self._edit_render_feedback(force=True)

    def _edit_send_led(self, status, cc, value, force=False):
        key = (status, cc)
        value = max(0, min(127, int(value)))
        if self._bank_animation_suppress_for_key(status,cc):
            return
        if force or self._edit_led_sent.get(key) != value:
            from .Bank1_SelectedTrack import MidiFighterTwisterCustom
            ok = MidiFighterTwisterCustom._send_midi(self, (status, cc, value))
            if ok is not False:
                self._edit_led_sent[key] = value

    def _edit_render_feedback(self, force=False):
        row = self._edit_row()
        if not row or self._three_bank_closed:
            return
        try:
            song = self.song()
            pin, pout = bool(song.punch_in), bool(song.punch_out)
            # Colors derive from the existing Twister standard palette.
            blue = self.LED_COLORS['light_blue']
            yellow = self.LED_COLORS['yellow']
            pink = self.LED_COLORS.get('pink', self.LED_COLORS['purple'])
            rgb = (yellow if pin else blue, yellow, pink, yellow if pout else blue)
            rings = (127 if pin else 0, min(127, max(8, round(float(song.loop_length) * 8))),
                     64, 127 if pout else 0)
            for offset in (0,16,32):
                for idx, local in enumerate(row):
                    self._edit_send_led(0xBA, offset + local, rgb[idx], force)
                    self._edit_send_led(0xBB, offset + local, rings[idx], force)
        except (AttributeError, RuntimeError, ValueError, TypeError) as exc:
            self.log_message('BentoBox edit LED unavailable: {}'.format(exc))

    def _edit_schedule_led_tick(self):
        if self._edit_visible and not self._three_bank_closed and not self._edit_led_tick_pending:
            self._edit_led_tick_pending = True
            self.schedule_message(self.EDIT_LED_TICK_FRAMES, self._edit_led_tick)

    def _edit_led_tick(self):
        self._edit_led_tick_pending = False
        if self._three_bank_closed or not self._edit_visible:
            return
        self._edit_render_feedback()
        self._edit_schedule_led_tick()

    def _edit_side_value(self, down, used_by_presets=False):
        """Return whether CC11 tap toggles Edit; holds are momentary."""
        if self._three_bank_closed:
            return
        now = time.monotonic()
        if down:
            self._edit_press_at = now
            self._edit_gesture_used = False
            self._edit_set_visible(True)
        else:
            tap = (not self._edit_gesture_used and not used_by_presets and
                   now - self._edit_press_at <= self.TAP_MAX_SECONDS)
            if tap:
                self._edit_locked = not self._edit_locked
            self._edit_set_visible(self._edit_locked)

    def _edit_handle_push(self, bank, cc, value):
        if cc not in range(8, 16):
            return False
        key = (bank, cc)
        down = int(value) > 0
        if key in self._edit_suppressed:
            if not down:
                self._edit_suppressed.discard(key)
                self._edit_pressed.discard(key)
            return True
        if down and cc in self._edit_row() and key not in self._edit_native_down:
            self._edit_suppressed.add(key)
            self._edit_pressed.add(key)
            self._edit_gesture_used = True
            # A normal tap of top-right alone toggles the mode; actions/chords do not.
            self._edit_execute_push(cc - self._edit_row()[0])
            return True
        if down:
            self._edit_native_down.add(key)
        else:
            self._edit_native_down.discard(key)
        return False

    def _edit_count_detents(self, bank, operation, value, held):
        if int(value) not in (63,65):
            return 0
        key = (bank, operation, bool(held))
        total = self._edit_rotary_remainder.get(key, 0) + (1 if value == 65 else -1)
        if abs(total) < self.EDIT_TICKS_PER_STEP:
            self._edit_rotary_remainder[key] = total
            return 0
        direction = 1 if total > 0 else -1
        self._edit_rotary_remainder[key] = total - 4 * direction
        return direction

    def _edit_route_rotary(self, bank, cc, value):
        key = (bank, cc)
        if cc not in self._edit_row() or key in self._edit_native_down:
            return False
        # Never forward editing turns into a native bank handler.
        if int(value) in (63,65):
            self._edit_gesture_used = True
            idx = cc - self._edit_row()[0]
            held = key in self._edit_pressed
            direction = self._edit_count_detents(bank, idx, value, held)
            if direction:
                self._edit_execute_turn(idx, direction, held)
        return True

    def _edit_execute_push(self, index):
        try:
            song = self.song()
            if index == 0:
                song.punch_in = not bool(song.punch_in)
                self.show_message('Arrangement Punch In {}'.format('ON' if song.punch_in else 'OFF'))
            elif index == 3:
                song.punch_out = not bool(song.punch_out)
                self.show_message('Arrangement Punch Out {}'.format('ON' if song.punch_out else 'OFF'))
            elif index == 1:
                if not self._transport_edit_allowed(song):
                    return
                beat, _ = self._transport_time_units(song)
                start = max(0.0, float(song.current_song_time))
                # Deliberately uses loop brace, not a highlighted timeline time selection.
                song.loop_start = start
                song.loop_length = beat
                self.show_message('Arrangement range: 1 beat at playhead (loop brace)')
            self._edit_render_feedback()
        except (AttributeError, RuntimeError, ValueError, TypeError) as exc:
            self.log_message('MF Edit push {}: {}'.format(index, exc))
            self.show_message('BentoBox Edit: action unavailable')

    def _edit_execute_turn(self, index, direction, held):
        if index not in (1,2):
            return
        if index == 2:
            self._edit_zoom(direction, vertical=held)
            return
        try:
            song = self.song()
            if not self._transport_edit_allowed(song):
                return
            beat, _ = self._transport_time_units(song)
            if held:
                song.loop_length = max(beat, float(song.loop_length) + direction * beat)
                message = 'Edit range end {}'.format('extend' if direction > 0 else 'shrink')
            else:
                song.loop_start = max(0.0, float(song.loop_start) + direction * beat)
                message = 'Edit range {}'.format('forward' if direction > 0 else 'back')
            self.show_message(message + ' 1 beat')
            self._edit_render_feedback()
        except (AttributeError, RuntimeError, ValueError, TypeError) as exc:
            self.log_message('MF Edit range: {}'.format(exc))
            self.show_message('BentoBox Edit: range unavailable')

    def _edit_zoom(self, direction, vertical=False):
        """Best-effort zoom_view on focused supported view, no key emulation."""
        try:
            view = self.application().view
            # Never force focus into another view; use existing document focus.
            preferred = getattr(view, 'focused_document_view', 'Arranger')
            if preferred not in ('Arranger','Detail/Clip'):
                preferred = 'Arranger'
            view.zoom_view(direction, preferred, bool(vertical))
            self.show_message('BentoBox: {} zoom {}'.format(
                'vertical' if vertical else 'horizontal', 'in' if direction>0 else 'out'))
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('MF Edit zoom unavailable: {}'.format(exc))
            self.show_message('BentoBox: active-view zoom unavailable')
