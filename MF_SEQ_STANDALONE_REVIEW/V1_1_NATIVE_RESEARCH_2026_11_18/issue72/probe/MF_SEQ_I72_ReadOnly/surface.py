"""One-shot read-only host/Push boundary probe. No MIDI bindings or listeners."""
import json
import Live
from _Framework.ControlSurface import ControlSurface
from .inspect_host import capture


class Issue72Probe(ControlSurface):
    def __init__(self, c_instance):
        super(Issue72Probe, self).__init__(c_instance)
        self._closed = False
        self._ran = False
        self.schedule_message(5, self._capture)

    def _emit(self, record):
        self.log_message("MFSEQ_I72 " + json.dumps(record, sort_keys=True))

    def _capture(self):
        if self._closed or self._ran:
            return
        self._ran = True
        try:
            app = Live.Application.get_application()
            self._emit({"kind": "runtime", "version": [app.get_major_version(), app.get_minor_version(), app.get_bugfix_version()]})
            for record in capture(self.song(), Live, self._c_instance):
                self._emit(record)
        except Exception as error:
            self._emit({"kind": "capture_error", "error": type(error).__name__, "message": str(error)[:180]})
        self._emit({"kind": "finished", "writes_attempted": 0, "listeners_registered": 0})

    def disconnect(self):
        self._closed = True
        self._emit({"kind": "disconnect", "listeners_registered": 0})
        super(Issue72Probe, self).disconnect()
