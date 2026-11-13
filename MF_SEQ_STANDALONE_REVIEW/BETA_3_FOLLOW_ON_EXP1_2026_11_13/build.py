"""Deterministic installable ZIP; exactly the three accepted script paths."""
import hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent
out=root/'MF_SEQ_BETA_3_FOLLOW_ON_EXP1.zip'
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted((root/'source').rglob('*.py')):
  data=p.read_bytes();compile(data,str(p),'exec')
  info=zipfile.ZipInfo(p.relative_to(root/'source').as_posix(),(2026,11,13,12,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
  z.writestr(info,data,compresslevel=9)
with zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 assert set(z.namelist())=={'MF_SEQ/MF_SEQ.py','MF_SEQ/__init__.py','MF_SEQ/scale_sync.py'}
 for name in z.namelist():assert z.read(name)==(root/'source'/name).read_bytes()
files=[out,*sorted((root/'source').rglob('*.py'))]
(root/'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root)}\n' for p in files))
print((root/'SHA256SUMS').read_text())
