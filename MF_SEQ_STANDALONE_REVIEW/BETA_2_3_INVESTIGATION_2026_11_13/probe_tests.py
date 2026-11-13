import json,types,unittest
from pathlib import Path
from harness import load,setup
import runtime_probe
class Probe(unittest.TestCase):
 def test_no_extra_scheduler_or_midi_and_detach(self):
  mod=load('combined/MF_SEQ/MF_SEQ.py','probe')
  a,c,_=setup(mod);b,d,_=setup(mod)
  runtime_probe.attach(b);runtime_probe.attach(b)
  for i in range(16):
   c.playing_position=d.playing_position=i*.25;a.tick();b.tick()
   self.assertEqual(len(b.queue),1)
  self.assertEqual(a.midi,b.midi)
  runtime_probe.detach(b);self.assertFalse(hasattr(b,'_mf_perf_probe'))
  b.tick();self.assertEqual(len(b.queue),1)
 def test_flush_via_existing_tick(self):
  mod=load('combined/MF_SEQ/MF_SEQ.py','flush');s,c,_=setup(mod)
  counter=[0.]
  def clock():counter[0]+=.01;return counter[0]
  runtime_probe.time=types.SimpleNamespace(perf_counter=clock)
  runtime_probe.attach(s,window_seconds=.01)
  s.tick();s.tick()
  self.assertTrue(any('MF SEQ PERF |' in msg for msg in s.logs))
  self.assertEqual(len(s.queue),1)
if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Probe))
 Path('probe_results.json').write_text(json.dumps({'groups':r.testsRun,'failures':len(r.failures),'errors':len(r.errors)},indent=2)+'\n')
 raise SystemExit(0 if r.wasSuccessful() else 1)
