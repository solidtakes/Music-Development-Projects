"""Deterministic source-only candidate; never includes SDK, dependencies, emitted code or audio."""
import argparse, hashlib, json, pathlib, zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True)
parser.add_argument('--sha', required=True)
args = parser.parse_args()
if len(args.sha) != 40 or any(c not in '0123456789abcdef' for c in args.sha):
    raise SystemExit('An exact reviewed SHA is required')
repo = pathlib.Path(__file__).resolve().parents[4]
project = pathlib.Path(__file__).resolve().parents[1]
paths = [p for p in project.rglob('*') if p.is_file() and
         not any(c in {'.build', '__pycache__', 'node_modules', '.git'} for c in p.parts) and
         p.name != '.compile.generated.json' and p.suffix not in {'.zip', '.pyc'}]
paths += [repo / 'ableton-offline-processing/engine/src' / p for p in ['contract.ts', 'wav.ts', 'dsp.ts']]
paths += [repo / 'ableton-offline-processing/engine' / p for p in ['package.json', 'package-lock.json']]
paths += [repo / 'ableton-offline-processing/spikes/s5-design' / p for p in
          ['fake-host.mjs', 'fake-host.test.mjs', 'README.md', 'SDK_EVIDENCE.md', 'TRIAL_PROTOCOL.md']]
members = {p.relative_to(repo).as_posix(): p.read_bytes().replace(b'\r\n', b'\n') for p in paths}
manifest = {'schema': 1, 'status': 'NOT AUTHORIZED FOR LIVE / BUILD-ONLY',
            'reviewed_sha': args.sha, 'files': {p: hashlib.sha256(b).hexdigest() for p, b in sorted(members.items())}}
members['BUILD_ONLY_MANIFEST.json'] = (json.dumps(manifest, indent=2, sort_keys=True) + '\n').encode()
out = pathlib.Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(members.items()):
        info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, data, compresslevel=9)
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(members)
print(json.dumps({'file': out.name, 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(),
                  'reviewed_sha': args.sha, 'members': len(members)}))
