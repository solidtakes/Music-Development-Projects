"""v1.7 feature regressions: FX group, Volume/Mute, Unsolo and audio gating."""
import unittest
import types
from pathlib import Path
import mock_live as mock

SOURCE = Path(__file__).resolve().parents[1] / "MF4TRKBento" / "MF4TRKBento.py"
module = mock.load(SOURCE)


class V17Features(unittest.TestCase):
    def setUp(self):
        self.song = mock.SONG = mock.Song()
        self.clock = [1.0]
        module.time = types.SimpleNamespace(monotonic=lambda: self.clock[0])
        mock.SessionComponent.created_count = 0
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

    def test_fx_returns_toggle_moves_controls_and_session_box_together(self):
        returns = [mock.Track() for _ in range(6)]
        self.song.return_tracks = returns
        self.surface._track_offset = 2
        self.surface._refresh_all()
        self.fx_toggle()
        self.assertTrue(self.surface._fx_mode)
        self.assertEqual(self.surface._track_offset, 0)
        self.assertIs(self.surface._track_for_column(0), returns[0])
        self.assertIs(self.surface._track_for_column(3), returns[3])
        self.assertEqual(self.surface._session_size, (4, 1))
        self.assertEqual(self.surface._session_component.tracks_to_use(), returns)
        self.assertEqual(self.surface._session_component.offset, (0, 0))
        self.push(0, 127)
        self.turn(15, 4)
        self.push(0, 0)
        self.assertEqual(self.surface._track_offset, 1)
        self.assertIs(self.surface._track_for_column(0), returns[1])
        self.fx_toggle()
        self.assertFalse(self.surface._fx_mode)
        self.assertEqual(self.surface._track_offset, 2)
        self.assertIs(self.surface._track_for_column(0), self.song.visible_tracks[2])
        self.fx_toggle()
        self.assertTrue(self.surface._fx_mode)
        self.assertEqual(self.surface._track_offset, 1)
        self.assertIs(self.surface._track_for_column(0), returns[1])

    def test_fx_session_highlight_excludes_master_when_fewer_than_four_returns(self):
        returns = [mock.Track(), mock.Track()]
        self.song.return_tracks = returns
        self.fx_toggle()
        self.assertEqual(self.surface._session_size, (2, 1))
        self.assertEqual(self.surface._session_component.tracks_to_use(), returns)
        self.assertNotIn(self.song.master_track, self.surface._session_component.tracks_to_use())
        self.assertIsNone(self.surface._track_for_column(2))
        self.assertIsNone(self.surface._track_for_column(3))

    def test_e16_alone_and_reverse_alt_gesture_keep_their_existing_meanings(self):
        self.song.return_tracks = [mock.Track()]
        self.tap(15)
        self.assertFalse(self.surface._fx_mode)
        self.alt_toggle()
        self.assertTrue(self.surface._alt_mode)
        self.assertFalse(self.surface._fx_mode)
        self.fx_toggle()
        self.assertTrue(self.surface._fx_mode)
        self.assertTrue(self.surface._alt_mode)

    def test_mute_module_combines_volume_and_mute_with_both_press_orders(self):
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Sends"]
        track = self.song.tracks[0]
        parameter = track.mixer_device.volume
        parameter.value = 0.5
        self.surface._refresh_all()
        initial = parameter.value
        self.assertEqual(self.surface._frame[8][2], 64)
        self.push(8, 127)
        self.turn(8)
        self.assertEqual(parameter.value, initial)
        self.push(8, 0)
        self.assertTrue(track.mute)
        self.assertEqual(self.surface._frame[8][1], 4)
        self.assertEqual(self.surface._frame[8][2], 64)
        track.mute = False
        self.surface._refresh_all()
        before = parameter.value
        schedule_calls = self.surface.schedule_message_calls
        self.turn(8)
        self.assertGreater(parameter.value, before)
        self.assertEqual(self.surface.schedule_message_calls, schedule_calls)
        self.clock[0] += 0.020
        self.push(8, 127)
        self.assertAlmostEqual(parameter.value, before)
        self.push(8, 0)
        self.assertTrue(track.mute)
        track.mute = False
        parameter.value = 0.5
        self.surface._refresh_all()
        before = parameter.value
        self.turn(8)
        self.clock[0] += 0.050
        self.push(8, 127)
        self.assertGreater(parameter.value, before)
        self.push(8, 0)

    def test_master_unsolo_indicator_and_action_work_in_every_row(self):
        self.surface._alt_mode = True
        for row in range(4):
            modules = ["Pan"] * 4
            modules[row] = "Mute"
            self.surface._row_modules[:] = modules
            self.surface._refresh_all()
            cc = row * 4 + 3
            self.assertEqual(self.surface._frame[cc][:2], (32, 0))
            self.song.return_tracks[0].solo = True
            self.surface._refresh_all()
            self.assertEqual(self.surface._frame[cc][:2], (32, 4))
            self.song.return_tracks[0].solo = False
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Pan"]
        self.song.tracks[1].solo = True
        self.song.return_tracks[0].solo = True
        self.song.master_track.solo = True
        self.surface._refresh_all()
        self.tap(11)
        self.assertFalse(any(track.solo for track in self.song.tracks))
        self.assertFalse(any(track.solo for track in self.song.return_tracks))
        self.assertFalse(self.song.master_track.solo)
        self.assertEqual(self.surface._frame[11][:2], (32, 0))

    def test_sends_are_purple_and_pan_sends_disappear_without_audio_output(self):
        self.surface._row_modules[:] = ["Pan", "Sends", "Pan", "Sends"]
        track = self.song.tracks[0]
        self.surface._refresh_all()
        self.assertEqual(self.surface._frame[4][0], 47)
        self.assertEqual(self.surface._frame[12][0], 47)
        track.has_audio_output = False
        self.surface._refresh_all()
        for cc in (0, 4, 8, 12):
            self.assertNotIn(cc, self.surface._frame)
        before = (track.mixer_device.panning.value,
                  tuple(parameter.value for parameter in track.mixer_device.sends))
        for cc in (0, 4, 8, 12):
            self.turn(cc)
            self.tap(cc)
        after = (track.mixer_device.panning.value,
                 tuple(parameter.value for parameter in track.mixer_device.sends))
        self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
