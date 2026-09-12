#!/usr/bin/env python3
"""Read only one token group or selected asset specification; never scan all source code."""
import argparse,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def query(kind,key=None,search=None):
 if kind=='icons':
  base=ROOT/'frontend/element-plus';entries=json.loads((base/'assets/icons/lucide/tags.json').read_text());aliases=json.loads((base/'src/icons/icon-aliases.json').read_text())
  entries.update({n:entries.get(c,[]) for n,c in aliases.items()})
  needle=(key or search or '').lower()
  matches=[{'name':n,'canonicalName':aliases.get(n,n)} for n,tags in entries.items() if not needle or needle in n.lower() or needle in json.dumps(tags,ensure_ascii=False).lower()]
  if needle in aliases and not any(i['name']==needle for i in matches):matches.insert(0,{'name':needle,'canonicalName':aliases[needle]})
  return {'matches':matches[:20],'total':len(matches),'rules':'design/icon-rules.md','export':'scripts/export_icons.py'}
 if kind=='tokens':
  doc=json.loads((ROOT/'design/tokens.json').read_text());entries=doc['groups']
  def rules(group):
   if group.startswith('frost') or 'glass' in group:return ['design/rules.md','design/frosted-glass.md']
   if group.startswith(('foundation','semantic','charts','code')):return ['design/rules.md','design/color-rules.md']
   return ['design/rules.md']
  if key in entries:return {'group':key,**entries[key],'rules':rules(key)}
  if search:
   matches=[{'group':g,'name':n,**v,'rules':rules(g)} for g,d in entries.items() for n,v in d['tokens'].items() if search.lower() in (g+' '+d['description']+' '+n+' '+json.dumps(v,ensure_ascii=False)).lower()]
   return {'matches':matches[:20],'total':len(matches),'next':'Query an exact token or group for complete values.'}
  if key:
   found={g:{n:v for n,v in d['tokens'].items() if n==key} for g,d in entries.items()};found={g:v for g,v in found.items() if v}
   if not found:
    matches={g:{'description':v['description'],'count':len(v['tokens'])} for g,v in entries.items() if key.lower() in (g+' '+v['description']).lower()}
    if matches:return {'matchingGroups':matches,'next':'Query one exact group name for token values.'}
    raise ValueError('Unknown token or group: '+key)
   return found
  return {g:{'description':v['description'],'count':len(v['tokens'])} for g,v in entries.items() if not search or search.lower() in (g+' '+v['description']).lower()}
 file='index.json' if kind=='components' else 'templates.json';entries=json.loads((ROOT/'components'/file).read_text())[kind]
 if key:
  if key not in entries:raise ValueError('Unknown '+kind+' id: '+key)
  return entries[key]
 return [{k:v for k,v in item.items() if k in ['id','name','level','useWhen','spec']} for item in entries.values() if not search or search.lower() in json.dumps(item,ensure_ascii=False).lower()]
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('kind',choices=['tokens','components','templates','icons']);p.add_argument('key',nargs='?');p.add_argument('--search');a=p.parse_args()
 try:print(json.dumps(query(a.kind,a.key,a.search),ensure_ascii=False,indent=2))
 except ValueError as e:print('ERROR:',e);raise SystemExit(1)
