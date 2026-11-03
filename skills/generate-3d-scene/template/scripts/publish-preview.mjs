import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,unlinkSync,renameSync} from 'node:fs';
import {resolve,join,dirname,relative} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const manifestName='preview/.scene3d-preview-baseline.json';
const hash=data=>createHash('sha256').update(data).digest('hex');
function safe(path) {
 for(let p=resolve(path);;p=dirname(p)) {
  let st;try{st=lstatSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(st?.isSymbolicLink()||(p!==resolve(path)&&st&&!st.isDirectory()))throw new Error(`预览路径不安全: ${p}`);
  if(p===dirname(p))break;
 }
}
export function publishPreview(root,out) {
 if(resolve(root)!==resolve(out,'source'))throw new Error('原位发布要求工程位于交付目录 source');
 const files=new Map(),offline=join(root,'offline');
 function walk(dir) {
  for(const name of readdirSync(dir)) {
   const path=join(dir,name),st=lstatSync(path),key=relative(offline,path).replaceAll('\\','/');
   if(st.isSymbolicLink())throw new Error(`预览输入不支持链接: ${path}`);
   if(st.isDirectory())walk(path);
   else if(st.isFile()&&!['.scene3d-offline','index.3d.html'].includes(key))files.set('preview/'+key,readFileSync(path));
  }
 }
 walk(offline);
 files.set('index.3d.html',Buffer.from(readFileSync(join(offline,'index.3d.html'),'utf8').replace(/((?:src|href)=["'])\.\//g,'$1./preview/')));
 if(files.has(manifestName))throw new Error('预览输入不能包含发布基线');
 const manifestPath=join(out,manifestName);safe(manifestPath);
 let previous={};
 if(existsSync(manifestPath)) {
  const baseline=JSON.parse(readFileSync(manifestPath,'utf8'));
  if(baseline.version!==1||!baseline.files||typeof baseline.files!=='object'||Array.isArray(baseline.files)||!Object.hasOwn(baseline.files,'index.3d.html'))throw new Error('预览基线无效');
  previous=baseline.files;
  for(const [key,value] of Object.entries(previous)) {
   if((key!=='index.3d.html'&&!key.startsWith('preview/'))||key===manifestName||key.includes('\\')||key.includes(':')||key.split('/').some(x=>!x||x==='.'||x==='..')||typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new Error('预览基线条目无效');
  }
 }
 const keys=new Set([...Object.keys(previous),...files.keys()]);
 for(const key of keys) {
  const path=join(out,key);safe(path);
  if(Object.hasOwn(previous,key)) {
   if(!existsSync(path)||!lstatSync(path).isFile()||hash(readFileSync(path))!==previous[key])throw new Error(`预览文件已修改或删除: ${key}`);
  } else if(existsSync(path))throw new Error(`预览目标存在非管理内容: ${key}`);
 }
 const next={version:1,files:Object.fromEntries([...files].map(([key,data])=>[key,hash(data)]))};
 files.set(manifestName,Buffer.from(JSON.stringify(next,null,2)+'\n'));keys.add(manifestName);
 const originals=new Map([...keys].map(key=>[key,existsSync(join(out,key))?readFileSync(join(out,key)):null]));
 const temps=new Map(),changed=[];
 try {
  for(const [key,data] of files) {
   const path=join(out,key);mkdirSync(dirname(path),{recursive:true});
   const temp=path+'.'+randomUUID()+'.tmp';temps.set(key,temp);writeFileSync(temp,data,{flag:'wx'});
  }
  // Only owned output files are updated; source, history and attachments are never replaced.
  for(const key of keys) {
   const path=join(out,key);changed.push(key);
   if(files.has(key))renameSync(temps.get(key),path);
   else unlinkSync(path);
  }
 } catch(error) {
  for(const key of changed.reverse()) {
   const path=join(out,key),data=originals.get(key);
   if(data===null){if(existsSync(path))unlinkSync(path);}else writeFileSync(path,data);
  }
  throw error;
 } finally {for(const path of temps.values())if(existsSync(path))unlinkSync(path);}
 return join(out,'index.3d.html');
}
