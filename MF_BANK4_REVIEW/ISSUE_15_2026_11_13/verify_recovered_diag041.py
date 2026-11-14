import zipfile,ast,types,json,hashlib,argparse
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('archive',type=Path)
p=parser.parse_args().archive
assert hashlib.sha256(p.read_bytes()).hexdigest()=='aa0d3cf8b702c568a9f1b12ad5f6363c25ffefd9510386975fccf0348002b4e9'
with zipfile.ZipFile(p) as z:s=z.read('MF_Bank_4_LED_DIAG/MF_Bank_4_Test.py')
compile(s,'diagnostic','exec'); tree=ast.parse(s)
class View:
 def __init__(self):self.selected_device=None;self.selected_track=None;self.listeners={}
 def __getattr__(self,n):
  for suffix in ['_has_listener','']:
   if suffix and n.endswith(suffix):return lambda cb:cb in self.listeners.get(n[:-len(suffix)],set())
  if n.startswith('add_') and n.endswith('_listener'):
   return lambda cb:self.listeners.setdefault(n[4:-9],set()).add(cb)
  if n.startswith('remove_') and n.endswith('_listener'):
   return lambda cb:self.listeners.setdefault(n[7:-9],set()).remove(cb)
  raise AttributeError(n)
class Guard:
 def __enter__(self):pass
 def __exit__(self,*args):pass
class Base:
 def __init__(self,ci):self.song=ci;self.messages=[]
 def component_guard(self):return Guard()
 def _send_midi(self,msg):self.messages.append(msg)
 def show_message(self,msg):pass
 def refresh_state(self):pass
 def disconnect(self):pass
song=View();song.view=View();song.appointed_device=None
track=types.SimpleNamespace(view=View());song.view.selected_track=track
ns={'ControlSurface':Base};tree.body=[n for n in tree.body if not isinstance(n,ast.ImportFrom)];exec(compile(tree,'diagnostic','exec'),ns)
x=ns['MFBank4Test'](song)
assert len(x.messages)==32
assert x.messages[:16]==[(0xB0,48+i,0) for i in range(16)]
assert x.messages[16:]==[(0xB1,48+i,[72,108,68,76][i//4]) for i in range(16)]
for c in ['Eq8','AutoFilter','Compressor2','Unknown']:
 track.view.selected_device=types.SimpleNamespace(class_name=c,name=c);x._refresh()
assert len(x.messages)==32
track.view.selected_device=None;song.appointed_device=types.SimpleNamespace(class_name='Eq8',name='other')
assert x._selected_device() is song.appointed_device
x.refresh_state();assert len(x.messages)==64
x.disconnect();assert x.messages[-16:]==[(0xB1,48+i,0) for i in range(16)]
assert all(not v for v in song.listeners.values()) and all(not v for v in song.view.listeners.values()) and all(not v for v in track.view.listeners.values())
print(json.dumps({'archive_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_sha256':hashlib.sha256(s).hexdigest(),'checks':{'syntax':'PASS','startup_exact_channel1_rings_channel2_rgb':'PASS','selection_does_not_update_probe':'PASS','appointed_fallback':'PASS','refresh_repeats_probe':'PASS','normal_disconnect_listener_cleanup':'PASS'},'limitations':'Minimal mock only; no Live or hardware, missing log_message deliberately absent. No controller parameter/input implementation.'},indent=2))
