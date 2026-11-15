import unittest

from layout_controller import LayoutStateController
from module_state import ModuleRegistry, ModuleStateManager, make_document


class MemoryStore(object):
    def __init__(self):
        self.last = {}
        self.global_presets = {}
        self.set_presets = {}

    def save_last(self, key, doc): self.last[key] = doc
    def load_last(self, key): return self.last.get(key)
    def save_global(self, surface, name, doc): self.global_presets[(surface, name)] = doc
    def load_global(self, surface, name): return self.global_presets.get((surface, name))
    def delete_global(self, surface, name): return self.global_presets.pop((surface, name), None) is not None
    def save_set(self, set_key, surface, name, doc): self.set_presets[(set_key, surface, name)] = doc
    def load_set(self, set_key, surface, name): return self.set_presets.get((set_key, surface, name))
    def delete_set(self, set_key, surface, name): return self.set_presets.pop((set_key, surface, name), None) is not None
    def list_global(self, surface): return []
    def list_set(self, set_key, surface): return []


class LayoutControllerTests(unittest.TestCase):
    def setUp(self):
        registry = ModuleRegistry()
        registry.register("mixer.pan")
        registry.register("mixer.volume")
        self.store = MemoryStore()
        self.manager = ModuleStateManager("selectedtrack", registry, self.store)
        self.current = {"column1": "mixer.pan", "column2": "mixer.volume"}
        self.applied = []
        self.reports = []
        self.controller = LayoutStateController(
            self.manager, lambda: dict(self.current),
            lambda layout: self.applied.append(dict(layout)),
            lambda: {"column1": "mixer.volume", "column2": "mixer.pan"},
            self.reports.append,
        )

    def test_startup_uses_last_layout_and_is_safe_without_saved_layout(self):
        result = self.controller.restore_startup()
        self.assertFalse(result["restored"])
        self.assertEqual(self.applied[-1], {
            "column1": "mixer.volume", "column2": "mixer.pan"
        })

    def test_module_change_persists_assignments_only(self):
        self.current["column1"] = "mixer.volume"
        self.controller.on_layout_changed()
        restored = self.manager.restore_last()
        self.assertEqual(restored["assignments"]["column1"], "mixer.volume")
        self.assertNotIn("parameter_values", restored["source_document"])

    def test_loading_preset_applies_and_updates_startup_last(self):
        self.manager.save_global("Mix", {"column1": "mixer.pan"})
        result = self.controller.load_global_preset("Mix")
        self.assertTrue(result["restored"])
        self.assertEqual(result["assignments"]["column1"], "mixer.pan")
        self.assertEqual(self.manager.restore_last()["assignments"]["column1"], "mixer.pan")

    def test_missing_module_uses_default_without_rewriting_saved_preset(self):
        self.store.global_presets[("selectedtrack", "Old")] = make_document(
            "selectedtrack", {"column1": "removed.module"})
        result = self.controller.load_global_preset("Old")
        self.assertEqual(result["assignments"]["column1"], "mixer.volume")
        self.assertEqual(result["missing"], [
            {"slot": "column1", "module_id": "removed.module"}
        ])
        self.assertEqual(
            self.store.global_presets[("selectedtrack", "Old")]["assignments"]["column1"],
            "removed.module",
        )

    def test_live_write_is_deferred_and_rapid_layouts_are_coalesced(self):
        scheduled = []
        controller = LayoutStateController(
            self.manager, lambda: dict(self.current),
            lambda layout: self.applied.append(dict(layout)),
            lambda: {"column1": "mixer.volume", "column2": "mixer.pan"},
            schedule_save=scheduled.append,
        )
        self.current["column1"] = "mixer.pan"
        controller.on_layout_changed()
        self.current["column1"] = "mixer.volume"
        controller.on_layout_changed()
        self.assertEqual(len(scheduled), 1)
        self.assertIsNone(self.manager.restore_last())
        scheduled[0]()
        self.assertEqual(self.manager.restore_last()["assignments"]["column1"],
                         "mixer.volume")


if __name__ == "__main__":
    unittest.main()
