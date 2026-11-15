"""Surface adapter that applies module layouts after a Bento is initialized.

The host surface supplies callbacks; this module does not import Ableton or
schedule work. Call restore_startup only after the module catalog/defaults exist.
"""
from module_state import StateError


class LayoutStateController:
    def __init__(self, manager, read_layout, apply_layout, default_layout,
                 report_callback=None, schedule_save=None):
        self.manager = manager
        self.read_layout = read_layout
        self.apply_layout = apply_layout
        self.default_layout = default_layout
        self.report_callback = report_callback
        # In Live, inject schedule_save=lambda callback: surface.schedule_message(1, callback)
        # so no disk I/O occurs inside a MIDI value listener.
        self.schedule_save = schedule_save
        self._pending_last = None
        self._save_scheduled = False

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
            self._queue_last(assignments)
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

    def _queue_last(self, assignments):
        snapshot = self.manager.snapshot(assignments)
        if self.schedule_save is None:
            self.manager.save_last(snapshot["assignments"])
            return
        self._pending_last = snapshot
        if not self._save_scheduled:
            self._save_scheduled = True
            self.schedule_save(self.flush_pending)

    def flush_pending(self):
        """Scheduled persistence boundary; coalesces rapid module changes."""
        self._save_scheduled = False
        pending = self._pending_last
        self._pending_last = None
        if pending is None:
            return None
        return self.manager.save_last(pending["assignments"])

    def cancel_pending(self):
        self._pending_last = None
        self._save_scheduled = False

    def on_layout_changed(self):
        """Call after module assignment changes; parameter values are never read."""
        self._queue_last(self.read_layout())

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
