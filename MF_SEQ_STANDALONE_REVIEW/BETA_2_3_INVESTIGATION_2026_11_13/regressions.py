"""Dependency-free regression fixtures against frozen Test 18."""
import ast,copy,json,random,sys,types,unittest
from pathlib import Path
from harness import C,load,setup,Clip,press,tap,turn,chord,forwarded
base=load('baseline/MF_SEQ/MF_SEQ.py','base');new=load(sys.argv[1] if len(sys.argv)>1 else 'prototype/MF_SEQ/MF_SEQ.py','new')
def final(s):return (s._page,s._follow_playback,s._follow_manual_pause,s._last_playhead,list(s._last_leds),list(s._last_white_rings))
class Regression(unittest.TestCase):
 def test_frozen_input_functions_and_palette(self):
  def funcs(mod):
   cls=next(n for n in ast.parse(Path(mod.__file__).read_text()).body if isinstance(n,ast.ClassDef))
   return {f.name:ast.dump(f) for f in cls.body if isinstance(f,ast.FunctionDef)}
  b,n=funcs(base),funcs(new)
  for name in ('receive_midi','build_midi_map','_set_mode','_advance_param','_apply_loop','_cycle_loop_length','_shift_loop_start','_target','_read','_led','_white_ring','_rgb_brightness','_note_to_ring'):
   self.assertEqual(b[name],n[name],name)
  for name in ('FIRST_CC','PUSH_CHANNEL','ROT_CHANNEL','BLUE','NOTE_START','HELD','MAX_PAGES'):self.assertEqual(getattr(base,name),getattr(new,name))
 def test_playback_differential_matrix_every_sample(self):
  for bpm in (90,120,160,200):
   for bars in (1,2,4):
    for origin in (0.,8.):
     a,c,_=setup(base,bars,origin);b,d,_=setup(new,bars,origin)
     for i in range(160):
      pos=origin+(i*.1*bpm/60)%(bars*4);c.playing_position=pos;d.playing_position=pos
      a.tick();b.tick();self.assertEqual(final(a),final(b),(bpm,bars,origin,i))
 def test_frozen_chords_order_release_and_follow_manual_pause(self):
  for mod in (base,new):
   for reverse in (False,True):
    s,c,_=setup(mod);c.notes=[];s._follow_playback=False
    for page in range(4):chord(s,12,page,reverse);self.assertEqual(s._page,page)
    self.assertFalse(c.notes);chord(s,15,0,reverse);self.assertTrue(s._follow_playback)
    c.playing_position=0.;s.tick();chord(s,12,2,reverse);s.tick();self.assertEqual(s._page,2)
    c.is_playing=False;s.tick();c.is_playing=True;s.tick();self.assertEqual(s._page,0)
    previous=s._last_edit_mode;chord(s,0,12,reverse);self.assertNotEqual(s._last_edit_mode,previous)
    self.assertNotEqual(s._last_edit_mode,'cc1');chord(s,0,13,reverse);self.assertNotEqual(s._edit_mode,'notes')
    before=len(c.notes);chord(s,0,14,reverse);self.assertEqual(len(c.notes),before)
    self.assertFalse(any(s._pressed));self.assertFalse(s._press_order)
 def test_all_ordered_press_pairs_differential(self):
  rows=[]
  for first in range(16):
   for second in range(16):
    if first==second:continue
    for reverse in (False,True):
     states=[]
     for mod in (base,new):
      s,c,_=setup(mod);c.notes=[];s._follow_playback=False
      chord(s,first,second,reverse)
      states.append((s._page,s._follow_playback,s._edit_mode,s._last_edit_mode,[vars(n) for n in c.notes],s.messages,s._pressed,s._press_order))
     self.assertEqual(states[0],states[1],(first,second,reverse))
     rows.append({'first':first+1,'second':second+1,'release_first_modifier':reverse,'page':states[0][0]+1,'follow':states[0][1],'mode':states[0][2],'parameter':states[0][3],'note_count':len(states[0][4]),'messages':states[0][5]})
  Path('gesture_audit.json').write_text(json.dumps(rows,indent=2)+'\n')
 def test_stop_restart_shifted_loop_clip_change_and_external_edit(self):
  pairs=[setup(mod) for mod in (base,new)]
  for operation in ('warm','shift_loop','stop','restart','external','replace','remove'):
   results=[]
   for s,c,song in pairs:
    if operation=='shift_loop':s._apply_loop(c,2,2);c.playing_position=4.
    if operation=='stop':c.is_playing=False
    if operation=='restart':c.is_playing=True;c.playing_position=8.
    if operation=='external':c.notes[16].velocity=17.
    if operation=='replace':song.view.highlighted_clip_slot.clip=Clip(origin=8.)
    if operation=='remove':song.view.highlighted_clip_slot.clip=None
    for _ in range(4):s.tick()
    results.append(final(s))
   self.assertEqual(results[0],results[1],operation)
 def test_local_edits_native_vector_and_no_stale_note_cache(self):
  states=[]
  for mod in (base,new):
   s,c,_=setup(mod,follow=False);s.tick()
   s._adjust_velocity(0,4);s.tick();self.assertEqual(s._cached_rings[0],s._velocity_to_ring(74))
   s._adjust_pitch(0,1);s._adjust_probability(0,-.04);s._cycle_probability_preset(0)
   s._adjust_length(0,1);s._extend_note(0,3);s._toggle(7)
   s.tick();states.append(([vars(n) for n in c.notes],s._last_white_rings,s._cached_colors))
  self.assertEqual(states[0],states[1])
 def test_one_ring_reassertion_after_color_pass(self):
  counts=[]
  for mod in (base,new):
   s,c,_=setup(mod);s.tick();s.midi.clear();press(s,0);s.tick()
   packets=[p for p in s.midi if p[:2]==(0xBB,32)];counts.append(len(packets))
   self.assertEqual(s._last_white_rings[0],s._velocity_to_ring(70))
   self.assertFalse(any((p[0]&15) not in (10,11) for p in s.midi))
  self.assertEqual(counts,[2,1])
 def test_cache_refresh_hook_transport_and_read_fail_retry(self):
  s,c,_=setup(new);s.tick();s.midi.clear();s.refresh_state();s.tick()
  self.assertEqual(len(s.midi),32)
  c.fail_read=True;s._notes_dirty=True;before=C['note_vectors'];s.tick()
  for _ in range(3):s.tick()
  self.assertEqual(C['note_vectors']-before,1)
  c.fail_read=False;s.tick();self.assertEqual(C['note_vectors']-before,2)
 def test_unambiguous_one_callback_and_disconnect(self):
  s,c,_=setup(new)
  for i in range(2000):c.playing_position=(i*.2)%16;s.tick();self.assertEqual(len(s.queue),1)
  s.disconnect();s.midi.clear();s.tick();self.assertFalse(s.queue);self.assertFalse(s.midi)
 def test_long_note_all_modes_and_non_four_four(self):
  rng=random.Random(23)
  for case in range(30):
   notes=[types.SimpleNamespace(note_id=i+1,start_time=i*.5,duration=rng.choice([.125,.25,.5,2.]),pitch=48+i%12,velocity=64+i,probability=.5,mute=False) for i in range(8)]
   frames=[]
   for mod in (base,new):
    s,c,_=setup(mod,follow=False);c.notes=copy.deepcopy(notes);c.signature_numerator=3;c.signature_denominator=4
    s._last_edit_mode=('velocity','pitch','length','probability')[case%4];s._page=case%4
    for i in range(8):c.playing_position=i*.25;s.tick()
    frames.append(final(s))
   self.assertEqual(frames[0],frames[1])
if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Regression))
 Path('regression_results.json').write_text(json.dumps({'scope':'Mock contracts only; actual Live 12/13 and hardware NOT RUN','groups':r.testsRun,'failures':len(r.failures),'errors':len(r.errors)},indent=2)+'\n')
 sys.exit(0 if r.wasSuccessful() else 1)
