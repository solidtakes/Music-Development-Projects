"""Two-minute read-only Push comparison. Owner performs all UI/hardware actions."""
import json
import time
import Live
from _Framework.ControlSurface import ControlSurface
from .inspect_host import capture
from .session import BoundedSession, snapshot


class PushReadOnly(ControlSurface):
    def __init__(self, c_instance):
        super(PushReadOnly, self).__init__(c_instance)
        self._closed = False
        self._session = None
        self.schedule_message(5, self._begin)

    def _emit(self, record):
        self.log_message('MFSEQ_PUSH_RO ' + json.dumps(record, sort_keys=True))

    def _begin(self):
        if self._closed or self._session is not None:
            return
        app = Live.Application.get_application()
        self._emit({'kind': 'runtime', 'version': [app.get_major_version(),
                    app.get_minor_version(), app.get_bugfix_version()],
                    'beta_suffix_source': 'owner About Live or Log.txt header',
                    'duration_s': 120, 'max_samples': 61})
        try:
            for record in capture(self.song(), Live, self._c_instance):
                self._emit({'kind': 'initial_capability', 'record': record})
        except Exception as error:
            self._emit({'kind': 'capture_error', 'error': type(error).__name__,
                        'message': str(error)[:180]})
        self._session = BoundedSession(time.monotonic())
        self._tick()

    def _tick(self):
        if self._closed or self._session is None or self._session.closed:
            return
        try:
            for record in self._session.poll(time.monotonic(),
                    lambda: snapshot(self.song(), self._c_instance)):
                self._emit(record)
        except Exception as error:
            self._emit({'kind': 'sample_error', 'error': type(error).__name__,
                        'message': str(error)[:180]})
            for record in self._session.finish('error'):
                self._emit(record)
        if not self._session.closed:
            self.schedule_message(20, self._tick)

    def disconnect(self):
        self._closed = True
        if self._session is not None:
            for record in self._session.finish('disconnect'):
                self._emit(record)
        self._emit({'kind': 'disconnect', 'listeners_registered': 0})
        super(PushReadOnly, self).disconnect()
