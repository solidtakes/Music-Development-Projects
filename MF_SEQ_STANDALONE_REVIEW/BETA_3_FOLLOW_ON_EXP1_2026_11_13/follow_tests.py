"""Follow behavior contracts using mocked Live; no hardware certification."""
import ast, copy, os, unittest
from pathlib import Path
from harness import C, Clip, Song, chord, load, press, turn
base=load('accepted/MF_SEQ/MF_SEQ.py','accepted_follow')
new=load('combined/MF_SEQ/MF_SEQ.py','experimental_follow')
def rig(mod=new, origin=0., bars=4):
 c=Clip(origin,bars);song=Song(c);s=mod.MF_SEQ(song)
 return s,c,song
class FollowTests(unittest.TestCase):
 def test_only_runtime_difference_is_initial_default(self):
  a=Path(base.__file__).read_text();b=Path(new.__file__).read_text()
  self.assertEqual(a.replace('self._follow_playback = False','self._follow_playback = True',1),b)
 def test_initialization_and_reload_without_fixture_override(self):
  self.assertFalse(rig(base)[0]._follow_playback)
  for _ in range(2):
   s,c,song=rig();self.assertTrue(s._follow_playback);self.assertFalse(s._follow_manual_pause)
   c.playing_position=9.;s.tick();self.assertEqual(s._page,2);s.disconnect()
 def test_toggle_both_release_orders_and_no_note_edits(self):
  for reverse in (False,True):
   for mode in ('notes','velocity','pitch','length','probability'):
    s,c,_=rig();s._edit_mode=mode;s.tick();before=copy.deepcopy(c.notes);writes=C['note_writes']
    for enabled in (False,True,False,True):
     chord(s,15,0,reverse);self.assertEqual(s._follow_playback,enabled)
     self.assertFalse(any(s._pressed));self.assertFalse(s._press_order)
     s.tick()
    self.assertEqual(c.notes,before);self.assertEqual(C['note_writes'],writes)
 def test_off_holds_page_and_on_resumes(self):
  s,c,_=rig();s.tick();chord(s,15,0);c.playing_position=12.;s.tick();self.assertEqual(s._page,0)
  chord(s,15,0);s.tick();self.assertEqual(s._page,3)
 def test_manual_chord_and_rotary_suspend_until_restart(self):
  for rotary in (False,True):
   for reverse in (False,True):
    s,c,_=rig();s.tick();before=copy.deepcopy(c.notes)
    if rotary:
     press(s,0);turn(s,15,1,8);press(s,0,False)
    else:chord(s,12,2,reverse)
    self.assertEqual(s._page,2);self.assertTrue(s._follow_manual_pause)
    for pos in (4.,12.,0.):c.playing_position=pos;s.tick();self.assertEqual(s._page,2)
    c.is_playing=False;s.tick();self.assertEqual(s._page,2)
    c.is_playing=True;c.playing_position=4.;s.tick();self.assertEqual(s._page,1)
    self.assertFalse(s._follow_manual_pause);self.assertTrue(s._follow_playback);self.assertEqual(c.notes,before)
 def test_loop_wrap_origins_lengths_meter_and_live_loop_change(self):
  for origin in (0.,8.):
   for bars in (1,2,4):
    s,c,_=rig(origin=origin,bars=bars)
    for offset in (0.,3.99,bars*4-.01,bars*4,bars*4+.25):
     c.playing_position=origin+offset;s.tick();self.assertEqual(s._page,int((offset%(bars*4))/4))
  s,c,_=rig();s.tick();s._apply_loop(c,3,2)
  for pos,page in ((8.,2),(15.9,3),(16.,2)):
   c.playing_position=pos;s.tick();self.assertEqual(s._page,page)
  s,c,_=rig();c.signature_numerator=3
  for pos,page in ((3.,1),(6.,2),(9.,3),(16.,0)):
   c.playing_position=pos;s.tick();self.assertEqual(s._page,page)
 def test_clip_replace_remove_reinsert_and_off_persistence(self):
  s,c,song=rig();c.playing_position=12.;s.tick();self.assertEqual(s._page,3)
  other=Clip(origin=8.,bars=2);other.playing_position=12.
  song.view.highlighted_clip_slot.clip=other;song.view.detail_clip=other;s.tick();self.assertEqual(s._page,1)
  song.view.highlighted_clip_slot.clip=None;song.view.detail_clip=None;s.tick()
  song.view.highlighted_clip_slot.clip=other;song.view.detail_clip=other;s.tick();self.assertEqual(s._page,1)
  chord(s,15,0);other.is_playing=False;s.tick();other.is_playing=True;other.playing_position=8.;s.tick()
  self.assertFalse(s._follow_playback);self.assertEqual(s._page,1)
 def test_all_press_pairs_and_leds_differential_with_same_follow_setting(self):
  for enabled in (False,True):
   for first in range(16):
    for second in range(16):
     if first==second:continue
     for reverse in (False,True):
      states=[]
      for mod in (base,new):
       s,c,_=rig(mod);s._follow_playback=enabled;s.tick();chord(s,first,second,reverse);s.tick()
       states.append((s._page,s._follow_playback,s._follow_manual_pause,s._edit_mode,[vars(n) for n in c.notes],s.midi,s.messages,s._pressed,s._press_order))
      self.assertEqual(states[0],states[1],(enabled,first,second,reverse))
if __name__=='__main__':unittest.main(verbosity=2)
