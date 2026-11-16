import importlib.util
import sys
import types
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).parents[1] / "MF4TRKBento" / "MF4TRKBento.py"


class FakeParameter:
    def __init__(self, value=0.5, minimum=0.0, maximum=1.0):
        self.min = minimum
        self.max = maximum
        self.value = value


class FakeDevice:
    def __init__(self, name, count=24):
        self.name = name
        self.parameters = [FakeParameter(1.0)] + [FakeParameter(0.5) for _ in range(count)]
        self.parameters[0].name = "Device On"
        for i, param in enumerate(self.parameters[1:], 1):
            param.name = "Parameter %d" % i
            param.is_enabled = True
            param.is_quantized = False


class FakeMixer:
    def __init__(self):
        self.volume = FakeParameter(0.5)
        self.panning = FakeParameter(0.0, -1.0, 1.0)
        self.sends = [FakeParameter(0.1), FakeParameter(0.2), FakeParameter(0.3)]


class FakeClip:
    def __init__(self):
        self.is_recording = False
        self.is_triggered = False
        self.is_playing = False
        self.loop_start = 0.0
        self.loop_end = 4.0
        self.playing_position = 0.0
        self.color = 0x22AA55


class FakeSlot:
    def __init__(self, has_clip=True):
        self.has_clip = has_clip
        self.is_triggered = False
        self.has_stop_button = False
        self.clip = FakeClip() if has_clip else None
        self.fire_count = 0

    def fire(self):
        self.fire_count += 1


class FakeTrack:
    def __init__(self, name, armable=True, has_audio_output=True):
        self.name = name
        self.can_be_armed = armable
        self.arm = False
        self.solo = False
        self.mute = False
        self.has_audio_output = has_audio_output
        self.current_monitoring_state = 0
        self.mixer_device = FakeMixer()
        self.devices = [FakeDevice("Device 1"), FakeDevice("Device 2")]
        for device in self.devices:
            device.canonical_parent = self
        self.view = types.SimpleNamespace(selected_device=self.devices[0])
        self.clip_slots = [FakeSlot(True) for _ in range(8)]
        self.stop_count = 0

    def stop_all_clips(self):
        self.stop_count += 1


class FakeScene:
    def __init__(self):
        self.fire_count = 0

    def fire(self):
        self.fire_count += 1


class FakeSongView:
    def __init__(self, track):
        self.selected_track = track
        self.select_device_calls = []

    def select_device(self, device):
        self.select_device_calls.append(device)
        self.selected_track.view.selected_device = device


class FakeSong:
    def __init__(self, track_count=8, return_count=0, scene_count=8):
        self.tracks = [FakeTrack("Track %d" % i) for i in range(track_count)]
        self.visible_tracks = self.tracks
        self.return_tracks = [FakeTrack("Return %d" % i, armable=False)
                              for i in range(return_count)]
        self.master_track = FakeTrack("Master", armable=False)
        self.view = FakeSongView(self.tracks[0])
        self.scenes = [FakeScene() for _ in range(scene_count)]
        self.tempo = 120.0
        self.is_playing = True
        self.current_song_time = 0.0
        self.stop_all_count = 0

    def stop_all_clips(self):
        self.stop_all_count += 1


class FakeButtonElement:
    def __init__(self, *args, **kwargs):
        self.listeners = []

    def add_value_listener(self, callback):
        self.listeners.append(callback)

    def remove_value_listener(self, callback):
        if callback in self.listeners:
            self.listeners.remove(callback)


class FakeControlSurface:
    def __init__(self, c_instance):
        self._song = c_instance.song
        self.sent_midi = []
        self.messages = []
        self.logs = []
        self.scheduled = []
        self.highlight = None

    def component_guard(self):
        return nullcontext()

    def song(self):
        return self._song

    def _send_midi(self, message):
        self.sent_midi.append(tuple(message))
        return True

    def schedule_message(self, delay, callback):
        self.scheduled.append((delay, callback))

    def show_message(self, message):
        self.messages.append(message)

    def log_message(self, message):
        self.logs.append(message)

    def set_highlighting_session_component(self, component):
        self.highlight = component

    def refresh_state(self):
        pass

    def disconnect(self):
        pass


class FakeSessionComponent:
    def __init__(self, num_tracks, num_scenes, **kwargs):
        self.num_tracks = num_tracks
        self.num_scenes = num_scenes
        self.enabled = False
        self.offsets = (0, 0)

    def set_enabled(self, enabled):
        self.enabled = enabled

    def set_offsets(self, track_offset, scene_offset):
        self.offsets = (track_offset, scene_offset)

    def disconnect(self):
        pass


def load_subject():
    framework = types.ModuleType("_Framework")
    cs_mod = types.ModuleType("_Framework.ControlSurface")
    cs_mod.ControlSurface = FakeControlSurface
    be_mod = types.ModuleType("_Framework.ButtonElement")
    be_mod.ButtonElement = FakeButtonElement
    ic_mod = types.ModuleType("_Framework.InputControlElement")
    ic_mod.MIDI_CC_TYPE = 0
    sc_mod = types.ModuleType("_Framework.SessionComponent")
    sc_mod.SessionComponent = FakeSessionComponent
    sys.modules.update({
        "_Framework": framework,
        "_Framework.ControlSurface": cs_mod,
        "_Framework.ButtonElement": be_mod,
        "_Framework.InputControlElement": ic_mod,
        "_Framework.SessionComponent": sc_mod,
    })
    live = types.ModuleType("Live")
    live_track = types.ModuleType("Live.Track")

    class MonitoringStates:
        IN = 2

    class TrackType:
        monitoring_states = MonitoringStates

    live_track.Track = TrackType
    live.Track = live_track
    sys.modules["Live"] = live
    sys.modules["Live.Track"] = live_track

    spec = importlib.util.spec_from_file_location("mf4trkbento_beta3", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SUBJECT = load_subject()


class Beta3Tests(unittest.TestCase):
    def setUp(self):
        self.song = FakeSong()
        self.surface = SUBJECT.MF4TRKBento(types.SimpleNamespace(song=self.song))

    def tearDown(self):
        self.surface.disconnect()

    def push(self, cc):
        self.surface._push(cc, 127)
        self.surface._push(cc, 0)

    def test_default_modules_and_bottom_up_inheritance(self):
        self.assertEqual(self.surface._row_modules,
                         ["Clip Launch", "Arm", "Solo", "Mute"])
        self.assertEqual(self.surface._rotary_function(3), "Volume")
        self.assertEqual(self.surface._rotary_function(2), "Pan")
        self.assertEqual(self.surface._rotary_function(1), "Sends")
        self.assertEqual(self.surface._rotary_function(0), "Sends")

    def test_send_a_above_send_b_and_independent(self):
        track = self.song.tracks[0]
        a, b = track.mixer_device.sends[:2]
        old_a, old_b = a.value, b.value
        self.surface._rotary(0, 65)
        self.assertGreater(a.value, old_a)
        self.assertEqual(b.value, old_b)
        self.surface._rotary(4, 65)
        self.assertGreater(b.value, old_b)

    def test_blank_disables_push_without_reassigning_fixed_rotary(self):
        # Under the newly approved independent push/rotary architecture, Blank
        # turns off the button module without collapsing the mixer row.
        self.surface._row_modules[1] = "Blank"
        self.assertEqual(self.surface._rotary_function(1), "Sends")
        self.assertEqual(self.surface._rotary_function(3), "Volume")
        self.assertEqual(self.surface._rotary_function(2), "Pan")
        before = self.song.tracks[0].mixer_device.sends[1].value
        self.surface._rotary(4, 65)
        self.assertGreater(self.song.tracks[0].mixer_device.sends[1].value, before)
        self.push(4)
        self.assertFalse(self.song.tracks[0].arm)

    def test_blank_volume_retains_white_ring_across_refreshes(self):
        self.surface._row_modules[3] = "Blank"
        track = self.song.tracks[0]
        expected = self.surface._parameter_ring(track.mixer_device.volume)
        for _ in range(2):
            self.surface._refresh_all()
            self.assertEqual(self.surface._frame[12], (0, 0, expected, False))
            self.assertEqual(self.surface._ring_cache[12], expected)

    def test_unarmable_return_keeps_inherited_send_ring(self):
        ret = FakeTrack("Return", armable=False)
        self.song.return_tracks = [ret]
        self.surface._fx_mode = True
        self.surface._refresh_all()
        expected = self.surface._parameter_ring(ret.mixer_device.sends[1])
        self.assertEqual(self.surface._frame[4], (0, 0, expected, False))
        self.assertEqual(self.surface._ring_cache[4], expected)

    def test_fixed_mixer_rotaries_unchanged_by_button_selection(self):
        for rows in (["Blank", "Blank", "Blank", "Mute"],
                     ["Stop", "Mute", "Solo", "Arm"],
                     ["Clip Launch", "Clip Launch", "Stop", "Stop"]):
            self.surface._row_modules = list(rows)
            self.assertEqual([self.surface._rotary_function(row) for row in range(4)],
                             ["Sends", "Sends", "Pan", "Volume"])

    def test_stop_button_module_also_inherits_volume(self):
        track = self.song.tracks[0]
        self.surface._row_modules[3] = "Stop"
        before = track.mixer_device.volume.value
        self.surface._rotary(12, 65)
        self.assertGreater(track.mixer_device.volume.value, before)
        self.push(12)
        self.assertEqual(track.stop_count, 1)

    def test_rotary_dispatches_volume_pan_send_a_and_send_b_by_row(self):
        tracks = self.song.tracks
        self.surface._rotary(12, 65)  # bottom row / Volume / Track 1
        self.surface._rotary(8, 65)   # next row / Pan / Track 1
        self.surface._rotary(4, 65)   # next row / Send B / Track 1
        self.surface._rotary(0, 65)   # top row / Send A / Track 1
        self.assertGreater(tracks[0].mixer_device.volume.value, 0.5)
        self.assertGreater(tracks[0].mixer_device.panning.value, 0.0)
        self.assertGreater(tracks[0].mixer_device.sends[0].value, 0.1)
        self.assertGreater(tracks[0].mixer_device.sends[1].value, 0.2)

    def test_mute_push_is_independent_of_inherited_volume_turn(self):
        track = self.song.tracks[0]
        self.push(12)
        self.assertTrue(track.mute)
        before = track.mixer_device.volume.value
        self.surface._rotary(12, 65)
        self.assertGreater(track.mixer_device.volume.value, before)

    def test_arm_solo_and_mute_button_actions(self):
        track = self.song.tracks[0]
        self.push(4)   # Arm row, column 1
        self.push(8)   # Solo row, column 1
        self.push(12)  # Mute row, column 1
        self.assertTrue(track.arm)
        self.assertTrue(track.solo)
        self.assertTrue(track.mute)

    def test_clip_launch_button_launches_clip_on_release(self):
        slot = self.song.tracks[0].clip_slots[0]
        self.push(0)
        self.assertEqual(slot.fire_count, 1)

    def test_clip_launch_alt_fourth_push_launches_scene(self):
        self.surface._alt_mode = True
        self.push(3)
        self.assertEqual(self.song.scenes[0].fire_count, 1)

    def test_stop_alt_fourth_push_stops_all_clips(self):
        self.surface._row_modules[3] = "Stop"
        self.surface._alt_mode = True
        self.push(15)
        self.assertEqual(self.song.stop_all_count, 1)

    def test_mute_alt_fourth_push_un_solos_tracks_returns_and_master(self):
        ret = FakeTrack("Return 0", armable=False)
        self.song.return_tracks = [ret]
        self.song.tracks[0].solo = True
        ret.solo = True
        self.song.master_track.solo = True
        self.surface._alt_mode = True
        self.push(15)
        self.assertFalse(self.song.tracks[0].solo)
        self.assertFalse(ret.solo)
        self.assertFalse(self.song.master_track.solo)

    def test_master_volume_and_pan_are_available_on_alt_fourth_encoder(self):
        self.surface._alt_mode = True
        master_volume = self.song.master_track.mixer_device.volume
        master_pan = self.song.master_track.mixer_device.panning
        self.surface._rotary(15, 65)  # bottom Volume row / Master Volume
        self.surface._rotary(11, 65)  # Pan row / Master Pan
        self.assertGreater(master_volume.value, 0.5)
        self.assertGreater(master_pan.value, 0.0)

    def test_no_master_sends(self):
        self.surface._alt_mode = True
        before_a = self.song.tracks[0].mixer_device.sends[0].value
        before_b = self.song.tracks[0].mixer_device.sends[1].value
        self.surface._rotary(7, 65)  # Send B row, alternate fourth encoder
        self.surface._rotary(3, 65)  # Send A row, alternate fourth encoder
        self.assertEqual(self.song.tracks[0].mixer_device.sends[0].value, before_a)
        self.assertEqual(self.song.tracks[0].mixer_device.sends[1].value, before_b)

    def test_pan_and_sends_are_gated_without_audio_output_but_volume_is_not(self):
        track = self.song.tracks[0]
        track.has_audio_output = False
        self.assertIsNotNone(self.surface._inherited_parameter(3, 0))
        self.assertIsNone(self.surface._inherited_parameter(2, 0))
        self.assertIsNone(self.surface._inherited_parameter(1, 0))
        self.assertIsNone(self.surface._inherited_parameter(0, 0))

    def test_empty_midi_track_white_mixer_rings_dark_controls_unchanged(self):
        track = self.song.tracks[0]
        track.has_audio_output = False
        self.surface._refresh_all()
        for cc in (0, 4, 8, 12):
            self.assertIsNone(self.surface._frame.get(cc, (0, 0, None, False))[2])
            self.assertEqual(self.surface._ring_cache.get(cc, 0), 0)
        before = track.mixer_device.volume.value
        self.surface._rotary(12, 65)
        self.assertGreater(track.mixer_device.volume.value, before)
        self.assertEqual(self.surface._ring_cache.get(12, 0), 0)
        self.push(12)
        self.assertTrue(track.mute)
        track.has_audio_output = True
        self.surface._refresh_all()
        self.assertGreater(self.surface._ring_cache.get(12, 0), 0)

    def test_blank_midi_volume_row_stays_dark(self):
        self.song.tracks[0].has_audio_output = False
        self.surface._row_modules[3] = "Blank"
        self.surface._refresh_all()
        self.assertIsNone(self.surface._frame.get(12, (0, 0, None, False))[2])
        self.assertEqual(self.surface._ring_cache.get(12, 0), 0)

    def test_returns_banking_reaches_more_than_four_returns(self):
        self.song.return_tracks = [FakeTrack("Return %d" % i, armable=False)
                                   for i in range(6)]
        self.surface._toggle_fx_mode()
        self.assertIs(self.surface._track_for_column(0), self.song.return_tracks[0])
        self.surface._push(0, 127)
        for _ in range(4):
            self.surface._rotary(15, 65)
        self.surface._push(0, 0)
        self.assertEqual(self.surface._track_offset, 1)
        self.assertIs(self.surface._track_for_column(0), self.song.return_tracks[1])
        self.assertIs(self.surface._track_for_column(3), self.song.return_tracks[4])
        self.surface._push(0, 127)
        for _ in range(4):
            self.surface._rotary(15, 65)
        self.surface._push(0, 0)
        self.assertEqual(self.surface._track_offset, 2)
        self.assertIs(self.surface._track_for_column(3), self.song.return_tracks[5])

    def test_one_and_two_returns_leave_missing_columns_dark_and_rings_zero(self):
        for count in (1, 2):
            with self.subTest(return_count=count):
                self.surface._fx_mode = True
                self.song.return_tracks = [FakeTrack("Return %d" % i, armable=False)
                                           for i in range(count)]
                self.surface._refresh_all()
                for row in range(4):
                    for col in range(count, 4):
                        cc = row * 4 + col
                        state = self.surface._frame.get(cc, (0, 0, None, False))
                        self.assertEqual(state[0], 0)
                        self.assertEqual(state[1], 0)
                        self.assertIsNone(state[2])
                        self.assertEqual(self.surface._ring_cache.get(cc), 0)

    def test_four_detents_are_required_for_module_selection(self):
        original = self.surface._row_modules[0]
        self.surface._push(0, 127)  # hold row 1 modifier
        for _ in range(3):
            self.surface._rotary(3, 65)
        self.assertEqual(self.surface._row_modules[0], original)
        self.surface._rotary(3, 65)
        self.assertEqual(self.surface._row_modules[0], "Stop")
        self.surface._push(0, 0)

    def test_track_scroll_remains_four_detents(self):
        self.surface._push(0, 127)
        for _ in range(3):
            self.surface._rotary(15, 65)
        self.assertEqual(self.surface._track_offset, 0)
        self.surface._rotary(15, 65)
        self.assertEqual(self.surface._track_offset, 1)
        self.surface._push(0, 0)

    def test_old_vertical_cross_row_shortcuts_are_removed(self):
        track = self.song.tracks[0]
        self.surface._push(8, 127)   # hold Solo encoder
        self.surface._push(12, 127)  # tap Mute encoder below
        self.surface._push(12, 0)
        self.surface._push(8, 0)
        self.assertTrue(track.solo)
        self.assertTrue(track.mute)
        self.assertFalse(track.arm)

    def test_35ms_volume_press_contamination_is_reversed_immediately(self):
        track = self.song.tracks[0]
        parameter = track.mixer_device.volume
        before = parameter.value
        with patch.object(SUBJECT.time, "monotonic", return_value=100.0):
            self.surface._rotary(12, 65)
            self.surface._push(12, 127)
        self.assertAlmostEqual(parameter.value, before)
        self.surface._push(12, 0)

    def test_volume_turn_after_35ms_is_not_reversed(self):
        track = self.song.tracks[0]
        parameter = track.mixer_device.volume
        with patch.object(SUBJECT.time, "monotonic", return_value=100.0):
            self.surface._rotary(12, 65)
        applied = parameter.value
        with patch.object(SUBJECT.time, "monotonic", return_value=100.036):
            self.surface._push(12, 127)
        self.assertAlmostEqual(parameter.value, applied)
        self.surface._push(12, 0)

    def test_stop_normal_push_stops_track_clips(self):
        track = self.song.tracks[0]
        self.surface._row_modules[3] = "Stop"
        self.push(12)
        self.assertEqual(track.stop_count, 1)

    def test_returns_support_volume_pan_sends_solo_and_mute(self):
        ret = FakeTrack("Return 0", armable=False)
        self.song.return_tracks = [ret]
        self.surface._fx_mode = True
        self.surface._refresh_all()
        # Bottom row inherits Volume; next row inherits Pan; rows above inherit
        # Send A and Send B. All operate on the selected Return.
        self.surface._rotary(12, 65)
        self.surface._rotary(8, 65)
        self.surface._rotary(4, 65)
        self.surface._rotary(0, 65)
        self.assertGreater(ret.mixer_device.volume.value, 0.5)
        self.assertGreater(ret.mixer_device.panning.value, 0.0)
        self.assertGreater(ret.mixer_device.sends[0].value, 0.1)
        self.assertGreater(ret.mixer_device.sends[1].value, 0.2)
        self.push(8)  # Solo module
        self.push(12) # Mute module
        self.assertTrue(ret.solo)
        self.assertTrue(ret.mute)

    def test_mute_keeps_monitor_colour_and_flashes_when_muted(self):
        track = self.song.tracks[0]
        track.current_monitoring_state = 0
        self.surface._scan_frame()
        self.assertEqual(self.surface._frame[12][0], self.surface.MUTE_MONITOR_AUTO_OFF)
        self.assertEqual(self.surface._frame[12][1], 0)
        track.mute = True
        self.surface._scan_frame()
        self.assertEqual(self.surface._frame[12][0], self.surface.MUTE_MONITOR_AUTO_OFF)
        self.assertEqual(self.surface._frame[12][1], 4)
        track.current_monitoring_state = 2
        self.surface._scan_frame()
        self.assertEqual(self.surface._frame[12][0], self.surface.MUTE_MONITOR_IN)
        self.assertEqual(self.surface._frame[12][1], 4)

    def test_master_volume_press_guard_is_also_35ms(self):
        self.surface._alt_mode = True
        parameter = self.song.master_track.mixer_device.volume
        before = parameter.value
        with patch.object(SUBJECT.time, "monotonic", return_value=200.0):
            self.surface._rotary(15, 65)
            self.surface._push(15, 127)
        self.assertAlmostEqual(parameter.value, before)
        self.surface._push(15, 0)

    def test_track_scroll_still_works_without_clip_launch_module(self):
        self.surface._row_modules[0] = "Blank"
        self.surface._refresh_all()
        self.surface._push(0, 127)
        for _ in range(4):
            self.surface._rotary(15, 65)
        self.assertEqual(self.surface._track_offset, 1)
        self.surface._push(0, 0)

    def test_volume_vu_tracks_live_audio_on_render_only_ticks(self):
        track = self.song.tracks[0]
        track.output_meter_left, track.output_meter_right = 0.2, 0.8
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[12], round(0.8 * 127))
        track.output_meter_left, track.output_meter_right = 0.5, 0.05
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[12], round(0.5 * 127))

    def test_volume_vu_silent_falls_back_to_fader_position(self):
        track = self.song.tracks[0]
        track.output_meter_left = track.output_meter_right = 0.0
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[12],
                         self.surface._parameter_ring(track.mixer_device.volume))

    def test_volume_turn_shows_fader_temporarily_then_resumes_meter(self):
        track = self.song.tracks[0]
        track.output_meter_left = track.output_meter_right = 0.90
        with patch.object(SUBJECT.time, "monotonic", return_value=100.0):
            self.surface._rotary(12, 65)
        expected_fader = self.surface._parameter_ring(track.mixer_device.volume)
        with patch.object(SUBJECT.time, "monotonic", return_value=100.15):
            self.surface._render_frame(update_rings=False)
            self.assertEqual(self.surface._ring_cache[12], expected_fader)
        with patch.object(SUBJECT.time, "monotonic", return_value=100.31):
            self.surface._render_frame(update_rings=False)
            self.assertEqual(self.surface._ring_cache[12], round(0.9 * 127))

    def test_empty_midi_track_meter_stays_dark_even_with_audio_proxy(self):
        track = self.song.tracks[0]
        track.has_audio_output = False
        track.output_meter_left = track.output_meter_right = 0.95
        self.surface._refresh_all()
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[12], 0)

    def test_master_volume_vu_in_alt_mode(self):
        self.surface._alt_mode = True
        master = self.song.master_track
        master.output_meter_left = 0.85
        master.output_meter_right = 0.1
        self.surface._refresh_all()
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[15], round(0.85 * 127))

    def test_fx_returns_volume_vu_uses_return_audio_meter(self):
        ret = FakeTrack("Return 0", armable=False)
        ret.output_meter_left = 0.65
        self.song.return_tracks = [ret]
        self.surface._toggle_fx_mode()
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[12], round(0.65 * 127))

    def test_four_device_rows_do_not_activate_mixer_volume_vu(self):
        self._insert_devices(4)
        track = self.song.tracks[0]
        track.output_meter_left = track.output_meter_right = 0.99
        before = self.surface._ring_cache[12]
        self.surface._render_frame(update_rings=False)
        self.assertEqual(self.surface._ring_cache[12], before)

    def test_white_ring_tracks_inherited_volume_value(self):
        track = self.song.tracks[0]
        cc = 12
        expected = self.surface._parameter_ring(track.mixer_device.volume)
        self.assertEqual(self.surface._frame[cc][2], expected)

    def _insert_devices(self, count):
        # Explicit rotary assignment; all push modules remain unchanged.
        defaults = list(self.surface.MIXER_ROTARY_FUNCTIONS)
        self.surface._rotary_overrides = ["Device Control"] * count + defaults[count:]
        self.surface._refresh_all()

    def test_scan_reads_device_parameters_once_with_four_device_rows(self):
        class CountingDevice(FakeDevice):
            def __init__(self, name, count=300):
                self.parameter_reads = 0
                super().__init__(name, count)

            @property
            def parameters(self):
                self.parameter_reads += 1
                return self._parameters

            @parameters.setter
            def parameters(self, value):
                self._parameters = value

        self._insert_devices(4)
        track = self.song.tracks[0]
        counted = CountingDevice("Many parameters")
        counted.canonical_parent = track
        track.devices[0] = counted
        track.view.selected_device = counted
        counted.parameter_reads = 0
        self.surface._refresh_all()
        self.assertEqual(counted.parameter_reads, 1)
        self.assertIsNotNone(self.surface._frame[15][2])

    def test_device_row_one_controls_params_one_through_four(self):
        self._insert_devices(1)
        device = self.song.tracks[0].devices[0]
        self.assertIs(self.surface._device_parameter(0,0), device.parameters[1])
        self.assertIs(self.surface._device_parameter(0,3), device.parameters[4])
        before = device.parameters[1].value
        self.surface._rotary(0,65)
        self.assertGreater(device.parameters[1].value,before)
        self.assertEqual(self.surface._frame[0][2],self.surface._parameter_ring(device.parameters[1]))

    def test_device_two_three_four_stack_parameters_in_four_groups(self):
        self._insert_devices(4)
        device = self.song.tracks[0].devices[0]
        for row in range(4):
            for col in range(4):
                self.assertIs(self.surface._device_parameter(row,col),
                              device.parameters[1+row*4+col])
        self.assertEqual([self.surface._frame[row*4][0] for row in range(1,4)],
                         [self.surface.DEVICE_COLOR] * 3)

    def test_device_parameter_quantized_step_and_disabled_guard(self):
        self._insert_devices(1)
        param = self.song.view.selected_track.view.selected_device.parameters[1]
        param.min = 0.0
        param.max = 10.0
        param.value = 5.0
        param.is_quantized = True
        self.surface._rotary(0,65)
        self.assertEqual(param.value,6.0)
        param.is_enabled = False
        self.surface._rotary(0,65)
        self.assertEqual(param.value,6.0)

    def test_device_rows_leave_remaining_mixer_buttons_and_returns_intact(self):
        self._insert_devices(2)
        ret = FakeTrack("Return",armable=False)
        self.song.return_tracks = [ret]
        self.surface._toggle_fx_mode()
        before_pan = ret.mixer_device.panning.value
        before_volume = ret.mixer_device.volume.value
        self.surface._rotary(8,65)
        self.surface._rotary(12,65)
        self.assertGreater(ret.mixer_device.panning.value,before_pan)
        self.assertGreater(ret.mixer_device.volume.value,before_volume)
        self.push(8) # Solo
        self.push(12) # Mute
        self.assertTrue(ret.solo)
        self.assertTrue(ret.mute)

    def test_all_four_devices_do_not_disable_global_bank_switch(self):
        self._insert_devices(4)
        self.song.return_tracks = [FakeTrack("Return",armable=False)]
        self.surface._push(0,127)
        self.surface._push(15,127)
        self.surface._push(15,0)
        self.surface._push(0,0)
        self.assertTrue(self.surface._fx_mode)

    def test_device_on_alternate_mode_controls_fourth_parameter(self):
        self._insert_devices(1)
        self.surface._alt_mode = True
        param = self.song.view.selected_track.view.selected_device.parameters[4]
        before = param.value
        self.surface._rotary(3,65)
        self.assertGreater(param.value,before)

    def test_reverse_selector_recolors_row_then_restores_push_leds(self):
        self.assertIsNone(self.surface._rotary_overrides)
        # Bottom Volume row preview = green while its last push is held.
        self.surface._push(15, 127)
        for cc in range(12, 16):
            self.assertEqual(self.surface._rgb_cache[cc], 76)
        before_volume = self.song.tracks[0].mixer_device.volume.value
        before_ring = self.surface._ring_cache[12]
        for _ in range(4):
            self.surface._rotary(12, 65)
        self.assertEqual(self.surface._rotary_function(3), "Pan")
        self.assertAlmostEqual(self.song.tracks[0].mixer_device.volume.value,
                               before_volume)
        self.assertEqual(self.surface._rotary_overrides[:3],
                         ["Sends", "Sends", "Pan"])
        for cc in range(12, 16):
            self.assertEqual(self.surface._rgb_cache[cc], 68)
        self.surface._push(15, 0)
        for cc in range(12, 16):
            self.assertEqual(self.surface._rgb_cache[cc],
                             self.surface._frame[cc][0])
        self.assertFalse(self.surface._held[15])
        self.assertNotIn(3, self.surface._rotary_preview_rows)
        self.assertEqual(self.surface._rotary_scroll_steps[3], 0)

    def test_selector_four_detents_and_release_resets_partial_step(self):
        self.surface._push(15, 127)
        for _ in range(3):
            self.surface._rotary(12, 65)
        self.assertEqual(self.surface._rotary_function(3), "Volume")
        self.surface._push(15, 0)
        self.surface._push(15, 127)
        self.surface._rotary(12, 65)
        self.assertEqual(self.surface._rotary_function(3), "Volume")
        self.surface._push(15, 0)

    def test_reverse_selector_unifies_sends_into_one_module(self):
        self.assertEqual(self.surface._rotary_choices(),
                         ["Volume", "Pan", "Sends", "Device Control"])
        self.surface._push(7, 127)  # Last encoder of row 2
        before = self.song.tracks[0].mixer_device.sends[1].value
        for _ in range(4):
            self.surface._rotary(4, 65)
        self.assertEqual(self.surface._rotary_function(1), "Device Control")
        self.surface._push(7, 0)
        self.assertEqual(self.song.tracks[0].mixer_device.sends[1].value,
                         before)
        self.surface._push(7, 127)
        for _ in range(4):
            self.surface._rotary(4, 63)
        self.assertEqual(self.surface._rotary_function(1), "Sends")
        self.surface._push(7, 0)
        self.assertEqual(self.surface._row_modules[1], "Arm")
        self.assertTrue(any("Sends" in msg for msg in self.surface.messages))

    def test_normal_last_encoder_push_still_works_without_twisting_first(self):
        track = self.song.tracks[3]
        self.assertFalse(track.mute)
        self.push(15)
        self.assertTrue(track.mute)
        # Normal Mute flashes when muted; its LED can be lit or temporarily off.
        self.assertIn(self.surface._rgb_cache[15],
                      (0, self.surface._frame[15][0]))
        self.assertNotEqual(self.surface._rgb_cache[15], 76)
        self.assertFalse(self.surface._rotary_preview_rows)

    def test_original_first_hold_last_turn_remains_button_selector(self):
        before_function = self.surface._rotary_function(0)
        self.surface._push(0, 127)
        for _ in range(4):
            self.surface._rotary(3, 65)
        self.surface._push(0, 0)
        self.assertEqual(self.surface._row_modules[0], "Stop")
        self.assertEqual(self.surface._rotary_function(0), before_function)

    def test_linked_send_rows_with_gap_use_top_down_assignments(self):
        track = self.song.tracks[0]
        self.assertEqual(self.surface._send_rows(), (0, 1))
        self.assertIs(self.surface._inherited_parameter(0, 0),
                      track.mixer_device.sends[0])
        self.assertIs(self.surface._inherited_parameter(1, 0),
                      track.mixer_device.sends[1])
        self.surface._rotary_overrides = ["Sends", "Pan", "Sends", "Volume"]
        self.surface._refresh_all()
        self.assertEqual(self.surface._send_rows(), (0, 2))
        self.assertIs(self.surface._inherited_parameter(0, 0),
                      track.mixer_device.sends[0])
        self.assertIs(self.surface._inherited_parameter(2, 0),
                      track.mixer_device.sends[1])

    def test_mixer_corrected_send_order_without_devices(self):
        self.assertEqual(self.surface._row_modules,["Clip Launch","Arm","Solo","Mute"])
        self.assertEqual([self.surface._rotary_function(row) for row in range(4)],
                         ["Sends","Sends","Pan","Volume"])
        self.assertEqual(self.surface._device_row_count(),0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
