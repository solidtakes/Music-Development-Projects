"""MF BentoBoxV1 v1.3 DUAL MODE EXPERIMENTAL TEST — single Ableton ControlSurface.
Bank 1: Selected Track Bento v2.2 (CC0-15)
Bank 2: Four-Track Bento v1.0 stable (physical CC16-31; local 0-15)
Bank 3: Sequencer SP1 / v1.0 stable (CC32-47)
No Native Mode or controller setup changes. Experimental global transport overlay.
"""
import Live
import time
from _Framework.ControlSurface import ControlSurface
from _Framework.ButtonElement import ButtonElement
from _Framework.InputControlElement import MIDI_CC_TYPE
from .Bank1_SelectedTrack import MidiFighterTwisterCustom
from .FourTrack_Bank2 import FourTrackBank2
from .Sequencer_Bank3 import SequencerBank3
from .layout_state import FACTORY_LAYOUT, LayoutStore, validated_layout
from .secondary_edit import SecondaryEditMixin
from .bank_transition import BankTransitionMixin


class ThreeBankHost(BankTransitionMixin, SecondaryEditMixin, MidiFighterTwisterCustom):
    # MF3BANK build 1(1).mfs: top-left side CC Hold is global when
    # "Bank Side Buttons" is OFF. All channels are zero-based internally.
    TRANSPORT_MODIFIER_CHANNEL = 3  # MIDI channel 4
    TRANSPORT_MODIFIER_CC = 8
    SHIFT_MODIFIER_CHANNEL = 3  # MIDI channel 4
    SHIFT_MODIFIER_CC = 11      # top-right / reserved for future shift pages
    TAP_MAX_SECONDS = 0.28
    SHUTTLE_PRESS_GUARD_SECONDS = 0.055
    TRANSPORT_LED_TICK_FRAMES = 5
    TRANSPORT_CAPTURE_FLASH_SECONDS = 0.8
    SHUTTLE_E13_CC = 12
    LOOP_E16_CC = 15
    CAPTURE_E15_CC = 14
    TRANSPORT_TICKS_PER_STEP = 4  # MF Twister relative CC 65/63
    TRANSPORT_PUSH_CHANNEL = 10     # MIDI channel 11
    TRANSPORT_ROTARY_CHANNEL = 11   # MIDI channel 12
    TRANSPORT_BOTTOM_CCS = (12, 13, 14, 15)
    PRESET_CC_TO_SLOT = {0: '1', 1: '2', 2: '3', 3: '4'}
    PRESET_FACTORY_RESTORE_CC = 7  # right-side + E8 for >=2 seconds
    PRESET_SAVE_HOLD_SECONDS = 2.0
    PRESET_FEEDBACK_TICK_FRAMES = 4
    PRESET_CONFIRM_SECONDS = 0.9
    STATE_SCAN_FRAMES = 20
    STATE_SAVE_DELAY_FRAMES = 12
    PRESET_COLORS = (68, 76, 96, 108)  # blue/green/purple/yellow

    def __init__(self, c_instance):
        # Highlight requests are bank-local; the host alone owns the red box.
        self._highlight_components = {'bank1': None, 'bank2': None}
        self._active_highlight_bank = 'bank2'  # Bank 2 has Clip Launch by default.
        self._applied_highlight = None
        self._bank2 = None
        self._bank3 = None
        self._three_bank_closed = False
        # Track which pushes started as native (unmodified) gestures. Latch
        # transport presses until their matching release even when the side
        # modifier is released first.
        self._transport_modifier_down = False
        self._transport_shift_down = False
        self._transport_locked = False
        self._transport_visible = False
        self._transport_press_at = 0.0
        self._transport_gesture_used = False
        self._transport_suppressed = set()
        self._transport_native_down = set()
        self._native_bottom_feedback = {}
        self._transport_led_sent = {}
        self._transport_led_tick_pending = False
        self._transport_capture_flash_until = 0.0
        self._shuttle_e13_guard_until = 0.0
        self._loop_e16_guard_until = 0.0
        # These accumulators belong only to the transport overlay. Keep per-
        # bank/action/shift remainders so changing banks or precision cannot
        # unexpectedly complete a partial move.
        self._transport_turn_remainder = {}
        self._transport_capture_held = set()
        self._transport_capture_resized = set()
        # Session vs Arrangement record chord. E13 and E14 now resolve on
        # release so pressing both in either order cannot first toggle Play
        # or Session Record. These sets are transport-overlay-only.
        self._transport_record_pending = set()
        self._transport_record_chorded = set()
        self._state_store = None
        self._state_document = None
        self._state_last_seen = None
        self._state_pending_save = False
        self._preset_button_held = {}  # key -> press timestamp; release always consumed
        self._preset_hold_fired = set()  # save performed at two-second threshold
        self._preset_hold_canceled = set()  # top-right released before threshold
        self._preset_hold_timer_pending = False
        self._preset_native_feedback = {}
        self._preset_led_sent = {}
        self._preset_tick_pending = False
        self._preset_confirm = None  # (slot or 'factory', at, ends_at, saved?)
        self._preset_rgb_dirty = False
        self._edit_initialize()
        self._bank_animation_initialize()
        super(ThreeBankHost, self).__init__(c_instance)
        self._bank2 = FourTrackBank2(self)
        self._bank3 = SequencerBank3(self)
        self._start_layout_manager()
        # Register the global side switch with the same _Framework input
        # mechanism used by Bank 1's working encoders. Beta 2 forwarded it
        # manually as raw MIDI; in Live we never confirmed that the raw path
        # delivered system-channel CC8 to this host.
        with self.component_guard():
            self._global_side_button = ButtonElement(
                True, MIDI_CC_TYPE,
                self.TRANSPORT_MODIFIER_CHANNEL,
                self.TRANSPORT_MODIFIER_CC,
                name='MF3_GlobalTransport_SideLeftTop')
            self._global_side_button.add_value_listener(self._side_transport_value)
            # Bank 1's disconnect() already removes all _controls listeners.
            self._controls.append((self._global_side_button, self._side_transport_value))
            # Keep top-right isolated; for now it is only an optional
            # ONE-BEAT shuttle modifier, with no page-switch action.
            self._global_shift_button = ButtonElement(
                True, MIDI_CC_TYPE,
                self.SHIFT_MODIFIER_CHANNEL,
                self.SHIFT_MODIFIER_CC,
                name='MF_BentoBoxV1_RightTop_ShiftReserved')
            self._global_shift_button.add_value_listener(self._side_shift_value)
            self._controls.append((self._global_shift_button, self._side_shift_value))
            # Firmware bank-select reports, Ch4/CC0..3. Keep these separate
            # from all encoder/push MIDI mappings. No outbound bank command.
            self._bank_selector_elements = []
            for bank in range(4):
                element = ButtonElement(True, MIDI_CC_TYPE,
                    self.SHIFT_MODIFIER_CHANNEL, bank,
                    name='MF_BentoBox_BankSelect_{}'.format(bank+1))
                listener = (lambda value, b=bank: self._bank_change_value(b, value))
                element.add_value_listener(listener)
                self._controls.append((element, listener))
                self._bank_selector_elements.append(element)
        # Both raw-forwarded companions are now present. Request a fresh map:
        # Live may have built its initial map before companion initialization.
        self.request_rebuild_midi_map()
        self.show_message('MF BentoBoxV1 v1.3 TEST | Dual Transport/Edit')

    def set_highlighting_session_component(self, component):
        # Called by the unchanged Bank 1 implementation.
        self._register_highlight('bank1', component)

    def _bank2_highlight_changed(self, component):
        # Called only from the Bank 2 component's create/close paths.
        self._register_highlight('bank2', component)

    def _register_highlight(self, bank, component):
        self._highlight_components[bank] = component
        self._apply_highlight()

    def _apply_highlight(self):
        owner = self._active_highlight_bank
        other = 'bank1' if owner == 'bank2' else 'bank2'
        target = self._highlight_components[owner] or self._highlight_components[other]
        if target is self._applied_highlight:
            return
        ControlSurface.set_highlighting_session_component(self, target)
        self._applied_highlight = target

    def _update_clip_highlight(self):
        # Bento closes its SessionComponent directly when Clip Launcher leaves;
        # invalidate that pointer so it cannot mask the Four-Track clip box.
        super(ThreeBankHost, self)._update_clip_highlight()
        if self._session_component is None and self._highlight_components['bank1'] is not None:
            self._register_highlight('bank1', None)

    @staticmethod
    def _preset_feedback_key(message):
        if len(message) != 3:
            return None
        status, cc, _value = tuple(int(x) for x in message)
        if status in (0xBA, 0xBB) and cc in tuple(range(4)) + tuple(range(16, 20)) + tuple(range(32, 36)):
            return status, cc
        return None

    def _layout_snapshot(self):
        return validated_layout({
            'bank1_columns': list(self._modes),
            'bank2_buttons': list(self._bank2._row_modules),
            'bank2_rotaries': [self._bank2._rotary_function(i) for i in range(4)],
        })

    def _apply_layout(self, layout):
        """Apply all rows as one transaction; no Live parameter values changed."""
        target = validated_layout(layout)
        if target == self._layout_snapshot():
            return
        # Update before refreshing to prevent one source's update from
        # reintroducing the old module ownership in the next scan.
        self._modes = target['bank1_columns']
        self._bank2._row_modules = target['bank2_buttons']
        self._bank2._rotary_overrides = target['bank2_rotaries']
        self._bank2._rotary_preview_rows.clear()
        self._bank2._module_scroll_steps = [0] * 4
        self._bank2._rotary_scroll_steps = [0] * 4
        self._bank2._device_base = 0
        self._bank2._send_offset = 0
        self._bank2._mute_volume_last_turn.clear()
        self._bank2._volume_feedback_until.clear()
        self._device_page = 0
        self._device_banks = [0] * 4
        self._fx_shared_offset = 0
        self._clamp_fx_window()
        self._bind_columns()
        self._bank2._refresh_all()
        self._state_last_seen = self._layout_snapshot()

    def _start_layout_manager(self):
        # Failure to access the user folder is non-fatal: factory settings
        # still work and a visible warning is given upon explicit save.
        self._state_store = LayoutStore()
        try:
            self._state_document = self._state_store.load()
        except (OSError, ValueError, TypeError) as exc:
            self.log_message('MF BentoBox state read: {}'.format(exc))
            self._state_document = LayoutStore.blank()
        layout = self._state_document['last_used'] or FACTORY_LAYOUT
        try:
            self._apply_layout(layout)
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('MF BentoBox layout restore fallback: {}'.format(exc))
            self._apply_layout(FACTORY_LAYOUT)
        self._state_last_seen = self._layout_snapshot()
        self.schedule_message(self.STATE_SCAN_FRAMES, self._state_scan_tick)

    def _state_scan_tick(self):
        if self._three_bank_closed:
            return
        try:
            layout = self._layout_snapshot()
            if layout != self._state_last_seen:
                self._state_last_seen = layout
                self._state_schedule_save()
        except (AttributeError, ValueError, RuntimeError) as exc:
            self.log_message('MF BentoBox state scan: {}'.format(exc))
        self.schedule_message(self.STATE_SCAN_FRAMES, self._state_scan_tick)

    def _state_schedule_save(self):
        if not self._state_pending_save and not self._three_bank_closed:
            self._state_pending_save = True
            self.schedule_message(self.STATE_SAVE_DELAY_FRAMES, self._state_save_last)

    def _state_write(self):
        try:
            self._state_store.save(self._state_document)
            return True
        except (OSError, ValueError, TypeError) as exc:
            self.log_message('MF BentoBox state save failed: {}: {}'.format(type(exc).__name__, exc))
            return False

    def _state_save_last(self):
        self._state_pending_save = False
        if self._three_bank_closed:
            return
        try:
            self._state_last_seen = self._layout_snapshot()
            self._state_document['last_used'] = self._state_last_seen
            self._state_write()
        except (RuntimeError, AttributeError, ValueError) as exc:
            self.log_message('MF BentoBox last layout save: {}'.format(exc))

    def _preset_recall(self, slot):
        layout = self._state_document['presets'].get(slot)
        if layout is None:
            self._preset_confirm_start(slot, saved=None)
            self.show_message('BentoBox Preset {}: empty'.format(slot))
            return
        try:
            self._apply_layout(layout)
            self._state_schedule_save()
            self._preset_confirm_start(slot, saved=False)
            self.show_message('BentoBox Preset {}: loaded'.format(slot))
        except (ValueError, AttributeError, RuntimeError) as exc:
            self.log_message('MF BentoBox preset recall: {}'.format(exc))
            self.show_message('BentoBox Preset {}: unavailable'.format(slot))

    def _preset_save(self, slot):
        previous = self._state_document['presets'].get(slot)
        previous_last = self._state_document['last_used']
        try:
            current = self._layout_snapshot()
            self._state_document['presets'][slot] = current
            self._state_document['last_used'] = current
            ok = self._state_write()
            if ok:
                self._state_last_seen = current
                self._preset_confirm_start(slot, saved=True)
                self.show_message('BentoBox Preset {}: SAVED'.format(slot))
                return
        except (AttributeError, ValueError, RuntimeError) as exc:
            self.log_message('MF BentoBox preset save: {}'.format(exc))
        # A rejected disk write must not leave an unsaved slot marked valid.
        if previous is None:
            self._state_document['presets'].pop(slot, None)
        else:
            self._state_document['presets'][slot] = previous
        self._state_document['last_used'] = previous_last
        self._preset_confirm_start(slot, saved=None)
        self.show_message('BentoBox Preset {}: SAVE FAILED'.format(slot))

    def _preset_restore_factory(self):
        self._apply_layout(FACTORY_LAYOUT)
        self._state_schedule_save()
        self._preset_confirm_start('factory', saved=False)
        self.show_message('BentoBox Factory Layout RESTORED (presets retained)')

    def _preset_overlay_active(self):
        return self._transport_shift_down or self._preset_confirm is not None

    def _preset_confirm_start(self, slot, saved):
        now = time.monotonic()
        self._preset_confirm = (slot, now, now + self.PRESET_CONFIRM_SECONDS, saved)
        self._render_preset_feedback(force=True)
        self._schedule_preset_feedback()

    def _render_preset_feedback(self, force=False):
        if self._three_bank_closed or not self._preset_overlay_active():
            return
        now = time.monotonic()
        confirmation = self._preset_confirm
        if confirmation and now >= confirmation[2]:
            self._preset_confirm = None
            confirmation = None
            if not self._transport_shift_down:
                self._restore_native_preset_row()
                return
        colors = list(self.PRESET_COLORS)
        slots = self._state_document.get('presets', {})
        for i, slot in enumerate(('1','2','3','4')):
            if slot not in slots:
                colors[i] = 0
            if confirmation and confirmation[0] in (slot, 'factory'):
                elapsed = now - confirmation[1]
                # Saved: 3 preset-colored flashes; loaded: 1 flash;
                # errors: 3 RED flashes; factory restore: 3 YELLOW flashes.
                pulses = 3 if confirmation[3] is not False else 1
                flash_color = (self.LED_COLORS['yellow'] if confirmation[0] == 'factory'
                               else self.LED_COLORS['red'] if confirmation[3] is None
                               else self.PRESET_COLORS[i])
                if elapsed < (pulses * 0.22):
                    colors[i] = flash_color if int(elapsed / 0.11) % 2 == 0 else 0
                else:
                    colors[i] = self.PRESET_COLORS[i] if self._transport_shift_down and slot in slots else 0
        for offset in (0,16,32):
            for i, value in enumerate(colors):
                key=(0xBA,offset+i)
                if self._bank_animation_suppress_for_key(key[0],key[1]):
                    continue
                if force or self._preset_led_sent.get(key) != value:
                    result = super(ThreeBankHost, self)._send_midi((0xBA,offset+i,value))
                    if result is not False:
                        self._preset_led_sent[key] = value

    def _restore_native_preset_row(self):
        self._preset_led_sent.clear()
        for offset in (0,16,32):
            for local in range(4):
                for status in (0xBA,0xBB):
                    prior = self._preset_native_feedback.get((status,offset+local))
                    if not self._bank_animation_suppress_for_key(status,offset+local):
                        super(ThreeBankHost, self)._send_midi(
                            prior if prior is not None else (status,offset+local,0))

    def _schedule_preset_feedback(self):
        if not self._three_bank_closed and self._preset_overlay_active() and not self._preset_tick_pending:
            self._preset_tick_pending = True
            self.schedule_message(self.PRESET_FEEDBACK_TICK_FRAMES, self._preset_feedback_tick)

    def _preset_feedback_tick(self):
        self._preset_tick_pending = False
        if self._three_bank_closed:
            return
        self._render_preset_feedback()
        self._schedule_preset_feedback()

    def _preset_schedule_hold_check(self):
        """Poll a pressed preset key at Live's next scheduler frame.

        Wall-clock time remains authoritative: no fixed-tempo frame assumption,
        no disk work on a MIDI callback, and nothing is scheduled when idle.
        """
        if (not self._three_bank_closed and self._preset_button_held
                and not self._preset_hold_timer_pending):
            self._preset_hold_timer_pending = True
            self.schedule_message(1, self._preset_hold_timer_tick)

    def _preset_hold_timer_tick(self):
        self._preset_hold_timer_pending = False
        if self._three_bank_closed:
            return
        now = time.monotonic()
        if self._transport_shift_down:
            for key, began in tuple(self._preset_button_held.items()):
                if (key[1] in self.PRESET_CC_TO_SLOT and
                        key not in self._preset_hold_fired and
                        key not in self._preset_hold_canceled and
                        now - began >= self.PRESET_SAVE_HOLD_SECONDS):
                    # The successful disk-write acknowledgement drives the
                    # RGB confirmation immediately, *before* encoder release.
                    self._preset_hold_fired.add(key)
                    self._preset_save(self.PRESET_CC_TO_SLOT[key[1]])
        self._preset_schedule_hold_check()

    def _preset_handle_push(self, bank, cc, value):
        if cc not in self.PRESET_CC_TO_SLOT and cc != self.PRESET_FACTORY_RESTORE_CC:
            return False
        key = (bank, cc)
        down = int(value) > 0
        if key in self._preset_button_held:
            if not down:
                began = self._preset_button_held.pop(key)
                canceled = key in self._preset_hold_canceled
                fired = key in self._preset_hold_fired
                self._preset_hold_canceled.discard(key)
                self._preset_hold_fired.discard(key)
                if canceled or fired:
                    return True  # Never double-save or recall on release.
                duration = time.monotonic() - began
                if cc == self.PRESET_FACTORY_RESTORE_CC:
                    # Factory restore remains the existing release-only chord.
                    if self._transport_shift_down and duration >= self.PRESET_SAVE_HOLD_SECONDS:
                        self._preset_restore_factory()
                elif duration >= self.PRESET_SAVE_HOLD_SECONDS and self._transport_shift_down:
                    # If a release arrives before the pending scheduled tick,
                    # still save exactly once rather than silently discard.
                    self._preset_save(self.PRESET_CC_TO_SLOT[cc])
                else:
                    self._preset_recall(self.PRESET_CC_TO_SLOT[cc])
            return True
        if down and self._transport_shift_down:
            self._preset_button_held[key] = time.monotonic()
            self._edit_gesture_used = True
            if cc in self.PRESET_CC_TO_SLOT:
                self._preset_schedule_hold_check()
            self._render_preset_feedback(force=True)
            return True
        return False

    @staticmethod
    def _bottom_feedback_key(message):
        """Return (status, physical CC) for a bottom encoder's native LEDs."""
        if len(message) != 3:
            return None
        status, cc, _value = tuple(int(x) for x in message)
        if status not in (0xBA, 0xBB):  # pushes/RGB, rotary/white ring
            return None
        if cc in (tuple(range(8, 16)) + tuple(range(24, 32)) + tuple(range(40, 48))):
            return (status, cc)
        return None

    def _send_midi(self, midi_bytes):
        # A *single* host owns the hardware LEDs. While overlay is active,
        # retain each bank's latest normal feedback without letting its
        # scheduler overwrite visible Transport Mode colors/rings.
        msg = tuple(int(x) for x in midi_bytes)
        if (len(msg) == 3 and msg[0] in (0xBA,0xBB) and 0 <= msg[1] < 48):
            self._bank_animation_native_feedback[(msg[0],msg[1])] = msg
            if self._bank_animation_suppress_for_key(msg[0],msg[1]):
                return True
        pkey = self._preset_feedback_key(msg)
        if pkey is not None:
            self._preset_native_feedback[pkey] = msg
            if self._preset_overlay_active() and not self._three_bank_closed:
                return True
        key = self._bottom_feedback_key(msg)
        if key is not None:
            self._native_bottom_feedback[key] = msg
            if not self._three_bank_closed:
                local = msg[1] % 16
                if ((self._transport_visible and local in self.TRANSPORT_BOTTOM_CCS)
                        or local in self._edit_row()):
                    return True  # only host overlay drives occupied rows
        return super(ThreeBankHost, self)._send_midi(msg)

    def _send_overlay(self, status, cc, value, force=False):
        """Bypass native-feedback interception, without modifying native caches."""
        value = max(0, min(127, int(value)))
        key = (status, cc)
        if self._bank_animation_suppress_for_key(status,cc):
            return
        if force or self._transport_led_sent.get(key) != value:
            sent = super(ThreeBankHost, self)._send_midi((status, cc, value))
            if sent is not False:
                self._transport_led_sent[key] = value

    def _restore_native_bottom_row(self):
        self._transport_led_sent.clear()
        for bank_offset in (0, 16, 32):
            for local_cc in self.TRANSPORT_BOTTOM_CCS:
                cc = bank_offset + local_cc
                for status in (0xBA, 0xBB):
                    prior = self._native_bottom_feedback.get((status, cc))
                    if prior is None:
                        # No previous native feedback means no meaningful ring
                        # or RGB color to restore; clear the transport overlay.
                        prior = (status, cc, 0)
                    super(ThreeBankHost, self)._send_midi(prior)

    def _render_transport_feedback(self, force=False):
        if self._three_bank_closed or not self._transport_visible:
            return
        try:
            song = self.song()
            playing = bool(song.is_playing)
            # In Live: SessionRecordStatus.off=0, on=1, transition=2.
            # 'transition' is queued, not yet active recording. Prefer the
            # status to the Session Overdub toggle; Live may expose a pending
            # state while Session Record is armed but not recording.
            session_status = getattr(song, 'session_record_status', None)
            if session_status is None:
                session_active = bool(getattr(song, 'session_record', False))
            else:
                session_active = (int(session_status) == 1)
            recording = bool(song.record_mode) or session_active
            loop = bool(song.loop)
            capturable = bool(getattr(song, 'can_capture_midi', False))
        except (RuntimeError, AttributeError, TypeError, ValueError):
            return
        now = time.monotonic()
        blink_on = (int(now * 4) % 2 == 0)  # 2 flashes/second
        color = self.LED_COLORS
        capture_pulse = now < self._transport_capture_flash_until
        rgb = (
            (color['green'] if blink_on else 0) if playing else color['yellow'],
            (color['red'] if blink_on else 0) if recording and playing
            else color['purple'],
            # Purple LED shares the already-used FX Sends palette entry (47).
            # 75% on-duty while capture is available: the old 50%-off pulse
            # was reported as invisible even when the white availability ring
            # was active. A capture confirmation holds brighter purple.
            (color['light_purple'] if capture_pulse else
             (self._bank2.SEND_COLOR if capturable and (int(now * 4) % 4 != 3) else 0)),
            color['yellow'] if loop else 0,
        )
        rings = (127 if playing else 0,
                 127 if recording else 0,
                 127 if capture_pulse else (64 if capturable else 0),
                 127 if loop else 0)
        for offset in (0, 16, 32):
            for idx, local in enumerate(self.TRANSPORT_BOTTOM_CCS):
                self._send_overlay(0xBA, offset + local, rgb[idx], force=force)
                self._send_overlay(0xBB, offset + local, rings[idx], force=force)

    def _transport_feedback_tick(self):
        self._transport_led_tick_pending = False
        if self._three_bank_closed or not self._transport_visible:
            return
        self._render_transport_feedback()
        self._schedule_transport_feedback()

    def _schedule_transport_feedback(self):
        if self._transport_visible and not self._three_bank_closed and not self._transport_led_tick_pending:
            self._transport_led_tick_pending = True
            self.schedule_message(self.TRANSPORT_LED_TICK_FRAMES, self._transport_feedback_tick)

    def _transport_set_visible(self, enabled):
        enabled = bool(enabled)
        if enabled == self._transport_visible:
            return
        self._transport_visible = enabled
        # Partial detents must not survive mode changes.
        self._transport_turn_remainder.clear()
        self._edit_on_transport_changed()
        if enabled:
            self._schedule_transport_feedback()

    def _side_transport_value(self, value):
        """CC Hold: tap toggles the overlay, hold opens a momentary overlay."""
        if self._three_bank_closed:
            return
        down = int(value) > 0
        if down == self._transport_modifier_down:
            return
        now = time.monotonic()
        if down:
            self._transport_modifier_down = True
            self._transport_press_at = now
            self._transport_gesture_used = False
            self._transport_set_visible(True)
            self._edit_announce()
            self.log_message('MF Global Transport: modifier Ch4 CC8 pressed')
        else:
            self._transport_modifier_down = False
            tap = not self._transport_gesture_used and (now - self._transport_press_at) <= self.TAP_MAX_SECONDS
            if tap:
                self._transport_locked = not self._transport_locked
            self._transport_set_visible(self._transport_locked)
            self._edit_announce()

    def _side_shift_value(self, value):
        """Top-right reserved; currently Shift+E13 rotary = one beat."""
        if not self._three_bank_closed:
            shift_down = int(value) > 0
            if shift_down != self._transport_shift_down:
                was_visible = self._preset_overlay_active()
                self._transport_shift_down = shift_down
                self._edit_side_value(shift_down, used_by_presets=bool(self._preset_button_held))
                if shift_down:
                    self._preset_led_sent.clear()
                    self._render_preset_feedback(force=True)
                    self._schedule_preset_feedback()
                elif not self._preset_overlay_active() and was_visible:
                    self._restore_native_preset_row()
                if not shift_down:
                    # Releasing the modifier before the two-second deadline
                    # cancels unfinished saves. Do not save later just because
                    # the encoder remains physically held.
                    for key in self._preset_button_held:
                        if key not in self._preset_hold_fired:
                            self._preset_hold_canceled.add(key)
                # Never carry a partial bar across a change to beat mode.
                for key in tuple(self._transport_turn_remainder):
                    if key[1] == 'shuttle':
                        del self._transport_turn_remainder[key]

    def _transport_count_detents(self, bank, operation, value, shifted=False):
        """Translate four relative detents into one signed movement."""
        value = int(value)
        if value not in (63, 65):
            return 0
        key = (bank, operation, bool(shifted))
        total = self._transport_turn_remainder.get(key, 0) + (1 if value == 65 else -1)
        if abs(total) < self.TRANSPORT_TICKS_PER_STEP:
            self._transport_turn_remainder[key] = total
            return 0
        direction = 1 if total > 0 else -1
        self._transport_turn_remainder[key] = total - direction * self.TRANSPORT_TICKS_PER_STEP
        return direction

    def _transport_time_units(self, song):
        """Return (quarter-note units per notated beat, units per bar)."""
        numerator = int(song.signature_numerator)
        denominator = int(song.signature_denominator)
        if numerator < 1 or denominator not in (1, 2, 4, 8, 16):
            raise ValueError('Unsupported song time signature')
        beat = 4.0 / denominator
        return beat, numerator * beat

    def _transport_edit_allowed(self, song):
        if bool(song.record_mode) and bool(song.is_playing):
            self.show_message('Transport timeline edit disabled while recording')
            return False
        return True

    def _transport_route_rotary(self, bank, cc, value):
        key = (bank, cc)
        if (cc in (self.SHUTTLE_E13_CC, self.LOOP_E16_CC)
                and self._transport_visible and key not in self._transport_native_down):
            guard = (self._shuttle_e13_guard_until if cc == self.SHUTTLE_E13_CC
                     else self._loop_e16_guard_until)
            if key not in self._transport_suppressed and time.monotonic() >= guard:
                if int(value) in (63, 65):
                    self._transport_gesture_used = True
                    if cc == self.SHUTTLE_E13_CC:
                        if self._transport_shift_down:
                            self._edit_gesture_used = True
                        self._shuttle_arrangement(bank, value)
                    else:
                        capture_key = (bank, self.CAPTURE_E15_CC)
                        resize = capture_key in self._transport_capture_held
                        if resize:
                            # Intentional rotary use suppresses release-capture,
                            # even if fewer than four detents were supplied.
                            self._transport_capture_resized.add(capture_key)
                        self._move_or_resize_arrangement_loop(bank, value, resize)
            return True
        return self._transport_block_rotary(bank, cc)

    def _shuttle_arrangement(self, bank, value):
        """E13: +/-1 bar per 4 detents, or top-right + E13 +/-1 beat."""
        try:
            song = self.song()
            if not self._transport_edit_allowed(song):
                return
            beat, bar = self._transport_time_units(song)
            shifted = bool(self._transport_shift_down)
            direction = self._transport_count_detents(bank, 'shuttle', value, shifted)
            if not direction:
                return
            song.jump_by(direction * (beat if shifted else bar))
            self.show_message('Arrangement {} 1 {}'.format(
                'forward' if direction > 0 else 'back',
                'beat' if shifted else 'bar'))
        except (AttributeError, RuntimeError, ValueError, TypeError) as exc:
            self.log_message('MF BentoBoxV1 shuttle: {}: {}'.format(type(exc).__name__, exc))

    def _move_or_resize_arrangement_loop(self, bank, value, resize):
        """E16: move whole loop by a bar; E15 held: resize end by a beat.

        Neither action toggles song.loop. A failed write never changes the
        other loop property or invokes Capture MIDI.
        """
        try:
            song = self.song()
            if not self._transport_edit_allowed(song):
                return
            beat, bar = self._transport_time_units(song)
            operation = 'loop_resize' if resize else 'loop_move'
            direction = self._transport_count_detents(bank, operation, value)
            if not direction:
                return
            if resize:
                original_length = float(song.loop_length)
                new_length = max(beat, original_length + direction * beat)
                if abs(new_length - original_length) > 0.000001:
                    song.loop_length = new_length
                    self.show_message('Arrangement loop length {} 1 beat'.format(
                        'increased' if direction > 0 else 'decreased'))
            else:
                original_start = float(song.loop_start)
                new_start = max(0.0, original_start + direction * bar)
                if abs(new_start - original_start) > 0.000001:
                    song.loop_start = new_start
                    self.show_message('Arrangement loop moved {} 1 bar'.format(
                        'forward' if direction > 0 else 'back'))
        except (AttributeError, RuntimeError, ValueError, TypeError) as exc:
            self.log_message('MF BentoBoxV1 loop: {}: {}'.format(type(exc).__name__, exc))

    def _transport_handle_push(self, bank, cc, value):
        """Return True only for a completely consumed transport press/release.

        Called from Bank 1's framework push callback or raw Bank 2/3 dispatch.
        It never lets a matching release fall back into a bank's ordinary action.
        A button that was already held before the modifier stays bank-owned.
        """
        if cc not in self.TRANSPORT_BOTTOM_CCS:
            return False
        key = (bank, cc)
        down = int(value) > 0
        if cc == self.SHUTTLE_E13_CC:
            self._shuttle_e13_guard_until = time.monotonic() + self.SHUTTLE_PRESS_GUARD_SECONDS
        if cc == self.LOOP_E16_CC:
            self._loop_e16_guard_until = time.monotonic() + self.SHUTTLE_PRESS_GUARD_SECONDS
        if key in self._transport_suppressed:
            if not down:
                self._transport_suppressed.discard(key)
                if key in self._transport_record_pending:
                    # When the other transport push was pressed during this
                    # hold, the chord already executed. Neither release may
                    # subsequently toggle playback or session recording.
                    self._transport_record_pending.discard(key)
                    if key in self._transport_record_chorded:
                        self._transport_record_chorded.discard(key)
                    elif not self._three_bank_closed:
                        self._transport_execute(cc)
                if key in self._transport_capture_held:
                    self._transport_capture_held.discard(key)
                    resized = key in self._transport_capture_resized
                    self._transport_capture_resized.discard(key)
                    if not resized and not self._three_bank_closed:
                        # E15 tap captures on release so E15+E16 twist can
                        # resize without accidentally capturing on press.
                        self._transport_execute(self.CAPTURE_E15_CC)
            return True
        if down and self._transport_visible and key not in self._transport_native_down:
            self._transport_suppressed.add(key)
            self._transport_gesture_used = True
            if cc in (12, 13):
                self._transport_record_pending.add(key)
                other = (bank, 13 if cc == 12 else 12)
                if other in self._transport_record_pending:
                    # E13 Play/Stop + E14 Session Rec => Arrangement Record.
                    # Order-independent, once per complete chord.
                    already_chorded = other in self._transport_record_chorded
                    self._transport_record_chorded.add(key)
                    self._transport_record_chorded.add(other)
                    if not already_chorded:
                        self._transport_execute_arrangement_record()
            elif cc == self.CAPTURE_E15_CC:
                self._transport_capture_held.add(key)
                self._transport_capture_resized.discard(key)
                for k in tuple(self._transport_turn_remainder):
                    if k[0] == bank and k[1] in ('loop_move', 'loop_resize'):
                        del self._transport_turn_remainder[k]
            else:
                self._transport_execute(cc)
            return True
        if down:
            self._transport_native_down.add(key)
        else:
            self._transport_native_down.discard(key)
        return False

    def _transport_block_rotary(self, bank, cc):
        key = (bank, cc)
        return cc in self.TRANSPORT_BOTTOM_CCS and (
            key in self._transport_suppressed
            or (self._transport_visible and key not in self._transport_native_down))

    def _push(self, cc, value):
        # Bank 1's ButtonElements call this method directly. Interception in
        # receive_midi alone would NOT protect Bank 1 from normal push actions.
        if self._three_bank_closed:
            return
        if self._preset_handle_push('bank1', cc, value):
            return
        if self._edit_handle_push('bank1', cc, value):
            return
        if not self._transport_handle_push('bank1', cc, value):
            super(ThreeBankHost, self)._push(cc, value)

    def _rotate(self, cc, value):
        if self._three_bank_closed:
            return
        if ('bank1', cc) in self._preset_button_held:
            return
        if self._edit_route_rotary('bank1', cc, value):
            return
        if not self._transport_route_rotary('bank1', cc, value):
            super(ThreeBankHost, self)._rotate(cc, value)

    def _transport_execute_arrangement_record(self):
        """Order-independent E13+E14 chord; never touches playback state."""
        try:
            song = self.song()
            song.record_mode = not bool(song.record_mode)
            self.show_message('Global Transport: ARR RECORD {}'.format(
                'ON' if song.record_mode else 'OFF'))
            self._render_transport_feedback()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            self.log_message('MF Arrangement Record chord: {}: {}'.format(
                type(exc).__name__, exc))
            self.show_message('Global Transport: Arrangement Record unavailable')

    def _transport_execute(self, cc):
        """Execute a debounced transport action (E13/E14/E15 on release)."""
        try:
            song = self.song()
            if cc == 12:  # E13
                if song.is_playing:
                    song.stop_playing()
                    message = 'Global Transport: STOP'
                else:
                    song.start_playing()
                    message = 'Global Transport: PLAY'
            elif cc == 13:  # E14 normal push = Live's Session Record button.
                song.trigger_session_record()
                message = 'Global Transport: SESSION RECORD'
            elif cc == 14:  # E15; active/focused Live view
                if not bool(getattr(song, 'can_capture_midi', False)):
                    message = 'Global Transport: nothing to Capture MIDI'
                else:
                    song.capture_midi()
                    self._transport_capture_flash_until = time.monotonic() + self.TRANSPORT_CAPTURE_FLASH_SECONDS
                    message = 'Global Transport: Capture MIDI'
            elif cc == 15:  # E16; provisional Arrangement loop choice
                song.loop = not bool(song.loop)
                message = 'Global Transport: ARR LOOP {}'.format(
                    'ON' if song.loop else 'OFF')
            else:
                return
            self.show_message(message)
            self._render_transport_feedback()
        except (AttributeError, RuntimeError, TypeError, ValueError) as exc:
            # Never let an unavailable Live API crash the whole ControlSurface.
            self.log_message('MF Transport {}: {}: {}'.format(
                cc, type(exc).__name__, exc))
            self.show_message('Global Transport: action unavailable')

    def build_midi_map(self, midi_map_handle):
        super(ThreeBankHost, self).build_midi_map(midi_map_handle)
        # CC8 on Channel 4 is framework-managed via _global_side_button,
        # never registered a second time for raw MIDI forwarding.
        # Bank 2 is a plain Python companion, not a ControlSurface. Register
        # both channels explicitly so Live actually calls receive_midi for it.
        if self._bank2 is not None and not self._three_bank_closed:
            for channel in (self._bank2.PUSH_CH, self._bank2.ROTARY_CH):
                for cc in range(16, 32):
                    Live.MidiMap.forward_midi_cc(
                        self._c_instance.handle(), midi_map_handle, channel, cc)
        if self._bank3 is not None and not self._three_bank_closed:
            self._bank3.build_midi_map(midi_map_handle)

    def receive_midi(self, midi_bytes):
        if self._three_bank_closed:
            return
        if len(midi_bytes) == 3:
            status, cc, value = (int(x) for x in midi_bytes)
            # Side-button input is framework-managed. Let the parent deliver
            # Ch4/CC8 to _side_transport_value; never swallow it here.
            if (status & 0xF0) == 0xB0 and (status & 0x0F) in (10, 11):
                if 32 <= cc <= 47 and self._bank3 is not None:
                    local_cc = cc - 32
                    if (status & 0x0F) == self.TRANSPORT_PUSH_CHANNEL:
                        if self._preset_handle_push('bank3', local_cc, value):
                            return
                        if self._edit_handle_push('bank3', local_cc, value):
                            return
                        if self._transport_handle_push('bank3', local_cc, value):
                            return
                    elif (status & 0x0F) == self.TRANSPORT_ROTARY_CHANNEL:
                        if ('bank3', local_cc) in self._preset_button_held:
                            return
                        if self._edit_route_rotary('bank3', local_cc, value):
                            return
                        if self._transport_route_rotary('bank3', local_cc, value):
                            return
                    self._bank3.receive_midi(midi_bytes)
                    return
                if 16 <= cc <= 31 and self._bank2 is not None:
                    if self._active_highlight_bank != 'bank2':
                        self._active_highlight_bank = 'bank2'
                        self._apply_highlight()
                    local_cc = cc - 16
                    if (status & 0x0F) == self._bank2.ROTARY_CH:
                        if ('bank2', local_cc) in self._preset_button_held:
                            return
                        if self._edit_route_rotary('bank2', local_cc, value):
                            return
                        if not self._transport_route_rotary('bank2', local_cc, value):
                            self._bank2._rotary(local_cc, value)
                    else:
                        if self._preset_handle_push('bank2', local_cc, value):
                            return
                        if self._edit_handle_push('bank2', local_cc, value):
                            return
                        if not self._transport_handle_push('bank2', local_cc, value):
                            self._bank2._push(local_cc, value)
                    return  # Never also dispatch via _Framework (double event).
                if 0 <= cc <= 15 and self._active_highlight_bank != 'bank1':
                    self._active_highlight_bank = 'bank1'
                    self._apply_highlight()
        super(ThreeBankHost, self).receive_midi(midi_bytes)

    def refresh_state(self):
        super(ThreeBankHost, self).refresh_state()
        if self._bank2 is not None and not self._three_bank_closed:
            self._bank2.refresh_state()
        if self._bank3 is not None and not self._three_bank_closed:
            self._bank3.refresh_state()
        self._render_transport_feedback(force=True)
        self._edit_render_feedback(force=True)

    def disconnect(self):
        if self._three_bank_closed:
            return
        self._three_bank_closed = True
        self._transport_modifier_down = False
        self._transport_shift_down = False
        self._edit_visible = False
        self._edit_locked = False
        self._bank_animation_active = None
        self._bank_animation_tick_pending = False
        self._edit_suppressed.clear()
        self._edit_native_down.clear()
        self._edit_pressed.clear()
        self._edit_led_sent.clear()
        self._edit_rotary_remainder.clear()
        self._preset_confirm = None
        self._preset_button_held.clear()
        self._preset_hold_fired.clear()
        self._preset_hold_canceled.clear()
        self._preset_hold_timer_pending = False
        self._preset_tick_pending = False
        self._transport_visible = False
        self._transport_locked = False
        self._transport_led_tick_pending = False
        self._transport_led_sent.clear()
        self._transport_suppressed.clear()
        self._transport_native_down.clear()
        self._transport_turn_remainder.clear()
        self._transport_capture_held.clear()
        self._transport_capture_resized.clear()
        self._transport_record_pending.clear()
        self._transport_record_chorded.clear()
        self._preset_button_held.clear()
        self._preset_led_sent.clear()
        try:
            if self._state_document is not None and self._state_store is not None:
                latest = self._layout_snapshot()
                if latest != self._state_document.get('last_used'):
                    self._state_document['last_used'] = latest
                    self._state_write()
        except (AttributeError, ValueError, RuntimeError):
            pass
        try:
            if self._bank3 is not None:
                self._bank3.disconnect()
            if self._bank2 is not None:
                self._bank2.disconnect()
        finally:
            # Let Bank 1 close its own bindings before framework shutdown.
            # Explicitly clear highlight ownership at the very end.
            try:
                super(ThreeBankHost, self).disconnect()
            finally:
                self._highlight_components = {'bank1': None, 'bank2': None}
                self._applied_highlight = None
