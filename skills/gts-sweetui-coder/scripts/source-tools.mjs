import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
export const scripts=path.dirname(fileURLToPath(import.meta.url));
export function compilerRequire(){
  const cfg=JSON.parse(fs.readFileSync(path.join(scripts,'../references/env-config.json'),'utf8'));
  const base=process.platform==='win32'?(process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE,'AppData/Local')):process.platform==='darwin'?path.join(process.env.HOME,'Library/Application Support'):(process.env.XDG_DATA_HOME||path.join(process.env.HOME,'.local/share'));
  return createRequire(path.join(process.env[cfg.envDirEnvVar]||path.join(base,cfg.envDirName),'compiler/package.json'));
}
// Self-contained: this exact function is also embedded in preview-data.js.
export function resolveSource(spec,from,keys){
  var clean=String(spec).split(/[?#]/)[0].replace(/\\/g,'/');
  if(clean[0]!=='.'&&clean[0]!=='/')return null;
  var full=clean[0]==='/'?clean:(from.slice(0,from.lastIndexOf('/')+1)+clean),parts=[];
  for(var part of full.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)return null;parts.pop();}else parts.push(part);}
  var target='/'+parts.join('/');if(!target.startsWith('/src/'))return null;
  var candidates=[target,target+'.vue',target+'.js',target+'.mjs',target+'.css',target+'.json',target+'/index.vue',target+'/index.js',target+'/index.mjs'];
  return candidates.find(function(p){return Object.prototype.hasOwnProperty.call(keys,p);})||null;
}
export function walkFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')||e.name==='node_modules'||e.isSymbolicLink()?[]:e.isDirectory()?walkFiles(path.join(dir,e.name)):[path.join(dir,e.name)]);}
export function visitAST(node,fn){if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>visitAST(n,fn));else if(value&&typeof value==='object')visitAST(value,fn);}
export function dependencies(ast){const out=[];visitAST(ast,n=>{
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.source)out.push({spec:n.source.value,node:n});
  if(n.type==='ImportExpression')out.push({spec:n.source?.value,node:n,dynamic:true});
  if(n.type==='CallExpression'&&n.callee?.type==='Import')out.push({spec:n.arguments[0]?.value,node:n,dynamic:true});
});return out;}
