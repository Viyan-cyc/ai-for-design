import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';

// Check original TypeScript, before any type-only dependencies are erased.
export async function checkTypeClosure(ts,root,sourceFiles){
 const sources=new Set(sourceFiles.filter(p=>p.endsWith('.ts')).map(p=>resolve(root,p)));
 function dependency(from,name){
  if(typeof name!=='string'||!name)throw Error('Unsupported TypeScript dependency');
  if(name==='three'||name.startsWith('three/')){if(name.split('/').some(x=>!x||x==='.'||x==='..')||/[\\?#%]/.test(name))throw Error('Unsafe TypeScript peer path: '+name);return;}
  if(!name.startsWith('./')&&!name.startsWith('../'))throw Error('Undeclared TypeScript dependency: '+name);
  const target=resolve(dirname(from),name);
  const candidates=[target,target+'.ts',target+'.d.ts',join(target,'index.ts'),join(target,'index.d.ts')];
  if(name.endsWith('.js'))candidates.push(target.slice(0,-3)+'.ts',target.slice(0,-3)+'.d.ts');
  if(!candidates.some(p=>sources.has(p)))throw Error('TypeScript dependency outside component source: '+name);
 }
 for(const path of sources){
  const source=ts.createSourceFile(path,await readFile(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  for(const ref of source.referencedFiles)dependency(path,ref.fileName.startsWith('.')?ref.fileName:'./'+ref.fileName);
  for(const ref of source.typeReferenceDirectives)if(ref.fileName!=='three')throw Error('Undeclared TypeScript types reference: '+ref.fileName);
  function visit(node){
   if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){if(node.moduleSpecifier){if(!ts.isStringLiteral(node.moduleSpecifier))throw Error('Unsupported TS module reference');dependency(path,node.moduleSpecifier.text);}}
   if(ts.isImportTypeNode(node)){if(!ts.isLiteralTypeNode(node.argument)||!ts.isStringLiteral(node.argument.literal))throw Error('Unsupported TS import type');dependency(path,node.argument.literal.text);}
   if(ts.isImportEqualsDeclaration(node)&&ts.isExternalModuleReference(node.moduleReference)){const x=node.moduleReference.expression;if(!x||!ts.isStringLiteral(x))throw Error('Unsupported TS import equals');dependency(path,x.text);}
   if(ts.isModuleDeclaration(node)&&ts.isStringLiteral(node.name))dependency(path,node.name.text);
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
}
