import copy
import unittest

from module_state import ModuleRegistry, ModuleStateManager, StateError, make_document, validate_document


class MemoryStore:
    def __init__(self):
        self.last = {}
        self.global_presets = {}
        self.set_presets = {}

    def load_last(self, surface_id):
        return copy.deepcopy(self.last.get(surface_id))

    def save_last(self, surface_id, document):
        self.last[surface_id] = copy.deepcopy(document)

    def load_global(self, surface_id, name):
        return copy.deepcopy(self.global_presets.get((surface_id, name)))

    def save_global(self, surface_id, name, document):
        self.global_presets[(surface_id, name)] = copy.deepcopy(document)

    def delete_global(self, surface_id, name):
        return self.global_presets.pop((surface_id, name), None) is not None

    def load_set(self, set_key, surface_id, name):
        return copy.deepcopy(self.set_presets.get((set_key, surface_id, name)))

    def save_set(self, set_key, surface_id, name, document):
        self.set_presets[(set_key, surface_id, name)] = copy.deepcopy(document)

    def delete_set(self, set_key, surface_id, name):
        return self.set_presets.pop((set_key, surface_id, name), None) is not None


class ModuleStateTests(unittest.TestCase):
    def setUp(self):
        self.registry = ModuleRegistry()
        for module_id in ("clip.launcher", "mixer.volume", "mixer.pan", "mixer.sends"):
            self.registry.register(module_id)
        self.store = MemoryStore()
        self.manager = ModuleStateManager("mf4track", self.registry, self.store)

    def test_last_layout_restores_idempotently(self):
        layout = {"row1.col1": "clip.launcher", "row2.col4": "mixer.volume"}
        self.manager.save_last(layout)
        first = self.manager.restore_last()
        second = self.manager.restore_last()
        self.assertEqual(first["assignments"], layout)
        self.assertEqual(second["assignments"], layout)

    def test_global_preset_save_load_delete(self):
        layout = {"row1.col1": "clip.launcher"}
        self.manager.save_global("Performance", layout)
        self.assertEqual(self.manager.load_global("Performance")["assignments"], layout)
        self.assertTrue(self.manager.delete_global("Performance"))
        self.assertIsNone(self.manager.load_global("Performance"))

    def test_set_preset_is_namespaced_by_set_and_surface(self):
        self.manager.save_set("verified-path-hash", "Tracking", {"row1.col1": "mixer.pan"})
        self.assertEqual(
            self.manager.load_set("verified-path-hash", "Tracking")["assignments"],
            {"row1.col1": "mixer.pan"},
        )
        self.assertIsNone(self.manager.load_set("another-set", "Tracking"))

    def test_missing_module_is_reported_and_saved_source_is_preserved(self):
        document = make_document("mf4track", {"row1.col1": "removed.old_module", "row1.col2": "mixer.pan"})
        resolved = __import__("module_state").resolve_document(document, "mf4track", self.registry)
        self.assertEqual(resolved["assignments"], {"row1.col2": "mixer.pan"})
        self.assertEqual(resolved["missing"], [{"slot": "row1.col1", "module_id": "removed.old_module"}])
        self.assertEqual(resolved["source_document"]["assignments"]["row1.col1"], "removed.old_module")

    def test_corrupt_or_unsupported_document_fails_closed(self):
        self.store.last["mf4track"] = {"schema_version": 999, "surface_id": "mf4track", "assignments": {}}
        with self.assertRaises(StateError):
            self.manager.restore_last()
        self.assertEqual(self.store.last["mf4track"]["schema_version"], 999)

    def test_surface_namespace_prevents_cross_surface_overwrite(self):
        other = ModuleStateManager("selectedtrack", self.registry, self.store)
        self.manager.save_last({"row1.col1": "clip.launcher"})
        other.save_last({"col1": "mixer.volume"})
        self.assertEqual(self.manager.restore_last()["assignments"], {"row1.col1": "clip.launcher"})
        self.assertEqual(other.restore_last()["assignments"], {"col1": "mixer.volume"})

    def test_unknown_modules_cannot_be_saved_as_current_state(self):
        with self.assertRaises(StateError):
            self.manager.save_last({"row1.col1": "not.registered"})

    def test_schema_rejects_wrong_shape_and_missing_identity(self):
        with self.assertRaises(StateError):
            validate_document({"schema_version": 1, "surface_id": "", "assignments": {}})
        with self.assertRaises(StateError):
            validate_document({"schema_version": 1, "surface_id": "mf4track", "assignments": []})


if __name__ == "__main__":
    unittest.main()
