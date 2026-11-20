"""MF Build 3 Banks Beta 1 TEST — single Ableton ControlSurface.
Bank 1: Selected Track Bento v2.2 (CC0-15)
Bank 2: Four-Track Bento v1.0 stable (physical CC16-31; local 0-15)
Bank 3: Sequencer SP1 / v1.0 stable (CC32-47)
No Native Mode, transport overlay, or controller setup changes.
"""
import Live
from _Framework.ControlSurface import ControlSurface
from .Bank1_SelectedTrack import MidiFighterTwisterCustom
from .FourTrack_Bank2 import FourTrackBank2
from .Sequencer_Bank3 import SequencerBank3


class ThreeBankHost(MidiFighterTwisterCustom):
    def __init__(self, c_instance):
        # Highlight requests are bank-local; the host alone owns the red box.
        self._highlight_components = {'bank1': None, 'bank2': None}
        self._active_highlight_bank = 'bank2'  # Bank 2 has Clip Launch by default.
        self._applied_highlight = None
        self._bank2 = None
        self._bank3 = None
        self._three_bank_closed = False
        super(ThreeBankHost, self).__init__(c_instance)
        self._bank2 = FourTrackBank2(self)
        self._bank3 = SequencerBank3(self)
        # Both raw-forwarded companions are now present. Request a fresh map:
        # Live may have built its initial map before companion initialization.
        self.request_rebuild_midi_map()
        self.show_message('MF Build 3 Banks Beta 1.1 FIX TEST | CC0-47')

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

    def build_midi_map(self, midi_map_handle):
        super(ThreeBankHost, self).build_midi_map(midi_map_handle)
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
            if (status & 0xF0) == 0xB0 and (status & 0x0F) in (10, 11):
                if 32 <= cc <= 47 and self._bank3 is not None:
                    self._bank3.receive_midi(midi_bytes)
                    return
                if 16 <= cc <= 31 and self._bank2 is not None:
                    if self._active_highlight_bank != 'bank2':
                        self._active_highlight_bank = 'bank2'
                        self._apply_highlight()
                    local_cc = cc - 16
                    if (status & 0x0F) == self._bank2.ROTARY_CH:
                        self._bank2._rotary(local_cc, value)
                    else:
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

    def disconnect(self):
        if self._three_bank_closed:
            return
        self._three_bank_closed = True
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
