import {runtimeCompatibility} from '../../../template/scripts/runtime-compatibility.mjs';
/** Browser/Node portable delivery helpers. No network, executable archive content or hidden dependencies. */
import {scanForbiddenContent} from './model-policy.js';
export const deliveryLimits={files:10000,fileBytes:256*1024*1024,totalBytes:512*1024*1024};
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const fail=m=>{throw new Error(m);};
export function safeName(name){
  if(typeof name!=='string'||!name||name.includes('\\')||name.startsWith('/')||/[\x00-\x1f:]/.test(name)||name.split('/').some(p=>!p||p==='.'||p==='..'))fail('文件路径无效：'+name);
  return name;
}
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export async function closureHash(files){const lines=[];for(const name of Object.keys(files).sort())lines.push(name+':'+await sha256(files[name]));return sha256(encoder.encode(lines.join('\n')));}
const crcTable=Uint32Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255];return (crc^0xffffffff)>>>0;}
function checkFiles(files){let total=0;const names=new Set();if(!Object.keys(files).length||Object.keys(files).length>deliveryLimits.files)fail('文件数量超限或压缩包为空');for(const [name,bytes] of Object.entries(files)){safeName(name);if(names.has(name.toLowerCase()))fail('文件名重复：'+name);names.add(name.toLowerCase());total+=bytes.length;if(bytes.length>deliveryLimits.fileBytes||total>deliveryLimits.totalBytes)fail('模型包超过容量限制（单文件 256 MiB，整包 512 MiB）');}}
export function writeStoredZip(files){
  checkFiles(files);const chunks=[],central=[];let offset=0,centralSize=0;
  for(const [name,data] of Object.entries(files)){const n=encoder.encode(name);if(n.length>65535)fail('文件名过长');const local=new Uint8Array(30+n.length),l=new DataView(local.buffer),crc=crc32(data);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,n.length,true);local.set(n,30);chunks.push(local,data);
    const c=new Uint8Array(46+n.length),v=new DataView(c.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);c.set(n,46);central.push(c);centralSize+=c.length;offset+=local.length+data.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
export async function readModelZip(bytes){
  if(bytes.length>deliveryLimits.totalBytes)fail('ZIP 超过容量限制');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=Object.create(null);let end=-1,total=0;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)fail('ZIP 文件损坏');const count=v.getUint16(end+10,true),start=v.getUint32(end+16,true);let p=start;
  if(!count||count>deliveryLimits.files||v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count||start+v.getUint32(end+12,true)!==end)fail('ZIP 分卷、目录或文件数不支持');
  for(let i=0;i<count;i++){
    if(p+46>end||v.getUint32(p,true)!==0x02014b50)fail('ZIP 目录损坏');
    const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),packed=v.getUint32(p+20,true),size=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),local=v.getUint32(p+42,true),mode=(v.getUint32(p+38,true)>>>16)&0xf000;
    if(p+46+nl+el+cl>end||local+30>start)fail('ZIP 边界无效');const name=decoder.decode(bytes.subarray(p+46,p+46+nl));
    if(flags&1||mode===0xa000||![0,8].includes(method)||size>deliveryLimits.fileBytes||(total+=size)>deliveryLimits.totalBytes)fail('ZIP 加密、链接、压缩方式或容量不支持');
    if(v.getUint32(local,true)!==0x04034b50||v.getUint16(local+8,true)!==method)fail('ZIP 文件头无效');
    const dataStart=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);
    if(dataStart+packed>start||decoder.decode(bytes.subarray(local+30,local+30+v.getUint16(local+26,true)))!==name)fail('ZIP 内容边界或路径不一致');
    let data=bytes.subarray(dataStart,dataStart+packed);
    if(method===8){const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let length=0;try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>size)fail('ZIP 解压容量超限');parts.push(r.value);}}finally{await reader.cancel().catch(()=>{});}data=new Uint8Array(length);let off=0;for(const part of parts){data.set(part,off);off+=part.length;}}
    if(data.length!==size||crc32(data)!==v.getUint32(p+16,true))fail('ZIP 校验失败');
    if(name.endsWith('/'))safeName(name.slice(0,-1));else{safeName(name);if(Object.hasOwn(files,name))fail('ZIP 文件重复');files[name]=data;}
    p+=46+nl+el+cl;
  }
  if(p!==end)fail('ZIP 目录长度不一致');checkFiles(files);return files;
}
function resolveDependency(entry,uri){
  if(/^[a-z]+:|^\/|\\|[?#]/i.test(uri))fail('依赖必须包含在模型 ZIP 中');const parts=entry.split('/').slice(0,-1);for(const part of decodeURIComponent(uri).split('/')){if(part==='..'){if(!parts.length)fail('依赖路径越界');parts.pop();}else if(part&&part!=='.')parts.push(part);}return safeName(parts.join('/'));
}
export async function inspectModelFiles(files,chosenEntry){
  checkFiles(files);const entries=Object.keys(files).filter(n=>/\.(glb|gltf)$/i.test(n));const entry=chosenEntry??(entries.length===1?entries[0]:null);if(!entry||!files[entry])fail('请上传一个 GLB，或仅包含一个模型及其依赖的 ZIP');
  const bytes=files[entry];let json;
  if(/\.glb$/i.test(entry)){const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length||v.getUint32(16,true)!==0x4e4f534a||20+v.getUint32(12,true)>bytes.length)fail('GLB 文件头无效');json=JSON.parse(decoder.decode(bytes.subarray(20,20+v.getUint32(12,true))).trim());}else json=JSON.parse(decoder.decode(bytes).replace(/^\uFEFF/,''));
  if(json.asset?.version!=='2.0'||!json.scenes?.length||!json.scenes[json.scene??0])fail('模型必须为含有效场景的 glTF 2.0');
  const closure=Object.create(null);closure[entry]=bytes;for(const item of [...(json.buffers??[]),...(json.images??[])])if(item.uri&&!item.uri.startsWith('data:')){const path=resolveDependency(entry,item.uri);if(!files[path])fail('缺少依赖文件：'+path);closure[path]=files[path];}
  const compatibility=runtimeCompatibility(json);if(compatibility.status==='unsupported')fail('不支持的模型扩展：'+compatibility.missing.join(', '));
  const roots=(json.scenes[json.scene??0].nodes??[]).map(i=>json.nodes?.[i]).filter(Boolean);
  return {entry,bytes:closure,contentHash:await closureHash(closure),forbidden:scanForbiddenContent(json),rootTransforms:roots.length===1?roots[0]:null,sceneCount:json.scenes.length,selectedScene:json.scene??0,sceneSelection:json.scene===undefined?'first':'default',animated:!!json.animations?.length};
}
export function dataUrls(files){const result=Object.create(null);for(const [name,bytes] of Object.entries(files)){let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));result[name]='data:application/octet-stream;base64,'+btoa(binary);}return result;}
export async function decodeFiles(files){const result=Object.create(null);for(const [name,url] of Object.entries(files??{})){if(!/^data:/.test(url))fail('缺少内嵌模型文件');result[name]=new Uint8Array(await (await fetch(url)).arrayBuffer());}return result;}
