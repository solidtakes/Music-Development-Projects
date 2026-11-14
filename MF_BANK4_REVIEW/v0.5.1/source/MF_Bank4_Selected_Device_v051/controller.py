"""Standalone standard-mode Bank 4 prototype. Original implementation, no Live import."""
import math
from .mapping import FIRST_CC, RGB_STATUS, RING_STATUS, PROFILES


def read(obj, name, default=None):
    try:
        return getattr(obj, name)
    except Exception:
        return default


class Controller:
    """Owns only its listeners, 16 mappings and Bank 4 CC output.

    Polling is a fallback for unavailable observable APIs, not another focus source.
    All methods run on the Remote Script's main thread.
    """
    def __init__(self, song, send):
        self.song = song
        self.send = send
        self.closed = False
        self.device = None
        self.track = None
        self.slots = [None] * 16
        self.colors = (0,) * 16
        self.listeners = []
        self.rgb_cache = [None] * 16
        self.ring_cache = [None] * 16
        self.signature = None
        self.parameter_inventory = []
        self.binding_report = []
        self.error_count = 0
        self._busy = False

    def _listen(self, obj, prop):
        add = read(obj, 'add_' + prop + '_listener')
        remove = read(obj, 'remove_' + prop + '_listener')
        has = read(obj, prop + '_has_listener')
        if not callable(add) or not callable(remove):
            return
        callback = self.sync
        try:
            # Never adopt/remove a preexisting subscription.
            if callable(has) and has(callback):
                return
            add(callback)
            self.listeners.append((obj, prop, callback))
        except Exception:
            self.error_count += 1

    def _detach(self):
        owned, self.listeners = self.listeners, []
        for obj, prop, callback in owned:
            try:
                remove = read(obj, 'remove_' + prop + '_listener')
                if callable(remove):
                    remove(callback)
            except Exception:
                # Deleted Live objects may already have invalidated subscriptions.
                self.error_count += 1

    def _context(self):
        view = read(self.song, 'view')
        track = read(view, 'selected_track')
        device = read(read(track, 'view'), 'selected_device')
        class_name = read(device, 'class_name', '')
        try:
            params = tuple(read(device, 'parameters', ()))
        except Exception:
            params = ()
        # Original names avoid user-renamed parameters when host exposes them.
        names = tuple(read(p, 'original_name') or read(p, 'name', '') for p in params)
        signature = (id(track), id(device), class_name,
                     tuple((id(p), name) for p, name in zip(params, names)))
        return track, device, class_name, params, names, signature

    def sync(self, *unused):
        if self.closed or self._busy:
            return
        self._busy = True
        try:
            track, device, kind, params, names, signature = self._context()
            if signature != self.signature:
                self._detach()
                self.signature = signature
                self.track, self.device = track, device
                profile, self.colors = PROFILES.get(kind, (((),) * 16, (0,) * 16))
                self.slots = [None] * 16
                self.parameter_inventory = [
                    {'index': j, 'name': name, 'bounds': self.bounds(p),
                     'enabled': bool(read(p, 'is_enabled', False)),
                     'quantized': bool(read(p, 'is_quantized', False))}
                    for j, (p, name) in enumerate(zip(params, names))]
                self.binding_report = []
                for i, aliases in enumerate(profile):
                    matches = [(j, p) for j, (p, name) in enumerate(zip(params, names))
                               if name in aliases]
                    if len(matches) == 1:
                        j, parameter = matches[0]
                        self.slots[i] = parameter
                        state = 'bound'
                    else:
                        j = None
                        state = 'ambiguous' if matches else 'unavailable'
                    self.binding_report.append({'encoder': i + 1, 'aliases': aliases,
                                                'index': j, 'state': state})
                self._listen(read(self.song, 'view'), 'selected_track')
                self._listen(read(track, 'view'), 'selected_device')
                self._listen(track, 'devices')
                self._listen(device, 'parameters')
                for parameter in self.slots:
                    if parameter is not None:
                        self._listen(parameter, 'value')
                # Invalidate on context changes even for an identical palette.
                self.invalidate()
            self.render()
        finally:
            self._busy = False

    @staticmethod
    def bounds(parameter):
        try:
            lo, hi, value = (float(getattr(parameter, key)) for key in ('min', 'max', 'value'))
            if not all(math.isfinite(v) for v in (lo, hi, value)) or hi <= lo:
                return None
            return lo, hi, min(hi, max(lo, value))
        except Exception:
            return None

    def _emit(self, status, index, value, cache):
        if cache[index] == value:
            return
        try:
            result = self.send((status, FIRST_CC + index, value))
            # None is accepted for hosts whose send method has no return value.
            if result is not False:
                cache[index] = value
        except Exception:
            self.error_count += 1

    def invalidate(self):
        self.rgb_cache = [None] * 16
        self.ring_cache = [None] * 16

    def render(self):
        if self.closed:
            return
        for i, parameter in enumerate(self.slots):
            bounds = self.bounds(parameter)
            enabled = bool(read(parameter, 'is_enabled', False))
            value = 0
            if bounds and enabled:
                lo, hi, current = bounds
                value = int(round(127.0 * (current - lo) / (hi - lo)))
            self._emit(RGB_STATUS, i, self.colors[i], self.rgb_cache)
            self._emit(RING_STATUS, i, value, self.ring_cache)

    def receive(self, message):
        if self.closed:
            return
        # Sync before every write, protecting rapid selection changes even if a
        # host doesn't provide selection listeners. Pushes are intentionally inert.
        self.sync()
        try:
            if len(message) != 3 or message[0] != RING_STATUS:
                return
            status, cc, delta = message
            if not all(isinstance(v, int) and 0 <= v <= 127 for v in (cc, delta)):
                return
            if not FIRST_CC <= cc < FIRST_CC + 16 or delta not in (0x3F, 0x41):
                return
            parameter = self.slots[cc - FIRST_CC]
            if not read(parameter, 'is_enabled', False):
                return
            bounds = self.bounds(parameter)
            if bounds is None:
                return
            lo, hi, current = bounds
            direction = -1 if delta == 0x3F else 1
            if read(parameter, 'is_quantized', False):
                value = round(current) + direction
            else:
                # Proposed sensitivity: 128 ticks over the raw host range.
                value = current + direction * (hi - lo) / 128.0
            parameter.value = min(hi, max(lo, value))
            self.render()
        except Exception:
            # Invalid/deleted or read-only host objects fail closed; no fallback.
            self.error_count += 1
            self.signature = None
            self.sync()

    def refresh(self):
        if not self.closed:
            self.invalidate()
            self.sync()

    def close(self):
        if self.closed:
            return
        self.closed = True
        self._detach()
        # Only Bank 4 addresses. Zero's visible meaning depends on saved config.
        for i in range(16):
            for status in (RGB_STATUS, RING_STATUS):
                try:
                    self.send((status, FIRST_CC + i, 0))
                except Exception:
                    self.error_count += 1
        self.slots = [None] * 16
        self.device = self.track = self.song = None
        self.send = None
