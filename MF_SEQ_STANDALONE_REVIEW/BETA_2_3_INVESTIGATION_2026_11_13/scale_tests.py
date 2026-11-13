"""Scale synchronization contract tests, not Live 12/13 runtime certification."""
import copy,json,sys,unittest
from pathlib import Path
from harness import C,load,setup,Clip,Song,View
PROPS={'scale_mode','root_note','scale_name','scale_intervals'}
class Observable:
 def __getattr__(self,name):
  if name.startswith('add_') and name.endswith('_listener'):
   prop=name[4:-9]
   if prop in self._listener_props:
    def add(cb):
     if cb in self._listeners.setdefault(prop,[]):raise RuntimeError('duplicate listener')
     self._listeners[prop].append(cb)
    return add
  if name.startswith('remove_') and name.endswith('_listener'):
   prop=name[7:-9]
   if prop in self._listener_props:return lambda cb:self._listeners[prop].remove(cb)
  if name.endswith('_has_listener'):
   prop=name[:-13]
   if prop in self._listener_props:return lambda cb:cb in self._listeners.get(prop,[])
  raise AttributeError(name)
 def emit(self,prop,value):
  setattr(self,prop,value)
  for cb in tuple(self._listeners.get(prop,[])):cb()
class OClip(Observable,Clip):pass
class OSong(Observable,Song):pass
class OView(Observable,View):pass

def observe(obj,cls,props):
 obj.__class__=cls;obj._listener_props=set(props);obj._listeners={};return obj
def rig(mod,clip_props=True,listeners=True):
 s,c,song=setup(mod,follow=False)
 # Replace with a fresh surface after installing observable API contracts.
 s.disconnect()
 observe(song,OSong,PROPS if listeners else ())
 observe(song.view,OView,('detail_clip','highlighted_clip_slot','selected_track') if listeners else ())
 observe(c,OClip,PROPS if listeners else ())
 if clip_props:c.scale_mode=True;c.root_note=0;c.scale_name='Major';c.scale_intervals=(0,2,4,5,7,9,11)
 s=mod.MF_SEQ(song);return s,c,song

def listener_count(obj):return sum(len(v) for v in obj._listeners.values())
class ScaleTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.base=load('baseline/MF_SEQ/MF_SEQ.py','scale_baseline')
  cls.s1=load('scale/MF_SEQ/MF_SEQ.py','scale_s1')
  cls.sp1=load('combined/MF_SEQ/MF_SEQ.py','scale_sp1')
 def test_source_reproduction_off_regression(self):
  s,c,_=rig(self.base);c.scale_mode=False
  self.assertEqual(s._next_scale_pitch(60,1),62)
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod);c.scale_mode=False
   self.assertEqual([s._next_scale_pitch(p,1,c) for p in (60,61,62,63)],[61,62,63,64])
 def test_on_off_root_and_major_minor_dorian_next_edit(self):
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod);self.assertEqual(s._next_scale_pitch(60,1,c),62)
   c.emit('scale_mode',False);self.assertEqual(s._next_scale_pitch(60,1,c),61)
   c.emit('scale_mode',True);c.emit('root_note',2);self.assertEqual(s._next_scale_pitch(60,1,c),61)
   c.emit('scale_name','Minor');c.emit('scale_intervals',(0,2,3,5,7,8,10));self.assertEqual(s._next_scale_pitch(60,1,c),62)
   self.assertEqual(s._next_scale_pitch(70,1,c),72)
   c.emit('scale_name','Dorian');c.emit('scale_intervals',(0,2,3,5,7,9,10));self.assertEqual(s._next_scale_pitch(70,1,c),71)
 def test_notifications_never_retune_or_redraw_or_read_notes(self):
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod);s.tick();before=copy.deepcopy(c.notes);vectors=C['note_vectors'];midi=len(s.midi)
   for i in range(20):c.emit('root_note',i%12)
   self.assertEqual(c.notes,before);self.assertEqual(C['note_vectors'],vectors);self.assertEqual(len(s.midi),midi)
   s._scale_sync.tick(c,2)
   self.assertEqual(c.notes,before);self.assertEqual(C['note_vectors'],vectors);self.assertEqual(len(s.midi),midi)
 def test_metadata_preserved_by_off_pitch_edit(self):
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod);c.scale_mode=False;before=copy.deepcopy(c.notes)
   s._adjust_pitch(0,1);before[0].pitch=61
   self.assertEqual(c.notes,before)
 def test_no_duplicates_selection_rebind_disconnect_and_reload(self):
  for mod in (self.s1,self.sp1):
   s,c,song=rig(mod);s._scale_sync.tick(c,1)
   self.assertEqual((listener_count(song),listener_count(song.view),listener_count(c)),(4,3,4))
   for i in range(50):s._scale_sync.tick(c,i+2)
   self.assertEqual(listener_count(c),4)
   other=observe(Clip(),OClip,PROPS);other.scale_mode=False;other.root_note=7;other.scale_name='Major';other.scale_intervals=(0,2,4,5,7,9,11)
   song.view.highlighted_clip_slot.clip=other;song.view.emit('detail_clip',other)
   self.assertEqual(s._next_scale_pitch(60,1,other),61)
   self.assertEqual(listener_count(c),0);self.assertEqual(listener_count(other),4)
   s.disconnect();self.assertEqual((listener_count(song),listener_count(song.view),listener_count(other)),(0,0,0))
   fresh=mod.MF_SEQ(song);fresh._scale_sync.tick(other,1);self.assertEqual(listener_count(other),4);fresh.disconnect()
 def test_song_replacement_and_foreign_listener_preservation(self):
  for mod in (self.s1,self.sp1):
   s,c,song=rig(mod);foreign=lambda:None;song.add_root_note_listener(foreign)
   s._scale_sync.tick(c,1)
   replacement=Clip();replacement.scale_mode=False
   other=observe(Song(replacement),OSong,PROPS)
   observe(other.view,OView,('detail_clip','highlighted_clip_slot','selected_track'))
   s._c_instance=other
   self.assertEqual(s._next_scale_pitch(60,1,replacement),61)
   self.assertEqual(listener_count(song),1)
   self.assertTrue(song.root_note_has_listener(foreign))
   self.assertEqual(listener_count(c),0)
   s.disconnect();self.assertEqual(listener_count(other),0)
 def test_missing_listeners_poll_bound_and_immediate_edit(self):
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod,listeners=False);s._scale_sync.tick(c,1);rebuilds=s._scale_sync.mask_rebuilds
   for i in range(2,5):s._scale_sync.tick(c,i)
   self.assertEqual(s._scale_sync.mask_rebuilds,rebuilds)
   c.scale_mode=False;self.assertEqual(s._next_scale_pitch(60,1,c),61)
   self.assertFalse(s._scale_sync.enabled)
   c.scale_mode=True;c.root_note=2;s._scale_sync.tick(c,5)
   self.assertEqual(s._scale_sync.mask,frozenset((2,4,6,7,9,11,1)))
 def test_song_proxy_requires_correct_detail_clip(self):
  for mod in (self.s1,self.sp1):
   s,c,song=rig(mod,clip_props=False);song.scale_mode=False
   self.assertEqual(s._next_scale_pitch(60,1,c),61)
   song.view.emit('detail_clip',Clip());self.assertEqual(s._next_scale_pitch(60,1,c),60)
   self.assertTrue(any('proxy' in msg for msg in s.logs))
 def test_api_unavailable_blocks_not_c_major(self):
  for mod in (self.s1,self.sp1):
   s,c,song=rig(mod,clip_props=False,listeners=False);del song.scale_mode
   self.assertEqual(s._next_scale_pitch(60,1,c),60)
   self.assertTrue(any('synchronization unavailable' in msg for msg in s.logs))
   count=len(s.logs);s._next_scale_pitch(60,1,c);self.assertEqual(len(s.logs),count)
 def test_pitch_bounds_and_transport_state(self):
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod)
   for playing in (False,True,False):
    c.is_playing=playing;c.emit('scale_mode',False);s.tick()
    self.assertEqual(s._next_scale_pitch(36,-1,c),36);self.assertEqual(s._next_scale_pitch(72,1,c),72)
    self.assertEqual(s._next_scale_pitch(60,1,c),61)
 def test_fold_highlight_not_used_and_invalid_intervals_fail_closed(self):
  for mod in (self.s1,self.sp1):
   s,c,_=rig(mod);c.scale_mode=False;c.fold_notes=True;c.highlight_scale=True
   self.assertEqual(s._next_scale_pitch(60,1,c),61)
   c.emit('scale_mode',True);c.emit('scale_intervals',())
   self.assertEqual(s._next_scale_pitch(60,1,c),60)
if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ScaleTests))
 Path('scale_results.json').write_text(json.dumps({'scope':'Observable mocks for Clip/Song properties and listener contracts, not actual Live runtime validation','groups':r.testsRun,'failures':len(r.failures),'errors':len(r.errors)},indent=2)+'\n')
 sys.exit(0 if r.wasSuccessful() else 1)
