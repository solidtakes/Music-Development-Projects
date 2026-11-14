"""Deterministic v1.5 feature and gesture matrix."""
import unittest
from pathlib import Path
import mock_live as mock

SOURCE = Path(__file__).resolve().parents[1] / "MF4TRKBento" / "MF4TRKBento.py"
bento = mock.load(SOURCE)


class Matrix(unittest.TestCase):
    def setUp(self):
        self.song = mock.SONG = mock.Song()
        self.clock = 0.0
        bento.time = type("Clock", (), {"monotonic": lambda _: self.clock})()
        self.surface = bento.create_instance(None)
        self.addCleanup(self.surface.disconnect)
        self.tracks = self.song.tracks

    def push(self, cc, value):
        element, listener = self.surface._elements[2 * cc + 1]
        self.assertIn(listener, element.listeners)
        listener(value)

    def tap(self, cc):
        self.push(cc, 127)
        self.push(cc, 0)

    def turn(self, cc, n=1):
        for _ in range(n):
            self.surface._elements[2 * cc][1](65)

    def alt(self):
        self.push(15, 127)
        self.tap(0)
        self.push(15, 0)
        self.assertTrue(self.surface._alt_mode)

    def rows(self, *modules):
        self.surface._row_modules[:] = modules
        self.surface._refresh_all()

    def test_every_module_reachable_every_row(self):
        for row in range(4):
            seen = set()
            self.push(row * 4, 127)
            for _ in range(7):
                seen.add(self.surface._row_modules[row])
                self.turn(row * 4 + 3)
            self.push(row * 4, 0)
            self.assertEqual(seen, set(self.surface.MODULES))
        self.rows("Arm", "Solo", "RClip", "Sends")
        for row in (2, 3):
            for _ in range(7):
                self.surface._cycle_module(row, 1)
                self.assertNotIn(self.surface._row_modules[row], ("Arm", "Solo"))

    def test_single_and_multiple_arm_solo_all_rows(self):
        for module, flag in (("Arm", "arm"), ("Solo", "solo")):
            for row in range(4):
                with self.subTest(module=module, row=row):
                    self.rows(*[module if r == row else "Mute" for r in range(4)])
                    first = row * 4
                    for reverse_release in (False, True):
                        for track in self.tracks:
                            setattr(track, flag, False)
                        setattr(self.tracks[7], flag, True)
                        self.song.return_tracks[0].solo = self.song.master_track.solo = True
                        self.song.visible_tracks = self.tracks[:7]
                        self.tap(first)
                        self.assertTrue(getattr(self.tracks[0], flag))
                        self.assertFalse(getattr(self.tracks[7], flag))
                        self.assertTrue(self.song.return_tracks[0].solo)
                        self.assertTrue(self.song.master_track.solo)
                        self.tap(first)
                        self.assertFalse(getattr(self.tracks[0], flag))
                        setattr(self.tracks[7], flag, True)
                        self.push(first, 127)
                        self.push(first + 3, 127)
                        order = (first, first + 3) if reverse_release else (first + 3, first)
                        for button in order:
                            self.push(button, 0)
                        self.assertEqual([getattr(self.tracks[i], flag) for i in (0, 3, 7)],
                                         [True, True, True])

    def test_absent_and_nonarmable_controls_cannot_form_chords(self):
        for module, flag in (("Arm", "arm"), ("Solo", "solo")):
            self.rows("Mute", module, "Mute", "Mute")
            self.song.visible_tracks = self.tracks[:2]
            setattr(self.tracks[0], flag, True)
            self.push(5, 127)
            self.tap(6)
            self.push(5, 0)
            self.assertFalse(getattr(self.tracks[0], flag))
            self.assertTrue(getattr(self.tracks[1], flag))
        self.rows("Mute", "Arm", "Mute", "Mute")
        self.song.visible_tracks = self.tracks
        self.tracks[0].arm = True
        self.tracks[1].arm = False
        self.tracks[2].can_be_armed = False
        self.push(5, 127)
        self.tap(6)
        self.push(5, 0)
        self.assertFalse(self.tracks[0].arm)
        self.assertTrue(self.tracks[1].arm)

    def test_vertical_chords_all_supported_rows_and_columns(self):
        for row in range(1, 4):
            self.rows(*["Arm" if r == row else "Pan" for r in range(4)])
            for col in range(4):
                if (row, col) == (3, 3):
                    # For E16/E12 only, no E1 is involved in either direction.
                    self.assertFalse(self.surface._alt_mode)
                track = self.tracks[col]
                track.solo = track.mute = False
                track.mixer_device.panning.value = 0.375
                arm, above = row * 4 + col, (row - 1) * 4 + col
                self.push(arm, 127)
                self.tap(above)
                self.assertTrue(track.solo)
                self.tap(above)
                self.assertFalse(track.solo)
                self.push(arm, 0)
                self.push(above, 127)
                self.tap(arm)
                self.push(above, 0)
                self.assertTrue(track.mute)
                self.assertFalse(track.arm)
                self.assertEqual(track.mixer_device.panning.value, 0.375)

    def test_stop_per_track_and_global_in_each_row(self):
        for row in range(4):
            self.surface._alt_mode = False
            self.surface._track_offset = 2
            self.rows(*["Stop" if r == row else "Pan" for r in range(4)])
            cc = row * 4
            clip = mock.Clip()
            clip.is_playing = True
            self.tracks[7].clip_slots[0].clip = clip
            self.push(cc + 3, 127)
            prior = self.tracks[5].stop_count
            self.assertTrue(clip.is_playing)
            self.assertEqual(self.tracks[5].stop_count, prior)
            self.push(cc + 3, 0)
            self.assertEqual(self.tracks[5].stop_count, prior + 1)
            self.assertTrue(clip.is_playing)
            self.alt()
            prior = self.tracks[2].stop_count
            self.tap(cc)
            self.assertEqual(self.tracks[2].stop_count, prior + 1)
            self.assertTrue(clip.is_playing)
            prior = self.song.stop_count
            self.tap(cc + 3)
            self.assertEqual(self.song.stop_count, prior + 1)
            self.assertFalse(clip.is_playing)

    def test_stop_consumption_and_target_binding(self):
        self.rows("Stop", "Arm", "RClip", "Stop")
        self.push(1, 127)
        self.clock = 0.55
        self.push(1, 0)
        self.push(1, 127)
        self.song.visible_tracks = self.tracks[1:]
        self.push(1, 0)
        self.song.visible_tracks = self.tracks
        self.push(0, 127)
        self.turn(15, 1)
        self.push(0, 0)
        self.push(0, 127)
        self.turn(11, 4)
        self.push(0, 0)
        self.assertEqual(self.surface._scene_offset, 1)
        self.push(1, 127)
        self.tap(5)
        self.push(1, 0)
        self.assertTrue(self.tracks[1].mute)
        self.push(5, 127)
        self.tap(1)
        self.push(5, 0)
        self.assertTrue(self.tracks[1].solo)
        self.push(13, 127)
        self.alt()
        self.push(13, 0)
        self.push(12, 127)
        self.push(13, 127)
        self.turn(15)
        self.push(13, 0)
        self.push(12, 0)
        self.assertFalse(self.song.stop_count)
        self.assertFalse(any(track.stop_count for track in self.tracks))
        self.rows("Stop", "Pan", "Pan", "Pan")
        self.song.visible_tracks = self.tracks[:1]
        self.tap(1)
        self.assertFalse(any(track.stop_count for track in self.tracks))

    def test_midi_sends_and_mute(self):
        self.rows("Sends", "Mute", "Sends", "Sends")
        midi = self.tracks[0]
        midi.has_audio_output = False
        for row in (0, 2, 3):
            self.assertEqual(self.surface._frame[row * 4][0], 96)
            self.turn(row * 4)
            param = midi.mixer_device.sends[(0, 2, 3).index(row)]
            self.assertGreater(param.value, 0)
            prior = param.value
            self.tap(row * 4)
            self.assertEqual(param.value, prior)
        self.rows("Mute", "Mute", "Sends", "Sends")
        self.assertEqual(self.surface._send_index(2), 0)
        midi.mixer_device.sends = []
        self.surface._refresh_all()
        self.assertNotIn(8, self.surface._frame)
        self.turn(8)
        for col, track in enumerate(self.tracks[:2]):
            for state, color in ((1, 68), (2, 108), (3, 108)):
                track.current_monitoring_state = state
                self.tap(4 + col)
                self.assertEqual(track.current_monitoring_state, state)
                self.assertEqual(self.surface._frame[4 + col][:3], (color, 0, 127 if track.mute else 0))
        self.alt()
        self.assertTrue(all(cc not in self.surface._frame for cc in (3, 7, 11, 15)))

    def test_clip_release_and_master_pan(self):
        self.rows("RClip", "Pan", "RClip", "Sends")
        self.song.view.selected_track = self.tracks[-1]
        self.push(0, 127)
        self.turn(15, 4)
        self.push(0, 0)
        self.assertEqual(self.surface._session_component.offset, (1, 0))
        self.assertEqual(self.surface._session_size, (4, 2))
        self.assertFalse(self.tracks[0].clip_slots[0].fire_count)
        slot = self.tracks[1].clip_slots[1]
        self.push(8, 127)
        self.assertFalse(slot.fire_count)
        self.push(8, 0)
        self.assertEqual(slot.fire_count, 1)
        self.alt()
        self.turn(7)
        p = self.song.master_track.mixer_device.panning
        self.assertGreater(p.value, 0)
        self.tap(7)
        self.assertEqual(p.value, 0)
        self.tap(11)
        self.assertEqual(self.song.scenes[1].fire_count, 1)

    def test_cache_retries_explicit_send_failure_and_cleanup(self):
        u = self.surface
        elements = [element for element, _ in u._elements]
        schedule = u.scheduled.pop()
        self.assertEqual(u._rgb_cache[0], 0)
        original_send = u._send_midi
        u._send_midi = lambda _: False
        u._rgb(0, 96)
        self.assertEqual(u._rgb_cache[0], 0)
        u._send_midi = original_send
        u.sent.clear()
        u._rgb(0, 96)
        u._rgb(0, 96)
        self.assertEqual(len(u.sent), 1)
        u.disconnect()
        u.sent.clear()
        schedule[1]()
        self.assertFalse(u.sent)
        self.assertFalse(u.scheduled)
        self.assertTrue(all(not element.listeners for element in elements))


if __name__ == "__main__":
    unittest.main(verbosity=2)
