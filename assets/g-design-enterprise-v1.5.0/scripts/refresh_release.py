#!/usr/bin/env python3
"""Refresh compact release metadata and its tool-only source lock after validation."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def manifest_digest(data):
 clean={k:v for k,v in data.items() if k not in ['protectedFiles','sourceReleaseSha256']}
 return hashlib.sha256(json.dumps(clean,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def release_digest(metadata,files):
 return hashlib.sha256(('manifest:'+metadata+'\n'+''.join(f'{k}:{v}\n' for k,v in sorted(files.items()))).encode()).hexdigest()
def refresh(root=ROOT):
 path=root/'asset-manifest.json';data=json.loads(path.read_text());data.pop('protectedFiles',None)
 data['sourceLock']='release/source-lock.json';data['sourceReleaseHashFormat']='manifest-sha256 and sorted path:sha256 lines'
 lock=root/data['sourceLock'];lock.parent.mkdir(exist_ok=True)
 files=sorted(p for p in root.rglob('*') if p.is_file() and p not in [path,lock] and not any(part in ['node_modules','dist','preview-dist','.git','__pycache__'] for part in p.relative_to(root).parts) and p.suffix!='.pyc' and p.name!='.DS_Store')
 hashes={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
 metadata=manifest_digest(data);data['sourceReleaseSha256']=release_digest(metadata,hashes)
 lock.write_text(json.dumps({'manifestSha256':metadata,'sourceReleaseSha256':data['sourceReleaseSha256'],'files':hashes},ensure_ascii=False,indent=2)+'\n')
 path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');return hashes
if __name__=='__main__':print('Refreshed',len(refresh()),'source hashes in release/source-lock.json.')
