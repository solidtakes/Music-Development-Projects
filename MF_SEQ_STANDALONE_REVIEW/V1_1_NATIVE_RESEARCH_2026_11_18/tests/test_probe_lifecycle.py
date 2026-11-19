"""Offline callback-ownership checks; these do not reproduce Live's dispatcher."""
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch


class HostSurface:
    def __init__(self, c_instance):
        self.queue = []
        self.log = []
        self.base_disconnected = False

    def schedule_message(self, ticks, callback):
        self.queue.append(callback)

    def log_message(self, message):
        self.log.append(message)

    def disconnect(self):
        self.base_disconnected = True


def load_surface():
    root = Path(__file__).parents[1] / "probe/MF_SEQ_R1_ReadOnly"
    package = ModuleType("r1_probe_test")
    package.__path__ = [str(root)]
    host = ModuleType("_Framework.ControlSurface")
    host.ControlSurface = HostSurface
    mocks = {"r1_probe_test": package, "Live": ModuleType("Live"),
             "_Framework": ModuleType("_Framework"), "_Framework.ControlSurface": host}
    with patch.dict(sys.modules, mocks):
        spec = importlib.util.spec_from_file_location("r1_probe_test.surface", root / "surface.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module.ReadOnlyProbe


Probe = load_surface()


class Observable:
    def __init__(self):
        self.listeners = []

    def add_value_listener(self, callback):
        if callback in self.listeners:
            raise RuntimeError("duplicate")
        self.listeners.append(callback)

    def remove_value_listener(self, callback):
        self.listeners.remove(callback)


class ProbeLifecycleTests(unittest.TestCase):
    def test_disconnect_removes_successful_subscription_and_late_callback_is_inert(self):
        probe, subject = Probe(None), Observable()
        probe._bind(subject, "value")
        probe._bind(subject, "value")  # Rejected duplicate must not own a second binding.
        self.assertEqual(len(subject.listeners), 1)
        self.assertEqual(len(probe._bindings), 1)
        probe.disconnect()
        self.assertEqual(subject.listeners, [])
        self.assertTrue(probe.base_disconnected)
        scheduled = len(probe.queue)
        probe._changed()
        for callback in list(probe.queue):
            callback()  # No Live module access after disconnect.
        self.assertEqual(len(probe.queue), scheduled)

    def test_event_burst_schedules_one_deferred_snapshot(self):
        probe = Probe(None)
        initial = len(probe.queue)
        for _ in range(100):
            probe._changed()
        self.assertEqual(len(probe.queue), initial + 1)
        probe.disconnect()

    def test_unsupported_listener_is_reported_without_ownership(self):
        probe = Probe(None)
        probe._bind(SimpleNamespace(), "missing")
        self.assertEqual(probe._bindings, [])
        self.assertTrue(any("AttributeError" in line for line in probe.log))
        probe.disconnect()


if __name__ == "__main__":
    unittest.main()
