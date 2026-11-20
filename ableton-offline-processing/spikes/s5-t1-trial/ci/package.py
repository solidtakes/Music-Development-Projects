"""Immutable reviewed-source package. Never packages a working-tree/private/untracked file."""
import argparse, hashlib, json, pathlib, re, subprocess, zipfile

REPO = pathlib.Path(__file__).resolve().parents[4]
PROJECTS = ('ableton-offline-processing/spikes/s5-t1-trial/',
            'ableton-offline-processing/spikes/s5-t1/')
EXTRA = {'ableton-offline-processing/engine/' + n for n in ['src/contract.ts','src/wav.ts','src/dsp.ts','package.json','package-lock.json']}
EXTRA |= {'ableton-offline-processing/spikes/s5-design/' + n for n in
          ['fake-host.mjs','fake-host.test.mjs','README.md','SDK_EVIDENCE.md','TRIAL_PROTOCOL.md']}

def allowed(name):
    p = pathlib.PurePosixPath(name)
    if p.is_absolute() or '\\' in name or ':' in name or any(ord(c)<32 for c in name) or any(x in {'.','..','node_modules','.build','dist','.git','__pycache__'} for x in p.parts):
        return False
    if not (name.startswith(PROJECTS) or name in EXTRA):
        return False
    return p.name == '.gitignore' or p.suffix in {'.ts','.mts','.mjs','.json','.md','.py'}

def git(*args):
    return subprocess.check_output(['git','-c',f'safe.directory={REPO.as_posix()}','-C',str(REPO),*args])

def archive(out, members):
    if len(members) != len({n.casefold() for n in members}):
        raise ValueError('duplicate names')
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_STORED) as z:
        for name,data in sorted(members.items()):
            p=pathlib.PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or '\\' in name or ':' in name or any(ord(c)<32 for c in name):
                raise ValueError('unsafe ZIP member')
            info=zipfile.ZipInfo(name,date_time=(2020,1,1,0,0,0))
            info.create_system=3
            info.compress_type=zipfile.ZIP_STORED
            info.external_attr=0o100644 << 16
            z.writestr(info,data)

def package(sha,out):
    if not re.fullmatch('[0-9a-f]{40}',sha):
        raise ValueError('Exact reviewed SHA required')
    assert git('rev-parse',sha).decode().strip()==sha
    names=git('ls-tree','-r','--name-only',sha).decode().splitlines()
    members={name:git('show',f'{sha}:{name}') for name in names if allowed(name)}
    assert 'ableton-offline-processing/spikes/s5-t1-trial/src/extension.ts' in members
    assert 'ableton-offline-processing/spikes/s5-t1/src/extension.ts' in members
    manifest={'schema':1,'status':'NOT AUTHORIZED FOR LIVE / DO NOT RUN',
      'reviewed_sha':sha,'profile':'S5-T1-OWNER-7025538391','default_entry_locked':True,
      'separate_trial_entry_enabled':True,'requires_separate_owner_approval':True,
      'owner_source_sha256':'c897d44b640a602f162e61ed7719d6469722cf22b51fcec894dd6f9231633026',
      'files':{n:hashlib.sha256(b).hexdigest() for n,b in sorted(members.items())}}
    members['CONTROLLED_TRIAL_MANIFEST.json']=(json.dumps(manifest,sort_keys=True,indent=2)+'\n').encode()
    out=pathlib.Path(out);out.parent.mkdir(parents=True,exist_ok=True)
    archive(out,members)
    with zipfile.ZipFile(out) as z:
        assert z.testzip() is None and len(z.namelist())==len(members)
    return {'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
            'reviewed_sha':sha,'members':len(members)}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--sha',required=True)
    a=p.parse_args();print(json.dumps(package(a.sha,a.out)))
