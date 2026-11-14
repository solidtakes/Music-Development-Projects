"""Live adapter. No appointed-device following, global routing or SysEx."""
import Live
from ableton.v2.control_surface import ControlSurface
from .controller import Controller
from .mapping import VERSION


class Bank4Surface(ControlSurface):
    def __init__(self, c_instance):
        super(Bank4Surface, self).__init__(c_instance)
        self._bank4 = None
        self._bank4_alive = True
        with self.component_guard():
            self._bank4 = Controller(self.song, self._bank4_send)
            self._bank4.sync()
        self.request_rebuild_midi_map()
        # A single owned polling chain; callbacks after disconnect are inert.
        self.schedule_message(5, self._bank4_tick)
        try:
            self.show_message('Bank 4 ' + VERSION + ' loaded')
        except Exception:
            pass

    def _bank4_send(self, message):
        return self._send_midi(message, optimized=False)

    def build_midi_map(self, midi_map_handle):
        super(Bank4Surface, self).build_midi_map(midi_map_handle)
        for cc in range(48, 64):
            Live.MidiMap.forward_midi_cc(
                self._c_instance.handle(), midi_map_handle, 11, cc)

    def _bank4_tick(self):
        if not self._bank4_alive:
            return
        self._bank4.sync()
        self.schedule_message(5, self._bank4_tick)

    def receive_midi(self, midi_bytes):
        if getattr(self, '_bank4_alive', False) and self._bank4 is not None:
            with self.component_guard():
                self._bank4.receive(midi_bytes)

    def receive_midi_chunk(self, midi_chunk):
        # Live's batch entry point is separate from receive_midi in v2.
        # Route every event through our same scoped handler, in original order.
        for midi_bytes in midi_chunk:
            self.receive_midi(midi_bytes)

    def refresh_state(self):
        super(Bank4Surface, self).refresh_state()
        controller = getattr(self, '_bank4', None)
        if controller is not None:
            controller.refresh()

    def disconnect(self):
        self._bank4_alive = False
        try:
            if self._bank4 is not None:
                self._bank4.close()
        finally:
            super(Bank4Surface, self).disconnect()
