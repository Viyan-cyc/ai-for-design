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
  var candidates=[target,target+'.vue',target+'.js',target+'.mjs',target+'.css',target+'.less',target+'.json',target+'/index.vue',target+'/index.js',target+'/index.mjs'];
  return candidates.find(function(p){return Object.prototype.hasOwnProperty.call(keys,p);})||null;
}
export function walkFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name.startsWith('.')||e.name==='node_modules'||e.isSymbolicLink()?[]:e.isDirectory()?walkFiles(path.join(dir,e.name)):[path.join(dir,e.name)]);}
export function visitAST(node,fn){if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>visitAST(n,fn));else if(value&&typeof value==='object')visitAST(value,fn);}
export function dependencies(ast){const out=[];visitAST(ast,n=>{
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(n.type)&&n.source)out.push({spec:n.source.value,node:n});
  if(n.type==='ImportExpression')out.push({spec:n.source?.value,node:n,dynamic:true});
  if(n.type==='CallExpression'&&n.callee?.type==='Import')out.push({spec:n.arguments[0]?.value,node:n,dynamic:true});
});return out;}
export function iconImports(src,sfc){
  const result=[];for(const file of walkFiles(src).filter(f=>/\.(vue|m?js)$/.test(f)&&!f.startsWith(path.join(src,'assets/icons')+path.sep))){
    const text=fs.readFileSync(file,'utf8');let ast;
    if(file.endsWith('.vue')){const {descriptor:d,errors}=sfc.parse(text,{filename:file});if(errors.length)throw Error(file+': '+errors.map(String).join('; '));if(!d.script&&!d.scriptSetup)continue;const c=sfc.compileScript(d,{id:'icon-scan'});ast=[...(c.scriptAst||[]),...(c.scriptSetupAst||[])];}
    else ast=sfc.babelParse(text,{sourceType:'module'}).program;
    for(const dep of dependencies(ast)){
      const spec=dep.spec;if(typeof spec!=='string')continue;
      const bridge=spec.startsWith('.')&&path.resolve(path.dirname(file),spec)===path.join(src,'assets/icons/entry.js');
      if(spec!=='@element-plus/icons-vue'&&!bridge)continue;
      if(file===path.join(src,'main.js')&&dep.node.type==='ImportDeclaration'&&dep.node.specifiers.every(n=>n.type==='ImportNamespaceSpecifier'))continue;
      if(dep.node.type!=='ImportDeclaration'||dep.node.specifiers.some(n=>n.type!=='ImportSpecifier'))throw Error(file+': icons require named static imports');
      result.push({file,text,node:dep.node,names:dep.node.specifiers.map(n=>n.imported.name||n.imported.value)});
    }
  }return result;
}
export function wireIcons(src,sfc,names){
  const imports=iconImports(src,sfc),dir=path.join(src,'assets/icons');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'entry.js'),"// Generated company overrides; missing names retain original EP exports.\nexport * from '@element-plus/icons-vue'\n"+(names.length?"export { "+names.join(', ')+" } from './index.js'\n":""));
  const edits=new Map(imports.map(entry=>[entry.file,entry.text]));
  for(const [file,text]of edits){
    function rewrite(source){const ast=sfc.babelParse(source,{sourceType:'module'}).program;let result=source;const nodes=ast.body.filter(n=>n.type==='ImportDeclaration'&&(n.source.value==='@element-plus/icons-vue'||(n.source.value.startsWith('.')&&path.resolve(path.dirname(file),n.source.value)===path.join(dir,'entry.js'))));for(const n of nodes.reverse()){let rel=path.relative(path.dirname(file),path.join(dir,'entry.js')).split(path.sep).join('/');if(!rel.startsWith('.'))rel='./'+rel;result=result.slice(0,n.source.start)+JSON.stringify(rel)+result.slice(n.source.end);}return result;}
    let result=text;if(file.endsWith('.vue')){const {descriptor:d}=sfc.parse(text,{filename:file});for(const block of [d.script,d.scriptSetup].filter(Boolean).sort((a,b)=>b.loc.start.offset-a.loc.start.offset))result=result.slice(0,block.loc.start.offset)+rewrite(block.content)+result.slice(block.loc.end.offset);}else result=rewrite(text);
    if(result!==text)fs.writeFileSync(file,result);
  }
}
