"""Inert Live mocks: run with python3 -m unittest discover -s tests -v."""
import importlib
import json
from pathlib import Path
import sys
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'source'))
FORWARDED = []
live = types.ModuleType('Live')
live.MidiMap = types.SimpleNamespace(forward_midi_cc=lambda *a: FORWARDED.append(a))
sys.modules['Live'] = live

class Base:
    def __init__(self, ci):
        self._c_instance = ci
        self.song = ci.song
        self.sent = []
        self.scheduled = []
        self.base_disconnected = False
    def component_guard(self):
        class Guard:
            def __enter__(self): pass
            def __exit__(self, *a): pass
        return Guard()
    def _send_midi(self, msg, optimized=True):
        assert optimized is False
        self.sent.append(msg)
        return True
    def schedule_message(self, delay, callback): self.scheduled.append((delay, callback))
    def request_rebuild_midi_map(self): self.rebuild_requested = True
    def build_midi_map(self, handle): pass
    def show_message(self, text): pass
    def refresh_state(self): pass
    def disconnect(self): self.base_disconnected = True

for name in ('ableton', 'ableton.v2', 'ableton.v2.control_surface'):
    sys.modules[name] = types.ModuleType(name)
sys.modules['ableton.v2.control_surface'].ControlSurface = Base
pkg = importlib.import_module('MF_Bank4_Selected_Device_v050')
Controller = importlib.import_module('MF_Bank4_Selected_Device_v050.controller').Controller
mapping = importlib.import_module('MF_Bank4_Selected_Device_v050.mapping')

class Observable:
    def __init__(self, **values):
        self.listeners = {}
        self.__dict__.update(values)
    def __getattr__(self, name):
        if name.endswith('_has_listener'):
            prop = name[:-13]
            return lambda cb: cb in self.listeners.get(prop, [])
        if name.startswith('add_') and name.endswith('_listener'):
            prop = name[4:-9]
            def add(cb):
                if cb in self.listeners.setdefault(prop, []):
                    raise AssertionError('duplicate listener')
                self.listeners[prop].append(cb)
            return add
        if name.startswith('remove_') and name.endswith('_listener'):
            prop = name[7:-9]
            return lambda cb: self.listeners[prop].remove(cb)
        raise AttributeError(name)
    def fire(self, prop):
        for cb in list(self.listeners.get(prop, [])): cb()

class Parameter(Observable):
    def __init__(self, name, value=0.5, lo=0, hi=1, quantized=False, enabled=True):
        super().__init__(name=name, original_name=name, min=lo, max=hi,
                         is_quantized=quantized, is_enabled=enabled)
        self._value = value
        self.writes = 0
    @property
    def value(self): return self._value
    @value.setter
    def value(self, value):
        self._value = value
        self.writes += 1
        self.fire('value')

def device(kind='Eq8'):
    profile = mapping.PROFILES.get(kind, (((),)*16, ()))[0]
    return Observable(class_name=kind, name='User renamed device',
                      parameters=[Parameter(aliases[0]) for aliases in profile if aliases])

def fixture(dev=None):
    track = Observable(view=Observable(selected_device=dev), devices=[dev] if dev else [])
    song = Observable(view=Observable(selected_track=track), appointed_device=device('Compressor2'))
    return song, track

class ControllerTests(unittest.TestCase):
    def setUp(self):
        self.dev = device()
        self.song, self.track = fixture(self.dev)
        self.sent = []
        self.c = Controller(self.song, self.sent.append)
        self.c.sync()
    def tearDown(self): self.c.close()
    def test_initial_exact_frame(self):
        expected = [m for i in range(16) for m in ((0xBA,48+i,68),(0xBB,48+i,64))]
        self.assertEqual(self.sent, expected)
    def test_suppression_and_force_refresh(self):
        self.c.sync(); self.assertEqual(len(self.sent),32)
        self.c.refresh(); self.assertEqual(self.sent[:32],self.sent[32:])
    def test_palettes_and_unused_filter(self):
        self.track.view.selected_device=device('AutoFilter'); self.track.view.fire('selected_device')
        self.assertEqual(self.c.colors,(108,)*8+(0,)*8)
        self.assertEqual(self.c.slots[8:],[None]*8)
        self.assertTrue(all(m[2]==0 for m in self.sent[-16:]))
        self.track.view.selected_device=device('Compressor2');self.c.sync()
        self.assertEqual(self.c.colors,(72,)*16)
    def test_no_appointed_fallback(self):
        self.track.view.selected_device=None; self.c.sync()
        self.assertIsNone(self.c.device); self.assertEqual(self.c.colors,(0,)*16)
        self.assertEqual(self.c.slots,[None]*16)
    def test_unsupported_and_no_track(self):
        self.track.view.selected_device=device('Operator');self.c.sync()
        self.assertEqual(self.c.slots,[None]*16)
        self.song.view.selected_track=None;self.c.sync()
        self.assertIsNone(self.c.track)
    def test_continuous_rotation_bounds(self):
        p=self.dev.parameters[0]
        self.c.receive((0xBB,48,65));self.assertEqual(p.value,.5+1/128)
        self.c.receive((0xBB,48,63));self.assertEqual(p.value,.5)
        p.value=1;self.c.receive((0xBB,48,65));self.assertEqual(p.value,1)
        p.value=0;self.c.receive((0xBB,48,63));self.assertEqual(p.value,0)
    def test_quantized_rotation(self):
        p=self.dev.parameters[0];p.min=0;p.max=3;p.is_quantized=True;p.value=1
        self.c.receive((0xBB,48,65));self.assertEqual(p.value,2)
        self.c.receive((0xBB,48,63));self.assertEqual(p.value,1)
    def test_disabled_invalid_bounds_and_nan(self):
        p=self.dev.parameters[0]
        for key,value in [('is_enabled',False),('max',0),('max',float('nan'))]:
            setattr(p,key,value);before=p.writes
            self.c.receive((0xBB,48,65));self.assertEqual(p.writes,before)
            self.assertEqual(self.c.ring_cache[0],0)
            p.is_enabled=True
    def test_wrong_channels_addresses_push_and_malformed(self):
        p=self.dev.parameters[0]
        for msg in [(),(0xBB,48),(0xBB,48,65,0),(0xBA,48,127),(0xBB,47,65),
                    (0xBB,64,65),(0xBB,48,1),(0xBB,48,64),(0xBB,48,127),
                    (0xB0,48,65),(0xBB,-1,65),(0xBB,48,'x')]:
            self.c.receive(msg)
        self.assertEqual(p.writes,0)
    def test_external_automation_feedback(self):
        p=self.dev.parameters[0];self.sent.clear();p.value=1
        self.assertEqual(self.sent,[(0xBB,48,127)])
    def test_track_switch_detaches_old_listeners(self):
        oldp=self.dev.parameters[0];oldview=self.track.view
        new=device('AutoFilter');newtrack=Observable(view=Observable(selected_device=new))
        self.song.view.selected_track=newtrack;self.song.view.fire('selected_track')
        self.assertTrue(all(not v for v in oldp.listeners.values()))
        self.assertTrue(all(not v for v in oldview.listeners.values()))
        self.assertIs(self.c.device,new)
    def test_rapid_focus_change_before_rotation(self):
        old=self.dev.parameters[0];new=device('Compressor2')
        self.track.view.selected_device=new # no event: input must resolve focus again
        self.c.receive((0xBB,48,65))
        self.assertEqual(old.writes,0);self.assertEqual(new.parameters[0].writes,1)
    def test_parameter_collection_reorder_removal_and_ambiguity(self):
        original=self.dev.parameters[0]
        self.dev.parameters.reverse();self.dev.fire('parameters')
        self.assertIs(self.c.slots[0],original)
        self.dev.parameters.append(Parameter('1 Frequency A'));self.c.sync()
        self.assertIsNone(self.c.slots[0]);self.assertEqual(self.c.binding_report[0]['state'],'ambiguous')
        self.dev.parameters=[];self.c.sync();self.assertEqual(self.c.slots,[None]*16)
    def test_original_names_survive_user_rename(self):
        p=self.dev.parameters[0];p.name='New name';self.c.sync()
        self.assertIs(self.c.slots[0],p)
    def test_poll_fallback_without_observers(self):
        v=types.SimpleNamespace(selected_device=self.dev)
        self.track.view=v;self.c.sync()
        v.selected_device=None;self.c.sync();self.assertIsNone(self.c.device)
    def test_deleted_device_reads_fail_closed(self):
        class Deleted:
            def __getattribute__(self,name):raise RuntimeError('object deleted')
        self.track.view.selected_device=Deleted();self.c.sync()
        self.assertEqual(self.c.slots,[None]*16)
    def test_no_duplicate_listeners_after_repeated_switches(self):
        other=device('AutoFilter')
        for i in range(50):
            self.track.view.selected_device=other if i%2 else self.dev
            self.c.sync();self.c.sync()
        self.assertTrue(all(len(v)<=1 for o,p,c in self.c.listeners for v in o.listeners.values()))
        self.c.close()
        for obj in [self.song.view,self.track.view,self.track,self.dev,other,*self.dev.parameters,*other.parameters]:
            self.assertTrue(all(not v for v in obj.listeners.values()))
    def test_close_idempotence_and_late_callbacks(self):
        cb=self.c.sync;self.c.close();n=len(self.sent)
        cb();self.c.receive((0xBB,48,65));self.c.refresh();self.c.close()
        self.assertEqual(len(self.sent),n)
        self.assertEqual(self.sent[-32:],[m for i in range(16) for m in ((0xBA,48+i,0),(0xBB,48+i,0))])
    def test_send_failure_retry(self):
        self.c.rgb_cache[0]=None
        self.c.send=lambda msg:False;self.c.render();self.assertIsNone(self.c.rgb_cache[0])
        def fail(msg):raise RuntimeError('output unavailable')
        self.c.send=fail;self.c.render();self.assertIsNone(self.c.rgb_cache[0])
        self.c.send=self.sent.append;self.c.render();self.assertEqual(self.c.rgb_cache[0],68)
    def test_published_fixture_frames(self):
        fixtures=json.loads((ROOT/'MIDI_FIXTURES.json').read_text())
        for kind,key in [('Eq8','eq8_midpoint'),('AutoFilter','autofilter_midpoint'),
                         ('Compressor2','compressor_midpoint'),('Unknown','unsupported')]:
            song,track=fixture(device(kind));messages=[]
            controller=Controller(song,messages.append);controller.sync()
            self.assertEqual([list(m) for m in messages],fixtures[key])
            controller.close()
            self.assertEqual([list(m) for m in messages[-32:]],fixtures['disconnect'])

    def test_output_scope(self):
        for kind in ('AutoFilter','Compressor2','Unknown'):
            self.track.view.selected_device=device(kind);self.c.sync()
        self.c.close()
        self.assertTrue(all(s in (0xBA,0xBB) and 48<=cc<=63 and 0<=v<=127 for s,cc,v in self.sent))

class AdapterTests(unittest.TestCase):
    def test_entry_forwarding_refresh_tick_disconnect(self):
        song,track=fixture(device())
        ci=types.SimpleNamespace(song=song,handle=lambda:42)
        surface=pkg.create_instance(ci)
        FORWARDED.clear();surface.build_midi_map(99)
        self.assertEqual(FORWARDED,[(42,99,11,cc) for cc in range(48,64)])
        self.assertTrue(surface.rebuild_requested)
        self.assertEqual(len(surface.sent),32)
        surface.receive_midi((0xBB,48,65));self.assertEqual(track.view.selected_device.parameters[0].writes,1)
        before=len(surface.sent);surface.refresh_state();self.assertEqual(len(surface.sent),before+32)
        _,callback=surface.scheduled.pop(0);callback();self.assertEqual(len(surface.scheduled),1)
        surface.disconnect();before=len(surface.sent)
        callback();surface.receive_midi((0xBB,48,65))
        self.assertTrue(surface.base_disconnected);self.assertEqual(len(surface.sent),before)

if __name__=='__main__':unittest.main()
