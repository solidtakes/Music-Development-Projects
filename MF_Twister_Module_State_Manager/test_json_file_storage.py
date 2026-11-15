import json
import os
import tempfile
import unittest

from json_file_storage import JSONFileStorage, StorageError
from module_state import ModuleRegistry, ModuleStateManager


class JSONFileStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.mkdtemp(prefix="mft-state-test-")
        self.store = JSONFileStorage(self.temp)
        registry = ModuleRegistry()
        registry.register("mixer.volume")
        registry.register("clip.launcher")
        self.manager = ModuleStateManager("mf4track", registry, self.store)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp, ignore_errors=True)

    def test_last_layout_persists_across_instances(self):
        layout = {"row1.col1": "clip.launcher", "row4.col4": "mixer.volume"}
        self.manager.save_last(layout)
        other = JSONFileStorage(self.temp)
        restored = ModuleStateManager("mf4track", self.manager.registry, other).restore_last()
        self.assertEqual(restored["assignments"], layout)

    def test_global_named_presets_list_load_and_delete(self):
        self.manager.save_global("Studio", {"row1.col1": "clip.launcher"})
        self.manager.save_global("Live", {"row1.col1": "mixer.volume"})
        self.assertEqual([x["name"] for x in self.manager.list_global()], ["Live", "Studio"])
        self.assertEqual(self.manager.load_global("Studio")["assignments"],
                         {"row1.col1": "clip.launcher"})
        self.assertTrue(self.manager.delete_global("Studio"))
        self.assertIsNone(self.manager.load_global("Studio"))

    def test_set_presets_are_isolated_by_set_and_surface(self):
        self.manager.save_set("set-key-A", "Verse", {"row1.col1": "clip.launcher"})
        self.manager.save_set("set-key-B", "Verse", {"row1.col1": "mixer.volume"})
        self.assertEqual(self.manager.load_set("set-key-A", "Verse")["assignments"],
                         {"row1.col1": "clip.launcher"})
        self.assertEqual(self.manager.load_set("set-key-B", "Verse")["assignments"],
                         {"row1.col1": "mixer.volume"})
        self.assertEqual(self.manager.list_set("set-key-A")[0]["name"], "Verse")
        self.assertTrue(self.manager.delete_set("set-key-A", "Verse"))
        self.assertIsNone(self.manager.load_set("set-key-A", "Verse"))

    def test_backup_recovers_previous_valid_state_after_corruption(self):
        self.manager.save_last({"row1.col1": "clip.launcher"})
        self.manager.save_last({"row1.col1": "mixer.volume"})
        path = self.store._path("last", "mf4track")
        with open(path, "wb") as handle:
            handle.write(b"{broken")
        restored = self.manager.restore_last()
        self.assertEqual(restored["assignments"], {"row1.col1": "clip.launcher"})
        self.assertEqual(self.store.last_recovery["source"], "backup")

    def test_corrupt_primary_without_backup_fails_closed(self):
        path = self.store._path("last", "mf4track")
        os.makedirs(os.path.dirname(path))
        with open(path, "wb") as handle:
            handle.write(b"{broken")
        with self.assertRaises(StorageError):
            self.store.load_last("mf4track")

    def test_surface_and_namespace_are_not_taken_from_filename(self):
        self.manager.save_global("A/../../B", {"row1.col1": "clip.launcher"})
        self.assertEqual(self.manager.load_global("A/../../B")["assignments"],
                         {"row1.col1": "clip.launcher"})
        self.assertEqual(len(os.listdir(os.path.join(self.temp, "global",
                                                     self.store._digest("mf4track")))), 1)

    def test_unknown_document_fields_are_rejected(self):
        path = self.store._path("last", "mf4track")
        os.makedirs(os.path.dirname(path))
        envelope = {
            "format_version": 1, "kind": "last", "surface_id": "mf4track",
            "preset_name": None, "set_key": None,
            "document": {"schema_version": 1, "surface_id": "mf4track",
                         "preset_name": None, "assignments": {},
                         "volume_values": {"track1": 0.5}}
        }
        with open(path, "w") as handle:
            json.dump(envelope, handle)
        with self.assertRaises(StorageError):
            self.store.load_last("mf4track")


if __name__ == "__main__":
    unittest.main()
