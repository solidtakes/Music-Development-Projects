"""Reproducible source-only Windows SDK test ZIP; does not bundle proprietary SDK packages."""
from __future__ import annotations
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import sys

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "aopx-t8-0-readonly-windows-test.zip"
fixed = (2024, 1, 1, 0, 0, 0)
prefix = "aopx-t8-0-readonly/"
paths = [
    root / rel for rel in (
        "README.md", "run.ps1", "package.json", "manifest.json",
        "tsconfig.json", "build.ts"
    )
] + sorted((root / "src").rglob("*")) + sorted((root / "test").rglob("*"))
for required in ("flow.test.ts", "waveform.test.ts", "waveform-gui.browser.mts"):
    assert (root / "test" / required).is_file(), f"Test missing from package: {required}"
files = sorted(p for p in paths if p.is_file())
assert files, "No package files found"
hashes = []
with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as z:
    for path in files:
        rel = path.relative_to(root).as_posix()
        data = path.read_bytes()
        hashes.append(f"{sha256(data).hexdigest()}  {rel}")
        info = ZipInfo(prefix + rel, fixed)
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, data)
    checksum = ("\n".join(hashes) + "\n").encode("utf8")
    info = ZipInfo(prefix + "SHA256SUMS.txt", fixed)
    info.compress_type = ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    z.writestr(info, checksum)
print(f"Created {output}, SHA256={sha256(output.read_bytes()).hexdigest()}, files={len(files)+1}")
