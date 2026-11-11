"""COL-001 v0.2: output-only MFT color calibration, banks 1 and 3.

Fixed RGB feedback: CC MIDI channel 2 (status B1);
bank 1 CC 0..15; bank 3 CC 32..47.
No input/control mappings. Repeats palette to avoid startup timing.
"""
from ableton.v2.control_surface import ControlSurface

BANK_1 = tuple(1 + 4 * i for i in range(16))
BANK_3 = tuple(65 + 4 * i for i in range(16))
REFRESH_TICKS = 80  # Ableton display ticks (~8 seconds at nominal 100 ms)


class ColorCalibrationSurface(ControlSurface):
    def __init__(self, c_instance):
        super(ColorCalibrationSurface, self).__init__(c_instance)
        self._col001_ticks = 0
        self._col001_sends = 0
        self.log_message("COL-001 v0.2 loaded: output-only Bank 1 + Bank 3 palette")
        with self.component_guard():
            self.schedule_message(10, self._send_palette)

    def _send_palette(self):
        sent = 0
        for offset, palette in ((0, BANK_1), (32, BANK_3)):
            for index, value in enumerate(palette):
                result = self._send_midi((0xB1, offset + index, value))
                if result is not False:
                    sent += 1
        self._col001_sends += 1
        if self._col001_sends <= 3:
            self.log_message("COL-001 palette transmission #%d, %d messages attempted" % (self._col001_sends, sent))

    def update_display(self):
        super(ColorCalibrationSurface, self).update_display()
        self._col001_ticks += 1
        if self._col001_ticks >= REFRESH_TICKS:
            self._col001_ticks = 0
            self._send_palette()

    def receive_midi(self, midi_bytes):
        pass
