"""Reproduce ZIP and hashes using only this directory; no network or MIDI."""
from pathlib import Path
import hashlib
import zipfile

ROOT = Path(__file__).resolve().parent
archive = ROOT / 'MF_Bank4_Selected_Device_v0.5.0_Rebuild_Candidate.zip'
paths = [(p, str(p.relative_to(ROOT/'source'))) for p in sorted((ROOT/'source').rglob('*.py'))]
paths += [(ROOT/name, name) for name in ('README.md', 'PARAMETER_MAPPING.md', 'HARDWARE_CHECKLIST.md')]
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for path, member in paths:
        info = zipfile.ZipInfo(member, date_time=(2026,11,13,0,0,0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, path.read_bytes(), compresslevel=9)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
files = sorted(p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name != 'SHA256SUMS')
(ROOT/'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(ROOT))+'\n' for p in files))
print(archive.name, hashlib.sha256(archive.read_bytes()).hexdigest())
