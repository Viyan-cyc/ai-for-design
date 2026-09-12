#!/usr/bin/env python3
"""Exercise V1.5 against real temporary prototypes and isolated source mutations."""
from __future__ import annotations
import argparse,hashlib,json,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
LIB=ROOT/json.loads((ROOT/'asset-catalog.json').read_text())['libraries']['g-design-enterprise']['root']
sys.path.insert(0,str(ROOT/'skills/generate-ux-prototype/scripts'))
from resolve_source_assets import resolve
from validate_source_draft import validate
from asset_locator import locate_asset_library
sys.path.insert(0,str(ROOT/'skills/manage-design-assets/scripts'))
from compare_assets import compare
from sync_to_library import sync
sys.path.insert(0,str(LIB/'scripts'))
from build_tokens import outputs as token_outputs
from validate_library import check

def hash_tree(root):return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and 'node_modules' not in p.parts and '__pycache__' not in p.parts}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--frontend',action='store_true');parser.add_argument('--report',type=Path);a=parser.parse_args();checks=[]
 def passed(name):checks.append(name);print('PASS:',name,flush=True)
 assert not check(),check();passed('canonical tokens, generated outputs, indexes, dependencies and release hashes')
 manifest=json.loads((LIB/'asset-manifest.json').read_text());contract_path=LIB/'asset-library.contract.json';contract=json.loads(contract_path.read_text());components=json.loads((LIB/'components/index.json').read_text())['components'];templates=json.loads((LIB/'components/templates.json').read_text())['templates']
 assert len(components)==61 and len(templates)==6;passed('all 61 components/services and 6 templates retained')
 for path in [ROOT,ROOT/'assets',LIB]:assert locate_asset_library(path,manifest['assetId'])[0]==LIB
 passed('package, assets and direct-library roots resolve consistently')
 with tempfile.TemporaryDirectory(prefix='gdesign-v15-test-') as tmp:
  work=Path(tmp);prototypes={}
  for tid,template in templates.items():
   plan={'schemaVersion':'2.2','assetId':manifest['assetId'],'assetVersion':manifest['assetVersion'],'directionId':'test-reference','templateId':tid,'components':[],'interactions':template['criticalInteractions'],'assetGaps':[],'theme':'light','visualStyle':'enterprise-light-dark'}
   p=work/(tid+'.json');p.write_text(json.dumps(plan));out=work/tid;selection=resolve(p,ROOT,out);assert not validate(out,ROOT),validate(out,ROOT);prototypes[tid]=out
   if a.frontend:
    result=subprocess.run(['npm','run','build'],cwd=out/selection['projectRoot'],text=True,capture_output=True)
    assert result.returncode==0,result.stdout+result.stderr
   passed(tid+' resolves and validates'+('; frontend build passes' if a.frontend else ''))
  out=prototypes['standard-list-page'];selection=json.loads((out/'asset-selection.json').read_text());cfg=out/selection['configFile'];original=cfg.read_text();data=json.loads(original);data['title']='配置迭代示例';data['theme']='dark';data['visualStyle']='frosted-glass';cfg.write_text(json.dumps(data));assert not validate(out,ROOT);data['theme']='invalid';cfg.write_text(json.dumps(data));assert validate(out,ROOT);cfg.write_text(original);passed('business configuration is editable; invalid theme is rejected')
  plan=json.loads((work/'standard-list-page.json').read_text());plan['components']=['missing-component'];bad=work/'invalid-plan.json';bad.write_text(json.dumps(plan))
  try:resolve(bad,ROOT,work/'must-stay-empty');raise AssertionError('Unknown component accepted')
  except ValueError:pass
  assert not (work/'must-stay-empty').exists();passed('invalid component rejected before output writes')
  plan['components']=[];plan['interactions']=[];bad.write_text(json.dumps(plan))
  try:resolve(bad,ROOT,work/'missing-interactions');raise AssertionError('Missing interactions accepted')
  except ValueError:pass
  passed('critical interactions required')
  proposal=compare(out,LIB,contract);assert not proposal['actionable'],proposal['summary'];passed('fresh prototype bundles compare in-sync, including styles and types')
  style=out/'frontend/element-plus/src/components/basic/GButton/style.scss';old=style.read_text();style.write_text(old+'\n/* reviewed style iteration */\n');assert validate(out,ROOT);proposal=compare(out,LIB,contract);assert any(i['id']=='g-button' for i in proposal['actionable']);passed('style-only change detected by source lock and asset comparison')
  before=hash_tree(LIB);dry=sync(out,LIB,contract_path,proposal,True);assert not dry['blocked'],dry;assert before==hash_tree(LIB);passed('sync dry-run leaves the library unchanged')
  denied=sync(out,LIB,contract_path,proposal,False);assert denied['blocked'];passed('unapproved asset sync is rejected')
  # Exercise a real approved sync in a disposable library copy.
  clone=work/'sync-library';shutil.copytree(LIB,clone,ignore=shutil.ignore_patterns('node_modules','dist','preview-dist','__pycache__'))
  # A broken dependency must fail staging without mutating the destination library.
  source=out/'frontend/element-plus/src/components/basic/GButton/GButton.vue';source_original=source.read_text();source.write_text(source_original.replace('<script setup lang="ts">','<script setup lang="ts">\nimport Missing from "./Missing.vue"'))
  assert source.read_text()!=source_original
  broken=compare(out,clone,contract);broken['approved']=True;clone_before=hash_tree(clone);failed=sync(out,clone,clone/'asset-library.contract.json',broken,False);assert failed['blocked'];assert clone_before==hash_tree(clone);source.write_text(source_original);passed('failed staging validation leaves destination library unchanged')
  proposal['approved']=True;result=sync(out,clone,clone/'asset-library.contract.json',proposal,False);assert not result['blocked'],result;assert not check(clone),check(clone);assert (clone/'frontend/element-plus/src/components/basic/GButton/style.scss').read_text()==style.read_text();passed('approved bundle sync updates specification, version, indexes and hashes transactionally')
  # Numeric-source edits must reach both browser variables and compile-time Sass.
  token_file=clone/'design/tokens.json';td=json.loads(token_file.read_text());td['groups']['foundation']['tokens']['--brand-50']['value']='#123456';td['groups']['spacing']['tokens']['--space-16']['value']='18px';token_file.write_text(json.dumps(td));generated=token_outputs(clone)
  assert '--brand-50: #123456;' in generated['frontend/element-plus/tokens/primitive.css'];assert '--space-16: 18px;' in generated['frontend/element-plus/tokens/primitive.css'];assert '#123456' in generated['frontend/element-plus/tokens/element-plus.scss'];assert '#123456' in generated['design/tokens.md'];passed('one token edit propagates to CSS, Sass and readable values')
  td['groups']['frost-common']['tokens']['--frost-blur-card']['value']='24px';token_file.write_text(json.dumps(td));frost_outputs=token_outputs(clone)
  assert '--frost-blur-card: 24px;' in frost_outputs['frontend/element-plus/tokens/frosted.css'];assert '--glass-blur: var(--frost-blur-card);' in frost_outputs['frontend/element-plus/tokens/glass.css'];passed('frosted token changes propagate while legacy glass names remain aliases')
  td['groups']['foundation']['tokens']['--brand-50']['value']='var(--brand-50)';token_file.write_text(json.dumps(td))
  try:token_outputs(clone);raise AssertionError('Cyclic reference accepted')
  except ValueError:pass
  passed('cyclic token references rejected')
  td['groups']['foundation']['tokens']['--brand-50']['value']='var(--undefined-token)';token_file.write_text(json.dumps(td))
  try:token_outputs(clone);raise AssertionError('Undefined token accepted')
  except ValueError:pass
  passed('undefined token references rejected')
  # A traversal path in an approved proposal must never write outside the library.
  badproposal=json.loads(json.dumps(proposal));badproposal['actionable'][0]['files']={'../../escape.scss':'x'};badresult=sync(out,clone,clone/'asset-library.contract.json',badproposal,True);assert badresult['blocked'];passed('sync rejects escaping source paths')
 # The skill must work from extracted rules and token metadata without original media.
 colors=json.loads((LIB/'design/tokens.json').read_text())['groups'];assert len([n for n in colors['foundation']['tokens'] if __import__('re').fullmatch(r'--(?:rose|red|orange|yellow|green|mint|cyan|blue|indigo|purple|pink|brand)-(?:05|[1-9]0)|--gray-(?:0White|05|[1-9]0|100Black)',n)])==132
 assert all(t.get('usage') for g in ['semantic-light','semantic-dark','code-light','code-dark'] for t in colors[g]['tokens'].values())
 mappings=[t['codeMapping'] for t in colors['code-light']['tokens'].values() if 'codeMapping' in t];assert len(mappings)==37 and all(m.get('rationale') and m.get('example') and m.get('hljsClass') for m in mappings)
 assert (LIB/'design/color-rules.md').is_file() and (LIB/'design/color-tokens.md').is_file()
 assert not any(p.suffix.lower() in ['.docx','.png','.jpg','.jpeg'] for p in (LIB/'design').rglob('*') if p.is_file())
 passed('extracted color rules, all 132 palette entries and 37 code mappings available without original media')
 report={'status':'passed','checks':checks,'frontendBuilds':6 if a.frontend else 0,'browserSmoke':'not performed; compile and source checks do not prove visual fidelity','userUiApproval':'not claimed','scope':'isolated local fixtures; original V1.4 not changed'}
 if a.report:a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(f'Passed {len(checks)} checks.')
if __name__=='__main__':main()
