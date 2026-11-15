"""Test-only alternative: cache has_audio_output per Track with LOM listener invalidation.

This is deliberately not imported by the production remote script.
"""
class ListenerAvailabilityCache:
    def __init__(self):
        self._entries = {}

    def _refresh(self, track):
        entry = self._entries.get(id(track))
        if entry is None or entry[0] is not track:
            return
        try:
            entry[1] = bool(track.has_audio_output)
        except (AttributeError, RuntimeError, TypeError, ValueError):
            entry[1] = None

    def sync(self, tracks):
        active = {id(track): track for track in tracks if track is not None}
        for key, entry in list(self._entries.items()):
            if key not in active or active[key] is not entry[0]:
                track, _available, callback = entry
                if callback is not None:
                    try:
                        track.remove_has_audio_output_listener(callback)
                    except (AttributeError, RuntimeError, TypeError, ValueError):
                        pass
                del self._entries[key]
        for track in active.values():
            key = id(track)
            if key in self._entries:
                continue
            callback = lambda track=track: self._refresh(track)
            try:
                track.add_has_audio_output_listener(callback)
                available = bool(track.has_audio_output)
                self._entries[key] = [track, available, callback]
            except (AttributeError, RuntimeError, TypeError, ValueError):
                # If the listener API is absent, keep no stale cached value.
                try:
                    track.remove_has_audio_output_listener(callback)
                except Exception:
                    pass
                self._entries[key] = [track, None, None]

    def mixer_for(self, track):
        if track is None:
            return None
        entry = self._entries.get(id(track))
        if entry is None or entry[0] is not track:
            self.sync([track])
            entry = self._entries.get(id(track))
        if entry is None:
            return None
        available = entry[1]
        if available is None:
            try:
                available = bool(track.has_audio_output)
            except (AttributeError, RuntimeError, TypeError, ValueError):
                return None
        if available:
            try:
                return track.mixer_device
            except (AttributeError, RuntimeError, TypeError, ValueError):
                return None
        return None

    def close(self):
        for track, _available, callback in list(self._entries.values()):
            if callback is not None:
                try:
                    track.remove_has_audio_output_listener(callback)
                except (AttributeError, RuntimeError, TypeError, ValueError):
                    pass
        self._entries.clear()
