#!/usr/bin/env python3
"""Generate CSS/SCSS and readable token indexes from design/tokens.json (stdlib only)."""
from __future__ import annotations
import argparse,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PLACEHOLDER=re.compile(r'\{\{(resolve:)?([^|{}]+)\|([^{}]+)\}\}')
def outputs(root=ROOT):
 doc=json.loads((root/'design/tokens.json').read_text());groups=doc['groups'];all_names={n for g in groups.values() for n in g['tokens']}
 if doc['schemaVersion']!='1.4':raise ValueError('Unsupported token schemaVersion')
 def resolve(group,name,trail=()):
  key=(group,name)
  if key in trail:raise ValueError('Cyclic token reference: '+str(trail+(key,)))
  value=groups[group]['tokens'][name]['value']
  def ref(match):
   target=match.group(1)
   theme=next((t for t in ['light','dark'] if group.endswith('-'+t)),None)
   candidates=[group]+[g for g in groups if g!=group and theme and g.endswith('-'+theme)]+[g for g in groups if g!=group and (not theme or not g.endswith('-'+theme))]
   owner=next((g for g in candidates if target in groups[g]['tokens']),None)
   if owner is None:raise ValueError('Undefined token '+target)
   return resolve(owner,target,trail+(key,))
  return re.sub(r'var\((--[\w-]+)\)',ref,value)
 for group,record in groups.items():
  if not isinstance(record.get('tokens'),dict):raise ValueError('Invalid group '+group)
  for name,item in record['tokens'].items():
   value=item.get('value')
   if not name.startswith('--') or not isinstance(value,str):raise ValueError('Invalid token '+name)
   if any(c in value for c in '{};') or '</' in value:raise ValueError('Token must be a CSS value: '+name)
   for ref in re.findall(r'var\((--[\w-]+)',value):
    if ref not in all_names:raise ValueError('Undefined reference '+ref)
   resolve(group,name)
   for color in re.findall(r'#[\w]+',value):
    if not re.fullmatch(r'#(?:[a-fA-F0-9]{3,4}|[a-fA-F0-9]{6}|[a-fA-F0-9]{8})',color):raise ValueError('Invalid color '+color)
   for args in re.findall(r'rgba?\(([^)]+)\)',resolve(group,name)):
    numbers=[float(n.strip()) for n in args.split(',')]
    if len(numbers) not in [3,4] or any(n<0 or n>255 for n in numbers[:3]) or (len(numbers)==4 and not 0<=numbers[3]<=1):raise ValueError('Invalid rgb value '+value)
 result={}
 for template in sorted((root/'frontend/element-plus/bindings').rglob('*.tpl')):
  relative=template.relative_to(root/'frontend/element-plus/bindings').as_posix()[:-4]
  def replace(match):
   expanded,group,name=match.groups()
   return resolve(group,name) if expanded else groups[group]['tokens'][name]['value']
  value=PLACEHOLDER.sub(replace,template.read_text())
  if '{{' in value:raise ValueError('Unresolved placeholder '+relative)
  prefix='// GENERATED from design/tokens.json; edit the source, then run scripts/build_tokens.py.\n' if relative.endswith('.scss') else '/* GENERATED from design/tokens.json. Do not edit generated values. */\n'
  result['frontend/element-plus/tokens/'+relative]=prefix+value
 index={'schemaVersion':'1.4','source':'tokens.json','generated':True,'groups':{g:{'description':v['description'],'count':len(v['tokens']),'tokens':list(v['tokens'])} for g,v in groups.items()}}
 result['design/index.json']=json.dumps(index,ensure_ascii=False,indent=2)+'\n'
 lines=['# Token 数值表（自动生成）','','数值唯一来源为 `tokens.json`；此表不能作为第二个编辑入口。运行 `python3 scripts/build_tokens.py` 更新。','']
 for group,data in groups.items():
  lines+=['## '+group,'',data['description'],'','| Token | 值 | 用途/来源 |','| --- | --- | --- |']
  for name,item in data['tokens'].items():lines.append('| `'+name+'` | `'+item['value'].replace('|','\\|')+'` | '+item.get('usage',item.get('source','')).replace('|','\\|')+' |')
  lines.append('')
 result['design/tokens.md']='\n'.join(lines)+'\n'
 color_groups=['foundation','semantic-light','semantic-dark','charts-default','charts-accessible','charts-extension-1','charts-extension-2','charts-extension-3','code-light','code-dark']
 color_lines=['# H Design 颜色 Token 表（自动生成）','','唯一维护源为 [tokens.json](tokens.json)，颜色用法见 [color-rules.md](color-rules.md)。value/usage/codeMapping 变更后运行 scripts/build_tokens.py；不要手改此表。','','包含基础与辅助色、UI 明暗语义、图表方案、代码浅深色及其用途。深色 UI 为项目兼容方案；代码明暗值来自 H Design 语义明细表。','']
 def cell(value):return str(value).replace('|','\\|').replace('\n',' ')
 for group in color_groups:
  data=groups[group];color_lines+=['## '+group,'',data['description'],'','| Token | 引用或定义 | 解析色值 | 使用说明 |','| --- | --- | --- | --- |']
  for name,item in data['tokens'].items():
   if group=='foundation' and item['type'] not in ['color','reference']:continue
   color_lines.append('| `'+name+'` | `'+cell(item['value'])+'` | `'+cell(resolve(group,name))+'` | '+cell(item.get('usage',item.get('source','')))+' |')
  color_lines.append('')
 color_lines+=['## StarCode 语义与平台映射','','IDE 项目名是 DevEco 示例，其他 IDE 按实际名称对应；example 为便于使用整理的语法示例。映射元数据只维护于 code-light 各项 codeMapping。','','| Token | 大类 / 子类 | Highlight.js | IDE 设置项 | 频率 | 用途示例 | 选色理由 |','| --- | --- | --- | --- | --- | --- | --- |']
 for name,item in groups['code-light']['tokens'].items():
  m=item.get('codeMapping')
  if m:color_lines.append('| `'+name+'` | '+cell(m['group']+' / '+m['subcategory'])+' | '+cell(m['hljsClass'])+' | '+cell(m['ideSetting'])+' | '+cell(m['frequency'])+' | '+cell(m['example'])+' | '+cell(m['rationale'])+' |')
 result['design/color-tokens.md']='\n'.join(color_lines)+'\n'
 return result

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
 try:generated=outputs()
 except (ValueError,KeyError,TypeError) as e:print('ERROR:',e);return 1
 bad=[]
 for relative,text in generated.items():
  target=ROOT/relative
  if args.check:
   if not target.is_file() or target.read_text()!=text:bad.append(relative)
  else:target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding='utf-8')
 if bad:print('Generated files out of date:\n'+'\n'.join(bad));return 1
 print(('Verified' if args.check else 'Generated')+f' {len(generated)} token outputs.');return 0
if __name__=='__main__':raise SystemExit(main())
