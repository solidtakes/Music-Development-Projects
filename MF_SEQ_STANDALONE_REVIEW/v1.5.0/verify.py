"""Dependency-free mock-Live regression and workload harness. Not a Live emulator.
Usage: python verify.py BASELINE_MF_SEQ.py CANDIDATE_MF_SEQ.py
"""
import collections, copy, importlib.util, json, random, statistics, sys, time, types
from pathlib import Path

class Surface:
    def __init__(self, instance):
        self._c_instance = instance
        self.queue, self.midi, self.messages = [], [], []
        self.max_pending = 0
    def song(self): return self._c_instance
    def schedule_message(self, ticks, callback):
        self.queue.append(callback)
        self.max_pending = max(self.max_pending, len(self.queue))
    def request_rebuild_midi_map(self): pass
    def _send_midi(self, data): self.midi.append(data)
    def show_message(self, message): self.messages.append(message)
    def log_message(self, message): pass
    def disconnect(self): pass  # deliberately leaves queued callbacks: worst-case lifecycle
    def build_midi_map(self, handle): pass
    def run_tick(self): self.queue.pop(0)()

sys.modules['_Framework'] = types.ModuleType('_Framework')
sys.modules['_Framework.ControlSurface'] = types.SimpleNamespace(ControlSurface=Surface)
forwarded = []
sys.modules['Live'] = types.SimpleNamespace(
    Clip=types.SimpleNamespace(MidiNoteSpecification=lambda **kw: types.SimpleNamespace(**kw)),
    MidiMap=types.SimpleNamespace(forward_midi_cc=lambda *args: forwarded.append(args)))

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

class Vector(list): pass
class Clip:
    def __init__(self, notes=()):
        self.counts = collections.Counter()
        self.notes = list(copy.deepcopy(notes))
        self.loop_start, self.loop_end = 0., 4.
        self.signature_numerator, self.signature_denominator = 4, 4
        self.is_midi_clip, self.is_playing, self.playing_position = True, True, 0.
        self.last_vector = None
    def __getattribute__(self, name):
        if name in ('loop_start','loop_end','signature_numerator','signature_denominator','is_playing','playing_position'):
            object.__getattribute__(self, 'counts')['property_reads'] += 1
        return object.__getattribute__(self,name)
    def get_notes_extended(self, *args):
        self.counts['note_reads'] += 1
        self.last_vector = Vector(copy.deepcopy(self.notes))
        return self.last_vector
    def apply_note_modifications(self, notes):
        assert notes is self.last_vector and isinstance(notes, Vector), 'Native vector was replaced'
        self.counts['modify'] += 1; self.notes = copy.deepcopy(list(notes))
    def add_new_notes(self, specs):
        self.counts['add'] += 1
        for spec in specs:
            note = copy.deepcopy(spec); note.note_id = max([n.note_id for n in self.notes] + [0])+1
            self.notes.append(note)
    def remove_notes_by_id(self, ids):
        self.counts['remove'] += 1; self.notes = [n for n in self.notes if n.note_id not in ids]
class Proxy:
    def __init__(self, clip): object.__setattr__(self,'clip',clip)
    def __getattr__(self, name): return getattr(self.clip, name)
    def __setattr__(self,name,value): setattr(self.clip,name,value)
    def __eq__(self, other): return self.clip is getattr(other,'clip',other)
class Slot:
    def __init__(self, clip, wrappers=False): self.source, self.wrappers = clip, wrappers
    @property
    def has_clip(self): return self.source is not None
    @property
    def clip(self): return Proxy(self.source) if self.wrappers else self.source
    def create_clip(self, length): self.source = Clip(); self.source.loop_end=length
class Song:
    def __init__(self, clip, wrappers=False):
        self.counts=collections.Counter()
        slot=Slot(clip,wrappers)
        self.view=types.SimpleNamespace(detail_clip=None,highlighted_clip_slot=slot)
        self.tracks=[types.SimpleNamespace(has_midi_input=True,clip_slots=[slot])]
    def __getattr__(self,name):
        if name in ('signature_numerator','signature_denominator'):
            self.counts['signature_reads']+=1
            return 4
        raise AttributeError(name)
    def handle(self): return 42

def note(i, start, duration=.25, pitch=60, velocity=100):
    return types.SimpleNamespace(note_id=i,start_time=start,duration=duration,pitch=pitch,velocity=velocity,mute=False)
def setup(module, notes=(), wrappers=False):
    clip=Clip(notes);song=Song(clip,wrappers);return module.MF_SEQ(song),clip,song

def press(surface, step, down=True): surface.receive_midi((0xBA,48+step,127 if down else 0))
def tap(surface, step): press(surface,step);press(surface,step,False)
def chord(surface, step, reverse=False):
    press(surface,0);press(surface,step)
    if reverse: press(surface,0,False);press(surface,step,False)
    else: press(surface,step,False);press(surface,0,False)
def turn(surface,step,value=65,count=1):
    for _ in range(count): surface.receive_midi((0xBB,48+step,value))
def state(surface, clip):
    return ([vars(n) for n in clip.notes],surface._page,surface._ring_view,surface._cached_colors,surface._cached_rings,surface._last_leds,surface._last_white_rings)

results=[]
def check(name, fn):
    fn();results.append({'test':name,'result':'PASS'})

base=load(sys.argv[1],'baseline');new=load(sys.argv[2],'candidate')

def gestures():
    for mod in (base,new):
        s,c,_=setup(mod)
        tap(s,0);assert len(c.notes)==1 and not s.messages
        tap(s,0);assert not c.notes  # two taps do not change mode
        for reverse in (False,True):
            chord(s,15,reverse);assert s._ring_view=='pitch' and not c.notes
            chord(s,15,reverse);assert s._ring_view=='velocity'
        for _ in range(8): chord(s,13)
        assert s._page==3 and not c.notes
        tap(s,2);assert c.notes[0].start_time==12.5 and c.loop_end==16
        for _ in range(8): chord(s,14)
        assert s._page==0 and len(c.notes)==1
        assert not any(s._pressed) and not s._press_order
check('Immediate E1, double taps, both chord release orders, modes and four-bar cap',gestures)

def edits():
    for mod in (base,new):
        s,c,_=setup(mod,[note(1,0)])
        turn(s,0);assert c.notes[0].velocity==101
        chord(s,15);turn(s,0,count=3);assert c.notes[0].pitch==60
        turn(s,0);assert c.notes[0].pitch==62
        press(s,0);turn(s,0,63,count=4);press(s,0,False)
        assert len(c.notes)==1 and c.notes[0].pitch==60
        turn(s,0,count=3);turn(s,0,63,count=3);assert c.notes[0].pitch==60
        press(s,0);press(s,3);press(s,3,False);press(s,0,False)
        assert c.notes[0].duration==1.0 and len(c.notes)==1
        old=copy.deepcopy(c.notes);turn(s,2);assert vars(c.notes[0])==vars(old[0])
        c.notes.append(note(2,0,pitch=64));before=copy.deepcopy(c.notes)
        tap(s,0);turn(s,0);assert [vars(n) for n in c.notes]==[vars(n) for n in before]
        assert 12<=s._next_scale_pitch(12,-1)<=72
        assert s._next_scale_pitch(72,1)==72
check('Velocity, scale pitch, held turn, reversal, ties, ambiguous notes, native vectors',edits)

def routing():
    for mod in (base,new):
        s,c,_=setup(mod)
        before=len(forwarded);s.build_midi_map(None)
        assert {(a[2],a[3]) for a in forwarded[before:]}=={(ch,cc) for ch in (10,11) for cc in range(48,64)}
        for data in ((0xB0,48,127),(0xBA,47,127),(0x90,48,127),(0xBA,48),(0xBB,48,127)):
            s.receive_midi(data)
        assert not c.notes and not any(s._pressed)
        s.run_tick();count=len(s.midi);s.run_tick();assert len(s.midi)==count
check('Exact MIDI forwarding, rejected input and steady LED deduplication',routing)

def external_changes():
    for mod in (base,new):
        s,c,song=setup(mod,[note(1,0)]);s.run_tick()
        c.notes[0].velocity=57
        for _ in range(4): s.run_tick()
        assert s._cached_rings[0]==57
        other=Clip([note(2,.5,pitch=67)]);song.view.highlighted_clip_slot.source=other
        s.run_tick();assert s._cached_rings[0]==0 and s._cached_rings[2]==100
        song.tracks[0].has_midi_input=False;tap(s,3);assert len(other.notes)==1
        song.tracks[0].has_midi_input=True;song.view.highlighted_clip_slot.source=None
        tap(s,4);created=song.view.highlighted_clip_slot.source
        assert len(created.notes)==1 and created.notes[0].start_time==1
check('External edit polling, clip change, audio rejection and empty-slot creation',external_changes)

def differential():
    rng=random.Random(150)
    for case in range(60):
        numerator,denominator=rng.choice([(4,4),(3,4),(7,8),(5,4)])
        bar=numerator*4./denominator
        notes=[note(i+1,rng.choice([rng.randrange(64)*bar/16,-bar/8]),rng.choice([bar/16,bar,bar*2]),rng.randrange(12,73),rng.randrange(1,128)) for i in range(rng.randrange(1,45))]
        surfaces=[]
        for mod in (base,new):
            s,c,_=setup(mod,notes);c.signature_numerator=numerator;c.signature_denominator=denominator
            c.loop_start=bar/4;c.loop_end=bar*4+bar/4;s._page=case%4
            s._ring_view='pitch' if case%2 else 'velocity'
            for k in range(8):
                c.playing_position=k*bar/8;s.run_tick()
            surfaces.append(state(s,c))
        assert surfaces[0]==surfaces[1],case
check('60 seeded render comparisons: meters, ties, chords, off-grid notes, pages and modes',differential)

def lifecycle():
    s,c,_=setup(new,[note(1,0)])
    for _ in range(20000): s.run_tick()
    assert len(s.queue)==1 and s.max_pending==1
    s.disconnect();s.midi.clear();s.run_tick()
    assert not s.queue and not s.midi
    # A failure must schedule one successor, and disconnect must still stop it.
    s,c,_=setup(new);s._target=lambda: (_ for _ in ()).throw(RuntimeError('injected'))
    try: s.run_tick()
    except RuntimeError: pass
    assert len(s.queue)==1
    s.disconnect();s.run_tick();assert not s.queue
check('20,000-tick soak, one callback chain, queued callback after disconnect and failure path',lifecycle)

def failed_scan():
    s,c,_=setup(new,[note(1,0)]);s.run_tick();old=list(s._cached_rings)
    c.get_notes_extended=lambda *args: (_ for _ in ()).throw(RuntimeError('injected read'))
    s._dirty=True;s.run_tick();assert s._cached_rings==old and len(s.queue)==1
check('Transient note-read failure preserves display and callback chain',failed_scan)

def dirty_playhead():
    counts=[]
    for mod in (base,new):
        s,c,_=setup(mod,[note(1,0)]);s.run_tick();s.midi.clear()
        c.notes=[];c.playing_position=.25;s._dirty=True;s.run_tick()
        counts.append(len(s.midi))
        assert s._last_leds[0]==0 and s._last_leds[1]==mod.BLUE
        assert s._last_white_rings[0]==0
    assert counts==[4,3],counts
check('Dirty scan plus playhead move: identical final LEDs, four messages reduced to three',dirty_playhead)

def timing_fallback():
    for mod in (base,new):
        s,_,_=setup(mod)
        assert s._bar_beats(None)==4
        assert s._bar_beats(types.SimpleNamespace(signature_numerator=7))==7
        assert s._bar_beats(types.SimpleNamespace(signature_numerator=3,signature_denominator=8))==1.5
        assert s._bar_beats(types.SimpleNamespace(signature_numerator=0,signature_denominator=8))==4
check('Meter fallback and invalid signatures',timing_fallback)

def equality_failures():
    class Deleted:
        def __eq__(self,other): raise RuntimeError('deleted wrapper')
    assert new.MF_SEQ._same_clip(None,None)
    assert not new.MF_SEQ._same_clip(Deleted(),Deleted())
    assert not new.MF_SEQ._same_clip(Clip(),Clip())
    for mod in (base,new):
        source=Path(mod.__file__).read_text()
        assert all(word not in source for word in ('DOUBLE_CLICK','_pending_taps','_double_click_steps'))
check('Conservative clip comparison and absent double-click machinery',equality_failures)

metrics=[]
for wrappers in (False,True):
    for mod,label in ((base,'v1.4.9'),(new,'v1.5.0')):
        s,c,song=setup(mod,[note(i+1,i*.25) for i in range(16)],wrappers)
        durations=[];windows=[];previous=collections.Counter()
        for k in range(2000):
            c.playing_position=(k%64)*.0625
            t=time.perf_counter_ns();s.run_tick();durations.append((time.perf_counter_ns()-t)/1000.)
            if (k+1)%500==0:
                now=collections.Counter(c.counts);now['midi']=len(s.midi)
                windows.append(dict(now-previous));previous=now
        measured_counts=dict(c.counts);measured_midi=len(s.midi)
        measured_signature_reads=song.counts['signature_reads']
        before=len(s.queue);s.disconnect();after_disconnect=len(s.midi);s.run_tick()
        metrics.append(dict(build=label,equivalent_fresh_wrappers=wrappers,ticks=2000,
            note_reads=measured_counts['note_reads'],clip_timing_property_reads=measured_counts['property_reads'],
            song_signature_reads=measured_signature_reads,midi_messages=measured_midi,
            midi_after_disconnect_callback=len(s.midi)-after_disconnect,
            pending_before_disconnect=before,pending_after_disconnect=len(s.queue),
            max_pending=s.max_pending,windows_500_ticks=windows,
            mock_tick_us_p50=statistics.median(durations),mock_tick_us_p95=sorted(durations)[1899]))
report={'scope':'Mock Python Live API only; no Ableton, MIDI driver, USB or hardware timing.',
        'python':sys.version,'regressions':results,'workloads':metrics}
Path('results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
