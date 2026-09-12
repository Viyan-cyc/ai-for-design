#!/usr/bin/env python3
"""Generate AI indexes from component specifications and actual local imports."""
import json,re,argparse
from pathlib import Path
from asset_graph import dependency_files
ROOT=Path(__file__).resolve().parents[1]
def outputs(root=ROOT):
 components={};templates={}
 for p in sorted((root/'components/specs').glob('*.json')):
  item=json.loads(p.read_text());item['spec']=p.relative_to(root).as_posix();parent=(root/item['source']).parent;starts=[item['source']]+[(parent/n).relative_to(root).as_posix() for n in ['index.ts','types.ts','style.scss'] if (parent/n).is_file()];item['files']=dependency_files(root,starts);item['tokens']=sorted(set(re.findall(r'var\((--[\w-]+)', '\n'.join((root/f).read_text() for f in item['files'] if Path(f).suffix in ['.vue','.css','.scss']))));components[item['id']]=item
 for item in components.values():item['dependencies']=sorted(c['id'] for c in components.values() if c['source'] in item['files'] and c['id']!=item['id'])
 for p in sorted((root/'components/templates').glob('*.json')):
  item=json.loads(p.read_text());item['spec']=p.relative_to(root).as_posix();item['files']=dependency_files(root,[item['source'],str(Path(item['source']).parent/'index.ts'),item['appEntry'],'frontend/element-plus/src/main.ts'],skip=['frontend/element-plus/src/selected-template.ts',item['configFile']]);item['components']=sorted(c['id'] for c in components.values() if c['source'] in item['files']);templates[item['id']]=item
 result={'components/index.json':{'schemaVersion':'1.4','generated':True,'components':components},'components/templates.json':{'schemaVersion':'1.4','generated':True,'templates':templates}}
 return {p:json.dumps(v,ensure_ascii=False,indent=2)+'\n' for p,v in result.items()}
def main():
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args();bad=[]
 for rel,value in outputs().items():
  target=ROOT/rel
  if a.check:
   if not target.exists() or target.read_text()!=value:bad.append(rel)
  else:target.write_text(value)
 if bad:print('Indexes out of date:',bad);return 1
 print('Component and template indexes verified.' if a.check else 'Generated component and template indexes.');return 0
if __name__=='__main__':raise SystemExit(main())
