import copy,json,sys,types,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from timing_model import plan,boundaries
from cc_lane_probe import run
class Envelope:
 def __init__(self):self.cells={}
 def insert_step(self,t,d,v):self.cells[(t,t+d)]=v
 def value_at_time(self,t):return next(v for (a,b),v in self.cells.items() if a<=t<b)
class Clip:
 is_session_clip=True;loop_start=0.;loop_end=4.
 def __init__(self,track):self.canonical_parent=track;self.env=None
 def automation_envelope(self,p):return self.env
 def create_automation_envelope(self,p):self.env=Envelope();return self.env
class Research(unittest.TestCase):
 def notes(self):return [dict(note_id=i+1,grid_step=i,start_time=i*.25,duration=.125,pitch=60+i,velocity=100,probability=.7,mute=False) for i in range(16)]
 def test_formula_examples_and_same_boundary_model(self):
  self.assertEqual(boundaries(0)[:4],[0.,.25,.5,.75]);self.assertEqual(boundaries(50)[1],.3125);self.assertEqual(boundaries(100)[1],.375)
  n=self.notes();p=plan(n,100);self.assertEqual([x['start_time'] for x in p],boundaries(100))
 def test_idempotence_restore_and_metadata(self):
  n=self.notes();original=copy.deepcopy(n)
  for amount in (0,50,100,50,0):
   self.assertEqual(plan(n,amount),plan(n,amount));self.assertEqual(n,original)
  self.assertEqual(plan(n,0),n)
  for a,b in zip(n,plan(n,100)):
   for key in a:
    if key!='start_time':self.assertEqual(a[key],b[key])
 def test_nudge_direction_cross_bar_negative_and_collision(self):
  n=self.notes();self.assertLess(plan(n,0,{2:-1})[1]['start_time'],n[1]['start_time'])
  self.assertGreater(plan(n,0,{2:1})[1]['start_time'],n[1]['start_time'])
  with self.assertRaises(ValueError):plan(n,0,{1:-1})
  with self.assertRaises(ValueError):plan(n,100,{2:1})
  sparse=[dict(note_id=1,grid_step=16,start_time=4.,duration=.125,pitch=60)]
  self.assertLess(plan(sparse,0,{1:-1})[0]['start_time'],4.)
 def test_ties_microtiming_and_unknown_owner(self):
  n=[dict(note_id=1,grid_step=0,start_time=.01,duration=.75,pitch=60),dict(note_id=2,grid_step=3,start_time=.75,duration=.125,pitch=64)]
  p=plan(n,50);self.assertEqual(p[0]['duration'],.75);self.assertEqual(p[0]['start_time'],.01)
  with self.assertRaises(ValueError):plan(n,0)
  with self.assertRaises(ValueError):plan(n,50,{99:1})
 def test_cc_probe_ownership_confirmation_and_readback(self):
  track=object();clip=Clip(track);param=types.SimpleNamespace(canonical_parent=track,is_enabled=True,min=0.,max=127.)
  with self.assertRaises(RuntimeError):run(clip,param,track)
  self.assertIsNone(clip.env)
  self.assertEqual(run(clip,param,track,True)['values_read_back'],[0,42,85,127])
  with self.assertRaises(RuntimeError):run(clip,param,track,True)
  with self.assertRaises(RuntimeError):run(Clip(object()),param,track,True)
if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Research))
 Path('research_results.json').write_text(json.dumps({'scope':'Offline models only; no Live save/reload or MIDI output validation','groups':r.testsRun,'failures':len(r.failures),'errors':len(r.errors)},indent=2)+'\n')
 sys.exit(0 if r.wasSuccessful() else 1)
