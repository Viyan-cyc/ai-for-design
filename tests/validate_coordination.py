#!/usr/bin/env python3
"""Test installed entrypoints, real handoffs, scoped locks and offline icon export."""
import argparse,hashlib,json,shutil,subprocess,sys,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/json.loads((ROOT/'asset-catalog.json').read_text())['libraries']['g-design-enterprise']['root']
sys.path.insert(0,str(ROOT/'skills/generate-ux-prototype/scripts'))
from resolve_source_assets import resolve
from validate_source_draft import validate
from workflow_handoff import load_handoff
sys.path.insert(0,str(ROOT/'skills/manage-design-assets/scripts'))
from sync_to_library import bump
sys.path.insert(0,str(LIB/'scripts'))
from refresh_release import refresh
from query_assets import query

def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def command(*args):return subprocess.run([sys.executable,'-B',*map(str,args)],capture_output=True,text=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('--report',type=Path);args=p.parse_args();checks=[]
    def passed(name):checks.append(name);print('PASS:',name,flush=True)
    with tempfile.TemporaryDirectory(prefix='gdesign-v15-coordination-') as tmp:
        work=Path(tmp).resolve();installed=work/'installed';installer=ROOT/'installer/install_skills.py'
        result=command(installer,installed);assert result.returncode==0,result.stderr
        catalog=json.loads((ROOT/'skill-catalog.json').read_text())
        for s in catalog['skills']:
            target=installed/s['id'];binding=json.loads((target/'agents/package-location.json').read_text())
            assert Path(binding['packageRoot'])==ROOT
            assert binding['packageVersion']==catalog['packageVersion']
            assert (Path(binding['packageRoot'])/binding['entry']).is_file()
            assert all(s.get(k) for k in ['inputs','outputs','skipWhen'])
        assert command(installer,installed).returncode!=0
        assert command(installer,installed,'--rebind').returncode==0
        passed('four installed Skills locate one package; existing installation is preserved; rebind works')

        plan=json.loads((ROOT/'examples/standard-list-plan.json').read_text());plan_file=work/'plan.json'
        plan['directionId']='direction-a';write(plan_file,plan)
        result=command(installed/'generate-ux-prototype/scripts/resolve_source_assets.py',plan_file,ROOT,work/'direct')
        assert result.returncode==0,result.stdout+result.stderr
        assert not (work/'direct/task-handoff.json').exists()
        passed('installed prototype Skill generates directly without mandatory analysis artifacts')

        requirement=work/'requirements.json';insight=work/'insights.json';handoff=work/'task-handoff.json'
        write(requirement,{'schemaVersion':'1.0','projectId':'project-a','status':'draft','coreTasks':[{'id':'task-1','status':'assumed','evidence':[]}]})
        write(insight,{'schemaVersion':'1.0','projectId':'project-a','selectedDirectionId':'direction-a','designDirections':[{'id':'direction-a','status':'selected','requirementIds':['task-1']}]})
        data={'schemaVersion':'1.0','projectId':'project-a','mode':'staged','selectedDirectionId':'direction-a','inputs':[{'kind':kind,'path':f.name,'sha256':digest(f)} for kind,f in [('requirements',requirement),('insights',insight)]],'userConfirmation':{'status':'not-requested'}}
        def save_handoff():
            write(handoff,data);plan['handoff']={'path':handoff.name,'sha256':digest(handoff)};write(plan_file,plan)
        save_handoff();out=work/'staged';selection=resolve(plan_file,ROOT,out)
        assert not validate(out,ROOT)
        assert json.loads((out/'task-handoff.json').read_text())['userConfirmation']['status']=='not-requested'
        passed('staged handoff validates project, evidence hashes and selected direction without claiming UI approval')

        def rejected(label):
            try:resolve(plan_file,ROOT,work/'rejected');raise AssertionError(label+' was accepted')
            except ValueError:pass
            assert not (work/'rejected').exists()
            passed(label+' rejected before output writes')
        original=requirement.read_text();requirement.write_text(original+' ')
        rejected('changed upstream requirements');assert validate(out,ROOT);requirement.write_text(original)
        plan['directionId']='wrong';write(plan_file,plan);rejected('mismatched plan direction');plan['directionId']='direction-a';write(plan_file,plan)
        doc=json.loads(insight.read_text());original_insight=insight.read_text();doc['designDirections'][0]['requirementIds']=['missing-task'];write(insight,doc);data['inputs'][1]['sha256']=digest(insight);save_handoff();rejected('unknown upstream requirement ID')
        doc['designDirections'][0]['requirementIds']=['task-1'];doc['projectId']='other-project';write(insight,doc);data['inputs'][1]['sha256']=digest(insight);save_handoff();rejected('mismatched upstream project')
        insight.write_text(original_insight);data['inputs'][1]['sha256']=digest(insight);save_handoff()

        clone=work/'library';shutil.copytree(LIB,clone,ignore=shutil.ignore_patterns('node_modules','dist','preview-dist','__pycache__'))
        (clone/'README.md').write_text((clone/'README.md').read_text()+'\nDocumentation-only test fixture.\n');refresh(clone)
        assert not validate(work/'direct',clone,scope='selected')
        assert validate(work/'direct',clone,scope='full')
        file=next(f for f in selection['files'] if f.endswith('style.scss'))
        (clone/file).write_text((clone/file).read_text()+'\n/* mutation */\n');refresh(clone)
        assert validate(work/'direct',clone,scope='selected')
        passed('selected validation tolerates unrelated documented release changes but detects used source changes')
        assert [bump('1.5.0',v) for v in ['keep','patch','minor']]==['1.5.0','1.5.1','1.6.0']
        passed('explicit keep, patch and minor policies produce predictable versions')

        assert query('tokens',search='轻雾')['matches']
        assert query('tokens','frost-common')['rules'][-1]=='design/frosted-glass.md'
        assert query('icons','搜索')['matches'][0]['canonicalName']=='search'
        export=command(LIB/'scripts/export_icons.py','--all',work/'icons');assert export.returncode==0,export.stderr
        assert len(list((work/'icons').glob('*.svg')))==2077
        for f in (work/'icons').glob('*.svg'):assert ET.fromstring(f.read_text()).tag.endswith('svg')
        passed('token usage search and topic routing work; all 2077 SVG names export offline')

        # Evidence-validation fixtures do not constitute real browser/user approval.
        direct=work/'direct';sel=json.loads((direct/'asset-selection.json').read_text());report=work/'browser-fixture.json'
        write(report,{'status':'passed','prototypeRoot':str(direct),'configSha256':'invalid','criticalInteractions':sel['criticalInteractions']})
        freeze=ROOT/'skills/generate-ux-prototype/scripts/freeze_design_handoff.py'
        call=[freeze,direct,ROOT,'--direction-id','direction-a','--browser-report',report,'--confirmation-reference','test fixture only']
        assert command(*call).returncode!=0
        doc=json.loads(report.read_text());doc['configSha256']=digest(direct/sel['configFile']);write(report,doc)
        result=command(*call);assert result.returncode==0,result.stdout+result.stderr
        passed('engineering handoff requires evidence bound to the current configuration and interactions')
    result={'status':'passed','checks':checks,'scope':'deterministic contract and isolated integration tests; not a claim of autonomous AI routing, browser execution or user UI approval'}
    if args.report:write(args.report,result)
    print('Passed',len(checks),'coordination checks.')

if __name__=='__main__':main()
