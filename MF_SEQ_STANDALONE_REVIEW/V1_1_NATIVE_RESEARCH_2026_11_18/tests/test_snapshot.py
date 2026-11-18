import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).parents[1] / "probe/MF_SEQ_R1_ReadOnly/snapshot.py"
spec = importlib.util.spec_from_file_location("snapshot", SOURCE)
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


class Frozen:
    def __init__(self, **attributes):
        self.__dict__.update(attributes)

    def __setattr__(self, name, value):
        raise AssertionError("Probe attempted a host write: " + name)

    def __getattr__(self, name):
        if name.startswith(("set_", "create_", "fire", "remove_", "delete_")):
            raise AssertionError("Probe attempted a mutation lookup: " + name)
        raise AttributeError(name)


class SnapshotTests(unittest.TestCase):
    def test_actual_getter_failures_are_preserved(self):
        class Invalid:
            @property
            def steps(self):
                raise RuntimeError("Object no longer valid")
        item = snapshot.inspect_object(Invalid(), ("steps", "missing"))
        self.assertEqual(item["properties"]["steps"]["error_type"], "RuntimeError")
        self.assertEqual(item["properties"]["missing"]["error_type"], "AttributeError")

    def test_selected_row_and_steps_are_only_read(self):
        step = Frozen(is_on=True, velocity=80, offset=0.0, length=1.0,
                      repeat=1, pitch=0, chance=1.0, span=1)
        row = Frozen(midi_key=60, active_length=16, step_size=6,
                     play_direction=0, swing=0.0, steps=(step,))
        seq = Frozen(rows=(row,), highlighted_row_index=0, step_count=16)
        clip = Frozen(is_midi_clip=True, midi_clip_type=1, step_sequencer=seq,
                      view=Frozen())
        song = Frozen(view=Frozen(detail_clip=clip), tracks=())
        result, targets = snapshot.capture(song, SimpleNamespace())
        sampled = [r for r in result if r.get("path", "").endswith("steps[0]")]
        self.assertEqual(sampled[0]["properties"]["velocity"]["value"], 80)
        self.assertTrue(targets)

    def test_negative_or_stale_row_index_is_not_used(self):
        for index in (-1, 3):
            seq = Frozen(rows=(Frozen(),), highlighted_row_index=index)
            clip = Frozen(step_sequencer=seq)
            song = Frozen(view=Frozen(detail_clip=clip), tracks=())
            result, _ = snapshot.capture(song, SimpleNamespace())
            self.assertFalse(any(".rows[" in r.get("path", "") for r in result))


if __name__ == "__main__":
    unittest.main()
