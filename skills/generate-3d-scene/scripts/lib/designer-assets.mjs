/** Project-local asset packages. No writes to the skill and no implicit network access. */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, lstatSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, extname, basename, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { CHECKER_VERSION } from './viewer-version.mjs';
import { withFileLock } from './file-lock.mjs';
import { inflateRawSync, crc32 } from 'node:zlib';
import { parseGlb } from '../validate-model.mjs';
import { runtimeCompatibility } from '../../template/scripts/runtime-compatibility.mjs';
import { writeZip } from '../import-assets.mjs';
import { RULES_VERSION, scanForbiddenContent, suggestName, evaluateAsset, assertUsable } from './model-policy.mjs';
const skillRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function outsideSkill(path) {
 const rel=relative(skillRoot,resolve(path));
 if(!rel || (rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('..\\')&&!isAbsolute(rel)))throw new Error('Asset output must be outside the skill directory');
}
export const limits = { files: 10000, totalBytes: 1024*1024*1024, fileBytes: 256*1024*1024 };
export const digest = b => createHash('sha256').update(b).digest('hex');
export const readJSON = p => JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
export function safePath(root, path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || /^[a-z]+:|^\//i.test(path)) throw new Error('Unsafe asset path');
  const out=resolve(root,path), rel=relative(resolve(root),out);
  if (!rel || rel==='..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel)) throw new Error('Asset path escapes root');
  let ancestor=out;
  while(!existsSync(ancestor) && ancestor!==resolve(root)) ancestor=dirname(ancestor);
  if (existsSync(root) && existsSync(ancestor)) {
    const actual=relative(realpathSync(root),realpathSync(ancestor));
    if (actual==='..' || actual.startsWith('..\\') || actual.startsWith('../') || isAbsolute(actual)) throw new Error('Asset link escapes root');
  }
  return out;
}
export function atomicJSON(file,data) {
  mkdirSync(dirname(file),{recursive:true}); const tmp=file+'.'+randomUUID()+'.tmp';
  try { writeFileSync(tmp,JSON.stringify(data,null,2)+'\n'); renameSync(tmp,file); } finally { if(existsSync(tmp)) rmSync(tmp); }
}
function put(files,name,data,cap,state) {
  if (name.endsWith('/')) return;
  if (name.startsWith('/') || name.includes('\\') || name.split('/').some(x=>!x || x==='.' || x==='..') || /[:\0]/.test(name)) throw new Error('Unsafe ZIP entry');
  if (files.has(name.toLowerCase())) throw new Error('Duplicate/case-colliding input path');
  if (data.length>cap.fileBytes || state.bytes+data.length>cap.totalBytes || files.size>=cap.files) throw new Error('Package exceeds configured resource limit');
  state.bytes+=data.length; files.set(name.toLowerCase(),{name,data});
}
export function inputFiles(input,cap=limits) {
  cap={...limits,...cap};
  if(Object.values(cap).some(v=>!Number.isSafeInteger(v)||v<1))throw new Error("Invalid resource limits");
  const files=new Map(), state={bytes:0};
  if(lstatSync(input).isSymbolicLink()) throw new Error('Linked input is not supported');
  if(lstatSync(input).isDirectory()) {
    const walk=(dir,prefix='')=>{for(const e of readdirSync(dir,{withFileTypes:true})) {
      if(e.isSymbolicLink()) throw new Error('Linked package entry is not supported');
      const path=resolve(dir,e.name),name=prefix+e.name;
      if(e.isDirectory()) walk(path,name+'/'); else if(e.isFile()) {
        if(lstatSync(path).size>cap.fileBytes) throw new Error('File exceeds resource limit');
        put(files,name,readFileSync(path),cap,state);
      }
    }}; walk(input);
  } else if(extname(input).toLowerCase()==='.zip') {
    if(lstatSync(input).size>cap.totalBytes) throw new Error('ZIP exceeds resource limit');
    const b=readFileSync(input); let end=-1;
    for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--) if(b.readUInt32LE(i)===0x06054b50 && i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
    if(end<0) throw new Error('Invalid ZIP');
    const count=b.readUInt16LE(end+10); let p=b.readUInt32LE(end+16);
    if(count===65535 || count>cap.files || b.readUInt16LE(end+4) || b.readUInt16LE(end+6)) throw new Error('ZIP64/multi-volume or too many entries');
    for(let n=0;n<count;n++) {
      if(b.readUInt32LE(p)!==0x02014b50) throw new Error('Invalid ZIP directory');
      const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),packed=b.readUInt32LE(p+20),size=b.readUInt32LE(p+24);
      const nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),local=b.readUInt32LE(p+42);
      const name=b.toString('utf8',p+46,p+46+nl),mode=(b.readUInt32LE(p+38)>>>16)&0xf000;
      if(flags&1 || mode===0xa000 || ![0,8].includes(method)) throw new Error('Encrypted/linked/unsupported ZIP entry');
      if(size>cap.fileBytes || state.bytes+size>cap.totalBytes) throw new Error('ZIP expanded size exceeds limit');
      if(b.readUInt32LE(local)!==0x04034b50) throw new Error('Invalid ZIP header');
      const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
      if(start+packed>p || start+packed>b.length) throw new Error('Invalid ZIP bounds');
      const data=method===8?inflateRawSync(b.subarray(start,start+packed),{maxOutputLength:Math.min(cap.fileBytes,cap.totalBytes-state.bytes)+1}):b.subarray(start,start+packed);
      if(data.length!==size || crc32(data)!==b.readUInt32LE(p+16)) throw new Error('ZIP checksum/size mismatch');
      put(files,name,data,cap,state); p+=46+nl+el+cl;
    }
  } else {
    if(lstatSync(input).size>cap.fileBytes) throw new Error('File exceeds limit');
    put(files,basename(input),readFileSync(input),cap,state);
  }
  return [...files.values()];
}
export function inspectEntry(root,entry) {
  const bytes=readFileSync(safePath(root,entry));
  const json=extname(entry).toLowerCase()==='.glb'?parseGlb(bytes).json:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  if(json.asset?.version!=='2.0' || !Array.isArray(json.scenes) || !json.scenes.length) throw new Error('Expected glTF 2.0 with a scene');
  const selectedScene=json.scene??0;
  if(!json.scenes[selectedScene]) throw new Error('Invalid default scene');
  const files=[entry];
  for(const item of [...(json.buffers??[]),...(json.images??[])]) {
    if(!item.uri || item.uri.startsWith('data:')) continue;
    if(/^[a-z]+:|^\/|\\|[?#]/i.test(item.uri)) throw new Error('External/unsupported resource URI; include dependencies in ZIP');
    const file=posix.normalize(posix.join(posix.dirname(entry),decodeURIComponent(item.uri)));
    const path=safePath(root,file); if(!existsSync(path)) throw new Error(`Missing dependency: ${file}`);
    if(!files.includes(file)) files.push(file);
  }
  const compatibility=runtimeCompatibility(json);
  if(compatibility.status==='unsupported') throw new Error(`Unsupported extensions: ${compatibility.missing.join(', ')}`);
  const hash=digest(files.slice().sort().map(f=>f+':'+digest(readFileSync(safePath(root,f)))).join('\n'));
  // Whole-document forbidden content scan (spec \u00A76.1): unreferenced camera/light definitions count too.
  const forbidden=scanForbiddenContent(json);
  // Placement root transform check (spec \u00A75): single scene roots, not internal child nodes.
  const sceneRoots=(json.scenes[selectedScene].nodes??[]).map(i=>json.nodes?.[i]).filter(Boolean);
  const rootTransforms=sceneRoots.length===1?sceneRoots[0]:null;
  return {files,contentHash:hash,selectedScene,sceneCount:json.scenes.length,sceneSelection:json.scene===undefined?'first':'default',compatibility,units:'unverified',meshCount:json.meshes?.length??0,
    forbidden:forbidden.length?forbidden:undefined,rootTransforms,animated:!!json.animations?.length,assetType:'floor',rulesVersion:RULES_VERSION};
}
export function receive(input,out,description='',cap=limits) {
  out=resolve(out); outsideSkill(out); if(existsSync(out)) throw new Error('Package output must be a new directory; existing package is preserved');
  const stage=out+'.stage-'+randomUUID(); mkdirSync(resolve(stage,'files'),{recursive:true});
  try {
    const files=inputFiles(resolve(input),cap);
    for(const f of files){const target=safePath(resolve(stage,'files'),f.name);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,f.data);}
    const assets=[];
    for(const f of files.filter(f=>/\.(glb|gltf|fbx|obj|max|blend)$/i.test(f.name))) {
      const index=assets.length+1;
      const suggested=suggestName(f.name);
      const asset={number:index,origin:'upload',entry:f.name,name:suggested.pending?f.name.replace(/\.(glb|gltf)$/i,''):suggested.name,nameSource:'filename',namePending:suggested.pending,semanticStatus:suggested.pending?'unidentified':'suggested',description:'',descriptionPending:true,technicalStatus:'unchecked',confirmed:false,editability:'整体移动；实际网格/材质编辑粒度待加载检查',assetType:'floor',rulesVersion:RULES_VERSION};
      try {if(!/\.(glb|gltf)$/i.test(f.name))throw new Error('不支持此模型格式，请导出完整 GLB/glTF');Object.assign(asset,inspectEntry(resolve(stage,'files'),f.name),{technicalStatus:'structure_valid'});}
      catch(e){asset.technicalStatus='invalid';asset.error=e.message;asset.files=[f.name];asset.contentHash=digest(f.data);}
      // Materialized identity includes dependencies: equal JSON can reference different geometry/textures.
      asset.id='upload_'+digest(f.name+':'+asset.contentHash).slice(0,24);
      assets.push(asset);
    }
    const used=new Set(assets.flatMap(a=>a.files));
    const pkg={version:1,id:randomUUID(),revision:1,description,assets,unsupportedFiles:files.filter(f=>/\.(fbx|obj|max|blend)$/i.test(f.name)).map(f=>f.name),unassociatedFiles:files.map(f=>f.name).filter(n=>!used.has(n)),confirmation:null};
    atomicJSON(resolve(stage,'package.json'),pkg); renameSync(stage,out); return pkg;
  } catch(e){if(existsSync(stage))rmSync(stage,{recursive:true,force:true});throw e;}
}
export function loadPackage(dir) {const p=readJSON(resolve(dir,'package.json'));if(p.version!==1 || !Array.isArray(p.assets))throw new Error('Invalid package');return p;}
export function verifyContent(dir,a) {
  const actual=inspectEntry(resolve(dir,'files'),a.entry);
  if(actual.contentHash!==a.contentHash) throw new Error(`Asset changed; receive the updated package again: ${a.id}`);
  return actual;
}
/** Shared by page sessions and the controlled backend; never trust a filename as a cache hit. */
export function validPreviewImage(image) {
 if(typeof image!=='string'||image.length>8*1024*1024||!image.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(image))return false;
 const b=Buffer.from(image,'base64');if(b.length<45||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return false;
 let p=8,header=false,data=false;
 while(p+12<=b.length){const size=b.readUInt32BE(p),type=b.toString('ascii',p+4,p+8);if(p+12+size>b.length)return false;
 if(crc32(b.subarray(p+4,p+8+size))!==b.readUInt32BE(p+8+size))return false;
 if(!header){if(type!=='IHDR'||size!==13||!b.readUInt32BE(p+8)||!b.readUInt32BE(p+12)||b.readUInt32BE(p+8)>4096||b.readUInt32BE(p+12)>4096)return false;header=true;}
 if(type==='IDAT')data=true;p+=12+size;if(type==='IEND')return data&&size===0&&p===b.length;
 }return false;
}
export function checkCacheState(dir,a) {
 if(a.technicalStatus==='invalid')return 'invalid';
 try{verifyContent(dir,a);}catch{return 'stale';}
 if(a.technicalStatus!=='loadable')return 'miss';
 if(a.checkerVersion!==CHECKER_VERSION||a.rulesVersion!==RULES_VERSION||!a.thumbnail)return 'miss';
 try{return validPreviewImage(readFileSync(safePath(dir,a.thumbnail)).toString('base64'))?'hit':'miss';}catch{return 'miss';}
}
export function validateCheckPayload(r) {
 if(r.checkerVersion!==CHECKER_VERSION)throw new Error('Checker version mismatch');
 if(typeof r.ok!=='boolean')throw new Error('Invalid result status');
 if(!r.ok)return;
 if(!validPreviewImage(r.image))throw new Error('Invalid preview image');
 for(const key of ['min','max'])if(!Array.isArray(r.bbox?.[key])||r.bbox[key].length!==3||!r.bbox[key].every(Number.isFinite))throw new Error('Invalid measurement');
 if(r.bbox.min.some((v,i)=>v>r.bbox.max[i])||r.bbox.min.every((v,i)=>v===r.bbox.max[i]))throw new Error('Invalid measurement bounds');
 for(const key of ['meshes','triangles'])if(r[key]!==undefined&&(!Number.isSafeInteger(r[key])||r[key]<0))throw new Error('Invalid geometry measurement');
 for(const key of ['nodeCount','drawCalls','textureCount','maxTextureSize'])if(r[key]!==undefined&&(!Number.isSafeInteger(r[key])||r[key]<0))throw new Error('Invalid measurement');
}
const checkSnapshot=a=>JSON.stringify([a.technicalStatus,a.thumbnail,a.error,a.bbox,a.meshCount,a.triangles,a.checkerVersion,a.editability,a.placementViolations,a.budgetWarnings,a.drawCalls,a.nodeCount,a.textureCount,a.maxTextureSize,a.forbidden]);
/** Records a failed check for one asset. Identical state is idempotent; a real change bumps the revision. */
function markCheckFailedUnlocked(dir,assetId,message,status='preview_failed') {
  const pkg=loadPackage(dir);
  const a=pkg.assets.find(x=>x.id===assetId);
  if(!a)throw new Error('Unknown asset for this session');
  const before=checkSnapshot(a);
  a.technicalStatus=status;a.error=String(message).slice(0,600);a.confirmed=false;delete a.thumbnail;delete a.checkerVersion;
  if(checkSnapshot(a)===before)return {changed:false,status:a.technicalStatus};
  pkg.revision++;pkg.confirmation=null;atomicJSON(resolve(dir,'package.json'),pkg);
  return {changed:true,status:a.technicalStatus};
}
/** Writes one browser check result back into the package.
 * Content is re-read from disk so a result produced against an older file cannot be applied.
 * Identical results are idempotent; only a real change bumps the revision and clears confirmation. */
function applyCheckResultUnlocked(dir, {assetId,contentHash,checkerVersion,ok,image,bbox,meshes,triangles,instanced,skinned,error,nodeCount,drawCalls,textureCount,maxTextureSize}) {
  const pkg=loadPackage(dir);
  const a=pkg.assets.find(x=>x.id===assetId);
  if(!a)throw new Error('Unknown asset for this session');
  validateCheckPayload({checkerVersion,ok,image,bbox,meshes,triangles,nodeCount,drawCalls,textureCount,maxTextureSize});
  if(contentHash!==a.contentHash)throw new Error('Result does not match asset content');
  verifyContent(dir,a);
  if(!ok)return markCheckFailedUnlocked(dir,assetId,error);
  const before=checkSnapshot(a);
  const thumbnail=`previews/${a.id}.png`;
  mkdirSync(resolve(dir,'previews'),{recursive:true});
  writeFileSync(safePath(dir,thumbnail),Buffer.from(image,'base64'));
  a.thumbnail=thumbnail;a.bbox=bbox;a.meshCount=meshes;a.triangles=triangles;a.checkerVersion=checkerVersion;
  a.technicalStatus='loadable';delete a.error;
  a.instanced=!!instanced;a.skinned=!!skinned;
  a.editability=instanced?'含实例网格；整体/材质编辑，不保证单实例编排':skinned?'含蒙皮；整体/材质编辑，局部骨骼变换不支持':'整体及已命名网格槽位编辑';
  const measured={triangles,nodeCount,drawCalls,textureCount,maxTextureSize};
  for(const k of Object.keys(measured))if(measured[k]!==undefined)Object.assign(a,{[k]:measured[k]});
  Object.assign(a,evaluateAsset(a));
  a.budgetAck=undefined;
  if(checkSnapshot(a)===before)return {changed:false,status:a.technicalStatus};
  pkg.revision++;pkg.confirmation=null;a.confirmed=false;
  atomicJSON(resolve(dir,'package.json'),pkg);
  return {changed:true,status:a.technicalStatus};
}
export function sceneScope(asset) {
 if(!Number.isInteger(asset.sceneCount))return '未检查';
 if(asset.sceneCount===1)return '单场景；使用第 1 个 scene';
 return `共 ${asset.sceneCount} 个 scene；${asset.sceneSelection==='first'?'未指定默认场景，使用第 1 个':`仅使用默认第 ${asset.selectedScene+1} 个`}（索引 ${asset.selectedScene}），其余不载入`;
}
function describeUnlocked(dir,changes) {
 const pkg=loadPackage(dir);
 for(const change of changes) {
  const a=pkg.assets.find(a=>a.id===change.id);if(!a)throw new Error('Unknown asset ID');
  if(typeof change.name!=='string' || !change.name.trim())throw new Error('Name required');
  a.name=change.name.trim();a.description=String(change.description??'');a.semanticStatus=change.source==='user'?'user_named':'suggested';a.semanticSource=change.source==='user'?'user': 'agent_evidence';
  if(change.source!=='user' && (typeof change.evidence!=='string'||!change.evidence.trim()))throw new Error('Suggestion requires image/metadata evidence');
  a.semanticEvidence=change.source==='user'?'User correction':change.evidence;a.confirmed=false;
 }
 pkg.revision++;pkg.confirmation=null;atomicJSON(resolve(dir,'package.json'),pkg);return pkg;
}
function confirmUnlocked(dir,revision,{allowPartial=false,confirmFront=false,confirmScale=false}={}) {
 const pkg=loadPackage(dir); if(pkg.revision!==revision)throw new Error('Stale review revision');
 const failed=pkg.assets.filter(a=>a.technicalStatus!=='loadable');
 const blocked=pkg.assets.filter(a=>a.technicalStatus==='loadable'&&(a.forbidden||a.placementViolations?.length));
 for(const a of pkg.assets)if(a.technicalStatus==='loadable'&&checkCacheState(dir,a)!=='hit')throw new Error('Asset check cache is no longer valid; reopen preview before confirming');
 if(!pkg.assets.some(a=>a.technicalStatus==='loadable'))throw new Error('No usable assets to confirm');
 if(blocked.length)throw new Error(`相机/灯光或坐标规范违规不能确认使用：${blocked.map(a=>a.name).join('、')}（需整改后重新导出）`);
 if(failed.length && !allowPartial)throw new Error('Some assets are not loadable; explicitly confirm the usable subset');
 for(const a of pkg.assets) {if(a.technicalStatus==='loadable'){verifyContent(dir,a);if(confirmFront)a.frontConfirmed=true;if(confirmScale)a.scaleConfirmed=true;Object.assign(a,assertUsable(a,{semantic:a.origin!=='remote'}));a.confirmed=true;}}
 pkg.confirmation={revision,usable:pkg.assets.filter(a=>a.confirmed).map(a=>a.id),excluded:failed.map(a=>a.id)};
 atomicJSON(resolve(dir,'package.json'),pkg);return pkg;
}
export function selected(dir,ids) {
 const pkg=loadPackage(dir);if(!pkg.confirmation || pkg.confirmation.revision!==pkg.revision)throw new Error('Package needs user confirmation');
 const wanted=ids??pkg.confirmation.usable;if(!wanted.length)throw new Error('No usable assets selected');
 return wanted.map(id=>{const a=pkg.assets.find(a=>a.id===id);if(!a?.confirmed || a.technicalStatus!=='loadable')throw new Error('Asset not confirmed/loadable');
  Object.assign(a,assertUsable(a,{semantic:a.origin!=='remote'}));
  verifyContent(dir,a);if(checkCacheState(dir,a)!=='hit')throw new Error('Asset check cache is no longer valid; reopen preview');return a;});
}
export function inject(dir,project,ids) {
 outsideSkill(project);
 const assets=selected(dir,ids), target=resolve(project,'public/assets'), manifestPath=resolve(target,'asset-manifest.json');
 const manifest=existsSync(manifestPath)?readJSON(manifestPath):{};
 for(const a of assets) {
  const key=`models/packages/${a.id}_${a.contentHash.slice(0,12)}`;
  if(manifest[a.id] && manifest[a.id].model!==key+'/'+a.entry)throw new Error(`Asset ID conflict: ${a.id}`);
  for(const f of a.files){const to=safePath(target,key+'/'+f);mkdirSync(dirname(to),{recursive:true});writeFileSync(to,readFileSync(safePath(resolve(dir,'files'),f)));}
  manifest[a.id]={model:key+'/'+a.entry,format:extname(a.entry).slice(1).toLowerCase()};
 }
 atomicJSON(manifestPath,manifest);return assets.map(a=>({id:a.id,name:a.name,group:'asset',params:{assetId:a.id}}));
}
export function exportPackage(dir,out,config) {
 outsideSkill(out);
 if(extname(out).toLowerCase()!=='.zip')throw new Error('Export output must be a ZIP');
 if(!Number.isInteger(config.source_id) || config.source_id<1)throw new Error('Configure a positive source_id');
 if(config.group_id!==undefined && (!Number.isInteger(config.group_id)||config.group_id<1))throw new Error('Invalid group_id');
 const assets=selected(dir,config.ids),entries=[],data=[];
 const pkg=loadPackage(dir);
 for(const a of assets){
  for(const f of a.files)entries.push({name:`data/${a.id}/${f}`,data:readFileSync(safePath(resolve(dir,'files'),f))});
  const thumbnail=a.thumbnail?`image/${a.id}.png`:undefined;
  if(thumbnail)entries.push({name:thumbnail,data:readFileSync(safePath(dir,a.thumbnail))});
  // raw_data whitelist (spec §4.1): bbox/triangles/draw_calls/node_count/texture_count/max_texture_size
  // Missing values stay null; private identities never leave the package.
  const raw={
    bbox:(a.bbox&&Array.isArray(a.bbox.min)&&Array.isArray(a.bbox.max))?{min:a.bbox.min,max:a.bbox.max}:null,
    triangles:a.triangles??null,draw_calls:a.drawCalls??null,node_count:a.nodeCount??null,
    texture_count:a.textureCount??null,max_texture_size:a.maxTextureSize??null};
  data.push({name:a.name,file_name:basename(a.entry),file_path:`data/${a.id}/${a.entry}`,...(thumbnail?{thumbnail_path:thumbnail}:{}),description:a.description,tags:config.tags??[],search_text:[pkg.description,a.name,a.description].join(' '),raw_data:raw});
 }
 entries.push({name:'config.json',data:Buffer.from(JSON.stringify({meta:{type:'file',source_id:config.source_id,...(config.group_id?{group_id:config.group_id}:{})},data},null,2))});
 mkdirSync(dirname(resolve(out)),{recursive:true});const temp=resolve(out)+'.'+randomUUID()+'.tmp';
 try{writeZip(entries,temp);renameSync(temp,resolve(out));}finally{if(existsSync(temp))rmSync(temp);}
 return {status:'ready_for_manual_upload',path:resolve(out),count:data.length,excluded:pkg.confirmation.excluded};
}
export async function uploadAdapter(_zipPath,_target,_authContext) {return {status:'not_configured',message:'入库包已生成，可前往内网上传'};}

export function markCheckFailed(dir,assetId,message,status='preview_failed'){return withFileLock(resolve(dir,".package-write.lock"),()=>markCheckFailedUnlocked(dir,assetId,message,status));}

export function applyCheckResult(dir, result){return withFileLock(resolve(dir,".package-write.lock"),()=>applyCheckResultUnlocked(dir,result));}

export function describe(dir,changes){return withFileLock(resolve(dir,".package-write.lock"),()=>describeUnlocked(dir,changes));}

export function confirm(dir,revision,options={} ){return withFileLock(resolve(dir,".package-write.lock"),()=>confirmUnlocked(dir,revision,options));}
