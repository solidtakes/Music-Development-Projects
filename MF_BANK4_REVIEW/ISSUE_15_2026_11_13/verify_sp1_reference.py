"""Read-only accepted SP1 helper checks; never opens MIDI or tests Bank 4."""
import ast, hashlib, io, json, subprocess, types, zipfile
from pathlib import Path
repo=Path(__file__).resolve().parents[2]
commit='372690b15751bbd5bd5c6287cf88fdf89d9dd89e'
path='MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip'
data=subprocess.check_output(['git','show',f'{commit}:{path}'],cwd=repo)
assert hashlib.sha256(data).hexdigest()=='223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180'
with zipfile.ZipFile(io.BytesIO(data)) as z:
 assert z.testzip() is None
 source=z.read('MF_SEQ/MF_SEQ.py')
tree=ast.parse(source);constants={}
for node in tree.body:
 if isinstance(node,ast.Assign):
  for target in node.targets:
   if isinstance(target,ast.Name) and target.id in ('PUSH_CHANNEL','ROT_CHANNEL','FIRST_CC'):
    constants[target.id]=ast.literal_eval(node.value)
cls=next(x for x in tree.body if isinstance(x,ast.ClassDef))
methods=[x for x in cls.body if isinstance(x,ast.FunctionDef) and x.name in ('_led','_white_ring')]
namespace=dict(constants)
exec(compile(ast.Module(body=methods,type_ignores=[]),'sp1_helpers','exec'),namespace)
messages=[]
obj=types.SimpleNamespace(_last_leds=[None]*16,_last_white_rings=[None]*16,_send_midi=messages.append)
for i in range(16):
 namespace['_led'](obj,i,68);namespace['_white_ring'](obj,i,99)
assert messages==[m for i in range(16) for m in [(0xBA,32+i,68),(0xBB,32+i,99)]]
for i in range(16):
 namespace['_led'](obj,i,68);namespace['_white_ring'](obj,i,99)
assert len(messages)==32
print(json.dumps({'reference_commit':commit,'archive_path':path,
 'archive_sha256':hashlib.sha256(data).hexdigest(),'source_sha256':hashlib.sha256(source).hexdigest(),
 'constants':constants,'checks':{'archive_hash_crc':'PASS','exact_rgb_ring_32_message_frame':'PASS','unchanged_frame_suppression':'PASS'},
 'scope':'Extracted accepted SP1 helper contracts only. Bank 4 implementation and hardware remain unavailable.'},indent=2))
