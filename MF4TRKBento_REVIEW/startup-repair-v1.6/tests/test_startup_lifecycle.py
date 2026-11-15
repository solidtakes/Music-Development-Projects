"""Startup, scheduler and Live-object access regression tests for the v1.6 repair."""
import unittest
from pathlib import Path
import types
import mock_live as mock
from availability_cache_variant import ListenerAvailabilityCache

SOURCE = Path(__file__).resolve().parents[1] / "MF4TRKBento" / "MF4TRKBento.py"
module = mock.load(SOURCE)


class StartupLifecycle(unittest.TestCase):
    def setUp(self):
        self.song = mock.SONG = mock.Song()
        self.clock = 0.0
        module.time = types.SimpleNamespace(monotonic=lambda: self.clock)
        mock.SessionComponent.created_count = 0
        self.surface = module.create_instance(None)
        self.surface._diagnostics_enabled = True
        self.surface._diagnostics.clear()

    def tearDown(self):
        if not self.surface._closed:
            self.surface.disconnect()

    def fire_next(self):
        self.assertTrue(self.surface.scheduled, "expected one queued callback")
        delay, callback = self.surface.scheduled.pop(0)
        self.assertEqual(delay, 1)
        callback()

    def test_1000_scheduled_ticks_are_single_and_bounded(self):
        self.assertEqual(len(self.surface.scheduled), 1)
        for track in self.song.visible_tracks[:4]:
            track.audio_output_reads = 0
        for _ in range(1000):
            self.assertEqual(len(self.surface.scheduled), 1)
            self.fire_next()
            self.assertEqual(len(self.surface.scheduled), 1)
        self.assertEqual(self.surface.schedule_message_calls, 1001)
        self.assertEqual(self.surface._diagnostics["ticks"], 1000)
        self.assertEqual(self.surface._diagnostics["scans"], 500)
        self.assertEqual(self.surface._diagnostics["audio_output_probes"], 2000)
        self.assertEqual([t.audio_output_reads for t in self.song.visible_tracks[:4]],
                         [500, 500, 500, 500])
        self.assertEqual(mock.SessionComponent.created_count, 1)
        self.assertEqual(len(self.surface.scheduled), 1)

    def test_reentrant_tick_is_ignored_and_does_not_fork_scheduler(self):
        track = self.song.visible_tracks[0]
        calls = [0]
        def reenter(_track):
            if not calls[0]:
                calls[0] += 1
                self.surface._tick()
        track.audio_output_hook = reenter
        self.fire_next()
        self.fire_next()
        self.assertEqual(calls[0], 1)
        self.assertEqual(self.surface._diagnostics["reentrant_ticks"], 1)
        self.assertEqual(len(self.surface.scheduled), 1)
        self.assertEqual(self.surface.schedule_message_calls, 3)

    def test_reentrant_refresh_is_coalesced_to_next_tick(self):
        original_scan = self.surface._scan_frame
        entered = [False]
        def reenter_scan():
            if not entered[0]:
                entered[0] = True
                self.surface._refresh_all()
            original_scan()
        self.surface._scan_frame = reenter_scan
        before = self.surface._diagnostics.get("scans", 0)
        self.surface._refresh_all()
        self.assertEqual(self.surface._diagnostics["reentrant_refreshes"], 1)
        self.assertEqual(self.surface._diagnostics["scans"] - before, 1)
        self.assertEqual(self.surface._ticks_until_scan, 0)
        self.assertEqual(len(self.surface.scheduled), 1)
        self.surface._scan_frame = original_scan
        self.fire_next()
        self.assertEqual(len(self.surface.scheduled), 1)

    def test_audio_output_probe_once_per_track_per_scan_and_graph_changes(self):
        tracks = self.song.visible_tracks[:4]
        midi_without_instrument, midi_with_instrument, silent_instrument, audio_track = tracks
        midi_without_instrument.has_audio_output = False
        midi_with_instrument.has_audio_output = False
        midi_with_instrument.add_device(True)
        silent_instrument.has_audio_output = False
        silent_instrument.add_device(True)
        silent_instrument.output_meter_level = 0.0
        audio_track.has_audio_output = True
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Sends"]
        for track in tracks:
            track.audio_output_reads = 0
        self.surface._refresh_all()
        self.assertEqual([t.audio_output_reads for t in tracks], [1, 1, 1, 1])
        self.assertNotIn(0, self.surface._frame)
        self.assertIn(5, self.surface._frame)
        self.assertIn(6, self.surface._frame)
        self.assertIn(7, self.surface._frame)
        self.assertNotIn(12, self.surface._frame)
        self.assertIn(13, self.surface._frame)
        device = midi_with_instrument.devices[0]
        midi_with_instrument.remove_device(device)
        self.surface._refresh_all()
        self.assertNotIn(5, self.surface._frame)
        self.assertNotIn(13, self.surface._frame)
        midi_with_instrument.add_device(True)
        self.surface._refresh_all()
        self.assertIn(5, self.surface._frame)
        self.assertIn(13, self.surface._frame)

    def test_audio_output_probe_off_control_isolates_gate_only(self):
        self.surface._row_modules[:] = ["Pan", "Pan", "Mute", "Sends"]
        self.surface._refresh_all()
        baseline_frame = dict(self.surface._frame)
        original = self.surface._audio_mixer
        tracks = self.song.visible_tracks[:4]
        for track in tracks:
            track.audio_output_reads = 0
        # Test-only feature flag: bypass the availability probe without changing
        # any mixer, Pan, Sends, rendering, or MIDI code.
        self.surface._audio_mixer = lambda track: track.mixer_device if track is not None else None
        self.surface._refresh_all()
        self.assertEqual(self.surface._frame, baseline_frame)
        self.assertEqual([track.audio_output_reads for track in tracks], [0, 0, 0, 0])
        self.surface._audio_mixer = original
        # The normal encoder paths perform one probe per direct operation.
        tracks[0].audio_output_reads = 0
        self.surface._pan_parameter(0)
        self.assertEqual(tracks[0].audio_output_reads, 1)
        tracks[0].audio_output_reads = 0
        self.surface._send_parameter(3, 0)
        self.assertEqual(tracks[0].audio_output_reads, 1)

    def test_listener_invalidated_cache_variant_tracks_graph_changes_and_cleanup(self):
        tracks = self.song.visible_tracks[:4]
        midi_without_instrument, midi_with_instrument, silent_instrument, audio_track = tracks
        midi_without_instrument.has_audio_output = False
        midi_with_instrument.has_audio_output = False
        midi_device = midi_with_instrument.add_device(True)
        silent_instrument.has_audio_output = False
        silent_instrument.add_device(True)
        silent_instrument.output_meter_level = 0.0
        audio_track.has_audio_output = True
        for track in tracks:
            track.audio_output_reads = 0

        cache = ListenerAvailabilityCache()
        cache.sync(tracks)
        self.assertEqual([t.audio_output_reads for t in tracks], [1, 1, 1, 1])
        self.assertIsNone(cache.mixer_for(midi_without_instrument))
        self.assertIsNotNone(cache.mixer_for(midi_with_instrument))
        self.assertIsNotNone(cache.mixer_for(silent_instrument))
        self.assertIsNotNone(cache.mixer_for(audio_track))
        for _ in range(100):
            cache.sync(tracks)
            for track in tracks:
                cache.mixer_for(track)
        self.assertEqual([t.audio_output_reads for t in tracks], [1, 1, 1, 1])

        # Track.has_audio_output listener refreshes the cached value on device removal/addition.
        midi_with_instrument.remove_device(midi_device)
        self.assertIsNone(cache.mixer_for(midi_with_instrument))
        self.assertEqual(midi_with_instrument.audio_output_reads, 2)
        midi_with_instrument.add_device(True)
        self.assertIsNotNone(cache.mixer_for(midi_with_instrument))
        self.assertEqual(midi_with_instrument.audio_output_reads, 3)

        # Removing a Track from the active set removes its listener and cache entry.
        cache.sync(tracks[1:])
        self.assertFalse(midi_without_instrument._has_audio_output_listeners)
        self.assertNotIn(id(midi_without_instrument), cache._entries)
        replacement = mock.Track()
        cache.sync(tracks[1:] + [replacement])
        self.assertEqual(replacement.audio_output_reads, 1)
        cache.close()
        self.assertTrue(all(not track._has_audio_output_listeners for track in tracks[1:]))
        self.assertFalse(replacement._has_audio_output_listeners)

    def test_persistent_track_proxy_cache_goes_stale_after_device_removal(self):
        track = self.song.visible_tracks[0]
        original = self.surface._audio_mixer
        cached = {}
        def persistent_variant(item):
            key = id(item)
            if key not in cached:
                cached[key] = original(item)
            return cached[key]
        self.surface._audio_mixer = persistent_variant
        self.surface._refresh_all()
        self.assertIn(4, self.surface._frame)
        track.has_audio_output = False
        self.surface._refresh_all()
        # This test-only persistent-cache variant keeps exposing Pan/Sends.
        self.assertIn(4, self.surface._frame)
        self.assertIn(12, self.surface._frame)
        self.surface._audio_mixer = original
        self.surface._refresh_all()
        self.assertNotIn(4, self.surface._frame)
        self.assertNotIn(12, self.surface._frame)

    def test_deleted_track_is_not_retained_by_availability_cache(self):
        deleted = self.song.visible_tracks[1]
        self.surface._refresh_all()
        prior_reads = deleted.audio_output_reads
        self.song.visible_tracks = [self.song.visible_tracks[0]] + self.song.visible_tracks[2:]
        self.song.tracks = list(self.song.visible_tracks)
        self.surface._refresh_all()
        self.assertEqual(deleted.audio_output_reads, prior_reads)
        replacement = mock.Track()
        self.song.visible_tracks.insert(1, replacement)
        self.song.tracks.insert(1, replacement)
        self.surface._refresh_all()
        self.assertEqual(replacement.audio_output_reads, 1)

    def test_property_exceptions_and_slow_getters_do_not_break_tick_loop(self):
        track = self.song.visible_tracks[0]
        track.audio_output_error = RuntimeError("simulated Live proxy getter failure")
        self.surface._refresh_all()
        self.assertNotIn(4, self.surface._frame)
        self.assertEqual(len(self.surface.scheduled), 1)
        track.audio_output_error = None
        elapsed = [0.0]
        def slow_getter(_track):
            elapsed[0] += 0.05
        for item in self.song.visible_tracks[:4]:
            item.audio_output_hook = slow_getter
        self.surface._refresh_all()
        self.assertAlmostEqual(elapsed[0], 0.20)
        self.assertEqual(len(self.surface.scheduled), 1)
        self.assertGreaterEqual(self.surface._diagnostics["audio_output_probes"], 8)

    def test_repeated_refresh_state_does_not_duplicate_ticks_or_recreate_highlight(self):
        self.assertEqual(mock.SessionComponent.created_count, 1)
        for _ in range(25):
            self.surface.refresh_state()
            self.assertEqual(len(self.surface.scheduled), 1)
        self.assertEqual(mock.SessionComponent.created_count, 1)
        self.assertEqual(self.surface.schedule_message_calls, 1)
        self.assertEqual(self.surface._diagnostics.get("reentrant_refreshes", 0), 0)

    def test_diagnostics_are_disabled_by_default_and_emit_no_tick_logs(self):
        surface = module.create_instance(None)
        self.assertFalse(surface._diagnostics_enabled)
        self.assertEqual(surface._diagnostics, {})
        queued = surface.scheduled.pop(0)[1]
        queued()
        self.assertEqual(surface._diagnostics, {})
        self.assertFalse(any("tick" in message.lower() for message in surface.messages))
        surface.disconnect()

    def test_queued_callback_after_disconnect_is_inert(self):
        self.assertEqual(len(self.surface.scheduled), 1)
        callback = self.surface.scheduled.pop(0)[1]
        scans = self.surface._diagnostics.get("scans", 0)
        self.surface.disconnect()
        self.surface.sent.clear()
        callback()
        self.assertEqual(self.surface._diagnostics.get("scans", 0), scans)
        self.assertFalse(self.surface.scheduled)
        self.assertFalse(self.surface.sent)
        self.assertEqual(self.surface.base_disconnect_calls, 1)

    def test_repeated_init_disconnect_has_no_stale_callbacks_or_listeners(self):
        for _ in range(20):
            surface = module.create_instance(None)
            self.assertEqual(len(surface.scheduled), 1)
            queued = surface.scheduled.pop(0)[1]
            elements = [element for element, _ in surface._elements]
            component = surface._session_component
            surface.disconnect()
            surface.sent.clear()
            queued()
            self.assertFalse(surface.scheduled)
            self.assertFalse(surface.sent)
            self.assertTrue(all(not element.listeners for element in elements))
            self.assertEqual(surface.base_disconnect_calls, 1)
            self.assertIsNone(surface._session_component)
            self.assertEqual(component.disconnect_calls, 1)
            self.assertFalse(component.enabled)


if __name__ == "__main__":
    unittest.main(verbosity=2)
