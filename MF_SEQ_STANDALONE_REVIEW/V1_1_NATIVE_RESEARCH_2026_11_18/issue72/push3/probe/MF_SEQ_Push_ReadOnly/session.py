"""Bounded observation only. No controls, MIDI output, listeners or setters."""
from .inspect_host import read, inspect_root


def snapshot(song, c_instance):
    result = {}
    try:
        clip = song.view.detail_clip
        result['clip_present'] = clip is not None
        result['clip_type'] = type(clip).__name__
        if clip is not None:
            result['clip'] = {name: read(clip, name) for name in
                              ('is_midi_clip', 'midi_clip_type', 'step_sequencer')}
            result['clip_view'] = {name: read(clip.view, name) for name in
                                   ('selected_lane', 'selected_pitch', 'selected_note',
                                    'highlighted_row_index')}
            try:
                notes = clip.get_notes_extended(0, 128, 0.0, 4.0)
                result['conventional_notes'] = {
                    'count': len(notes), 'range_beats': [0, 4],
                    'native_step_representation_verified': False}
            except Exception as error:
                result['conventional_notes'] = {
                    'error': type(error).__name__, 'message': str(error)[:180]}
        # Existing getter only; no private imports, object construction or writers.
        # This is a Push-route candidate, not a public LOM path.
        result['push_route_candidate'] = inspect_root(c_instance)
    except Exception as error:
        result['error'] = type(error).__name__
        result['message'] = str(error)[:180]
    return result


class BoundedSession:
    PERIOD = 2.0
    DURATION = 120.0
    MAX_SAMPLES = 61

    def __init__(self, started):
        self.started = started
        self.next_at = started
        self.samples = 0
        self.closed = False

    def poll(self, now, getter):
        if self.closed:
            return []
        elapsed = max(0.0, now - self.started)
        if elapsed > self.DURATION or self.samples >= self.MAX_SAMPLES:
            return self.finish('limit', elapsed)
        if now < self.next_at:
            return []
        # Never replay missed intervals after a stalled host callback.
        self.next_at = now + self.PERIOD
        record = {'kind': 'sample', 'sample': self.samples,
                  'elapsed_s': round(elapsed, 3), 'observation': getter()}
        self.samples += 1
        records = [record]
        if self.samples >= self.MAX_SAMPLES or elapsed >= self.DURATION:
            records.extend(self.finish('limit', elapsed))
        return records

    def finish(self, reason, elapsed=None):
        if self.closed:
            return []
        self.closed = True
        return [{'kind': 'finished', 'reason': reason, 'samples': self.samples,
                 'elapsed_s': elapsed, 'writes_attempted': 0,
                 'listeners_registered': 0}]
