#!/usr/bin/env python3
"""Scan component bundles, including styles and types, using canonical IDs."""
from __future__ import annotations
import json,hashlib,re,sys
from pathlib import Path

def safe(root,rel):
 root=Path(root).resolve();p=(root/rel).resolve()
 if Path(rel).is_absolute() or root not in p.parents:raise ValueError('Path escapes root: '+str(rel))
 return p

def load_index(root,contract,kind):
 m=contract['indexMapping'];p=root/contract['discovery']['indexes']/m[kind]
 if p.exists():return json.loads(p.read_text())[m['rootKey' if kind=='components' else 'templateRootKey']]
 specs=root/'components'/('specs' if kind=='components' else 'templates')
 return {d['id']:d for p in specs.glob('*.json') for d in [json.loads(p.read_text())]}
def load_manifest(root,contract):return json.loads((root/contract['discovery']['manifest']).read_text())
def _id(name):return re.sub(r'([a-z0-9])([A-Z])',r'\1-\2',re.sub(r'([A-Z]+)([A-Z][a-z])',r'\1-\2',name)).lower()
def scan_directory(root,contract,target='prototype'):
 root=Path(root).resolve();result={'target':target,'root':str(root),'components':{},'templates':{}}
 for kind,pattern in [('components',contract['discovery']['components']),('templates',contract['discovery']['templates'])]:
  registered=load_index(root,contract,kind);sources={d['source']:cid for cid,d in registered.items()}
  candidates={p.relative_to(root).as_posix() for p in root.glob(pattern) if p.is_file() and p.name!='examples.vue'}|{d['source'] for d in registered.values() if safe(root,d['source']).is_file()}
  for rel in sorted(candidates):
   p=safe(root,rel);cid=sources.get(rel,_id(p.parent.name if p.name=='index.ts' else p.stem))
   bundle={f.relative_to(root).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(p.parent.iterdir()) if f.is_file() and f.name not in ['examples.vue','examples.ts','README.md','metadata.json','.DS_Store'] and f.suffix in ['.vue','.ts','.js','.scss','.css','.json']}
   h=hashlib.sha256(''.join(f'{r}:{v}\n' for r,v in sorted(bundle.items())).encode()).hexdigest()
   result[kind][cid]={'id':cid,'file':rel,'absolute':str(p),'hash':h,'files':bundle}
 return result
if __name__=='__main__':
 contract=json.loads(Path(sys.argv[1]).read_text());print(json.dumps(scan_directory(Path(sys.argv[2]),contract,sys.argv[3] if len(sys.argv)>3 else 'prototype'),ensure_ascii=False,indent=2))
