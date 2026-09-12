"""Resolve local source dependencies without importing or executing component code."""
from pathlib import Path
import re

def safe_path(root,relative):
 p=(root/relative).resolve()
 if p==root.resolve() or root.resolve() not in p.parents:raise ValueError('Path escapes asset root: '+str(relative))
 return p

def dependency_files(root,starts,skip=()):
 seen=set();queue=list(starts);skip=set(skip)
 while queue:
  rel=queue.pop()
  if rel in seen or rel in skip:continue
  p=safe_path(root,rel)
  if not p.is_file():raise ValueError('Missing dependency: '+rel)
  seen.add(rel)
  if p.suffix not in ['.ts','.js','.vue','.css','.scss']:continue
  text=p.read_text()
  refs=re.findall(r'''(?:from\s*|import\s*)['"]([^'"]+)['"]''',text)+re.findall(r'''<style[^>]+src=['"]([^'"]+)['"]''',text)
  for ref in refs:
   if not ref.startswith('.'):continue
   candidate=p.parent/ref
   choices=[candidate]+[Path(str(candidate)+ext) for ext in ['.ts','.js','.vue','.json','.css','.scss']]+[candidate/('index'+ext) for ext in ['.ts','.js']]
   target=next((f for f in choices if f.is_file()),None)
   if target is None:raise ValueError(f'Unresolved local import {ref} in {rel}')
   target=target.resolve()
   if root.resolve() not in target.parents:raise ValueError('Dependency escapes root')
   queue.append(target.relative_to(root.resolve()).as_posix())
 return sorted(seen)
