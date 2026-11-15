"""Surface adapter that applies module layouts after a Bento is initialized.

The host surface supplies callbacks; this module does not import Ableton or
schedule work. Call restore_startup only after the module catalog/defaults exist.
"""
from module_state import StateError


class LayoutStateController:
    def __init__(self, manager, read_layout, apply_layout, default_layout,
                 report_callback=None):
        self.manager = manager
        self.read_layout = read_layout
        self.apply_layout = apply_layout
        self.default_layout = default_layout
        self.report_callback = report_callback

    def _defaults(self):
        value = self.default_layout()
        if not isinstance(value, dict):
            raise StateError("default_layout callback must return a dict")
        return dict(value)

    def _apply_resolved(self, resolved, persist_as_last):
        assignments = self._defaults()
        missing = []
        if resolved is not None:
            assignments.update(resolved["assignments"])
            missing = list(resolved["missing"])
            # A missing module falls back to this surface's safe default for
            # that slot. The saved preset itself is never rewritten.
            for item in missing:
                slot = item["slot"]
                if slot not in assignments:
                    assignments.pop(slot, None)
        self.apply_layout(dict(assignments))
        if persist_as_last:
            self.manager.save_last(assignments)
        report = {
            "assignments": dict(assignments),
            "missing": missing,
            "restored": resolved is not None,
        }
        if self.report_callback is not None:
            self.report_callback(report)
        return report

    def restore_startup(self):
        return self._apply_resolved(self.manager.restore_last(), False)

    def on_layout_changed(self):
        """Call after a user changes module assignment; values are not captured."""
        return self.manager.save_last(self.read_layout())

    def save_global_preset(self, name):
        return self.manager.save_global(name, self.read_layout())

    def load_global_preset(self, name):
        resolved = self.manager.load_global(name)
        if resolved is None:
            return None
        return self._apply_resolved(resolved, True)

    def delete_global_preset(self, name):
        return self.manager.delete_global(name)

    def save_set_preset(self, set_key, name):
        return self.manager.save_set(set_key, name, self.read_layout())

    def load_set_preset(self, set_key, name):
        resolved = self.manager.load_set(set_key, name)
        if resolved is None:
            return None
        return self._apply_resolved(resolved, True)

    def delete_set_preset(self, set_key, name):
        return self.manager.delete_set(set_key, name)
