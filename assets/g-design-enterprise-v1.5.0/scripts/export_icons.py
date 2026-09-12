#!/usr/bin/env python3
"""Export Lucide SVGs offline from canonical nodes, retaining upstream attribution."""
import argparse,json,xml.etree.ElementTree as ET
from pathlib import Path
from functools import lru_cache
ROOT=Path(__file__).resolve().parents[1]/'frontend/element-plus'
@lru_cache(maxsize=1)
def registry():
 return json.loads((ROOT/'src/icons/icon-nodes.json').read_text()),json.loads((ROOT/'src/icons/icon-aliases.json').read_text())
def svg(name):
 nodes,aliases=registry();key=aliases.get(name,name)
 if key not in nodes:raise ValueError('Unknown icon: '+name)
 root=ET.Element('svg',{'xmlns':'http://www.w3.org/2000/svg','width':'24','height':'24','viewBox':'0 0 24 24','fill':'none','stroke':'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round'})
 for tag,attrs in nodes[key]:ET.SubElement(root,tag,{k:str(v) for k,v in attrs.items()})
 return '<!-- @license lucide-static v1.43.0 - ISC -->\n'+ET.tostring(root,encoding='unicode')+'\n'
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('name',nargs='?');p.add_argument('output',type=Path);p.add_argument('--all',action='store_true');a=p.parse_args()
 if a.all:
  nodes,aliases=registry();names=sorted(set(nodes)|{n for n in aliases if n.isascii()});a.output.mkdir(parents=True,exist_ok=True)
  for name in names:(a.output/(name+'.svg')).write_text(svg(name))
 else:
  if not a.name:p.error('Provide NAME OUTPUT.svg, or --all OUTPUT_DIR')
  a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(svg(a.name))
if __name__=='__main__':main()
