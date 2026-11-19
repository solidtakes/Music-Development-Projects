import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest

SOURCE = Path(__file__).parent / "probe/MF_SEQ_I72_ReadOnly/inspect_host.py"
spec = importlib.util.spec_from_file_location("i72_inspect", SOURCE)
inspector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspector)


class Clip:
    is_midi_clip = True
    midi_clip_type = 1

    def __init__(self):
        self.calls = []

    def get_notes_extended(self, *args):
        self.calls.append(args)
        return [SimpleNamespace(note_id=1, start_time=0.0, duration=0.25,
                                velocity=80, pitch=60, probability=1.0)]

    def set_step(self, *args):
        raise AssertionError("Writer must never be called")


class InspectHostTests(unittest.TestCase):
    def test_only_whitelisted_note_getter_is_called_and_not_labeled_native(self):
        clip = Clip()
        live = SimpleNamespace(Clip=SimpleNamespace(Clip=Clip, MidiClipType=SimpleNamespace(piano_roll=0, step_sequencer=1)))
        records = inspector.capture(SimpleNamespace(view=SimpleNamespace(detail_clip=clip)), live,
                                    SimpleNamespace(), module_lookup=lambda n: {"discoverable": False})
        self.assertEqual(clip.calls, [(0, 128, 0.0, 4.0)])
        notes = next(r for r in records if ".get_notes_extended(" in r["path"])["result"]
        self.assertIn("not_verified_native_steps", notes["representation"])
        self.assertFalse(notes["first_note_field_presence"]["repeat"])

    def test_missing_native_getter_retains_exact_exception(self):
        r = inspector.read(Clip(), "step_sequencer")
        self.assertFalse(r["ok"])
        self.assertEqual(r["error"], "AttributeError")

    def test_member_list_is_bounded_without_false_complete_flag(self):
        obj = SimpleNamespace(**{"step_%d" % i: i for i in range(100)})
        r = inspector.members(obj)
        self.assertEqual(len(r["matching_members"]), 64)
        self.assertEqual(r["matching_count"], 100)
        self.assertTrue(r["truncated"])

    def test_no_selected_clip_skips_all_clip_reads(self):
        live = SimpleNamespace(Clip=SimpleNamespace(Clip=Clip))
        r = inspector.capture(SimpleNamespace(view=SimpleNamespace(detail_clip=None)), live,
                              SimpleNamespace(), module_lookup=lambda n: {"discoverable": False})
        self.assertFalse(any("get_notes_extended(" in row["path"] for row in r))

    def test_existing_root_route_is_read_without_writers_or_construction(self):
        step = SimpleNamespace(velocity=80, offset=0.0, length=1.0, repeat=1,
                               pitch=0, chance=1.0, span=1)
        row = SimpleNamespace(steps=[step], midi_key=60, active_length=16,
                              step_size=6, play_direction=0, swing=0.0)
        seq = SimpleNamespace(rows=[row], highlighted_row_index=0, step_count=16)
        root = SimpleNamespace(song=SimpleNamespace(view=SimpleNamespace(detail_clip=SimpleNamespace(step_sequencer=seq))))
        r = inspector.inspect_root(SimpleNamespace(root=lambda: root))
        velocity = next(x for x in r if x['path'].endswith('steps[0].velocity'))
        self.assertEqual(velocity['result']['value'], 80)


if __name__ == "__main__":
    unittest.main()
