"""Verify exact uploaded Test 18 archive, then extract to generated baseline/."""
import hashlib,json,sys,zipfile
from pathlib import Path
EXPECTED_ZIP='38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c'
EXPECTED_SOURCE='270460564e5fb765ef4e7d86e4fefb5c2b69926445d9bec66358160c69d6c1a8'
def verify(path):
 data=Path(path).read_bytes();assert hashlib.sha256(data).hexdigest()==EXPECTED_ZIP,'Wrong ZIP baseline'
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  assert set(z.namelist())=={'MF_SEQ/MF_SEQ.py','MF_SEQ/__init__.py','README_TEST18.txt','SHA256_MF_SEQ_py.txt'}
  source=z.read('MF_SEQ/MF_SEQ.py');assert hashlib.sha256(source).hexdigest()==EXPECTED_SOURCE
  for name in z.namelist():
   p=Path(name);assert not p.is_absolute() and '..' not in p.parts
   if name.endswith('.py'):compile(z.read(name),name,'exec')
   target=Path('baseline')/name
   if target.exists():assert target.read_bytes()==z.read(name),'Existing baseline differs; refusing overwrite'
  z.extractall('baseline')
 return {'zip_sha256':EXPECTED_ZIP,'source_sha256':EXPECTED_SOURCE,'zip_crc':'PASS','layout':'PASS','syntax':'PASS (host Python only)','hardware':'owner-accepted freeze; no new hardware testing'}
if __name__=='__main__':
 result=verify(sys.argv[1]);Path('BASELINE_VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
