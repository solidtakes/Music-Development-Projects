"""Run from any directory; requires Python 3 and repository history at review SHA."""
import hashlib,io,json,os,shutil,subprocess,sys,tempfile,zipfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[1]
REVIEW='372690b15751bbd5bd5c6287cf88fdf89d9dd89e'
ART='MF_SEQ_STANDALONE_REVIEW/BETA_2_3_INVESTIGATION_2026_11_13/MF_SEQ_BETA_2_3_SP1_SCALE_PERFORMANCE_REVIEW.zip'
ROLLBACK='MF_SEQ_STANDALONE_REVIEW/BETA_2_3_TEST18_SOURCE/MF_SEQ_BETA_2_3_FROZEN_TEST18.zip'
def blob(path):return subprocess.check_output(['git','show',f'{REVIEW}:{path}'],cwd=REPO)
sp1=blob(ART);rollback=blob(ROLLBACK)
assert hashlib.sha256(sp1).hexdigest()=='223601c89dc84653e706e9027a5904c450d2e3fcfce87b2e02db07de06b7b180'
assert hashlib.sha256(rollback).hexdigest()=='38f3682e107742f68ef4ecd6400145bfc153afd86b1c8ad45618618daef16e8c'
results=[];logs=[]
with tempfile.TemporaryDirectory(prefix='mf-follow-') as temp:
 p=Path(temp)
 for name,data in [('accepted',sp1),('scale',sp1),('baseline',rollback)]:
  with zipfile.ZipFile(io.BytesIO(data)) as z:assert z.testzip() is None;z.extractall(p/name)
 shutil.copytree(HERE/'source',p/'combined')
 for name in ('harness.py','follow_tests.py','sp1_regressions.py','scale_tests.py'):shutil.copy2(HERE/name,p/name)
 for test,args in [('follow_tests.py',[]),('sp1_regressions.py',['combined/MF_SEQ/MF_SEQ.py']),('scale_tests.py',[])]:
  r=subprocess.run([sys.executable,test,*args],cwd=p,capture_output=True,text=True)
  logs.append(f'=== {test} ===\n'+r.stdout+r.stderr)
  results.append({'suite':test,'exit_code':r.returncode})
 (HERE/'TEST_LOG.txt').write_text('\n'.join(logs))
(HERE/'TEST_RESULTS.json').write_text(json.dumps({'scope':'Mock Live contracts only; hardware and real Live runtime NOT RUN','python':sys.version,'suites':results,'passed':all(r['exit_code']==0 for r in results)},indent=2)+'\n')
print('\n'.join(logs));sys.exit(0 if all(r['exit_code']==0 for r in results) else 1)
