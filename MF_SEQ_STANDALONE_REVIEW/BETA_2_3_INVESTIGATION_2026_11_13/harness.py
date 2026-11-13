"""Instrumented Python contracts only; not Live, a MIDI driver, or hardware."""
import collections, copy, importlib.util, sys, types
C=collections.Counter()
FIELDS={'view','tracks','clip_slots','has_clip','clip','has_midi_input','detail_clip','highlighted_clip_slot','loop_start','loop_end','signature_numerator','signature_denominator','is_playing','playing_position','start_time','duration','note_id','pitch','velocity','probability','scale_mode','root_note','scale_name','scale_intervals'}
class Object:
    def __getattribute__(self,name):
        if name in FIELDS:C['property_reads']+=1
        return object.__getattribute__(self,name)
class Note(Object):pass
class Vector:
    def __init__(self,notes):
        self.items=[]
        for raw in notes:
            n=Note();n.__dict__.update(copy.deepcopy(vars(raw)));self.items.append(n)
    def __iter__(self):return iter(self.items)
class Clip(Object):
    def __init__(self,origin=0.,bars=4):
        self.loop_start=origin;self.loop_end=origin+bars*4
        self.signature_numerator=4;self.signature_denominator=4
        self.is_playing=True;self.playing_position=origin;self.is_midi_clip=True
        self.is_session_clip=True;self.is_arrangement_clip=False
        self.notes=[types.SimpleNamespace(note_id=i+1,start_time=origin+i*.25,duration=.125,pitch=60+i%12,velocity=70+i%50,probability=1.,mute=False,release_velocity=64.,velocity_deviation=0.) for i in range(64)]
        self.vector=None;self.fail_read=False
    def get_notes_extended(self,*args):
        C['note_vectors']+=1
        if self.fail_read:raise RuntimeError('injected note read failure')
        self.vector=Vector(self.notes);return self.vector
    def apply_note_modifications(self,notes):
        if notes is not self.vector:raise TypeError('expected original native vector')
        C['note_writes']+=1
        self.notes=[types.SimpleNamespace(**copy.deepcopy(vars(n))) for n in notes]
    def add_new_notes(self,specs):
        C['note_writes']+=1
        for spec in specs:
            n=copy.deepcopy(spec);n.note_id=max([x.note_id for x in self.notes]+[0])+1
            n.probability=getattr(n,'probability',1.);self.notes.append(n)
    def remove_notes_by_id(self,ids):C['note_writes']+=1;self.notes=[n for n in self.notes if n.note_id not in ids]
class Slot(Object):
    def __init__(self,clip):self.clip=clip
    @property
    def has_clip(self):return self.clip is not None
    def create_clip(self,length):self.clip=Clip(bars=length/4.);self.clip.notes=[]
class Track(Object):
    def __init__(self,clip):self.clip_slots=[Slot(clip)];self.has_midi_input=True;self.devices=[]
class View(Object):pass
class Song(Object):
    def __init__(self,clip):
        self.tracks=[Track(clip)];self.view=View();self.signature_numerator=4;self.signature_denominator=4
        self.view.highlighted_clip_slot=self.tracks[0].clip_slots[0];self.view.detail_clip=clip
        self.view.selected_track=self.tracks[0]
        self.scale_mode=True;self.root_note=0;self.scale_name='Major';self.scale_intervals=(0,2,4,5,7,9,11)
    def handle(self):return 1
class Surface:
    def __init__(self,song):self._c_instance=song;self.queue=[];self.midi=[];self.messages=[];self.logs=[]
    def song(self):return self._c_instance
    def request_rebuild_midi_map(self):pass
    def schedule_message(self,ticks,cb):self.queue.append(cb);C['scheduled']+=1;C['max_pending']=max(C['max_pending'],len(self.queue))
    def _send_midi(self,m):self.midi.append(m);C['midi']+=1
    def show_message(self,m):self.messages.append(m)
    def log_message(self,m):self.logs.append(m)
    def disconnect(self):pass
    def refresh_state(self):pass
    def build_midi_map(self,handle):pass
    def tick(self):self.queue.pop(0)()
sys.modules['_Framework']=types.ModuleType('_Framework')
sys.modules['_Framework.ControlSurface']=types.SimpleNamespace(ControlSurface=Surface)
forwarded=[]
sys.modules['Live']=types.SimpleNamespace(Clip=types.SimpleNamespace(MidiNoteSpecification=lambda **kw:types.SimpleNamespace(**kw)),MidiMap=types.SimpleNamespace(forward_midi_cc=lambda *args:forwarded.append(args)))
def load(path,name):
    from pathlib import Path
    pkg=types.ModuleType(name+'_pkg');pkg.__path__=[str(Path(path).resolve().parent)];sys.modules[pkg.__name__]=pkg
    spec=importlib.util.spec_from_file_location(pkg.__name__+'.MF_SEQ',path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def setup(mod,bars=4,origin=0.,follow=True):
    clip=Clip(origin,bars);song=Song(clip);surface=mod.MF_SEQ(song);surface._follow_playback=follow
    return surface,clip,song
def press(s,step,down=True):s.receive_midi((0xBA,32+step,127 if down else 0))
def tap(s,step):press(s,step);press(s,step,False)
def turn(s,step,direction=1,count=1):
    for _ in range(count):s.receive_midi((0xBB,32+step,65 if direction>0 else 63))
def chord(s,first,second,reverse=False):
    press(s,first);press(s,second)
    if reverse:press(s,first,False);press(s,second,False)
    else:press(s,second,False);press(s,first,False)
