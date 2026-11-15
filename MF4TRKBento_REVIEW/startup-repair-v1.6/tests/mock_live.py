"""Hardware-free regression for v1.4. Mocks do not establish Live 13 behavior."""
import contextlib
import importlib.util
import pathlib
import sys
import types
from collections import Counter

framework = types.ModuleType('_Framework')
sys.modules['_Framework'] = framework

def stub(name, **members):
    mod = types.ModuleType('_Framework.' + name)
    for key, value in members.items():
        setattr(mod, key, value)
    sys.modules['_Framework.' + name] = mod
    setattr(framework, name, mod)

live = types.ModuleType('Live')
live.Track = types.SimpleNamespace(Track=types.SimpleNamespace(monitoring_states=types.SimpleNamespace(IN=1,AUTO=2,OFF=3)))
sys.modules['Live'] = live

class Parameter:
    def __init__(self, low=0.0, high=1.0):
        self.min, self.max, self.value = low, high, (high + low) / 2 if low < 0 else low

class Mixer:
    def __init__(self):
        self.panning = Parameter(-1.0, 1.0)
        self.sends = [Parameter() for _ in range(4)]

class Clip:
    def __init__(self, color=0x00bbcc):
        self.color = color
        self.is_playing = False
        self.is_recording = False
        self.is_triggered = False
        self.loop_start = 0.0
        self.loop_end = 8.0
        self.playing_position = 2.0

class Slot:
    def __init__(self):
        self.has_clip = False
        self.clip = None
        self.is_triggered = False
        self.has_stop_button = True
        self.fire_count = 0
    def fire(self):
        self.fire_count += 1

class Track:
    def __init__(self, scene_count=12):
        self.arm = self.solo = self.mute = False
        self.can_be_armed = True
        self.current_monitoring_state = 2
        self.mixer_device = Mixer()
        self.stop_count = 0
        self._has_audio_output = True
        self._has_audio_output_listeners = []
        self.audio_output_reads = 0
        self.audio_output_error = None
        self.audio_output_hook = None
        self.output_meter_level = 0.0
        self.devices = []
        self.clip_slots = [Slot() for _ in range(scene_count)]

    @property
    def has_audio_output(self):
        self.audio_output_reads += 1
        if self.audio_output_hook is not None:
            self.audio_output_hook(self)
        if self.audio_output_error is not None:
            raise self.audio_output_error
        return self._has_audio_output

    @has_audio_output.setter
    def has_audio_output(self, value):
        value = bool(value)
        changed = value != self._has_audio_output
        self._has_audio_output = value
        if changed:
            for callback in tuple(self._has_audio_output_listeners):
                callback()

    def add_has_audio_output_listener(self, callback):
        if callback not in self._has_audio_output_listeners:
            self._has_audio_output_listeners.append(callback)

    def has_audio_output_has_listener(self, callback):
        return callback in self._has_audio_output_listeners

    def remove_has_audio_output_listener(self, callback):
        if callback in self._has_audio_output_listeners:
            self._has_audio_output_listeners.remove(callback)

    def add_device(self, audio_output=True):
        device = types.SimpleNamespace(audio_output=bool(audio_output))
        self.devices.append(device)
        self.has_audio_output = any(item.audio_output for item in self.devices)
        return device

    def remove_device(self, device):
        self.devices.remove(device)
        self.has_audio_output = any(item.audio_output for item in self.devices)

    def stop_all_clips(self):
        self.stop_count += 1
        for slot in self.clip_slots:
            if slot.clip is not None:
                slot.clip.is_playing = False

class Scene:
    def __init__(self): self.fire_count=0
    def fire(self): self.fire_count+=1

class Song:
    def __init__(self):
        self.tracks = [Track() for _ in range(8)]
        self.visible_tracks = self.tracks
        self.scenes = [Scene() for _ in range(12)]
        self.master_track = Track()
        self.return_tracks = [Track()]
        self.stop_count = 0
        self.view = types.SimpleNamespace(selected_track=self.tracks[0])
        self.current_song_time = 0
        self.is_playing = True
        self.tempo = 120.0

    def stop_all_clips(self):
        self.stop_count += 1
        for track in self.tracks:
            track.stop_all_clips()

def count_reads(cls, attributes):
    def read(self, attr):
        if attr in attributes:
            READS[attr] += 1
        return object.__getattribute__(self, attr)
    cls.__getattribute__ = read

READS = Counter()
count_reads(Song, {'visible_tracks', 'tracks', 'scenes', 'master_track',
                   'is_playing', 'current_song_time'})
count_reads(Track, {'clip_slots', 'mixer_device', 'has_audio_output'})
count_reads(Mixer, {'panning', 'sends'})
count_reads(Parameter, {'min', 'max', 'value'})
count_reads(Clip, {'playing_position', 'loop_start', 'loop_end'})
SONG=Song()
class ControlSurface:
    def __init__(self, *args):
        self.sent=[]
        self.messages=[]
        self.scheduled=[]
        self.schedule_message_calls=0
        self.highlight_set_calls=0
        self.base_disconnect_calls=0
    def song(self): return SONG
    def component_guard(self): return contextlib.nullcontext()
    def _send_midi(self,msg): self.sent.append(msg); return True
    def schedule_message(self,t,func):
        self.schedule_message_calls += 1
        self.scheduled.append((t,func))
    def log_message(self,msg):self.messages.append(msg)
    def show_message(self,msg):self.messages.append(msg)
    def set_highlighting_session_component(self,c):
        self.highlighter=c
        self.highlight_set_calls += 1
    def refresh_state(self):pass
    def disconnect(self):self.base_disconnect_calls += 1

class ButtonElement:
    def __init__(self,*args,**kwargs):self.listeners=[]
    def add_value_listener(self,cb):self.listeners.append(cb)
    def remove_value_listener(self,cb):self.listeners.remove(cb)
class SessionComponent:
    created_count = 0
    def __init__(self,t,s,**kw):
        type(self).created_count += 1
        self.t=t;self.s=s;self.offset=(0,0);self.enabled=False
        self.set_offsets_calls=0;self.disconnect_calls=0
    def set_offsets(self,t,s):
        self.offset=(t,s)
        self.set_offsets_calls += 1
    def set_enabled(self,b):self.enabled=b
    def disconnect(self):self.disconnect_calls += 1
stub('ControlSurface',ControlSurface=ControlSurface)
stub('ButtonElement',ButtonElement=ButtonElement)
stub('InputControlElement',MIDI_CC_TYPE=1)
stub('SessionComponent',SessionComponent=SessionComponent)

def load(source):
    spec = importlib.util.spec_from_file_location("bento_under_test", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
