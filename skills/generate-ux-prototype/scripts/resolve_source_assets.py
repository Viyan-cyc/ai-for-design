#!/usr/bin/env python3
"""Resolve exact source bundles and one editable business configuration."""
from __future__ import annotations
import argparse,hashlib,json,os,shutil
from pathlib import Path
from asset_locator import load_json,safe_path,locate_asset_library,load_contract,index_paths,load_manifest

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def resolve(plan_path,assets_root,output):
 request=load_json(plan_path)
 from validate_source_draft import schema_errors
 errors=schema_errors(request,load_json(Path(__file__).resolve().parents[1]/'references/component-plan.schema.json'),'plan')
 if errors:raise ValueError('; '.join(errors))
 from workflow_handoff import load_handoff
 handoff=load_handoff(plan_path,request)
 if request.get('schemaVersion')!='2.2':raise ValueError('component-plan schemaVersion must be 2.2')
 if request.get('assetGaps'):raise ValueError('Resolve declared asset gaps before generation')
 if not request.get('directionId'):raise ValueError('directionId is required')
 root,catalog,entry=locate_asset_library(assets_root,request.get('assetId'));contract,contract_name=load_contract(root,entry);paths=index_paths(root,contract);manifest=load_manifest(root,paths['manifest'].relative_to(root).as_posix());mapping=contract['indexMapping']
 for key in ['assetId','assetVersion']:
  if request.get(key)!=manifest.get(key):raise ValueError(key+' mismatch')
 components=load_json(paths['components'])[mapping['rootKey']];templates=load_json(paths['templates'])[mapping['templateRootKey']];interactions=load_json(paths['interactions'])[mapping['interactionRootKey']]
 if request.get('templateId') not in templates:raise ValueError('Unknown templateId')
 template=templates[request['templateId']]
 declared=request.get('interactions',[])
 if set(declared)-set(interactions):raise ValueError('Unknown interaction')
 if set(template['criticalInteractions'])-set(declared):raise ValueError('Missing critical interactions')
 selected=set(request.get('components',[]))|set(template['components']);queue=list(selected)
 for name in declared:
  for cid in interactions[name].get('requires',[]):selected.add(cid);queue.append(cid)
 while queue:
  name=queue.pop()
  if name not in components:raise ValueError('Unknown component: '+name)
  for dependency in components[name]['dependencies']:
   if dependency not in selected:selected.add(dependency);queue.append(dependency)
 for relative,expected in manifest['protectedFiles'].items():
  path=safe_path(root,relative)
  if not path.is_file() or digest(path)!=expected:raise ValueError('Release integrity failure: '+relative)
 files=set(manifest['prototypeBaseFiles'])|set(template['files'])|{template['spec'],template['configSchema']}
 for cid in selected:files.update(components[cid]['files']);files.add(components[cid]['spec'])
 config=load_json(safe_path(root,template['configPreset']));config.update({k:request[k] for k in ['assetId','assetVersion','templateId','directionId']})
 for key in ['theme','visualStyle']:
  if key in request:config[key]=request[key]
 from validate_source_draft import schema_errors
 errors=schema_errors(config,load_json(safe_path(root,template['configSchema'])))
 if errors:raise ValueError('; '.join(errors))
 output=Path(output).resolve()
 if output.exists() and any(output.iterdir()):raise ValueError('Output must be empty')
 # Validate every source and destination before writing.
 for relative in files:safe_path(output,relative);path=safe_path(root,relative);assert path.is_file(),relative
 output.mkdir(parents=True,exist_ok=True);copied={}
 for relative in sorted(files):
  destination=safe_path(output,relative);destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(safe_path(root,relative),destination);copied[relative]=digest(destination)
 config_file=safe_path(output,template['configFile']);config_file.parent.mkdir(parents=True,exist_ok=True);write(config_file,config)
 project=contract['projectRoot'];generated_path=project+'/src/selected-template.ts'
 relative=os.path.relpath(template['source'],project+'/src').replace(os.sep,'/')
 content="export { default } from './"+relative+"'\n"
 safe_path(output,generated_path).write_text(content)
 shutil.copy2(safe_path(root,template['configSchema']),output/'page-config.schema.json');shutil.copy2(plan_path,output/'component-plan.json')
 selection={'schemaVersion':'2.2','assetId':manifest['assetId'],'assetVersion':manifest['assetVersion'],'sourceReleaseSha256':manifest['sourceReleaseSha256'],'assetPackageId':catalog.get('packageId') if catalog else None,'assetPackageVersion':catalog.get('packageVersion') if catalog else None,'framework':contract['framework'],'assetContract':contract_name,'directionId':request['directionId'],'templateId':request['templateId'],'projectRoot':project,'templateSource':template['source'],'appEntry':template['appEntry'],'configFile':template['configFile'],'configPreset':template['configPreset'],'configSchema':template['configSchema'],'criticalInteractions':template['criticalInteractions'],'components':sorted(selected),'interactions':declared,'files':copied,'generatedFiles':{generated_path:digest(safe_path(output,generated_path))}}
 if handoff:
  write(output/'task-handoff.json',handoff['data']);selection['handoff']={k:v for k,v in handoff.items() if k!='data'};selection['handoff']['snapshotSha256']=digest(output/'task-handoff.json')
 write(output/'asset-selection.json',selection)
 deps=safe_path(root,project+'/node_modules') if not (root/project/'node_modules').is_symlink() else root/project/'node_modules'
 if deps.is_dir():os.symlink(deps.resolve(),output/project/'node_modules',target_is_directory=True)
 return selection

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('plan',type=Path);p.add_argument('assets_root',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
 try:s=resolve(a.plan,a.assets_root,a.output)
 except (ValueError,KeyError,OSError,AssertionError) as e:print('ERROR:',e);return 1
 print(f"Resolved {len(s['components'])} components and {len(s['files'])} locked files. Runtime: {a.output/s['projectRoot']}");return 0
if __name__=='__main__':raise SystemExit(main())
