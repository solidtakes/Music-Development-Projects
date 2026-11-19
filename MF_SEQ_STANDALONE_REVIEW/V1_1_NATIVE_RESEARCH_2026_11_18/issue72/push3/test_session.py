"""Offline limits/lifecycle checks; not proof of Live or Push support."""
import importlib
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).parent / 'probe/MF_SEQ_Push_ReadOnly'
pkg = ModuleType('push_ro_test')
pkg.__path__ = [str(ROOT)]
sys.modules[pkg.__name__] = pkg
session = importlib.import_module('push_ro_test.session')


class SessionTests(unittest.TestCase):
    def test_two_minute_limit_and_no_reads_after_finish(self):
        calls = []
        s = session.BoundedSession(100)
        records = []
        for t in range(125):
            records += s.poll(100 + t, lambda: calls.append(1))
        self.assertEqual(len(calls), 61)
        self.assertEqual(len([r for r in records if r['kind'] == 'finished']), 1)
        self.assertTrue(s.closed)
        self.assertEqual(s.finish('disconnect'), [])

    def test_stalled_dispatcher_does_not_replay_missed_intervals(self):
        s = session.BoundedSession(0)
        self.assertEqual(len(s.poll(0, lambda: {})), 1)
        self.assertEqual(len(s.poll(100, lambda: {})), 1)
        self.assertEqual(s.poll(100, lambda: self.fail('duplicate read')), [])
        result = s.poll(121, lambda: self.fail('late read'))
        self.assertEqual(result[0]['kind'], 'finished')
        self.assertEqual(s.samples, 2)

    def test_snapshot_handles_missing_routes_and_reads_no_writer(self):
        class Clip:
            is_midi_clip = True
            midi_clip_type = 1
            view = object()

            def get_notes_extended(self, *args):
                self.last_range = args
                return []

            def apply_note_modifications(self, *args):
                raise AssertionError('must not write')

            def __getattr__(self, name):
                if name.startswith(('set_', 'add_', 'remove_')):
                    raise AssertionError('must not bind or write')
                raise AttributeError(name)

        clip = Clip()
        result = session.snapshot(SimpleNamespace(view=SimpleNamespace(detail_clip=clip)), object())
        self.assertEqual(clip.last_range, (0, 128, 0.0, 4.0))
        self.assertFalse(result['conventional_notes']['native_step_representation_verified'])
        self.assertEqual(result['clip']['step_sequencer']['error'], 'AttributeError')
        self.assertEqual(result['push_route_candidate'][0]['result']['error'], 'AttributeError')
        empty = session.snapshot(SimpleNamespace(view=SimpleNamespace(detail_clip=None)), object())
        self.assertFalse(empty['clip_present'])

    def test_disconnect_makes_queued_callbacks_inert(self):
        class Base:
            def __init__(self, c):
                self._c_instance = c
                self.queue = []
                self.log = []

            def schedule_message(self, ticks, callback):
                self.queue.append(callback)

            def log_message(self, message):
                self.log.append(message)

            def disconnect(self):
                self.base_disconnected = True

        framework = ModuleType('_Framework.ControlSurface')
        framework.ControlSurface = Base
        with patch.dict(sys.modules, {'Live': ModuleType('Live'),
                '_Framework': ModuleType('_Framework'), '_Framework.ControlSurface': framework}):
            surface = importlib.import_module('push_ro_test.surface')
        probe = surface.PushReadOnly(object())
        probe._session = session.BoundedSession(0)
        probe.queue.append(probe._tick)
        probe.disconnect()
        size = len(probe.queue)
        for callback in list(probe.queue):
            callback()
        self.assertEqual(len(probe.queue), size)
        self.assertTrue(probe.base_disconnected)
        self.assertTrue(probe._session.closed)


if __name__ == '__main__':
    unittest.main()
