"""Read-only scale synchronization; no note edits, MIDI, timer or thread.
Clip APIs are capability-checked. Song proxy is used only when detail_clip is
provably the edit target. Unknown context blocks pitch edits, never C Major.
"""
class ScaleSync:
    PROPERTIES = ('scale_mode', 'root_note', 'scale_name', 'scale_intervals')
    def __init__(self, surface):
        self.surface = surface
        self.song = surface.song()
        self.view = self.song.view
        self.clip = None
        self.source = None
        self.bindings = []
        self.dirty = True
        self.closed = False
        self.last_poll = -100
        self.state_key = None
        self.mask = frozenset()
        self.enabled = False
        self.supported = False
        self.reason = ''
        self.last_warning = None
        self.mask_rebuilds = 0
        self.selection_poll = False
        self.property_poll = True
        self._watch_context()

    def _watch_context(self):
        for prop in ('detail_clip', 'highlighted_clip_slot', 'selected_track'):
            if not self._watch(self.view, prop, self._selection_changed, 'view'):
                self.selection_poll = True
        # Song notifications also catch UI context changes in proxy runtimes.
        for prop in self.PROPERTIES:
            self._watch(self.song, prop, self._scale_changed, 'song')

    def _watch(self, obj, prop, callback, group):
        add = getattr(obj, 'add_' + prop + '_listener', None)
        remove = getattr(obj, 'remove_' + prop + '_listener', None)
        has = getattr(obj, prop + '_has_listener', None)
        if not callable(add) or not callable(remove):
            return False
        try:
            if not callable(has) or not has(callback):
                add(callback)
                self.bindings.append((obj, prop, callback, group))
            return True
        except Exception as exc:
            self.surface.log_message('MF SEQ SCALE | listener {} unavailable: {}: {}'.format(prop, type(exc).__name__, exc))
            return False

    def _unwatch(self, group=None):
        retained = []
        for obj, prop, callback, category in self.bindings:
            if group is not None and category != group:
                retained.append((obj, prop, callback, category))
                continue
            try:
                has = getattr(obj, prop + '_has_listener', None)
                if not callable(has) or has(callback):
                    getattr(obj, 'remove_' + prop + '_listener')(callback)
            except Exception as exc:
                self.surface.log_message('MF SEQ SCALE | detach {}: {}: {}'.format(prop, type(exc).__name__, exc))
        self.bindings = retained

    def _scale_changed(self, *args):
        if not self.closed:
            self.dirty = True

    def _selection_changed(self, *args):
        # Keep callbacks cheap and read-only. Next edit/tick binds the actual
        # _target clip before reading state; never quantize on notification.
        self._scale_changed()

    def bind(self, clip):
        if self.closed:
            return
        current_song = self.surface.song()
        if not self.surface._same_clip(current_song, self.song):
            self._unwatch()
            self.song = current_song
            self.view = current_song.view
            self.clip = self.source = None
            self.selection_poll = False
            self._watch_context()
        if self.surface._same_clip(clip, self.clip) and self.source is not None:
            return
        self._unwatch('clip')
        self.clip = clip
        self.source = None
        self.dirty = True
        self.property_poll = True
        try:
            # Presence is not a Python-version guarantee. Readback below validates
            # values and listeners are independently capability-checked.
            if clip is not None and hasattr(clip, 'scale_mode'):
                self.source = clip
                watched = [self._watch(clip, p, self._scale_changed, 'clip') for p in self.PROPERTIES]
                self.property_poll = not all(watched)
            elif hasattr(self.song, 'scale_mode'):
                self.source = self.song
                watched = {prop for obj, prop, cb, group in self.bindings if group == 'song'}
                self.property_poll = not set(self.PROPERTIES).issubset(watched)
        except Exception as exc:
            self.reason = 'Scale context binding failed: {}: {}'.format(type(exc).__name__, exc)

    def _read(self):
        try:
            if self.source is None:
                raise RuntimeError('No readable Clip/Song scale_mode API')
            if self.source is self.song and not self.surface._same_clip(
                    getattr(self.view, 'detail_clip', None), self.clip):
                raise RuntimeError('Song scale proxy is not bound to the edited detail clip')
            enabled = getattr(self.source, 'scale_mode')
            if enabled not in (False, True, 0, 1):
                raise RuntimeError('Ambiguous Scale Awareness state')
            enabled = bool(enabled)
            if enabled:
                raw_root = getattr(self.source, 'root_note')
                root = int(raw_root)
                if root != raw_root or not 0 <= root < 12:
                    raise RuntimeError('Scale root outside 0..11')
                name = str(getattr(self.source, 'scale_name'))
                raw = tuple(getattr(self.source, 'scale_intervals'))
                if not raw or any(int(v) != v or not 0 <= int(v) < 12 for v in raw):
                    raise RuntimeError('Invalid scale intervals')
                intervals = tuple(sorted(set(int(v) for v in raw)))
            else:
                root, name, intervals = 0, 'Chromatic', tuple(range(12))
            key = (enabled, root, intervals, name)
            if key != self.state_key:
                self.state_key = key
                self.surface.log_message('MF SEQ SCALE | owner={} enabled={} root={} scale={} intervals={} property_poll={}'.format(
                    'Clip' if self.source is self.clip else 'Song proxy', enabled, root, name, intervals, self.property_poll))
                mask = frozenset((root + interval) % 12 for interval in intervals)
                if mask != self.mask:
                    self.mask = mask
                    self.mask_rebuilds += 1
            self.enabled = enabled
            self.supported = True
            self.reason = ''
            self.last_warning = None
        except Exception as exc:
            self.supported = False
            self.reason = 'Scale synchronization unavailable: {}: {}'.format(type(exc).__name__, exc)
        self.dirty = False

    def tick(self, clip, tick_count):
        if self.closed:
            return
        self.bind(clip)
        due = (self.property_poll or self.selection_poll) and tick_count - self.last_poll >= 4
        if self.dirty or due:
            self.last_poll = tick_count
            self._read()

    def next_pitch(self, clip, pitch, direction, minimum, maximum):
        if self.closed:
            return int(pitch)
        self.bind(clip)
        # If any observer is unavailable, read the small state on edit so the
        # next detent never waits for the polling interval.
        if self.dirty or self.property_poll or self.selection_poll:
            self._read()
        if not self.supported:
            if self.reason != self.last_warning:
                self.last_warning = self.reason
                self.surface._report(self.reason + '; pitch edit blocked, no retuning')
            return int(pitch)
        direction = 1 if direction > 0 else -1
        candidate = int(pitch) + direction
        while minimum <= candidate <= maximum:
            if candidate % 12 in self.mask:
                return candidate
            candidate += direction
        return int(pitch)

    def close(self):
        self.closed = True
        self._unwatch()
        self.clip = self.source = None
