"""Small host-level integration smoke test using a controlled framework shim.
NOT a substitute for Live 13 / Twister hardware testing.
"""
from contextlib import contextmanager
from pathlib import Path
import collections, importlib, sys, types, unittest, os, tempfile

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
        self._state_temp = tempfile.TemporaryDirectory(prefix='bentobox24_test_')
        self._original_state_home = os.environ.get('MF_BENTOBOX_STATE_DIR')
        os.environ['MF_BENTOBOX_STATE_DIR'] = self._state_temp.name
        FakeButtonElement.all_elements = []
        MidiMap.calls = []
        self.song = ListenerProxy(view=ListenerProxy(selected_track=None, detail_clip=None, highlighted_clip_slot=None),
                                  tracks=[], visible_tracks=[], return_tracks=[], scenes=[],
                                  master_track=ListenerProxy(mixer_device=ListenerProxy()))
        self.mod = importlib.import_module('MF_BentoBoxV1')
        self.host = self.mod.create_instance(CI(self.song))
    def tearDown(self):
        self.host.disconnect()
        if self._original_state_home is None:
            os.environ.pop('MF_BENTOBOX_STATE_DIR', None)
        else:
            os.environ['MF_BENTOBOX_STATE_DIR'] = self._original_state_home
        self._state_temp.cleanup()
    def test_single_surface_host(self):
        self.assertIsInstance(self.host, FakeControlSurface)
        self.assertNotIsInstance(self.host._bank2, FakeControlSurface)
        self.assertNotIsInstance(self.host._bank3, FakeControlSurface)
    def test_input_ownership_and_outgoing_led(self):
        by_ch = {(el.channel,el.identifier) for el in FakeButtonElement.all_elements}
        # Bank 2 must be RAW-forwarded with no duplicate framework listeners.
        self.assertTrue(all((ch,cc) in by_ch for ch in (10,11) for cc in range(16)))
        self.assertFalse(any(16 <= cc < 32 for (_ch,cc) in by_ch))
        self.assertEqual(34,len(by_ch))
        # Live's framework now owns global side CC8 rather than a raw map.
        self.assertIn((3,8),by_ch)
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
        # The top-left side button is now framework-owned (not raw forwarded).
        self.assertEqual(64, len(MidiMap.calls))
        self.assertEqual(expected, set(MidiMap.calls))
        self.assertFalse(any(cc < 16 and ch in (10,11) for ch,cc in MidiMap.calls))

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
        from MF_BentoBoxV1.FourTrack_Bank2 import FourTrackBank2
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
            # Factory default now has Clip Launch on all four rows. Exercise
            # the original mute-monitor rendering path explicitly.
            self.host._bank2._row_modules[3] = 'Mute'
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

    def _send_side(self, down):
        self.host.receive_midi((0xB3, 8, 127 if down else 0))

    def _setup_transport_song(self):
        self.song.is_playing = False
        self.song.record_mode = False
        self.song.session_record = False
        self.song.session_record_status = 0  # 0 off; 1 on; 2 transition
        self.song.session_triggered = 0
        self.song.loop = False
        self.song.can_capture_midi = False
        self.song.started = 0
        self.song.stopped = 0
        self.song.captured = 0
        def start():
            self.song.started += 1
            self.song.is_playing = True
        def stop():
            self.song.stopped += 1
            self.song.is_playing = False
        def capture(): self.song.captured += 1
        self.song.start_playing = start
        self.song.stop_playing = stop
        self.song.capture_midi = capture
        def trigger_session_record():
            self.song.session_triggered += 1
            self.song.session_record = not self.song.session_record
            self.song.session_record_status = 1 if self.song.session_record else 0
        self.song.trigger_session_record = trigger_session_record

    def _bottom_midi(self, bank, cc, value):
        physical_cc = {'bank1':0,'bank2':16,'bank3':32}[bank] + cc
        if bank == 'bank1':
            # Fake _Framework dispatch does not happen via this host's raw
            # receive_midi method in actual Live. Exercise its push callback.
            self.host._push(cc, value)
        else:
            self.host.receive_midi((0xBA, physical_cc, value))

    def test_global_side_control_uses_framework_listener_not_raw_midi_map(self):
        side = [el for el in FakeButtonElement.all_elements
                if (el.channel,el.identifier)==(3,8)]
        self.assertEqual(1,len(side))
        self.assertEqual(1,len(side[0].callbacks))
        self.host.build_midi_map('fake-map')
        self.assertNotIn((3,8),MidiMap.calls)
        # Framework's listener is invoked by its standard ControlSurface path.
        self.assertFalse(self.host._transport_modifier_down)
        self.host.receive_midi((0xB3,8,127))
        self.assertTrue(self.host._transport_modifier_down)
        self.assertTrue(any('modifier Ch4 CC8 pressed' in entry
                            for entry in self.host._logs))
        self.host.receive_midi((0xB3,8,0))
        self.assertFalse(self.host._transport_modifier_down)

    def test_side_button_global_and_other_side_reserved(self):
        self.assertFalse(self.host._transport_modifier_down)
        self._send_side(True)
        self.assertTrue(self.host._transport_modifier_down)
        self.host.receive_midi((0xB3, 11, 127))  # Right top: future Shift.
        self.assertTrue(self.host._transport_modifier_down)
        self._send_side(False)
        self.assertFalse(self.host._transport_modifier_down)
        self.assertEqual(set(), self.host._transport_suppressed)

    def test_global_transport_all_three_banks_play_stop(self):
        self._setup_transport_song()
        for bank in ('bank1','bank2','bank3'):
            self._send_side(True)
            self._bottom_midi(bank, 12, 127)
            self.assertFalse(self.song.is_playing)  # chord-safe release action
            self._bottom_midi(bank, 12, 0)
            self.assertTrue(self.song.is_playing)
            self._send_side(False)
            self.assertEqual(set(), self.host._transport_suppressed)
            self.assertFalse(self.host._bank3._pressed[12])
            self.assertFalse(self.host._bank2._held[12])
            self.assertFalse(self.host._button_down[12])
            self._send_side(True)
            self._bottom_midi(bank, 12, 127)
            self.assertTrue(self.song.is_playing)  # still playing until release
            self._bottom_midi(bank, 12, 0)
            self.assertFalse(self.song.is_playing)
            self._send_side(False)
        self.assertEqual(3, self.song.started)
        self.assertEqual(3, self.song.stopped)

    def test_session_record_and_loop_push(self):
        self._setup_transport_song()
        self._send_side(True)
        self._bottom_midi('bank1', 13, 127)
        self.assertEqual(0,self.song.session_triggered)
        self._bottom_midi('bank1', 13, 0)
        self.assertEqual(1,self.song.session_triggered)
        self.assertTrue(self.song.session_record)
        self.assertFalse(self.song.record_mode)
        self._bottom_midi('bank2', 15, 127)
        self.assertTrue(self.song.loop)
        self._bottom_midi('bank2', 15, 0)
        self._bottom_midi('bank3', 13, 127)
        self._bottom_midi('bank3', 13, 0)
        self.assertEqual(2,self.song.session_triggered)
        self.assertFalse(self.song.session_record)
        self.assertFalse(self.song.record_mode)
        self._bottom_midi('bank3', 15, 127)
        self.assertFalse(self.song.loop)
        self._bottom_midi('bank3', 15, 0)
        self._send_side(False)

    def test_v11_arrangement_record_chord_both_orders_all_banks(self):
        # Both buttons are deferred on press. Chord does not affect transport
        # play state or Session Record (even with session record armed).
        for bank in ('bank1','bank2','bank3'):
            for first, second in ((12,13),(13,12)):
                self._setup_transport_song()
                self._send_side(True)
                self._bottom_midi(bank,first,127)
                self.assertEqual(0,self.song.started)
                self.assertEqual(0,self.song.session_triggered)
                self._bottom_midi(bank,second,127)
                self.assertTrue(self.song.record_mode)
                self.assertEqual(0,self.song.started)
                self.assertEqual(0,self.song.session_triggered)
                self._bottom_midi(bank,first,0)
                self._bottom_midi(bank,second,0)
                self.assertTrue(self.song.record_mode)
                self.assertFalse(self.song.is_playing)
                self.assertEqual(0,self.song.session_triggered)
                self.assertEqual(set(),self.host._transport_suppressed)
                self.assertEqual(set(),self.host._transport_record_pending)
                self.assertEqual(set(),self.host._transport_record_chorded)
                self._send_side(False)

    def test_v11_chord_toggle_arrangement_off_without_session_action(self):
        self._setup_transport_song()
        self.song.record_mode=True
        self.song.is_playing=True
        self._send_side(True)
        self._bottom_midi('bank2',12,127)
        self._bottom_midi('bank2',13,127)
        self._bottom_midi('bank2',13,0)
        self._bottom_midi('bank2',12,0)
        self.assertFalse(self.song.record_mode)
        self.assertTrue(self.song.is_playing)
        self.assertEqual(0,self.song.started)
        self.assertEqual(0,self.song.stopped)
        self.assertEqual(0,self.song.session_triggered)
        self._send_side(False)

    def test_v11_chord_retrigger_protection_while_e13_held(self):
        self._setup_transport_song()
        self._send_side(True)
        self._bottom_midi('bank1',12,127)
        for _ in range(2):
            self._bottom_midi('bank1',13,127)
            self.assertTrue(self.song.record_mode)
            self._bottom_midi('bank1',13,0)
        self._bottom_midi('bank1',12,0)
        self.assertTrue(self.song.record_mode)
        self.assertEqual(0,self.song.session_triggered)
        self.assertEqual(0,self.song.started)
        self._send_side(False)

    def test_v11_chord_reversed_modifier_release_still_consume(self):
        self._setup_transport_song()
        self._send_side(True)
        self._bottom_midi('bank3',13,127)
        self._bottom_midi('bank3',12,127)
        self._send_side(False)
        self._bottom_midi('bank3',13,0)
        self._bottom_midi('bank3',12,0)
        self.assertTrue(self.song.record_mode)
        self.assertEqual(0,self.song.session_triggered)
        self.assertEqual(0,self.song.started)
        self.assertFalse(self.host._bank3._pressed[12])
        self.assertFalse(self.host._bank3._pressed[13])

    def test_v11_normal_session_record_still_works_in_locked_mode(self):
        self._setup_transport_song()
        self._send_side(True)
        self._send_side(False)  # Tap locks.
        self._bottom_midi('bank2',13,127)
        self.assertEqual(0,self.song.session_triggered)
        self._bottom_midi('bank2',13,0)
        self.assertEqual(1,self.song.session_triggered)
        self.assertTrue(self.song.session_record)
        self.assertFalse(self.song.record_mode)
        self._bottom_midi('bank1',12,127)
        self._bottom_midi('bank1',12,0)
        self.assertTrue(self.song.is_playing)
        self._send_side(True)
        self._send_side(False)
        self.assertFalse(self.host._transport_locked)

    def test_v11_e14_led_follows_session_or_arrangement_recording(self):
        from unittest.mock import patch
        self._setup_transport_song()
        self.song.is_playing=True
        self._send_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=80.0):
            self.song.session_record_status = 1  # on
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+13,self.host.LED_COLORS['red']),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=80.3):
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+13,0),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=81.0):
            self.song.session_record_status = 2  # transition, not yet recording
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            self.assertIn((0xBA,13,self.host.LED_COLORS['purple']),self.host._midi)
            self.song.session_record_status = 0
            self.song.record_mode = True
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            self.assertIn((0xBA,13,self.host.LED_COLORS['red']),self.host._midi)
        self._send_side(False)

    def test_v11_disconnect_clears_pending_chord(self):
        self._setup_transport_song()
        self._send_side(True)
        self._bottom_midi('bank2',12,127)
        self.assertTrue(self.host._transport_record_pending)
        self.host.disconnect()
        self.assertFalse(self.host._transport_record_pending)
        self.assertFalse(self.host._transport_record_chorded)
        self.host.receive_midi((0xBA,28,0))
        self.assertEqual(0,self.song.started)

    def test_capture_midi_gated_and_called_once(self):
        self._setup_transport_song()
        self._send_side(True)
        self._bottom_midi('bank1', 14, 127)
        self._bottom_midi('bank1', 14, 127)  # Repeated down ignored.
        self._bottom_midi('bank1', 14, 0)
        self.assertEqual(0, self.song.captured)
        self.song.can_capture_midi = True
        self._bottom_midi('bank3', 14, 127)
        self._bottom_midi('bank3', 14, 127)
        self.assertEqual(0, self.song.captured)  # Capture now occurs on release.
        self._bottom_midi('bank3', 14, 0)
        self.assertEqual(1, self.song.captured)
        self._send_side(False)

    def test_modifier_release_first_still_consumes_bottom_release(self):
        self._setup_transport_song()
        for bank in ('bank1','bank2','bank3'):
            self._send_side(True)
            self._bottom_midi(bank, 12, 127)
            self.assertIn((bank,12), self.host._transport_suppressed)
            self._send_side(False)
            self.assertIn((bank,12), self.host._transport_suppressed)
            self._bottom_midi(bank, 12, 0)
            self.assertNotIn((bank,12), self.host._transport_suppressed)
            self.assertEqual(False, self.host._button_down[12])
            self.assertEqual(False, self.host._bank2._held[12])
            self.assertEqual(False, self.host._bank3._pressed[12])
        self.assertEqual(2, self.song.started)  # start, stop, start
        self.assertEqual(1, self.song.stopped)

    def test_native_press_before_side_modifier_keeps_ownership(self):
        # E13 already held as a bank action before the side modifier is pressed.
        from unittest.mock import patch
        from MF_BentoBoxV1.Bank1_SelectedTrack import MidiFighterTwisterCustom
        with patch.object(MidiFighterTwisterCustom, '_push') as original:
            self.host._push(12, 127)
            self.assertIn(('bank1',12),self.host._transport_native_down)
            self._send_side(True)
            self.host._push(12, 0)
            self.assertNotIn(('bank1',12),self.host._transport_native_down)
            self.assertEqual([(12,127),(12,0)], [x.args for x in original.call_args_list])
            self.assertEqual(set(),self.host._transport_suppressed)
        self._send_side(False)

    def test_rotary_is_guarded_only_during_transport(self):
        # Block bottom rotary changes while transport active, but leave E1
        # rotation unchanged and preserve ordinary bottom-row rotation.
        with __import__('unittest').mock.patch.object(self.host._bank2, '_rotary') as rotary:
            self._send_side(True)
            self.host.receive_midi((0xBB, 28, 65))
            self.assertEqual(0, rotary.call_count)
            self.host.receive_midi((0xBB, 16, 65))
            rotary.assert_called_once_with(0,65)
            self._send_side(False)
            self.host.receive_midi((0xBB, 28, 65))
            self.assertEqual(2, rotary.call_count)

    def test_transport_does_not_touch_bank3_note_tie_without_modifier(self):
        # Native sequencing remains active; no held-side modifier needed for ties.
        self.assertFalse(self.host._transport_modifier_down)
        self.host.receive_midi((0xBA, 36, 127))  # E5 = step4
        self.assertTrue(self.host._bank3._pressed[4])
        self.host.receive_midi((0xBA, 44, 127))  # E13
        self.assertTrue(self.host._bank3._pressed[12])
        self.assertFalse(self.host._transport_suppressed)
        self.host.receive_midi((0xBA, 44, 0))
        self.host.receive_midi((0xBA, 36, 0))

    def test_transport_closed_blocks_late_commands(self):
        self._setup_transport_song()
        self._send_side(True)
        self.host.disconnect()
        self.host.receive_midi((0xBA, 44, 127))
        self.host._push(12,127)
        self.assertEqual(0,self.song.started)
        self.assertFalse(self.host._transport_modifier_down)
        self.assertFalse(self.host._transport_suppressed)

    def test_transport_api_absence_cannot_break_other_banks(self):
        # Simulates a Live API missing or throwing in a beta; overlay must
        # fail closed and not disrupt later ordinary MIDI dispatch.
        self._send_side(True)
        self._bottom_midi('bank3', 13, 127)
        self._bottom_midi('bank3', 13, 0)
        self._send_side(False)
        self.assertTrue(any('MF Transport' in s for s in self.host._logs))
        self.host.receive_midi((0xBA, 32, 127))
        self.assertTrue(self.host._bank3._pressed[0])
        self.host.receive_midi((0xBA, 32, 0))


    def test_top_left_tap_toggle_locks_then_unlocks(self):
        self._setup_transport_song()
        self._send_side(True)
        self.assertTrue(self.host._transport_visible)
        self._send_side(False)
        self.assertTrue(self.host._transport_locked)
        self.assertTrue(self.host._transport_visible)
        # A locked transport chord never triggers the underlying bank action.
        self._bottom_midi('bank2', 12, 127)
        self.assertFalse(self.song.is_playing)
        self.assertFalse(self.host._bank2._held[12])
        self._bottom_midi('bank2', 12, 0)
        self.assertTrue(self.song.is_playing)
        self._send_side(True)
        self._send_side(False)
        self.assertFalse(self.host._transport_locked)
        self.assertFalse(self.host._transport_visible)

    def test_momentary_hold_long_without_chord_does_not_lock(self):
        from unittest.mock import patch
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=30.0):
            self._send_side(True)
            self.assertTrue(self.host._transport_visible)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=30.8):
            self._send_side(False)
        self.assertFalse(self.host._transport_locked)
        self.assertFalse(self.host._transport_visible)

    def test_momentary_action_release_first_restores_bank_rows(self):
        self._setup_transport_song()
        self._send_side(True)
        self._bottom_midi('bank3', 13, 127)
        self.assertFalse(self.song.session_record)
        self.assertTrue(self.host._transport_visible)
        self._send_side(False)
        self.assertFalse(self.host._transport_visible)
        self.assertFalse(self.host._transport_locked)
        self._bottom_midi('bank3', 13, 0)
        self.assertFalse(self.host._bank3._pressed[13])
        self.assertTrue(self.song.session_record)  # session state persists
        self.assertFalse(self.song.record_mode)

    def test_all_three_bank_led_overlay_and_exact_native_restore(self):
        self._setup_transport_song()
        self.host._midi.clear()
        for offset in (0,16,32):
            for local_cc in (12,13,14,15):
                self.host._send_midi((0xBA, offset+local_cc, 25))
                self.host._send_midi((0xBB, offset+local_cc, 38))
        self._send_side(True)
        for offset in (0,16,32):
            self.assertIn((0xBA, offset+12, self.host.LED_COLORS['yellow']), self.host._midi)
            self.assertIn((0xBA, offset+15, 0), self.host._midi)
        snapshot=len(self.host._midi)
        # Underlying bank updates occur during overlay; they are retained,
        # not delivered to the device until the overlay leaves.
        for offset in (0,16,32):
            self.host._send_midi((0xBA, offset+12, 61))
            self.host._send_midi((0xBB, offset+12, 73))
        self.assertEqual(snapshot,len(self.host._midi))
        self._send_side(False)
        # Single tap locks. Second tap unlocks and restores latest native state.
        self._send_side(True)
        self._send_side(False)
        self.assertFalse(self.host._transport_visible)
        for offset in (0,16,32):
            self.assertIn((0xBA, offset+12, 61),self.host._midi[snapshot:])
            self.assertIn((0xBB, offset+12, 73),self.host._midi[snapshot:])
            self.assertIn((0xBA, offset+15, 25),self.host._midi[snapshot:])

    def test_record_play_and_loop_led_states_all_banks(self):
        from unittest.mock import patch
        self._setup_transport_song()
        self.song.is_playing=True
        self.song.record_mode=True
        self.song.loop=True
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=60.0):
            self._send_side(True)
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for offset in (0,16,32):
                self.assertIn((0xBA,offset+12,self.host.LED_COLORS['green']),self.host._midi)
                self.assertIn((0xBA,offset+13,self.host.LED_COLORS['red']),self.host._midi)
                self.assertIn((0xBA,offset+15,self.host.LED_COLORS['yellow']),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=60.3):
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for offset in (0,16,32):
                self.assertIn((0xBA,offset+12,0),self.host._midi)  # green flashing OFF
                self.assertIn((0xBA,offset+13,0),self.host._midi)  # red flashing OFF
        self._send_side(False)

    def test_capture_midi_purple_blink_brief_then_solid(self):
        from unittest.mock import patch
        self._setup_transport_song()
        self.song.can_capture_midi=True
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=10.0):
            self._send_side(True)
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            self.assertIn((0xBA,14,self.host._bank2.SEND_COLOR),self.host._midi)
            self._bottom_midi('bank1',14,127)
            self.assertEqual(0,self.song.captured)
            self._bottom_midi('bank1',14,0)
            self.assertEqual(1,self.song.captured)
            self.assertEqual(10.8,self.host._transport_capture_flash_until)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=10.3):
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            self.assertIn((0xBA,14,self.host.LED_COLORS['light_purple']),self.host._midi)
            self.assertIn((0xBB,14,127),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=11.3):
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            self.assertIn((0xBA,14,self.host._bank2.SEND_COLOR),self.host._midi)
            self.assertIn((0xBB,14,64),self.host._midi)
        self._send_side(False)

    def test_e13_shuttle_bar_then_shift_beat_3_8(self):
        self._setup_transport_song()
        self.song.signature_numerator=3
        self.song.signature_denominator=8
        self.song.jumps=[]
        self.song.jump_by=lambda beats:self.song.jumps.append(beats)
        self._send_side(True)
        for _ in range(4): self.host.receive_midi((0xBB,28,65))
        for _ in range(4): self.host.receive_midi((0xBB,44,63))
        self.assertEqual([1.5,-1.5],self.song.jumps)
        self.host.receive_midi((0xB3,11,127))
        for _ in range(4): self.host._rotate(12,65)
        self.host.receive_midi((0xB3,11,0))
        self.assertEqual([1.5,-1.5,0.5],self.song.jumps)
        self._send_side(False)
        self.assertFalse(self.host._transport_locked)

    def test_e13_push_does_not_accidentally_jump_from_relative_nudge(self):
        from unittest.mock import patch
        self._setup_transport_song()
        self.song.signature_numerator=4
        self.song.signature_denominator=4
        self.song.jumps=[]
        self.song.jump_by=lambda beats:self.song.jumps.append(beats)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=50.0):
            self._send_side(True)
            self._bottom_midi('bank1',12,127)
            self._bottom_midi('bank1',12,0)
            self.host._rotate(12,65)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic', return_value=50.1):
            for _ in range(3): self.host._rotate(12,65)
            self.assertEqual([],self.song.jumps)
            self.host._rotate(12,65)
            self.assertEqual([4.0],self.song.jumps)
        self._send_side(False)

    def test_shuttle_blocked_during_arrangement_recording(self):
        self._setup_transport_song()
        self.song.signature_numerator=4
        self.song.signature_denominator=4
        self.song.record_mode=True
        self.song.is_playing=True
        self.song.jumps=[]
        self.song.jump_by=lambda beats:self.song.jumps.append(beats)
        self._send_side(True)
        self.host._rotate(12,65)
        self.assertEqual([],self.song.jumps)
        self._send_side(False)

    def test_transport_feedback_tick_late_callback_does_not_rearm(self):
        self._setup_transport_song()
        self._send_side(True)
        pending=list(self.host._scheduled)
        self.host.disconnect()
        prior=len(self.host._midi)
        for _delay,callback,args in pending: callback(*args)
        self.assertEqual(prior,len(self.host._midi))
        self.assertFalse(self.host._transport_visible)
        self.assertFalse(self.host._transport_locked)

    def test_bentobox_is_sole_entrypoint_and_other_banks_unchanged(self):
        import hashlib,zipfile
        from pathlib import Path
        base=Path('/mnt/data/MF_Build_3banks_Beta_2_1_Transport_Side_Routing_DIAGNOSTIC_TEST.zip')
        if base.is_file():
            with zipfile.ZipFile(base) as z:
                for filename in ('FourTrack_Bank2.py','Sequencer_Bank3.py','scale_sync.py'):
                    ours=(root/'MF_BentoBoxV1'/filename).read_bytes()
                    original=z.read('MF_Build_3banks/'+filename)
                    self.assertEqual(hashlib.sha256(ours).digest(),hashlib.sha256(original).digest())
        self.assertEqual(1,(root/'MF_BentoBoxV1'/'__init__.py').read_text().count('create_instance'))
        self.assertNotIn('MF_Build_3banks', (root/'MF_BentoBoxV1'/'__init__.py').read_text())


    def test_shuttle_stays_available_when_transport_toggled_on(self):
        self._setup_transport_song()
        self.song.signature_numerator=4
        self.song.signature_denominator=4
        self.song.jumps=[]
        self.song.jump_by=lambda beats:self.song.jumps.append(beats)
        self._send_side(True)
        self._send_side(False)  # tap to lock
        self.assertTrue(self.host._transport_visible)
        self.assertFalse(self.host._transport_modifier_down)
        for _ in range(4): self.host.receive_midi((0xBB,28,65))
        self.assertEqual([4.0],self.song.jumps)
        self._send_side(True)
        self._send_side(False)  # tap unlock
        self.assertFalse(self.host._transport_visible)

    def test_bank_led_producers_suppressed_during_overlay(self):
        self._setup_transport_song()
        self._send_side(True)
        self.host._midi.clear()
        self.host._bank2._rgb_cache.pop(12,None)
        self.host._bank2._rgb(12,87)
        self.host._bank3._last_leds[12]=-1
        self.host._bank3._led(12,46)
        self.assertEqual([],self.host._midi)
        self.assertEqual((0xBA,28,87),self.host._native_bottom_feedback[(0xBA,28)])
        self.assertEqual((0xBA,44,46),self.host._native_bottom_feedback[(0xBA,44)])
        self._send_side(False)
        self._send_side(True)
        self._send_side(False)
        self.assertIn((0xBA,28,87),self.host._midi)
        self.assertIn((0xBA,44,46),self.host._midi)


    def _set_loop_fixture(self, numerator=4, denominator=4, start=8.0, length=8.0):
        self._setup_transport_song()
        self.song.signature_numerator=numerator
        self.song.signature_denominator=denominator
        self.song.loop_start=start
        self.song.loop_length=length
        self.song.loop=True
        self.song.jumps=[]
        self.song.jump_by=lambda beats:self.song.jumps.append(beats)

    def _turn(self, bank, local_cc, value, count=1):
        physical_cc={'bank1':0,'bank2':16,'bank3':32}[bank]+local_cc
        for _ in range(count):
            if bank=='bank1':
                self.host._rotate(local_cc,value)
            else:
                self.host.receive_midi((0xBB,physical_cc,value))

    def test_e13_requires_four_detents_per_bar_all_banks(self):
        for bank in ('bank1','bank2','bank3'):
            self._set_loop_fixture()
            self._send_side(True)
            self._turn(bank,12,65,3)
            self.assertEqual([],self.song.jumps)
            self._turn(bank,12,65)
            self.assertEqual([4.0],self.song.jumps)
            self._turn(bank,12,63,4)
            self.assertEqual([4.0,-4.0],self.song.jumps)
            self._send_side(False)
            self.assertFalse(self.host._transport_locked)

    def test_e13_reversals_cancel_and_bank_accumulators_independent(self):
        self._set_loop_fixture()
        self._send_side(True)
        self._turn('bank1',12,65,3)
        self._turn('bank1',12,63,3)
        self._turn('bank1',12,65,3)
        self.assertEqual([],self.song.jumps)
        # The second bank starts at its own zero remainder.
        self._turn('bank2',12,65)
        self.assertEqual([],self.song.jumps)
        self._turn('bank1',12,65)
        self.assertEqual([4.0],self.song.jumps)
        self._send_side(False)

    def test_shift_beats_slower_and_precision_remainders_reset(self):
        self._set_loop_fixture(numerator=3,denominator=8)
        self._send_side(True)
        self._turn('bank1',12,65,3)
        self.host.receive_midi((0xB3,11,127))
        self._turn('bank1',12,65,3)
        self.assertEqual([],self.song.jumps)
        self._turn('bank1',12,65)
        self.assertEqual([0.5],self.song.jumps)
        self.host.receive_midi((0xB3,11,0))
        self._turn('bank1',12,65,4)
        self.assertEqual([0.5,1.5],self.song.jumps)
        self._send_side(False)

    def test_e16_moves_whole_loop_one_bar_every_four_detents(self):
        for bank in ('bank1','bank2','bank3'):
            self._set_loop_fixture(start=12,length=8)
            self._send_side(True)
            self._turn(bank,15,65,3)
            self.assertEqual(12,self.song.loop_start)
            self._turn(bank,15,65)
            self.assertEqual(16,self.song.loop_start)
            self.assertEqual(8,self.song.loop_length)
            self.assertTrue(self.song.loop)
            self._turn(bank,15,63,4)
            self.assertEqual(12,self.song.loop_start)
            self.assertEqual(8,self.song.loop_length)
            self._send_side(False)

    def test_e16_loop_move_respects_3_8_and_zero_bound(self):
        self._set_loop_fixture(numerator=3,denominator=8,start=1.5,length=6)
        self._send_side(True)
        self._turn('bank3',15,63,4)
        self.assertAlmostEqual(0.0,self.song.loop_start)
        self._turn('bank3',15,63,4)
        self.assertAlmostEqual(0.0,self.song.loop_start)
        self._turn('bank3',15,65,4)
        self.assertAlmostEqual(1.5,self.song.loop_start)
        self.assertEqual(6,self.song.loop_length)
        self._send_side(False)

    def test_e15_hold_e16_twist_resizes_end_one_beat_without_capture(self):
        for bank in ('bank1','bank2','bank3'):
            self._set_loop_fixture(numerator=3,denominator=8,start=4.0,length=2.0)
            self.song.can_capture_midi=True
            self._send_side(True)
            self._bottom_midi(bank,14,127)
            self.assertEqual(0,self.song.captured)
            self._turn(bank,15,65,3)
            self.assertEqual(2,self.song.loop_length)
            self._turn(bank,15,65)
            self.assertEqual(2.5,self.song.loop_length)
            self.assertEqual(4,self.song.loop_start)
            self._bottom_midi(bank,14,0)
            self.assertEqual(0,self.song.captured)
            self.assertFalse(self.host._transport_capture_held)
            self.assertFalse(self.host._transport_capture_resized)
            self._send_side(False)

    def test_e15_e16_resize_shortens_but_never_below_one_beat(self):
        self._set_loop_fixture(numerator=4,denominator=4,start=8,length=2)
        self.song.can_capture_midi=True
        self._send_side(True)
        self._bottom_midi('bank2',14,127)
        self._turn('bank2',15,63,4)
        self.assertEqual(1,self.song.loop_length)
        self._turn('bank2',15,63,4)
        self.assertEqual(1,self.song.loop_length)
        self.assertEqual(8,self.song.loop_start)
        self._bottom_midi('bank2',14,0)
        self.assertEqual(0,self.song.captured)
        self._send_side(False)

    def test_e15_capture_press_only_suppressed_release_calls_once(self):
        for bank in ('bank1','bank2','bank3'):
            self._set_loop_fixture()
            self.song.can_capture_midi=True
            self._send_side(True)
            self._bottom_midi(bank,14,127)
            self._bottom_midi(bank,14,127)
            self.assertEqual(0,self.song.captured)
            self._bottom_midi(bank,14,0)
            self.assertEqual(1,self.song.captured)
            self._bottom_midi(bank,14,0)
            self.assertEqual(1,self.song.captured)
            self._send_side(False)

    def test_e15_partial_resize_does_not_capture_on_release(self):
        self._set_loop_fixture()
        self.song.can_capture_midi=True
        self._send_side(True)
        self._bottom_midi('bank1',14,127)
        self._turn('bank1',15,65)  # only 1 of 4 detents
        self._bottom_midi('bank1',14,0)
        self.assertEqual(0,self.song.captured)
        self.assertEqual(8,self.song.loop_length)
        self._send_side(False)

    def test_e15_capture_release_after_left_modifier_released(self):
        self._set_loop_fixture()
        self.song.can_capture_midi=True
        self._send_side(True)
        self._bottom_midi('bank3',14,127)
        self._send_side(False)
        self.assertFalse(self.host._transport_visible)
        self._bottom_midi('bank3',14,0)
        self.assertEqual(1,self.song.captured)
        self.assertFalse(self.host._bank3._pressed[14])

    def test_e16_press_toggle_not_treated_as_loop_rotation(self):
        from unittest.mock import patch
        self._set_loop_fixture()
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=80.0):
            self._send_side(True)
            self._bottom_midi('bank1',15,127)
            self.assertFalse(self.song.loop)
            self._turn('bank1',15,65,4)
            self._bottom_midi('bank1',15,0)
            self._turn('bank1',15,65)
            self.assertEqual(8,self.song.loop_start)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=80.1):
            self._turn('bank1',15,65,4)
            self.assertEqual(12,self.song.loop_start)
        self._send_side(False)

    def test_e16_move_not_active_after_leaving_overlay(self):
        self._set_loop_fixture()
        self._send_side(True)
        self._turn('bank1',15,65,3)
        self._send_side(False)
        self.assertFalse(self.host._transport_visible)
        from unittest.mock import patch
        from MF_BentoBoxV1.Bank1_SelectedTrack import MidiFighterTwisterCustom
        with patch.object(MidiFighterTwisterCustom,'_rotate') as rotary:
            self._turn('bank1',15,65)
            rotary.assert_called_once_with(15,65)
        self.assertEqual(8,self.song.loop_start)
        self._send_side(True)
        self._turn('bank1',15,65)
        self.assertEqual(8,self.song.loop_start)  # remainder reset
        self._send_side(False)

    def test_loop_edit_fails_closed_if_missing_properties(self):
        self._setup_transport_song()
        self.song.signature_numerator=4
        self.song.signature_denominator=4
        self._send_side(True)
        self._turn('bank1',15,65,4)
        self.assertTrue(any('MF BentoBoxV1 loop:' in x for x in self.host._logs))
        self._send_side(False)
        self.host.receive_midi((0xBA,32,127))
        self.assertTrue(self.host._bank3._pressed[0])

    def test_loop_and_shuttle_changes_blocked_while_recording(self):
        self._set_loop_fixture()
        self.song.record_mode=True
        self.song.is_playing=True
        self._send_side(True)
        self._turn('bank1',12,65,4)
        self._turn('bank2',15,65,4)
        self._bottom_midi('bank3',14,127)
        self._turn('bank3',15,65,4)
        self._bottom_midi('bank3',14,0)
        self.assertEqual([],self.song.jumps)
        self.assertEqual(8,self.song.loop_start)
        self.assertEqual(8,self.song.loop_length)
        self.assertEqual(0,self.song.captured)
        self._send_side(False)

    def test_led_idle_purple_stopped_yellow_and_disabled_capture_off(self):
        from unittest.mock import patch
        self._setup_transport_song()
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=100.0):
            self._send_side(True)
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+12,self.host.LED_COLORS['yellow']),self.host._midi)
                self.assertIn((0xBA,off+13,self.host.LED_COLORS['purple']),self.host._midi)
                self.assertIn((0xBA,off+14,0),self.host._midi)
                self.assertIn((0xBA,off+15,0),self.host._midi)
        self._send_side(False)

    def test_led_capture_availability_flashes_and_success_pulses(self):
        from unittest.mock import patch
        self._setup_transport_song()
        self.song.can_capture_midi=True
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=40.0):
            self._send_side(True)
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+14,self.host._bank2.SEND_COLOR),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=40.8):
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+14,0),self.host._midi)
            self._bottom_midi('bank2',14,127)
            self._bottom_midi('bank2',14,0)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=40.5):
            self.song.can_capture_midi=False
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+14,self.host.LED_COLORS['light_purple']),self.host._midi)
                self.assertIn((0xBB,off+14,127),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=41.8):
            self.host._midi.clear()
            self.host._render_transport_feedback(force=True)
            for off in (0,16,32):
                self.assertIn((0xBA,off+14,0),self.host._midi)
        self._send_side(False)

    def test_loop_resizing_when_locked_on_and_no_left_held(self):
        self._set_loop_fixture()
        self.song.can_capture_midi=True
        self._send_side(True)
        self._send_side(False)
        self.assertTrue(self.host._transport_locked)
        self._bottom_midi('bank2',14,127)
        self._turn('bank2',15,65,4)
        self._bottom_midi('bank2',14,0)
        self.assertEqual(9,self.song.loop_length)
        self.assertEqual(0,self.song.captured)
        self._send_side(True)
        self._send_side(False)
        self.assertFalse(self.host._transport_locked)

    def test_overlay_capture_resized_cleared_on_disconnect(self):
        self._set_loop_fixture()
        self._send_side(True)
        self._bottom_midi('bank1',14,127)
        self._turn('bank1',15,65)
        self.assertTrue(self.host._transport_capture_held)
        self.host.disconnect()
        self.assertFalse(self.host._transport_capture_held)
        self.assertFalse(self.host._transport_capture_resized)
        self.assertFalse(self.host._transport_turn_remainder)

    def test_bank2_bank3_source_hashes_equal_betav22(self):
        import hashlib,zipfile
        base=Path('/mnt/data/MF_BentoBoxV1_Beta_2_2_Global_Transport_Shuttle_TEST.zip')
        if base.is_file():
            with zipfile.ZipFile(base) as z:
                for name in ('FourTrack_Bank2.py',
                             'Sequencer_Bank3.py','scale_sync.py','__init__.py'):
                    self.assertEqual(hashlib.sha256((root/'MF_BentoBoxV1'/name).read_bytes()).hexdigest(),
                                     hashlib.sha256(z.read('MF_BentoBoxV1/'+name)).hexdigest())


    # Beta 2.4: module-only factory baseline, persistent last-used layout,
    # four hardware preset slots, protected fallback and purple Capture status.
    def _send_right_side(self, down):
        self.host.receive_midi((0xB3,11,127 if down else 0))

    def _preset_press(self, bank, cc, down):
        self._bottom_midi(bank,cc,127 if down else 0)

    def test_v24_factory_layout_matches_owner_contract(self):
        from MF_BentoBoxV1.layout_state import FACTORY_LAYOUT
        self.assertEqual(FACTORY_LAYOUT,self.host._layout_snapshot())
        self.assertEqual([0,2,4,3],self.host._modes)
        self.assertEqual(['Clip Launch']*4,self.host._bank2._row_modules)
        self.assertEqual(['Device Control','Device Control','Sends','Volume'],
                         [self.host._bank2._rotary_function(i) for i in range(4)])

    def test_v24_all_banks_preset_buttons_latched_release_no_native_press(self):
        from unittest.mock import patch
        for bank in ('bank1','bank2','bank3'):
            received=[]
            if bank=='bank1':
                original=self.host._held[0]
            elif bank=='bank2':
                original=self.host._bank2._held[0]
            else:
                original=self.host._bank3._pressed[0]
            self._send_right_side(True)
            with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=20):
                self._preset_press(bank,0,True)
            self._send_right_side(False)
            with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=20.1):
                self._preset_press(bank,0,False)
            if bank=='bank1': actual=self.host._held[0]
            elif bank=='bank2': actual=self.host._bank2._held[0]
            else: actual=self.host._bank3._pressed[0]
            self.assertEqual(original,actual)
        self.assertFalse(self.host._preset_button_held)

    def test_v24_right_side_presets_do_not_toggle_transport(self):
        from unittest.mock import patch
        self._setup_transport_song()
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=100):
            self._preset_press('bank1',0,True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=102.2):
            self._preset_press('bank1',0,False)
        self._send_right_side(False)
        self.assertFalse(self.host._transport_locked)
        self.assertFalse(self.host._transport_visible)
        self.assertEqual(0,self.song.started)
        self.assertEqual(0,self.song.captured)

    def test_v24_save_then_recall_slot_across_banks(self):
        from unittest.mock import patch
        from MF_BentoBoxV1.layout_state import LayoutStore
        self.host._modes=[1,2,4,3]
        self.host._bind_columns()
        expected=self.host._layout_snapshot()
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=50):
            self._preset_press('bank2',1,True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=52.1):
            self._preset_press('bank2',1,False)
        self._send_right_side(False)
        self.assertEqual(expected,LayoutStore().load()['presets']['2'])
        self.host._modes=[0,2,4,3]
        self.host._bind_columns()
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=55):
            self._preset_press('bank3',1,True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=55.12):
            self._preset_press('bank3',1,False)
        self._send_right_side(False)
        self.assertEqual(expected,self.host._layout_snapshot())
        self.assertEqual('2',self.host._preset_confirm[0])

    def test_v24_save_confirmation_only_on_disk_success(self):
        from unittest.mock import patch
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=60):
            self._preset_press('bank1',0,True)
        with patch.object(self.host._state_store,'save',side_effect=PermissionError('denied')):
            with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=62.2):
                self._preset_press('bank1',0,False)
        self.assertIsNone(self.host._preset_confirm[3])  # red failure, not saved
        self.assertNotIn('1',self.host._state_document['presets'])
        self._send_right_side(False)
        self.assertTrue(any('save failed' in msg.lower() for msg in self.host._logs))

    def test_v24_factory_reset_two_second_chord_preserves_presets(self):
        from unittest.mock import patch
        self.host._modes=[1,2,4,3]
        self.host._bind_columns()
        self.host._preset_save('1')
        self.assertIn('1',self.host._state_document['presets'])
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=70):
            self._preset_press('bank3',7,True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=72.2):
            self._preset_press('bank3',7,False)
        self._send_right_side(False)
        from MF_BentoBoxV1.layout_state import FACTORY_LAYOUT
        self.assertEqual(FACTORY_LAYOUT,self.host._layout_snapshot())
        self.assertIn('1',self.host._state_document['presets'])

    def test_v24_state_autosaves_changed_assignments_without_encoder_values(self):
        from MF_BentoBoxV1.layout_state import LayoutStore
        self.host._bank2._row_modules[0]='Solo'
        self.host._bank2._rotary_overrides=['Volume','Pan','Sends','Device Control']
        self.host._state_scan_tick()
        self.assertTrue(self.host._state_pending_save)
        self.host._state_save_last()
        saved=LayoutStore().load()['last_used']
        self.assertEqual('Solo',saved['bank2_buttons'][0])
        self.assertEqual('Pan',saved['bank2_rotaries'][1])
        self.assertEqual({'bank1_columns','bank2_buttons','bank2_rotaries'},set(saved))

    def test_v24_startup_loads_valid_last_used_from_disk(self):
        from MF_BentoBoxV1.layout_state import LayoutStore, FACTORY_LAYOUT
        store=LayoutStore()
        doc=store.blank()
        layout=dict(FACTORY_LAYOUT)
        layout['bank1_columns']=[1,2,4,3]
        doc['last_used']=layout
        self.host.disconnect()  # Release prior instance before writing fixtures.
        store.save(doc)
        FakeButtonElement.all_elements=[]
        self.host=self.mod.create_instance(CI(self.song))
        self.assertEqual(layout,self.host._layout_snapshot())

    def test_v24_corrupt_state_fallback_preserves_user_file(self):
        from MF_BentoBoxV1.layout_state import LayoutStore, FACTORY_LAYOUT
        store=LayoutStore()
        store.directory.mkdir(parents=True,exist_ok=True)
        store.path.write_text('{bad json',encoding='utf-8')
        self.assertEqual(store.blank(),store.load())
        self.assertEqual('{bad json',store.path.read_text())
        self.assertEqual(FACTORY_LAYOUT,self.host._layout_snapshot())

    def test_v24_layout_exclusivity_and_corruption_rejected(self):
        from MF_BentoBoxV1.layout_state import validated_layout, FACTORY_LAYOUT
        import copy
        invalid=copy.deepcopy(FACTORY_LAYOUT)
        invalid['bank1_columns']=[0,0,4,3]
        with self.assertRaises(ValueError): validated_layout(invalid)
        invalid=copy.deepcopy(FACTORY_LAYOUT)
        invalid['bank2_buttons']=['Arm']*4
        with self.assertRaises(ValueError): validated_layout(invalid)
        invalid=copy.deepcopy(FACTORY_LAYOUT)
        invalid['bank2_rotaries'][1]='MIDI Value'
        with self.assertRaises(ValueError): validated_layout(invalid)

    def test_v24_preset_overlay_colors_then_restore_native_led(self):
        from unittest.mock import patch
        self.host._send_midi((0xBA,0,68))
        self.host._send_midi((0xBA,16,72))
        self._send_right_side(True)
        self.host._midi.clear()
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=12):
            self.host._preset_save('3')
            self.host._render_preset_feedback(force=True)
        for offset in (0,16,32):
            self.assertIn((0xBA,offset+2,self.host.PRESET_COLORS[2]),self.host._midi)
        self._send_right_side(False)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=13.2):
            self.host._render_preset_feedback()
        self.assertIn((0xBA,0,68),self.host._midi)
        self.assertIn((0xBA,16,72),self.host._midi)

    def test_v24_preset_return_first_does_not_stop_beat_shuttle(self):
        self._set_loop_fixture()
        self._send_side(True)
        self._send_right_side(True)
        self._turn('bank1',12,65,4)
        self.assertTrue(self.host._transport_shift_down)
        self.assertTrue(self.song.jumps)
        self.assertEqual(1,self.song.jumps[-1])
        self._send_right_side(False)
        self._send_side(False)

    def test_v24_preset_save_survives_external_reload(self):
        from MF_BentoBoxV1.layout_state import LayoutStore
        store=LayoutStore()
        doc=store.blank()
        doc['presets']['4']=self.host._layout_snapshot()
        store.save(doc)
        other=LayoutStore().load()
        self.assertEqual(doc,other)
        self.assertTrue(store.path.is_file())
        self.assertNotIn('parameter_value',store.path.read_text().lower())

    def test_v24_backup_recovery_of_valid_previous_state(self):
        from MF_BentoBoxV1.layout_state import LayoutStore
        store=LayoutStore()
        first=store.blank()
        first['presets']['1']=self.host._layout_snapshot()
        store.save(first)
        second=store.load()
        second['presets']['2']=self.host._layout_snapshot()
        store.save(second)
        store.path.write_text('{broken',encoding='utf-8')
        self.assertEqual(first,store.load())


    # v1.2 regression: two-second hold must write and flash BEFORE release.
    def test_v12_hold_saves_at_two_seconds_without_encoder_release(self):
        from unittest.mock import patch
        from MF_BentoBoxV1.layout_state import LayoutStore
        self.host._modes = [1,2,4,3]
        self.host._bind_columns()
        expected = self.host._layout_snapshot()
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=100):
            self._preset_press('bank1',0,True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=101.99):
            self.host._preset_hold_timer_tick()
        self.assertNotIn('1',LayoutStore().load()['presets'])
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=102.00):
            self.host._preset_hold_timer_tick()
        self.assertEqual(expected,LayoutStore().load()['presets']['1'])
        self.assertIn(('bank1',0),self.host._preset_hold_fired)
        self.assertEqual(('1',True), (self.host._preset_confirm[0],self.host._preset_confirm[3]))
        # Stored and RGB confirmation are already active while the key is down.
        self.assertIn((0xBA,0,68),self.host._midi)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=103):
            self._preset_press('bank1',0,False)
        self.assertFalse(self.host._preset_hold_fired)
        self.assertEqual(expected,self.host._layout_snapshot())
        self._send_right_side(False)

    def test_v12_releasing_modifier_early_cancels_pending_save_and_recall(self):
        from unittest.mock import patch
        from MF_BentoBoxV1.layout_state import LayoutStore
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=100):
            self._preset_press('bank2',1,True)
        self._send_right_side(False)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=103):
            self.host._preset_hold_timer_tick()
            self._preset_press('bank2',1,False)
        self.assertNotIn('2',LayoutStore().load()['presets'])
        self.assertFalse(self.host._preset_button_held)

    def test_v12_hold_save_failure_no_success_led_before_release(self):
        from unittest.mock import patch
        self._send_right_side(True)
        with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=100):
            self._preset_press('bank3',2,True)
        with patch.object(self.host._state_store,'save',side_effect=PermissionError('read-only')):
            with patch('MF_BentoBoxV1.ThreeBankHost.time.monotonic',return_value=102.1):
                self.host._preset_hold_timer_tick()
        self.assertIsNone(self.host._preset_confirm[3])
        self.assertNotIn('3',self.host._state_document['presets'])
        self._preset_press('bank3',2,False)
        self._send_right_side(False)

    @staticmethod
    def _midi_vu_track(**kw):
        fields = dict(has_midi_input=True, has_audio_output=True,
                      input_meter_level=0.0, output_meter_level=0.0,
                      output_meter_left=0.0, output_meter_right=0.0,
                      mixer_device=ListenerProxy(), devices=(),
                      name='MIDI Track')
        fields.update(kw)
        return ListenerProxy(**fields)

    def test_v12_midi_track_mixer_white_four_segments_not_audio(self):
        track = self._midi_vu_track(input_meter_level=0.53,
                                    output_meter_left=0.98, output_meter_right=0.98)
        self.host._selected_track=track
        self.host._modes=[0,2,4,3]
        self.host._last_midi.clear()
        self.host._vu_tick()
        for row,cc in enumerate((0,4,8,12)):
            # MIDI level 0.53 -> 3 segments, bottom to top; ignores .98 audio.
            self.assertEqual(0 if row==0 else 127,
                             self.host._last_midi[(self.host.ROTARY_CHANNEL,cc)])
        # 4-segment MIDI-only ladder must not replace Mixer push-button RGB.
        self.assertIsNotNone(self.host._modes[0])

    def test_v12_vu_column_uses_midi_input_not_audio_proxy(self):
        track = self._midi_vu_track(input_meter_level=0.20,
                                   output_meter_left=0.99, output_meter_right=0.99)
        self.host._selected_track=track
        self.host._modes=[0,2,4,3]
        self.host._vu_modes[2]=0
        self.host._last_midi.clear()
        self.host._render_vu_beat(2)
        self.assertEqual([0,0,0,127],
                         [self.host._last_midi[(self.host.ROTARY_CHANNEL,cc)]
                          for cc in (2,6,10,14)])

    def test_v12_midi_only_output_and_missing_input_fail_closed(self):
        track=self._midi_vu_track(has_audio_output=False,output_meter_level=0.30,
                                  output_meter_left=1.0)
        midi,level=self.host._midi_track_activity(track)
        self.assertTrue(midi)
        self.assertAlmostEqual(0.30,level)
        # No MIDI meter: do not show fake activity from audible instrument.
        track2=self._midi_vu_track(output_meter_left=1.0)
        del track2.input_meter_level
        self.assertEqual((True,0.0),self.host._midi_track_activity(track2))

    def test_v12_audio_track_keeps_audio_vu_behavior(self):
        track = self._midi_vu_track(has_midi_input=False,
                                   output_meter_left=0.8,output_meter_right=0.45)
        self.host._selected_track=track
        self.host._modes=[0,2,4,3]
        self.host._vu_modes[2]=0
        self.host._render_vu_beat(2)
        self.assertEqual(4,sum(self.host._last_midi[(self.host.ROTARY_CHANNEL,cc)]==127
                              for cc in (2,6,10,14)))


if __name__=='__main__':unittest.main(verbosity=2)
