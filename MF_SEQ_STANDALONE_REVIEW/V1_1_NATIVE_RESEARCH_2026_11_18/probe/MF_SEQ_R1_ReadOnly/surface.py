"""No MIDI bindings, LED output, clip writes, conversions or transport commands."""
import json
import Live
from _Framework.ControlSurface import ControlSurface
from .snapshot import capture, inspect_object


class ReadOnlyProbe(ControlSurface):
    def __init__(self, c_instance):
        super(ReadOnlyProbe, self).__init__(c_instance)
        self._closed = False
        self._pending = False
        self._bindings = []
        self._count = 0
        self.schedule_message(5, self._snapshot)

    def _emit(self, kind, payload):
        # Only API metadata/values: no clip names, Set paths, notes or user IDs.
        self.log_message("MFSEQ_R1 " + json.dumps({"kind": kind, "data": payload}, sort_keys=True))

    def _changed(self, *args):
        if not self._closed and not self._pending and self._count < 20:
            self._pending = True
            self.schedule_message(2, self._snapshot)

    def _unbind(self):
        for obj, prop, callback in self._bindings:
            try:
                getattr(obj, "remove_" + prop + "_listener")(callback)
            except (AttributeError, RuntimeError, ReferenceError):
                pass
        self._bindings = []

    def _bind(self, obj, prop):
        try:
            add = getattr(obj, "add_" + prop + "_listener")
            remove = getattr(obj, "remove_" + prop + "_listener")
            if not callable(add) or not callable(remove):
                return
            # Keep the exact bound callback used for removal.
            callback = self._changed
            add(callback)
            self._bindings.append((obj, prop, callback))
            self._emit("listener", {"object_type": type(obj).__name__, "property": prop, "attached": True})
        except (AttributeError, RuntimeError, ReferenceError) as error:
            self._emit("listener", {"property": prop, "error_type": type(error).__name__})

    def _snapshot(self):
        self._pending = False
        if self._closed or self._count >= 20:
            return
        self._count += 1
        self._unbind()
        try:
            app = Live.Application.get_application()
            version = [app.get_major_version(), app.get_minor_version(), app.get_bugfix_version()]
            self._emit("runtime", {"version": version, "snapshot": self._count,
                                   "Live_public_members": [n for n in dir(Live) if not n.startswith('_')]})
            self._emit("Clip_class", inspect_object(Live.Clip.Clip, ("midi_clip_type", "step_sequencer")))
            result, targets = capture(self.song(), Live)
            for item in result:
                self._emit("object", item)
            for obj, props in targets:
                for prop in props:
                    self._bind(obj, prop)
        except Exception as error:
            self._emit("snapshot_error", {"error_type": type(error).__name__, "message": str(error)[:180]})

    def disconnect(self):
        self._closed = True
        self._unbind()
        self._emit("disconnect", {"listeners_remaining": len(self._bindings)})
        super(ReadOnlyProbe, self).disconnect()
