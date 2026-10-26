import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
export const scripts=path.dirname(fileURLToPath(import.meta.url));
export const skill=path.dirname(scripts);
export const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
export function optionsOf(args=process.argv.slice(2)){
  const out={};for(let i=0;i<args.length;i++){
    const m=/^--([^=]+)(?:=(.*))?$/.exec(args[i]);
    if(!m)throw new Error('Expected --option value: '+args[i]);
    out[m[1]]=m[2]??args[++i];if(!out[m[1]]||out[m[1]].startsWith('--'))throw new Error('Missing --'+m[1]);
  }return out;
}
export function compilerRequire(){
  const cfg=readJSON(path.join(skill,'references','env-config.json'));
  const base=process.platform==='win32'?(process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE,'AppData','Local')):process.platform==='darwin'?path.join(process.env.HOME,'Library','Application Support'):(process.env.XDG_DATA_HOME||path.join(process.env.HOME,'.local','share'));
  return createRequire(path.join(process.env[cfg.envDirEnvVar]||path.join(base,cfg.envDirName),'compiler','package.json'));
}
export function packageAt(project,name){
  const req=createRequire(path.join(path.resolve(project),'package.json'));
  const entry=req.resolve(name);
  let dir=path.dirname(entry);
  while(dir!==path.dirname(dir)){
    const p=path.join(dir,'package.json');
    if(fs.existsSync(p)){const json=readJSON(p);if(json.name===name){const esm=typeof json.module==='string'?path.resolve(dir,json.module):null;return {dir,entry:esm&&fs.existsSync(esm)?esm:entry,info:json,require:createRequire(p)};}}
    dir=path.dirname(dir);
  }throw new Error('Cannot find installed package '+name+' from '+project);
}
export function exportsFromUMD(source,parse){
  const tree=parse(source,{sourceType:'script'}).program;
  let factory;
  function find(n){if(!n||typeof n!=='object'||factory)return;if(n.type==='CallExpression'){const funcs=n.arguments.filter(x=>['FunctionExpression','ArrowFunctionExpression'].includes(x.type));const f=funcs.at(-1);if(f?.params?.[0]?.type==='Identifier')factory=f;}if(!factory)for(const x of Object.values(n))if(Array.isArray(x))x.forEach(find);else find(x);}
  find(tree);if(!factory)throw new Error('Unrecognized UMD wrapper; provide the actual compatible distribution');
  const alias=factory.params[0].name,names=new Set();
  function walk(n){if(!n||typeof n!=='object')return;
    if(['FunctionExpression','FunctionDeclaration','ArrowFunctionExpression','ClassDeclaration','ClassExpression'].includes(n.type))return;
    if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.name===alias){const p=n.left.computed?n.left.property.value:n.left.property.name;if(typeof p==='string')names.add(p);}
    if(n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='Object'&&n.callee.property.name==='defineProperty'&&n.arguments[0]?.name===alias&&typeof n.arguments[1]?.value==='string')names.add(n.arguments[1].value);
    for(const value of Object.values(n))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
  }walk(factory.body);
  if(!names.size)throw new Error('No actual UMD exports extracted; refusing an invented export list');
  return [...names].filter(x=>x!=='__esModule').sort();
}

export function readWhitelist(file){
  const values=readJSON(file);
  if(!Array.isArray(values)||!values.length||values.some(x=>typeof x!=='string'||!x.trim())||new Set(values).size!==values.length)throw new Error('Expected a nonempty unique JSON string array: '+file);
  return values;
}
export function allowedNativeIcons(css){
  const allowed=readWhitelist(path.join(scripts,'verify','whitelists','sweetui-icons.json'));
  if(allowed.some(x=>!/^sweetui-icon-[a-z0-9-]+$/.test(x)))throw new Error('Invalid allowed common icon class');
  const present=new Set([...css.matchAll(/\.(sweetui-icon-[a-z0-9-]+)(?![a-z0-9-])/g)].map(m=>m[1]));
  const missing=allowed.filter(x=>!present.has(x));
  if(missing.length)throw new Error('Allowed common icons missing from actual CSS: '+missing.join(', '));
  return allowed;
}
