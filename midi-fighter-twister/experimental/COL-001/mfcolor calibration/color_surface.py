"""COL-001: output-only RGB palette for MFT banks 1 and 3.

Fixed Twister RGB feedback: CC MIDI channel 2 (status 0xB1),
bank 1 CC 0..15, bank 3 CC 32..47.
"""
from ableton.v2.control_surface import ControlSurface

BANK_1 = tuple(1 + 4 * i for i in range(16))
BANK_3 = tuple(65 + 4 * i for i in range(16))


class ColorCalibrationSurface(ControlSurface):
    def __init__(self, c_instance):
        super(ColorCalibrationSurface, self).__init__(c_instance)
        with self.component_guard():
            self.schedule_message(2, self._send_palette)

    def _send_palette(self):
        for offset, palette in ((0, BANK_1), (32, BANK_3)):
            for index, value in enumerate(palette):
                self._send_midi((0xB1, offset + index, value))
        self.log_message('COL-001 RGB palette sent to banks 1 and 3; no controls mapped')

    def receive_midi(self, midi_bytes):
        pass
