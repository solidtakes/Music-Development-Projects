"""Hardware-free MF4TRKBento correctness and script-call benchmark."""
import argparse
from contextlib import nullcontext
import gc
from pathlib import Path
from statistics import median
import sys
from time import perf_counter_ns, process_time_ns
from types import SimpleNamespace as NS
import zipfile

class Clock:
    value = 0
    def monotonic(self): return self.value

class Button:
    def __init__(self, momentary, kind, channel, cc, name):
        self.address = channel, cc
        self.callbacks = []
    def add_value_listener(self, callback): self.callbacks.append(callback)
    def remove_value_listener(self, callback): self.callbacks.remove(callback)

class Surface:
    def __init__(self, host):
        self.host = host
        self.sent = []
        self.tasks = []
        self.messages = []
        self.highlight = None
    def song(self): return self.host
    def component_guard(self): return nullcontext()
    def schedule_message(self, delay, callback): self.tasks.append((delay, callback))
    def show_message(self, message): pass
    def log_message(self, message): self.messages.append(message)
    def _send_midi(self, message): self.sent.append(message)
    def set_highlighting_session_component(self, session): self.highlight = session
    def refresh_state(self): pass
    def disconnect(self): pass

class Session:
    def __init__(self, width, height, **kwargs):
        self.size = width, height
        self.offsets = None
        self.closed = False
    def set_offsets(self, x, y): self.offsets = x, y
    def set_enabled(self, value): pass
    def disconnect(self): self.closed = True

sys.modules.update({
    '_Framework.ControlSurface': NS(ControlSurface=Surface),
    '_Framework.ButtonElement': NS(ButtonElement=Button),
    '_Framework.InputControlElement': NS(MIDI_CC_TYPE=1),
    '_Framework.SessionComponent': NS(SessionComponent=Session),
})

def load(name, path):
    if path.suffix == '.zip':
        with zipfile.ZipFile(path) as z:
            source = z.read('MF4TRKBento/MF4TRKBento.py')
    else:
        source = path.read_bytes()
    module = NS(__name__=name)
    exec(compile(source, str(path), 'exec'), vars(module))
    module.time = Clock()
    return module

def fixture(module, two_rows=True, alternate=False, playing=False):
    tracks = []
    for _ in range(5):
        slots = []
        for _ in range(5):
            clip = NS(color=0x2DBE4B, is_playing=playing, is_triggered=False,
                      is_recording=False, loop_start=0, loop_end=4, playing_position=2)
            slots.append(NS(clip=clip, has_clip=True, is_triggered=False, fires=0))
        tracks.append(NS(clip_slots=slots))
    scenes = [NS(fires=0) for _ in range(5)]
    for obj in scenes + [s for track in tracks for s in track.clip_slots]:
        def fire(obj=obj): obj.fires += 1
        obj.fire = fire
    host = NS(visible_tracks=tracks, view=NS(selected_track=tracks[0]), scenes=scenes)
    unit = module.MF4TRKBento(host)
    if two_rows:
        event(unit, 10, 4, 127)
        event(unit, 11, 7, 65)
        event(unit, 10, 4, 0)
    if alternate:
        event(unit, 10, 15, 127)
        event(unit, 10, 0, 127)
        event(unit, 10, 0, 0)
        event(unit, 10, 15, 0)
    return unit, tracks

def event(unit, channel, cc, raw):
    element = next(e for e, _ in unit._elements if e.address == (channel, cc))
    for callback in list(element.callbacks):
        callback(raw)

def tick(unit):
    assert len(unit.tasks) == 1
    _, callback = unit.tasks.pop()
    callback()

def verify(module):
    unit, tracks = fixture(module)
    assert set(e.address for e, _ in unit._elements) == {(c, n) for c in (10, 11) for n in range(16)}
    assert unit.highlight.size == (4, 2)
    assert unit._rgb_cache[0] == unit._rgb_cache[4] == 76
    unit.refresh_state()
    assert len(set(unit.sent[-32:])) == 32
    unit.sent.clear()
    session = unit.highlight
    tick(unit)
    tick(unit)
    assert unit.sent == [] and unit.highlight is session
    event(unit, 10, 2, 127)
    assert tracks[2].clip_slots[0].fires == 0
    event(unit, 10, 2, 0)
    assert tracks[2].clip_slots[0].fires == 1
    event(unit, 10, 0, 127)
    event(unit, 11, 11, 65)
    event(unit, 10, 0, 0)
    assert unit._clip_offset == 1 and tracks[0].clip_slots[1].fires == 0
    event(unit, 10, 11, 127)
    event(unit, 11, 0, 65)
    event(unit, 10, 11, 0)
    assert unit._clip_offset == 0
    unit.host.view.selected_track = tracks[1]
    tick(unit)
    tick(unit)
    assert unit.highlight.offsets == (1, 0)
    clip = tracks[1].clip_slots[0].clip
    clip.is_playing = True
    tick(unit)
    tick(unit)
    assert unit._ring_cache[0] == 63
    clip.playing_position = 3
    tick(unit)
    tick(unit)
    assert unit._ring_cache[0] == 95
    module.time.value = 0.30
    tick(unit)
    assert unit._rgb_cache[0] == 0
    module.time.value = 0
    clip.is_triggered = True
    tick(unit)
    tick(unit)
    assert unit._rgb_cache[0] == 108 and unit._ring_cache[0] == 0
    clip.is_recording = True
    tick(unit)
    tick(unit)
    assert unit._rgb_cache[0] == 72
    clip.is_playing = clip.is_triggered = clip.is_recording = False
    clip.color = 0x41A0EB
    tick(unit)
    tick(unit)
    assert unit._rgb_cache[0] == 68
    event(unit, 10, 15, 127)
    event(unit, 10, 0, 127)
    event(unit, 10, 0, 0)
    event(unit, 10, 15, 0)
    assert unit.highlight.size == (3, 2) and unit._rgb_cache[3] == unit._rgb_cache[7] == 0
    event(unit, 10, 7, 127)
    event(unit, 10, 7, 0)
    assert unit.host.scenes[1].fires == 1
    elements = [e for e, _ in unit._elements]
    unit.disconnect()
    assert all(not e.callbacks for e in elements)
    assert len(unit.sent[-32:]) == 32 and all(v == 0 for _, _, v in unit.sent[-32:])
    unit.sent.clear()
    tick(unit)
    assert not unit.tasks and not unit.sent

    unit, _ = fixture(module)
    sender = unit._send_midi
    unit._send_midi = lambda msg: False
    unit.refresh_state()
    assert not unit._rgb_cache and not unit._ring_cache
    unit._send_midi = sender
    tick(unit)
    tick(unit)
    assert len(unit._rgb_cache) == len(unit._ring_cache) == 16

    class BadSession:
        def __init__(self, *args, **kwargs): raise RuntimeError('unavailable')
    api = sys.modules['_Framework.SessionComponent']
    api.SessionComponent = BadSession
    try:
        unit, _ = fixture(module)
        before = len(unit.messages)
        tick(unit)
        tick(unit)
        assert len(unit.messages) == before and unit._rgb_cache[0] == 76
    finally:
        api.SessionComponent = Session
    print('PASS: MIDI addresses, gestures, highlight and failure path, RGB priorities, clip state/position, scene launch, send retry, refresh, teardown.')

def benchmark(module, mode, playing, loops=3000):
    results = []
    for _ in range(5):
        unit, _ = fixture(module, playing=playing)
        callback = unit._refresh_all if mode == 'scan' else lambda: tick(unit)
        for _ in range(25):
            callback()
            unit.sent.clear()
            if mode == 'scan':
                assert len(unit.tasks) == 1
        gc.collect()
        cpu_start, start = process_time_ns(), perf_counter_ns()
        attempts = 0
        for _ in range(loops):
            callback()
            attempts += len(unit.sent)
            unit.sent.clear()
        elapsed, cpu = perf_counter_ns() - start, process_time_ns() - cpu_start
        results.append((attempts / loops, elapsed / loops / 1000, cpu / loops / 1000))
    return tuple(median(row[i] for row in results) for i in range(3))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('baseline', type=Path)
    parser.add_argument('candidate', type=Path)
    args = parser.parse_args()
    baseline, candidate = load('baseline', args.baseline), load('candidate', args.candidate)
    verify(candidate)
    for mod in (baseline, candidate):
        unit, tracks = fixture(mod, playing=True)
        unit.sent.clear()
        old = mod is baseline
        for step in range(1, 81):
            mod.time.value = step / 20
            for track in tracks:
                for slot in track.clip_slots:
                    slot.clip.playing_position = (step / 20) % 4
            if old and step % 4:
                continue
            tick(unit)
        print(f'{mod.__name__} moving clips, 80 simulated host ticks: {len(unit.sent)} send attempts')
    for mode in ('scan', 'scheduled'):
        for playing in (False, True):
            for name, mod in (('v1.0.1', baseline), ('v1.1 EXP', candidate)):
                attempts, elapsed, cpu = benchmark(mod, mode, playing)
                print(f'{mode:9} {str(playing):5} {name:8} sends={attempts:.1f} wall_us={elapsed:.2f} cpu_us={cpu:.2f}')


