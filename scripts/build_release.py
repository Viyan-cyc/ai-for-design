#!/usr/bin/env python3
"""Generate and verify one complete package release; optionally build its frontend."""
from __future__ import annotations
import argparse,json,re,subprocess,sys,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def rewrite(value,old,new):
 if isinstance(value,dict):return {k:(new if k in ['assetVersion','packageVersion','version','const'] and v==old else rewrite(v,old,new)) for k,v in value.items()}
 if isinstance(value,list):return [rewrite(v,old,new) for v in value]
 return value

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--version');parser.add_argument('--build-frontend',action='store_true');a=parser.parse_args()
 catalog=json.loads((ROOT/'asset-catalog.json').read_text());entry=catalog['libraries']['g-design-enterprise'];lib=ROOT/entry['root'];manifest=json.loads((lib/'asset-manifest.json').read_text());old=manifest['assetVersion']
 if a.version and not re.fullmatch(r'\d+\.\d+\.\d+',a.version):raise SystemExit('Expected semantic version X.Y.Z')
 target_version=a.version or old
 for relative in ['asset-catalog.json','assets/asset-catalog.json']:
  path=ROOT/relative;value=json.loads(path.read_text());value['packageVersion']=target_version;value['libraries']['g-design-enterprise']['assetVersion']=target_version;path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 path=ROOT/'skill-catalog.json';value=json.loads(path.read_text());value['packageVersion']=target_version;path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 path=ROOT/'asset-manifest.yaml';text=path.read_text();text=re.sub(r'(packageVersion:|release:) [^\n]+',lambda m:m.group(1)+' '+json.dumps(target_version),text);path.write_text(text)
 if a.version:
  for p in ROOT.rglob('*.json'):
   if any(part in ['node_modules','dist','preview-dist','.git','sources'] for part in p.relative_to(ROOT).parts) or '/assets/icons/' in p.as_posix() or p.name=='upstream-hashes.json':continue
   value=json.loads(p.read_text());updated=rewrite(value,old,a.version)
   if value!=updated:p.write_text(json.dumps(updated,ensure_ascii=False,indent=2)+'\n')
  p=ROOT/'asset-manifest.yaml';p.write_text(p.read_text().replace('"'+old+'"','"'+a.version+'"'))
 for name in ['build_tokens.py','build_indexes.py','validate_library.py']:
  args=[sys.executable,'-B',str(lib/'scripts'/name)]+(['--skip-lock'] if name=='validate_library.py' else [])
  subprocess.run(args,check=True)
 if a.build_frontend:
  frontend=lib/'frontend/element-plus';subprocess.run(['npm','run','build:library'],cwd=frontend,check=True)
 subprocess.run([sys.executable,'-B',str(lib/'scripts/refresh_release.py')],check=True)
 subprocess.run([sys.executable,'-B',str(lib/'scripts/validate_library.py')],check=True)
 print('Release generated and verified. Run tests/validate_package.py for workflow checks.')
if __name__=='__main__':main()
