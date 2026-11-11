import {readFile, lstat} from 'node:fs/promises';
import {resolve, relative, sep, dirname} from 'node:path';
import {build} from 'vite';

// Inspect Rollup's resolved graph, not textual import matching. No project config runs.
export async function collectComponent(root) {
  root=resolve(root);
  const files={};
  async function read(path) {
    if(typeof path!=='string'||path.includes('\\')||path.startsWith('/')||path.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe component path: '+path);
    let full=resolve(root,path);
    if(!full.startsWith(root+sep))throw Error('Outside component project');
    for(let p=full;;p=dirname(p)) {if((await lstat(p)).isSymbolicLink())throw Error('Linked component input: '+path);if(p===root)break;}
    files[path]=await readFile(full);return files[path];
  }
  const boundary=JSON.parse(await read('component-boundary.json'));
  if(boundary.formatVersion!==1||!boundary.entry?.startsWith('component/')||!boundary.schema?.startsWith('component/'))throw Error('Invalid component boundary entries');
  for(const key of ['purpose','hostContract'])if(typeof boundary[key]!=='string'||!boundary[key].trim())throw Error('Missing boundary '+key);
  for(const key of ['owns','borrows','assets'])if(!Array.isArray(boundary[key])||boundary[key].some(x=>typeof x!=='string'||!x.trim()))throw Error('Invalid boundary '+key);
  const modules=new Set();
  const allowed=path=>(path.startsWith('component/')&&path!=='component/delivery.mjs')||path.startsWith('vendor/');
  function visit(node) {
    if(!node||typeof node!=='object')return;
    if(node.type==='ImportExpression')throw Error('Dynamic component imports require an explicit packaging adapter');
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  }
  await build({root,configFile:false,logLevel:'silent',plugins:[{
    name:'component-boundary',enforce:'pre',
    async load(id) {
      const path=relative(root,id).split(sep).join('/');
      if(!allowed(path)||id.includes('?')||! /\.(mjs|js|json)$/.test(path))throw Error('Component depends on demo or unsupported module: '+path);
      await read(path);modules.add(path);return null;
    },
    moduleParsed(info){visit(info.ast);}
  }],build:{write:false,minify:false,target:'esnext',rollupOptions:{input:[resolve(root,boundary.entry),resolve(root,boundary.schema)],onwarn(w){throw Error(w.message);},preserveEntrySignatures:'strict'}}});
  for(const path of boundary.assets){if(!path.startsWith('assets/'))throw Error('Component assets must be under assets/');await read(path);}
  for(const path of ['preset.json','controls.json','sources.json'])await read(path);
  // The template uses vendored Three; retain its redistribution license.
  if([...modules].some(p=>p.startsWith('vendor/three.')))await read('vendor/LICENSE');
  return {files,boundary};
}
