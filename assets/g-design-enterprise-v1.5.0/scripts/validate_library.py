#!/usr/bin/env python3
"""Validate canonical sources, generated outputs, dependency bundles and release locks."""
from __future__ import annotations
import argparse,hashlib,json,re,sys
from pathlib import Path
from build_tokens import outputs as token_outputs
from build_indexes import outputs as index_outputs
from asset_graph import safe_path
from schema_tools import schema_errors
from refresh_release import manifest_digest,release_digest
ROOT=Path(__file__).resolve().parents[1]
def check(root=ROOT,skip_lock=False):
 errors=[]
 try:
  for rel,text in {**token_outputs(root),**index_outputs(root)}.items():
   p=root/rel
   if not p.is_file() or p.read_text()!=text:errors.append('Generated output out of date: '+rel)
  manifest=json.loads((root/'asset-manifest.json').read_text());components=json.loads((root/'components/index.json').read_text())['components'];templates=json.loads((root/'components/templates.json').read_text())['templates'];interactions=json.loads((root/'components/interactions.json').read_text())['interactions'];tokens=json.loads((root/'design/tokens.json').read_text());known={n for g in tokens['groups'].values() for n in g['tokens']}
  for kind,index in [('component',components),('template',templates)]:
   for key,item in index.items():
    if key!=item['id']:errors.append('Inconsistent canonical id: '+key)
    if item['assetVersion']!=manifest['assetVersion']:errors.append('Version mismatch: '+key)
    for f in item['files']:
     if not safe_path(root,f).is_file():errors.append('Missing dependency '+f)
  for key,item in templates.items():
   for f in ['appEntry','configFile','configPreset','configSchema']:
    if not safe_path(root,item[f]).exists():errors.append('Missing template '+f+': '+key)
   errors.extend(schema_errors(json.loads(safe_path(root,item['configPreset']).read_text()),json.loads(safe_path(root,item['configSchema']).read_text()),key))
   if set(item['criticalInteractions'])-set(interactions):errors.append('Unknown template interaction '+key)
   if set(item['components'])-set(components):errors.append('Unknown template component '+key)
  texts=[p.read_text() for p in (root/'frontend/element-plus/src').rglob('*') if p.suffix in ['.vue','.ts','.scss','.css'] and p.name not in ['examples.vue','examples.ts']]
  combined='\n'.join(texts);known|=set(re.findall(r'''['"]?(--[\w-]+)['"]?\s*:''',combined))
  missing=set(re.findall(r'var\((--[\w-]+)',combined))-known
  missing={n for n in missing if not n.startswith('--el-')}
  if missing:errors.append('Undefined source tokens: '+', '.join(sorted(missing)))
  if not skip_lock:
   lock=json.loads(safe_path(root,manifest['sourceLock']).read_text());metadata=manifest_digest(manifest)
   if lock['manifestSha256']!=metadata:errors.append('Manifest metadata mismatch')
   for rel,h in lock['files'].items():
    p=safe_path(root,rel)
    if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=h:errors.append('Release lock mismatch: '+rel)
   expected=release_digest(metadata,lock['files'])
   if expected!=manifest['sourceReleaseSha256'] or expected!=lock['sourceReleaseSha256']:errors.append('Release digest mismatch')
 except (ValueError,KeyError,OSError,TypeError) as e:errors.append(str(e))
 return errors
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--skip-lock',action='store_true');a=p.parse_args();errors=check(skip_lock=a.skip_lock)
 if errors:print('\n'.join('ERROR: '+e for e in errors));raise SystemExit(1)
 print('Library source, token generation, indexes and dependencies are valid.')
