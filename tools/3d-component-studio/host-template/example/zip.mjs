// Deliberately small ZIP profile: STORE, UTF-8, no encryption, ZIP64 or data descriptors.
// Reject before allocating entry buffers; central/local metadata and CRC must agree.
const check=(ok,message)=>{if(!ok)throw Error(message);};
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
export const LIMIT=8*1024*1024;
export function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function pathOK(p){check(typeof p==='string'&&p.length<=180&&/^[A-Za-z0-9_.\/-]+$/.test(p)&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..'),'非法ZIP路径');}
function cat(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;}
export function writeZip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,data] of Object.entries(entries)){
  pathOK(name);const n=enc.encode(name),crc=crc32(data);const a=new Uint8Array(30+n.length),v=new DataView(a.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);a.set(n,30);
  const b=new Uint8Array(46+n.length),w=new DataView(b.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,crc,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);b.set(n,46);
  local.push(a,data);central.push(b);offset+=a.length+data.length;
 }
 const c=cat(central),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,c.length,true);v.setUint32(16,offset,true);
 const result=cat([...local,c,end]);check(result.length<=LIMIT,'交付包超过2MB');return result;
}
export function readZip(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);check(b.length>=22&&b.length<=LIMIT,'ZIP大小无效');const v=new DataView(b.buffer,b.byteOffset,b.byteLength),end=b.length-22;
 check(v.getUint32(end,true)===0x06054b50,'ZIP结束记录无效或包含注释');
 check(v.getUint16(end+4,true)===0&&v.getUint16(end+6,true)===0&&v.getUint16(end+20,true)===0,'不支持分卷ZIP或注释');
 const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),start=v.getUint32(end+16,true);
 check(count>0&&count<=64&&v.getUint16(end+8,true)===count&&start+size===end,'ZIP目录或条目数无效');
 const entries=Object.create(null);let at=start,localEnd=0,total=0;
 for(let i=0;i<count;i++){
  check(at+46<=end&&v.getUint32(at,true)===0x02014b50,'ZIP目录损坏');
  const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),crc=v.getUint32(at+16,true),packed=v.getUint32(at+20,true),length=v.getUint32(at+24,true),nl=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),off=v.getUint32(at+42,true);
  check(flags===0x800&&method===0&&extra===0&&comment===0&&v.getUint16(at+34,true)===0,'仅支持Studio无压缩UTF-8 ZIP');
  check((v.getUint32(at+38,true)>>>16 & 0xf000)!==0xa000,'禁止符号链接');
  check(packed===length&&length<=LIMIT&&(total+=length)<=LIMIT&&at+46+nl<=end,'ZIP展开大小无效');
  const name=dec.decode(b.subarray(at+46,at+46+nl));pathOK(name);check(!Object.hasOwn(entries,name),'ZIP路径重复');
  check(off===localEnd&&off+30+nl+length<=start&&v.getUint32(off,true)===0x04034b50,'ZIP本地记录无效');
  check(v.getUint16(off+6,true)===flags&&v.getUint16(off+8,true)===method&&v.getUint32(off+14,true)===crc&&v.getUint32(off+18,true)===length&&v.getUint32(off+22,true)===length&&v.getUint16(off+26,true)===nl&&v.getUint16(off+28,true)===0,'ZIP头不一致');
  check(dec.decode(b.subarray(off+30,off+30+nl))===name,'ZIP路径头不一致');
  const data=b.slice(off+30+nl,off+30+nl+length);check(crc32(data)===crc,'ZIP校验失败');entries[name]=data;
  localEnd=off+30+nl+length;at+=46+nl;
 }
 check(at===end&&localEnd===start,'ZIP存在未登记内容');return entries;
}
