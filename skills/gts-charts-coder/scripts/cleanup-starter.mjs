#!/usr/bin/env node
// Remove only exact, unreferenced starter files. Any edited content is retained.
import fs from 'node:fs';
import path from 'node:path';
import {scripts,walkFiles,compilerRequire,dependencies,resolveSource} from './source-tools.mjs';
const args=process.argv.slice(2),i=args.findIndex(a=>a==='--dir'||a==='-d');
try{
  if(i<0||!args[i+1])throw Error('Usage: node cleanup-starter.mjs --dir "<project>"');
  const root=path.resolve(args[i+1]),src=path.join(root,'src');if(!fs.existsSync(src))throw Error('src missing');
  const files=walkFiles(src),keys=Object.fromEntries(files.map(f=>['/src/'+path.relative(src,f).split(path.sep).join('/'),f]));
  const candidate=new Set(),warnings=new Set(),sfc=compilerRequire()('@vue/compiler-sfc');
  const normal=s=>s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  for(const rel of ['api/demo.js','api/mock/demo-data.js']){
    const key='/src/'+rel,file=path.join(src,rel);if(!fs.existsSync(file))continue;
    if(fs.lstatSync(file).isSymbolicLink()||fs.realpathSync(file)!==path.resolve(file)){warnings.add(rel+': symbolic link retained');continue;}
    if(normal(fs.readFileSync(file,'utf8'))===normal(fs.readFileSync(path.join(scripts,'preview/src',rel),'utf8')))candidate.add(key);else warnings.add(rel+': edited file retained');
  }
  const edges=[];let dynamic=false;
  for(const file of files.filter(f=>/\.(vue|m?js)$/.test(f))){const key='/src/'+path.relative(src,file).split(path.sep).join('/');let source=fs.readFileSync(file,'utf8'),ast;
    if(file.endsWith('.vue')){const p=sfc.parse(source,{filename:file});if(p.errors.length)throw Error('Cannot safely inspect '+key);const d=p.descriptor;source=[d.script?.content,d.scriptSetup?.content].filter(Boolean).join('\n');}
    ast=sfc.babelParse(source,{sourceType:'module'}).program;
    for(const dep of dependencies(ast)){if(typeof dep.spec!=='string'){dynamic=true;continue;}const target=resolveSource(dep.spec,key,keys);if(target)edges.push([key,target]);}
  }
  // Fixed point: a retained service keeps its imported mock too.
  let changed=true;while(changed){changed=false;for(const [from,to]of edges)if(candidate.has(to)&&!candidate.has(from)){candidate.delete(to);warnings.add(to+': still referenced by '+from);changed=true;}}
  if(dynamic){for(const name of candidate)warnings.add(name+': nonliteral dynamic import prevents safe cleanup');candidate.clear();}
  for(const key of candidate){const file=keys[key];if(!file||!file.startsWith(src+path.sep))throw Error('Cleanup target escapes src');fs.unlinkSync(file);}
  console.log('RESULT: OK\nCLEANED: '+candidate.size+', WARNED: '+warnings.size);for(const w of warnings)console.log('WARN: '+w);
}catch(e){console.log('RESULT: FAIL | '+e.message);process.exitCode=1;}
