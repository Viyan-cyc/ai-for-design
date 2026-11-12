import {build} from 'vite';
import {readFile,writeFile,rename,lstat} from 'node:fs/promises';
import {dirname,resolve,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=basename(root)==='source'?dirname(root):root;
for(let p=output;;p=dirname(p)){if((await lstat(p)).isSymbolicLink())throw Error('Linked output refused');if(dirname(p)===p)break;}
const result=await build({root,configFile:false,logLevel:'warn',build:{write:false,target:'esnext',minify:false,sourcemap:false,lib:{entry:join(root,'example/main.mjs'),formats:['es']},rollupOptions:{output:{inlineDynamicImports:true}}}});
const outputs=(Array.isArray(result)?result:[result]).flatMap(x=>x.output),chunks=outputs.filter(x=>x.type==='chunk');
if(chunks.length!==1||chunks[0].imports.length||chunks[0].dynamicImports.length||outputs.some(x=>x.type!=='chunk'))throw Error('Preview requires one fully embedded module; external chunks/assets unsupported');
let html=await readFile(join(root,'example/index.html'),'utf8');
const entry=/<script\s+type="module"\s+src="main\.mjs"><\/script>/;
if(!entry.test(html))throw Error('Expected example module entry');
// Keep nested candidate HTML and script text opaque to host HTML rewriting.
const payload=Buffer.from(chunks[0].code,'utf8').toString('base64');
html=html.replace(entry,()=>`<script>(async()=>{let url;try{const bytes=Uint8Array.from(atob('${payload}'),c=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));await import(url);}catch(error){document.getElementById('status').textContent='启动失败：'+error.message;console.error(error);}finally{if(url)URL.revokeObjectURL(url);}})();</script>`);

const path=join(output,'index.3d.html'),temp=path+'.tmp';await writeFile(temp,html);await rename(temp,path);
if(output!==root)await writeFile(join(output,'index.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=index.3d.html"><a href="index.3d.html">打开组件预览</a>');
console.log('HTML_PATH='+path);console.log('WORKSPACE_PATH='+root);
