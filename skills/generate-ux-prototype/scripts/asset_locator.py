"""Locate an explicitly selected library using a stable, implementation-neutral contract."""
from __future__ import annotations
import json,hashlib
from pathlib import Path

def load_json(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def safe_path(root,relative):
 if not isinstance(relative,str) or not relative or Path(relative).is_absolute():raise ValueError('Expected a relative asset path')
 root=Path(root).resolve();p=(root/relative).resolve()
 if root not in p.parents:raise ValueError('Path escapes root: '+relative)
 return p

def locate_asset_library(input_root,asset_id):
 root=Path(input_root).resolve()
 if (root/'asset-manifest.json').is_file():
  manifest=load_json(root/'asset-manifest.json')
  if manifest.get('assetId')!=asset_id:raise ValueError('assetId mismatch in direct library')
  return root,None,None
 path=root/'asset-catalog.json'
 if not path.is_file():raise ValueError('No asset-catalog.json or direct asset-manifest.json found')
 catalog=load_json(path);libraries=catalog.get('libraries')
 if not isinstance(libraries,dict):raise ValueError('libraries must be an object keyed by assetId; migrate legacy array catalogs')
 entry=libraries.get(asset_id)
 if not isinstance(entry,dict):raise ValueError('Unknown assetId: '+str(asset_id))
 lib=safe_path(root,entry.get('root'))
 if not (lib/'asset-manifest.json').is_file():raise ValueError('Registered library manifest is missing')
 return lib,catalog,entry

def load_contract(root,catalog_entry=None):
 name=(catalog_entry or {}).get('contract','asset-library.contract.json');data=load_json(safe_path(root,name))
 for key in ['assetId','discovery','indexMapping','manifestMapping','syncStrategy']:
  if key not in data:raise ValueError('Contract missing '+key)
 return data,name

def index_paths(root,contract):
 d=contract['discovery'];m=contract['indexMapping'];index=d.get('indexes','components')
 return {'manifest':safe_path(root,d.get('manifest','asset-manifest.json')),'components':safe_path(root,index+'/'+m['components']),'templates':safe_path(root,index+'/'+m['templates']),'interactions':safe_path(root,index+'/'+m['interactions'])}

def manifest_digest(data):
 clean={k:v for k,v in data.items() if k not in ['protectedFiles','sourceReleaseSha256']}
 return hashlib.sha256(json.dumps(clean,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def release_digest(metadata,files):
 return hashlib.sha256(('manifest:'+metadata+'\n'+''.join(f'{k}:{v}\n' for k,v in sorted(files.items()))).encode()).hexdigest()
def load_manifest(root,relative='asset-manifest.json'):
 data=load_json(safe_path(root,relative));lock=load_json(safe_path(root,data['sourceLock']))
 metadata=manifest_digest(data);expected=release_digest(metadata,lock['files'])
 if lock['manifestSha256']!=metadata or lock['sourceReleaseSha256']!=expected or data['sourceReleaseSha256']!=expected:raise ValueError('Release metadata or lock digest mismatch')
 return {**data,'protectedFiles':lock['files']}
