#!/usr/bin/env python3
"""Apply an approved bundle proposal after staging and validation; preserve failed state."""
from __future__ import annotations
import argparse,json,hashlib,shutil,subprocess,sys,tempfile
from pathlib import Path
from scan_assets import safe,load_index,load_manifest

def bump(value,policy='keep'):
 if policy=='keep':return value
 parts=[int(v) for v in value.split('.')]
 if policy=='patch':parts[2]+=1
 elif policy=='minor':parts[1]+=1;parts[2]=0
 else:raise ValueError('versionPolicy must be keep, patch or minor')
 return '.'.join(map(str,parts))
def replace_version(data,old,new):
 if isinstance(data,dict):return {k:(new if k in ['assetVersion','const','version'] and v==old else replace_version(v,old,new)) for k,v in data.items()}
 if isinstance(data,list):return [replace_version(v,old,new) for v in data]
 return data

def sync(prototype_root,library_root,contract,proposal,dry_run=False):
 proto=Path(prototype_root).resolve();lib=Path(library_root).resolve();c=json.loads(Path(contract).read_text());blocked=[];copies=[];specs=[]
 version_policy=proposal.get('versionPolicy',c.get('syncStrategy',{}).get('defaultVersionPolicy','keep'))
 if version_policy not in ['keep','patch','minor']:blocked.append('Invalid versionPolicy')
 current_scan=None
 if proposal.get('assetId')!=c['assetId']:blocked.append('Proposal assetId differs from library')
 if not dry_run and proposal.get('approved') is not True:blocked.append('Explicit approval required: set approved=true after review')
 for item in proposal.get('actionable',[]):
  try:
   kind=item['kind'];cid=item['id']
   if kind not in ['component','template'] or not re_valid(cid):raise ValueError('Invalid asset identity')
   index=load_index(lib,c,'components' if kind=='component' else 'templates');existing=index.get(cid);entry=item.get('approvedIndexEntry') or existing
   if not isinstance(entry,dict):raise ValueError('New asset requires reviewed approvedIndexEntry')
   required=['id','name','source','level'] if kind=='component' else ['id','name','source','appEntry','configFile','configPreset','configSchema','criticalInteractions','useWhen']
   if any(key not in entry for key in required):raise ValueError('Incomplete canonical specification')
   if entry['id']!=cid or entry['source']!=item['prototypeFile']:raise ValueError('Specification and source differ')
   source=safe(proto,item['prototypeFile']);parent=source.parent
   if not item.get('files'):raise ValueError('Bundle hashes are required; rerun compare')
   if existing and item.get('libraryHash'):
    from scan_assets import scan_directory
    if current_scan is None:current_scan=scan_directory(lib,c,'library')
    current=current_scan['components' if kind=='component' else 'templates'].get(cid)
    if not current or current['hash']!=item['libraryHash']:raise ValueError('Library changed since proposal')
   for rel,expected in item['files'].items():
    f=safe(proto,rel);destination=safe(lib,rel)
    allowed=lib/c['projectRoot']/'src'/('components' if kind=='component' else 'page-templates')
    if allowed not in destination.parents or f.parent!=parent:raise ValueError('Bundle outside asset directory')
    if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=expected:raise ValueError('Stale or missing prototype source '+rel)
    copies.append((rel,f))
   if kind=='template':
    for key in ['configPreset','configSchema']:
     rel=entry[key];f=safe(proto,rel)
     if not f.exists():
      if existing and safe(lib,rel).exists():continue
      raise ValueError('Template registration lacks '+key)
     if not rel.startswith(c['projectRoot']+'/configs/') and not rel.startswith(c['projectRoot']+'/schemas/'):raise ValueError('Unexpected configuration path')
     copies.append((rel,f))
   cleaned={k:v for k,v in entry.items() if k not in ['spec','files','dependencies','tokens','components']};specs.append(('components/'+('specs' if kind=='component' else 'templates')+'/'+cid+'.json',cleaned))
  except (ValueError,KeyError,OSError) as e:blocked.append(str(e))
 if blocked:return {'dryRun':dry_run,'copied':[],'blocked':blocked}
 plan=[{'source':str(f),'target':str(lib/r),'dryRun':dry_run} for r,f in copies]
 if dry_run or not copies:return {'dryRun':dry_run,'copied':plan,'blocked':[]}
 # Stage the complete next release. Any validation failure leaves the library untouched.
 with tempfile.TemporaryDirectory(prefix='gdesign-sync-') as tmp:
  stage=Path(tmp)/'library';shutil.copytree(lib,stage,ignore=shutil.ignore_patterns('node_modules','dist','preview-dist','__pycache__','.git'))
  for rel,source in copies:target=safe(stage,rel);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
  for rel,data in specs:safe(stage,rel).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
  old=load_manifest(stage,c)['assetVersion'];new=bump(old,version_policy)
  for p in stage.rglob('*.json'):
   rel=p.relative_to(stage).as_posix()
   if rel.startswith('design/sources/') or '/assets/icons/' in rel:continue
   value=json.loads(p.read_text());updated=replace_version(value,old,new)
   if updated!=value:p.write_text(json.dumps(updated,ensure_ascii=False,indent=2)+'\n')
  for script in ['build_tokens.py','build_indexes.py','validate_library.py','refresh_release.py']:
   args=[sys.executable,'-B',str(stage/'scripts'/script)]+(['--skip-lock'] if script=='validate_library.py' else [])
   r=subprocess.run(args,capture_output=True,text=True)
   if r.returncode:return {'dryRun':False,'copied':[],'blocked':[r.stdout+r.stderr]}
  changes=[p for p in stage.rglob('*') if p.is_file() and '__pycache__' not in p.parts and (not (lib/p.relative_to(stage)).exists() or p.read_bytes()!=(lib/p.relative_to(stage)).read_bytes())]
  backup={};written=[]
  try:
   for p in changes:
    target=lib/p.relative_to(stage);backup[target]=target.read_bytes() if target.exists() else None;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.read_bytes());written.append(target)
  except Exception:
   for p in reversed(written):
    if backup[p] is None:p.unlink()
    else:p.write_bytes(backup[p])
   raise
 return {'dryRun':False,'copied':plan,'blocked':[],'manifestVersion':new,'validation':'source/configuration only; run frontend build and browser review separately'}

def re_valid(s):
 import re
 return bool(re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',s))
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('contract',type=Path);p.add_argument('prototype',type=Path);p.add_argument('library',type=Path);p.add_argument('proposal',type=Path);p.add_argument('--dry-run',action='store_true');p.add_argument('-o','--output',type=Path);a=p.parse_args()
 result=sync(a.prototype,a.library,a.contract,json.loads(a.proposal.read_text()),a.dry_run);text=json.dumps(result,ensure_ascii=False,indent=2)
 if a.output:a.output.write_text(text+'\n')
 else:print(text)
 return 1 if result['blocked'] else 0
if __name__=='__main__':raise SystemExit(main())
