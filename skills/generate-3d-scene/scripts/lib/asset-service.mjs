/** Internal service adapter. */
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, posix, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseGlb } from '../validate-model.mjs';
import { receive, outsideSkill, safePath, atomicJSON, loadPackage, readJSON, limits } from './designer-assets.mjs';

const DEFAULT_TOKEN = 'octo_vs_5e2ef6429611ff3c39efc7cddf86d035';
const DEFAULT_CONFIG = {
  endpoint: 'https://octo.hdesign.huawei.com/lib-resource-service/api/vector/search',
  filters: { source_id: 16, group_id: 972 },
  allowedOrigins: ['https://octo.hdesign.huawei.com'],
  authOrigins: ['https://octo.hdesign.huawei.com'],
  topK: 5,
  timeoutMs: 15000,
  maxFileBytes: 268435456,
  maxTotalBytes: 1073741824,
};

export function serviceConfig() { return { ...DEFAULT_CONFIG, token: DEFAULT_TOKEN }; }

function allowed(url,cfg) {
 const u=new URL(url); if(!['http:','https:'].includes(u.protocol) || u.username || u.password || !cfg.allowedOrigins?.includes(u.origin))throw new Error('Resource origin is not configured'); return u;
}
async function request(url,cfg,options={}) {
 let u=allowed(url,cfg); const token=cfg.token;
 const authOrigins=cfg.authOrigins??[new URL(cfg.endpoint).origin];
 for(let i=0;i<4;i++) {
  let response;
  try{response=await fetch(u,{...options,headers:{...(options.headers??{}),...(token&&authOrigins.includes(u.origin)?{'octo-vs-token':token}:{})},redirect:'manual',signal:AbortSignal.timeout(cfg.timeoutMs??15000)});}catch{throw new Error('Asset service unavailable or timed out');}
  if(response.status>=300&&response.status<400){await response.body?.cancel();u=allowed(new URL(response.headers.get('location'),u),cfg);continue;}
  if(!response.ok){await response.body?.cancel();throw new Error(`Asset service HTTP ${response.status}`);}return {response,url:u};
 }
 throw new Error('Too many redirects');
}
async function bytes(response,max=limits.fileBytes) {
 if(Number(response.headers.get('content-length'))>max){await response.body?.cancel();throw new Error('Download exceeds resource limit');}
 const chunks=[];let size=0;
 for await(const c of response.body){size+=c.length;if(size>max)throw new Error('Download exceeds resource limit');chunks.push(c);}
 return Buffer.concat(chunks);
}
const firstNonEmpty = (...values) => values.find(v=>typeof v==='string'&&v.trim())?.trim();

export async function searchRemote(queries,cfg) {
 if(!cfg?.endpoint)return {status:'not_configured',results:queries.map(query=>({query,assets:[]}))};
 if(!Array.isArray(queries)||queries.some(q=>typeof q!=='string'))throw new Error('queries must be strings');
 const {response}=await request(cfg.endpoint,cfg,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'file',queries,top_k:cfg.topK??5,...(cfg.filters?{filters:cfg.filters}:{})})});
 const body=JSON.parse((await bytes(response,4*1024*1024)).toString('utf8'));
 if(!Array.isArray(body.results)||body.results.length!==queries.length)throw new Error('Unexpected search response');
 return {status:'ok',results:body.results.map((group,i)=>{
  const items=Array.isArray(group)?group:group.files;if(!Array.isArray(items))throw new Error('Unexpected search group');
  // Match the browser request: filters are sent to the service, not reapplied locally.
  // Returned group/source IDs may differ; do not silently discard those models.
  const seen=new Set();return {query:queries[i],assets:items.filter(r=>r.file_path&&(/^(glb|gltf)$/i.test(r.file_type??'')||/\.(glb|gltf)$/i.test(new URL(r.file_path).pathname))).filter(r=>{const key=r.raw_data?.content_hash??r.id??r.file_path;if(seen.has(key))return false;seen.add(key);return true;}).map(r=>({id:`remote_${r.id}`,origin:'remote',remoteId:r.id,name:firstNonEmpty(r.name,r.chineseName,r.file_name)??'未命名模型',description:r.description??'',tags:r.tags??[],entryUrl:r.file_path,thumbnailUrl:r.thumbnail_path??null,score:r.score,sourceId:r.source_id,groupId:r.group_id,technicalStatus:'not_downloaded',
   // Library metadata is a candidate hint (spec §4.1): pass through valid raw_data, never fabricate.
   libraryMetadata:sanitizeLibraryMetadata(r.raw_data)}))};
 })};
}

/** Whitelisted raw_data passthrough; unknown/malformed values are dropped, missing stays null. */
const finite3=(v)=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const int=(v)=>Number.isSafeInteger(v)&&v>=0?v:null;
export function sanitizeLibraryMetadata(raw) {
 if(!raw||typeof raw!=='object')return null;
 const out={};
 const t=int(raw.triangles);if(t!==null)out.triangles=t;
 const d=int(raw.draw_calls);if(d!==null)out.draw_calls=d;
 const n=int(raw.node_count);if(n!==null)out.node_count=n;
 const tc=int(raw.texture_count);if(tc!==null)out.texture_count=tc;
 const mts=int(raw.max_texture_size);if(mts!==null)out.max_texture_size=mts;
 if(raw.bbox&&finite3(raw.bbox.min)&&finite3(raw.bbox.max)&&!raw.bbox.min.some((v,i)=>v>raw.bbox.max[i]))out.bbox={min:raw.bbox.min,max:raw.bbox.max};
 if(typeof raw.units==='string')out.units=raw.units;
 return Object.keys(out).length?out:null;
}
export async function downloadCandidate(candidate,out,cfg) {
 outsideSkill(out);
 if(existsSync(out))throw new Error('Download destination already exists');
 const temp=resolve(out)+'.download-'+randomUUID();mkdirSync(temp,{recursive:true});
 try {
  const {response,url}=await request(candidate.entryUrl,cfg);const modelBytes=await bytes(response,cfg.maxFileBytes??limits.fileBytes);
  const ext=extname(url.pathname).toLowerCase();if(!['.glb','.gltf'].includes(ext))throw new Error('Unsupported model URL');
  const entry='model'+ext;const gltf=ext==='.glb'?parseGlb(modelBytes).json:JSON.parse(modelBytes.toString('utf8'));
  let total=modelBytes.length;let n=0;const rewrites=new Map();
  for(const item of [...(gltf.buffers??[]),...(gltf.images??[])]){
   if(!item.uri||item.uri.startsWith('data:'))continue;
   if(rewrites.has(item.uri)){item.uri=rewrites.get(item.uri);continue;}
   const old=item.uri,remote=new URL(old,url);const {response:dep}=await request(remote,cfg);const data=await bytes(dep,cfg.maxFileBytes??limits.fileBytes);
   total+=data.length;if(total>(cfg.maxTotalBytes??limits.totalBytes)||n>=limits.files)throw new Error('Asset download exceeds limit');
   const suffix=extname(remote.pathname).replace(/[^.a-z0-9]/gi,'').slice(0,12)||'.bin';const local=`deps/${n++}${suffix}`;
   mkdirSync(resolve(temp,'deps'),{recursive:true});writeFileSync(resolve(temp,local),data);rewrites.set(old,local);item.uri=local;
  }
  if(ext==='.gltf')writeFileSync(resolve(temp,entry),JSON.stringify(gltf));
  else {
   // Preserve every binary chunk while replacing external URI strings in the JSON chunk.
   const json=Buffer.from(JSON.stringify(gltf));const pad=Buffer.alloc((4-json.length%4)%4,0x20);const content=Buffer.concat([json,pad]);const rest=modelBytes.subarray(20+modelBytes.readUInt32LE(12));
   const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+content.length+rest.length,8);header.writeUInt32LE(content.length,12);header.writeUInt32LE(0x4e4f534a,16);writeFileSync(resolve(temp,entry),Buffer.concat([header,content,rest]));
  }
  receive(temp,out,'Downloaded from configured model library');const pkg=loadPackage(out),a=pkg.assets[0];
  if(!a)throw new Error('No downloaded model');a.origin='remote';a.remoteId=candidate.remoteId;a.name=candidate.name;a.description=candidate.description??'';a.semanticStatus='library_metadata';
  // Library raw_data is a hint (source/version unknown), not a local check verdict (spec §4.1).
  a.libraryMetadata=candidate.libraryMetadata??null;
  atomicJSON(resolve(out,'package.json'),pkg);return pkg;
 }finally{rmSync(temp,{recursive:true,force:true});}
}