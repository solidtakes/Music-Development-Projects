"""v1.8 regression tests for Sends reset, fast refresh, Master Volume and FX recovery."""
import types
import unittest
from pathlib import Path
import mock_live as mock

SOURCE = Path(__file__).resolve().parents[1] / "MF4TRKBento" / "MF4TRKBento.py"
module = mock.load(SOURCE)


class V18Features(unittest.TestCase):
    def setUp(self):
        self.song = mock.SONG = mock.Song()
        self.clock = [1.0]
        module.time = types.SimpleNamespace(monotonic=lambda: self.clock[0])
        self.surface = module.create_instance(None)
        self.addCleanup(self.surface.disconnect)

    def push(self, cc, value):
        self.surface._elements[2 * cc + 1][1](value)

    def tap(self, cc):
        self.push(cc, 127)
        self.push(cc, 0)

    def turn(self, cc, count=1):
        for _ in range(count):
            self.surface._elements[2 * cc][1](65)

    def fx_toggle(self):
        self.push(0, 127)
        self.push(15, 127)
        self.push(15, 0)
        self.push(0, 0)

    def alt_toggle(self):
        self.push(15, 127)
        self.push(0, 127)
        self.push(0, 0)
        self.push(15, 0)

    def test_sends_push_resets_only_selected_send_to_minimum(self):
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Sends"]
        track = self.song.tracks[0]
        track.mixer_device.sends[0].value = 0.73
        track.mixer_device.sends[1].value = 0.41
        self.surface._refresh_all()
        self.tap(12)
        self.assertEqual(track.mixer_device.sends[0].value, 0.0)
        self.assertEqual(track.mixer_device.sends[1].value, 0.41)
        self.assertEqual(self.surface._frame[12][0], self.surface.SEND_COLOR)
        self.assertEqual(self.surface._frame[12][2], 0)

    def test_sends_push_and_turn_is_safe_and_audio_gated(self):
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Sends"]
        track = self.song.tracks[0]
        parameter = track.mixer_device.sends[0]
        parameter.value = 0.5
        self.push(12, 127)
        self.turn(12, 3)
        self.assertEqual(parameter.value, 0.5)
        self.push(12, 0)
        self.assertEqual(parameter.value, 0.0)
        track.has_audio_output = False
        parameter.value = 0.6
        self.tap(12)
        self.assertEqual(parameter.value, 0.6)

    def test_pan_and_send_turns_do_not_trigger_full_grid_scan(self):
        self.surface._row_modules[:] = ["Pan", "Sends", "Mute", "Pan"]
        self.surface._refresh_all()
        scans = []
        renders = []
        self.surface._scan_frame = lambda: scans.append("scan")
        self.surface._render_frame = lambda update_rings: renders.append("full-render")
        self.turn(0)
        self.turn(4)
        self.tap(0)
        self.tap(4)
        self.assertEqual(scans, [])
        self.assertEqual(renders, [])


    def test_pan_push_first_suppresses_turn_then_resets_to_center(self):
        self.surface._row_modules[:] = ["Pan", "Sends", "Mute", "Pan"]
        parameter = self.song.tracks[0].mixer_device.panning
        parameter.value = 0.5
        self.push(0, 127)
        self.turn(0, 3)
        self.assertEqual(parameter.value, 0.5)
        self.push(0, 0)
        self.assertEqual(parameter.value, 0.0)

    def test_master_volume_uses_fourth_mute_encoder_in_alt_mode(self):
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Pan"]
        self.surface._alt_mode = True
        master = self.song.master_track
        master.mixer_device.volume.value = 0.5
        self.surface._refresh_all()
        before = master.mixer_device.volume.value
        self.turn(11)
        self.assertGreater(master.mixer_device.volume.value, before)
        state = self.surface._frame[11]
        self.assertEqual(state[0], self.surface.UNSOLO_COLOR)
        self.assertGreater(state[2], 0)
        self.song.tracks[0].solo = True
        self.surface._refresh_all()
        self.assertEqual(self.surface._frame[11][1], 4)
        self.clock[0] += 0.050
        self.tap(11)
        self.assertFalse(self.song.tracks[0].solo)
        self.assertEqual(self.surface._frame[11][1], 0)

    def test_master_volume_push_first_suppresses_rotation_and_unsolos(self):
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Pan"]
        self.surface._alt_mode = True
        master = self.song.master_track
        before = master.mixer_device.volume.value
        self.song.return_tracks[0].solo = True
        self.push(11, 127)
        self.turn(11, 2)
        self.assertEqual(master.mixer_device.volume.value, before)
        self.push(11, 0)
        self.assertFalse(self.song.return_tracks[0].solo)

    def test_fx_group_recovers_when_last_return_is_removed(self):
        self.song.return_tracks = [mock.Track(), mock.Track()]
        self.surface._track_offset = 2
        self.surface._refresh_all()
        self.fx_toggle()
        self.assertTrue(self.surface._fx_mode)
        self.assertIs(self.surface._track_for_column(0), self.song.return_tracks[0])
        self.song.return_tracks = []
        self.surface._refresh_all()
        self.assertFalse(self.surface._fx_mode)
        self.assertEqual(self.surface._track_offset, 2)
        self.assertIs(self.surface._track_for_column(0), self.song.visible_tracks[2])
        self.assertEqual(self.surface._session_component.tracks_to_use(),
                         self.song.visible_tracks)


if __name__ == "__main__":
    unittest.main(verbosity=2)
