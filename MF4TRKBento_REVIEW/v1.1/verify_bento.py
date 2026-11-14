"""Hardware-free MF4TRKBento correctness and script-call benchmark."""
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
    assert unit.highlight.offsets == (0, 0)
    assert unit.highlight.size == (4, 2)
    assert set(e.address for e, _ in unit._elements) == {(ch, cc) for ch in (10,11) for cc in range(16)}
    first = unit.highlight
    unit.host.view.selected_track = tracks[-1]
    unit.host.view.selected_scene = unit.host.scenes[-1]
    tick(unit)
    tick(unit)
    assert unit.highlight is first and first.offsets == (0, 0)
    event(unit, 10, 1, 127)
    event(unit, 10, 1, 0)
    assert tracks[1].clip_slots[0].fires == 1

    def scroll(cc, ticks, raw=65):
        event(unit, 10, 0, 127)
        for _ in range(ticks):
            event(unit, 11, cc, raw)
        event(unit, 10, 0, 0)

    scroll(15, 3)
    assert first.offsets == (0, 0) and tracks[0].clip_slots[0].fires == 0
    scroll(15, 4)
    assert first.offsets == (1, 0)
    scroll(15, 8)
    assert first.offsets == (1, 0)
    scroll(11, 4)
    assert first.offsets == (1, 1)
    event(unit, 10, 0, 127)
    for raw in (65,65,65,63,63,63):
        event(unit, 11, 11, raw)
    assert first.offsets == (1, 1)
    event(unit, 11, 11, 63)
    assert first.offsets == (1, 0)
    event(unit, 10, 0, 0)
    scroll(11, 4)
    assert first.offsets == (1, 1)
    event(unit, 10, 11, 127)
    for _ in range(4):
        event(unit, 11, 0, 65)
    event(unit, 10, 11, 0)
    assert first.offsets == (1, 0)

    unit.host.scenes[0].color = 0x41A0EB
    unit.host.scenes[1].color = 0xF5CD28
    event(unit, 10, 15, 127)
    event(unit, 10, 0, 127)
    for _ in range(4):
        event(unit, 11, 15, 65)
    event(unit, 10, 15, 0)
    event(unit, 10, 0, 0)
    assert unit.highlight.size == (3, 2) and unit.highlight.offsets == (1, 0)
    assert (unit._rgb_cache[3], unit._rgb_cache[7]) == (68, 108)
    assert (unit._ring_cache[3], unit._ring_cache[7]) == (0, 0)
    for cc in (3, 7):
        event(unit, 10, cc, 127)
        event(unit, 10, cc, 0)
    assert [scene.fires for scene in unit.host.scenes][:2] == [1, 1]
    unit.host.scenes[0].color = 0xEB2D32
    tick(unit)
    tick(unit)
    assert unit._rgb_cache[3] == 72

    event(unit, 10, 15, 127)
    event(unit, 10, 0, 127)
    event(unit, 10, 0, 0)
    event(unit, 10, 15, 0)
    assert unit.highlight.size == (4, 2) and (unit._rgb_cache[3], unit._rgb_cache[7]) == (76,76)
    event(unit, 10, 3, 127)
    event(unit, 10, 3, 0)
    assert tracks[4].clip_slots[0].fires == 1
    event(unit, 10, 0, 127)
    event(unit, 11, 3, 65)
    event(unit, 10, 0, 0)
    assert unit.highlight.size == (4, 1) and unit._rgb_cache[0] == 0
    event(unit, 10, 4, 127)
    event(unit, 10, 4, 0)
    assert tracks[1].clip_slots[0].fires == 2
    unit.host.visible_tracks = tracks[:2]
    unit.host.scenes = unit.host.scenes[:1]
    tick(unit)
    tick(unit)
    assert unit.highlight.offsets == (0,0)
    unit.host.scenes = []
    tick(unit)
    tick(unit)
    assert unit._session_component is None and all(v == 0 for v in unit._rgb_cache.values())
    unit.disconnect()
    unit.sent.clear()
    tick(unit)
    assert not unit.sent and not unit.tasks

if __name__ == '__main__':
    verify(load('candidate', Path(sys.argv[1])))
    print('PASS: independent box, track/scene four-detent scrolling, reversal/reset/bounds, alternate gesture and scene RGB, normal clip mode, Row 2, teardown.')

