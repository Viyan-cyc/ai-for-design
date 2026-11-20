import {existsSync,lstatSync,readdirSync,readFileSync,writeFileSync,mkdirSync,unlinkSync,renameSync,rmdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const manifestName='.scene3d-preview-baseline.json';
const legacyManifestName='preview/.scene3d-preview-baseline.json';
const flatOutput=key=>/^(?:index\.3d\.html|scene(?:-data)?\.js|[\w.-]+\.css)$/.test(key);
export const externalInputVersion = 1;
const hash=data=>createHash('sha256').update(data).digest('hex');
function safe(path) {
 for(let p=resolve(path);;p=dirname(p)) {
  let st;try{st=lstatSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(st?.isSymbolicLink()||(p!==resolve(path)&&st&&!st.isDirectory()))throw new Error(`预览路径不安全: ${p}`);
  if(p===dirname(p))break;
 }
}
export function publishPreview(root,out,offline=join(root,'offline')) {
 if(resolve(root)!==resolve(out,'source'))throw new Error('原位发布要求工程位于交付目录 source');
 const files=new Map();
 for(const key of readdirSync(offline)) {
  const path=join(offline,key);
  if(!lstatSync(path).isFile())throw new Error(`预览输出必须为同层普通文件: ${key}`);
  if(key==='.scene3d-offline')continue;
  if(!flatOutput(key))throw new Error(`未知预览输出: ${key}`);
  files.set(key,readFileSync(path));
 }
 if(!files.has('index.3d.html'))throw new Error('缺少预览入口');
 const manifestPath=join(out,manifestName),legacyPath=join(out,legacyManifestName);
 safe(manifestPath);
 const migrate=!existsSync(manifestPath)&&existsSync(legacyPath);
 if(migrate)safe(legacyPath);
 const baselinePath=migrate?legacyPath:manifestPath;
 let previous={};
 if(existsSync(baselinePath)) {
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
  if(baseline.version!==(migrate?1:2)||!baseline.files||typeof baseline.files!=='object'||Array.isArray(baseline.files)||!Object.hasOwn(baseline.files,'index.3d.html'))throw new Error('预览基线无效');
  previous=baseline.files;
  for(const [key,value] of Object.entries(previous)) {
   const valid=key==='index.3d.html'||(migrate?key.startsWith('preview/')&&flatOutput(key.slice(8)):flatOutput(key));
   if(!valid||typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw new Error('预览基线条目无效');
  }
 }
 const keys=new Set([...Object.keys(previous),...files.keys()]);
 for(const key of keys) {
  const path=join(out,key);safe(path);
  if(Object.hasOwn(previous,key)) {
   if(!existsSync(path)||!lstatSync(path).isFile()||hash(readFileSync(path))!==previous[key])throw new Error(`预览文件已修改或删除: ${key}`);
  } else if(existsSync(path))throw new Error(`预览目标存在非管理内容: ${key}`);
 }
 const next={version:2,files:Object.fromEntries([...files].map(([key,data])=>[key,hash(data)]))};
 files.set(manifestName,Buffer.from(JSON.stringify(next,null,2)+'\n'));keys.add(manifestName);
 if(migrate)keys.add(legacyManifestName);
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
 if(migrate&&readdirSync(join(out,'preview')).length===0)rmdirSync(join(out,'preview'));
 return join(out,'index.3d.html');
}
