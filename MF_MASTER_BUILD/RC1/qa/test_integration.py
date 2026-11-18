"""Small host-level integration smoke test using a controlled framework shim.
NOT a substitute for Live 13 / Twister hardware testing.
"""
from contextlib import contextmanager
from pathlib import Path
import collections, importlib, sys, types, unittest

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))

class ListenerProxy:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)
        self.listeners = collections.defaultdict(list)
    def __getattr__(self, name):
        if name.startswith('add_') and name.endswith('_listener'):
            prop = name[4:-9]
            return lambda cb: self.listeners[prop].append(cb)
        if name.startswith('remove_') and name.endswith('_listener'):
            prop = name[7:-9]
            return lambda cb: self.listeners[prop].remove(cb)
        if name.endswith('_has_listener'):
            prop = name[:-13]
            return lambda cb: cb in self.listeners[prop]
        raise AttributeError(name)

class FakeButtonElement:
    all_elements = []
    def __init__(self, is_momentary, type, channel, identifier, name=''):
        self.channel, self.identifier, self.name = channel, identifier, name
        self.callbacks = []
        FakeButtonElement.all_elements.append(self)
    def add_value_listener(self, cb): self.callbacks.append(cb)
    def remove_value_listener(self, cb): self.callbacks.remove(cb)

class FakeControlSurface:
    def __init__(self, c_instance):
        self._c_instance = c_instance
        self._fake_song = c_instance.song
        self._midi = []
        self._logs=[]
        self._scheduled = []
        self._highlight = None
        self._closed = False
    @contextmanager
    def component_guard(self): yield
    def song(self): return self._fake_song
    def _send_midi(self, message):
        self._midi.append(tuple(message))
        return True
    def schedule_message(self, n, callback, *args): self._scheduled.append((n, callback, args))
    def request_rebuild_midi_map(self): self._rebuilds = getattr(self,'_rebuilds',0)+1
    def log_message(self, msg): self._logs.append(str(msg))
    def show_message(self, msg): pass
    def build_midi_map(self, handle): pass
    def receive_midi(self, midi_bytes):
        status, cc, value = midi_bytes
        for el in FakeButtonElement.all_elements:
            if el.identifier == cc and el.channel == (status&0x0F):
                for callback in list(el.callbacks): callback(value)
    def refresh_state(self): pass
    def disconnect(self): self._closed = True
    def set_highlighting_session_component(self, comp): self._highlight = comp

class FakeSessionComponent:
    def __init__(self,*args,**kwargs): self._enabled=False
    def set_enabled(self,value): self._enabled=value
    def set_offsets(self,track,scene): pass
    def disconnect(self): pass

class CI:
    def __init__(self,song): self.song=song
    def handle(self): return 1

Live=types.ModuleType('Live')
class MidiMap:
    calls = []
    @staticmethod
    def forward_midi_cc(handle,map_handle,ch,cc): MidiMap.calls.append((ch,cc))
Live.MidiMap=MidiMap
sys.modules['Live']=Live
fw=types.ModuleType('_Framework');sys.modules['_Framework']=fw
for name, typename, attr in [('ControlSurface',FakeControlSurface,'ControlSurface'),('ButtonElement',FakeButtonElement,'ButtonElement'),('InputControlElement',None,'MIDI_CC_TYPE'),('SessionComponent',FakeSessionComponent,'SessionComponent')]:
    m=types.ModuleType('_Framework.'+name)
    setattr(m,attr,1 if typename is None else typename)
    sys.modules['_Framework.'+name]=m

class IntegrationTests(unittest.TestCase):
    def setUp(self):
        FakeButtonElement.all_elements = []
        MidiMap.calls = []
        self.song = ListenerProxy(view=ListenerProxy(selected_track=None, detail_clip=None, highlighted_clip_slot=None),
                                  tracks=[], visible_tracks=[], return_tracks=[], scenes=[],
                                  master_track=ListenerProxy(mixer_device=ListenerProxy()))
        self.mod = importlib.import_module('MF_Build_3banks')
        self.host = self.mod.create_instance(CI(self.song))
    def tearDown(self):
        self.host.disconnect()
    def test_single_surface_host(self):
        self.assertIsInstance(self.host, FakeControlSurface)
        self.assertNotIsInstance(self.host._bank2, FakeControlSurface)
        self.assertNotIsInstance(self.host._bank3, FakeControlSurface)
    def test_input_ownership_and_outgoing_led(self):
        by_ch = {(el.channel,el.identifier) for el in FakeButtonElement.all_elements}
        # Bank 2 must be RAW-forwarded with no duplicate framework listeners.
        self.assertTrue(all((ch,cc) in by_ch for ch in (10,11) for cc in range(16)))
        self.assertFalse(any(16 <= cc < 32 for (_ch,cc) in by_ch))
        self.assertEqual(32,len(by_ch))
        self.assertEqual([], self.host._bank2._elements)
        self.host._midi.clear()
        self.host._bank2._send(10,0,76)
        self.assertIn((0xBA,16,76),self.host._midi)
        self.host._bank2._send(11,15,127)
        self.assertIn((0xBB,31,127),self.host._midi)
        self.host._bank3._led(0,76)
        self.assertIn((0xBA,32,76),self.host._midi)
    def test_explicit_bank2_and_bank3_midi_map(self):
        self.assertGreaterEqual(self.host._rebuilds, 1)
        self.host.build_midi_map('fake-map')
        expected = set((ch,cc) for ch in (10,11) for cc in range(16,48))
        self.assertEqual(64, len(MidiMap.calls))
        self.assertEqual(expected, set(MidiMap.calls))
        self.assertFalse(any(cc < 16 for _ch,cc in MidiMap.calls))

    def test_bank2_raw_rotary_all_boundaries_and_channels(self):
        events=[]
        self.host._bank2._rotary=lambda cc,value: events.append(('rotary',cc,value))
        self.host._bank2._push=lambda cc,value: events.append(('push',cc,value))
        self.host.receive_midi((0xBB,16,65))
        self.host.receive_midi((0xBB,31,63))
        self.host.receive_midi((0xBA,16,127))
        self.host.receive_midi((0xBA,31,0))
        self.assertEqual([('rotary',0,65),('rotary',15,63),
                          ('push',0,127),('push',15,0)],events)
        self.host.receive_midi((0xB9,16,65))
        self.host.receive_midi((0xBB,32,65))  # Bank3, not Bank2.
        self.assertEqual(4,len(events))

    def test_bank2_no_framework_auto_dispatch_required(self):
        # Real-world failure: Live forwarded no ButtonElement callbacks for
        # this companion. Host must dispatch the event itself exactly once.
        before = list(self.host._bank2._held)
        self.host.receive_midi((0xBA,16,127))
        self.assertTrue(self.host._bank2._held[0])
        self.assertEqual(before[1:],self.host._bank2._held[1:])
        self.host.receive_midi((0xBA,16,0))
        self.assertEqual(before,self.host._bank2._held)
    def test_bank2_press_dispatch(self):
        prior=self.host._bank2._held[0]
        self.host.receive_midi((0xBA,16,127))
        self.assertNotEqual(prior,self.host._bank2._held[0])
        self.host.receive_midi((0xBA,16,0))
        self.assertEqual(prior,self.host._bank2._held[0])
    def test_bank3_press_dispatch(self):
        prior=self.host._bank3._pressed[0]
        self.host.receive_midi((0xBA,32,127))
        self.assertNotEqual(prior,self.host._bank3._pressed[0])
        self.host.receive_midi((0xBA,32,0))
        self.assertEqual(prior,self.host._bank3._pressed[0])
    def test_no_cross_bank_press_dispatch(self):
        before_b1=list(self.host._held)
        before_b2=list(self.host._bank2._held)
        self.host.receive_midi((0xBA,16,127))
        self.assertEqual(before_b1, list(self.host._held))
        self.assertTrue(self.host._bank2._held[0])
        self.host.receive_midi((0xBA,16,0))
        self.host.receive_midi((0xBA,0,127))
        self.assertEqual(before_b2, list(self.host._bank2._held))
        self.host.receive_midi((0xBA,0,0))

    def test_last_touched_session_highlight_owner(self):
        highlight1=object()
        highlight2=object()
        self.host._register_highlight('bank1', highlight1)
        self.assertIs(self.host._highlight,highlight1)
        self.host._register_highlight('bank2',highlight2)
        self.assertIs(self.host._highlight,highlight2)
        self.host.receive_midi((0xBB,0,63))
        self.assertIs(self.host._highlight,highlight1)
        self.host.receive_midi((0xBB,16,63))
        self.assertIs(self.host._highlight,highlight2)
        self.host._register_highlight('bank2', None)
        self.assertIs(self.host._highlight,highlight1)

    def test_late_ticks_do_not_rearm(self):
        pending=list(self.host._scheduled)
        self.host.disconnect()
        before_output=len(self.host._midi)
        for _n, cb, args in pending:
            cb(*args)
        self.assertEqual(before_output, len(self.host._midi))
        self.assertTrue(self.host._bank3._disconnected)

    def test_repeated_tick_smoke(self):
        for _ in range(5):
            pending=self.host._scheduled[:]
            self.host._scheduled.clear()
            for _n,cb,args in pending: cb(*args)
            self.assertLess(len(self.host._scheduled), 12)
        self.assertFalse(any('refresh error' in s.lower() for s in self.host._logs))

    def test_disconnect_cleanup(self):
        self.host.disconnect()
        self.host.receive_midi((0xBA,16,127))
        self.assertFalse(self.host._bank2._held[0])
        self.assertTrue(self.host._closed)
        self.assertTrue(self.host._bank2._closed)
        self.assertTrue(self.host._bank3._disconnected)
        self.assertTrue(self.host._bank3._scale_sync.closed)
        self.assertTrue(all(not el.callbacks for el in FakeButtonElement.all_elements))
        self.host.disconnect()

    def test_monitor_color_auto_off_and_in_state(self):
        """Regression: combined component must not reference old standalone class."""
        import types
        from MF_Build_3banks.FourTrack_Bank2 import FourTrackBank2
        previous = getattr(Live, 'Track', None)
        Live.Track = types.SimpleNamespace(Track=types.SimpleNamespace(
            monitoring_states=types.SimpleNamespace(IN='IN', AUTO='AUTO', OFF='OFF')))
        try:
            self.assertEqual(FourTrackBank2.MUTE_MONITOR_AUTO_OFF,
                             FourTrackBank2._monitor_color(
                                 types.SimpleNamespace(current_monitoring_state='AUTO')))
            self.assertEqual(FourTrackBank2.MUTE_MONITOR_AUTO_OFF,
                             FourTrackBank2._monitor_color(
                                 types.SimpleNamespace(current_monitoring_state='OFF')))
            self.assertEqual(FourTrackBank2.MUTE_MONITOR_IN,
                             FourTrackBank2._monitor_color(
                                 types.SimpleNamespace(current_monitoring_state='IN')))
        finally:
            if previous is None:
                delattr(Live, 'Track')
            else:
                Live.Track = previous

    def test_bank2_refresh_populated_tracks_monitor_states(self):
        """Startup regression: actual 4-track mute row must render without NameError."""
        import types
        previous = getattr(Live, 'Track', None)
        Live.Track = types.SimpleNamespace(Track=types.SimpleNamespace(
            monitoring_states=types.SimpleNamespace(IN='IN', AUTO='AUTO', OFF='OFF')))
        try:
            states = ('AUTO', 'IN', 'OFF', 'AUTO')
            tracks = [ListenerProxy(mute=False, solo=False, arm=False,
                                    can_be_armed=True, has_audio_output=False,
                                    current_monitoring_state=state,
                                    clip_slots=[], mixer_device=ListenerProxy())
                      for state in states]
            self.song.tracks = tracks
            self.song.visible_tracks = tracks
            # Expected startup path in Log.txt: _refresh_all->_scan_frame->_monitor_color.
            self.host._bank2._refresh_all()
            row4 = self.host._bank2._frame
            for cc in range(12, 16):
                expected = (self.host._bank2.MUTE_MONITOR_IN if states[cc-12] == 'IN'
                            else self.host._bank2.MUTE_MONITOR_AUTO_OFF)
                self.assertEqual(expected, row4[cc][0])
            self.assertFalse(any('refresh error' in x.lower() for x in self.host._logs))
        finally:
            if previous is None:
                delattr(Live, 'Track')
            else:
                Live.Track = previous

if __name__=='__main__':unittest.main(verbosity=2)
