import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT,CONTROLS} from '../../tools/3d-component-studio/src/contract.mjs';
import {exportDelivery,validateDelivery,sha256} from '../../tools/3d-component-studio/src/package.mjs';
import {readZip,writeZip} from '../../tools/3d-component-studio/src/zip.mjs';
import {StudioState} from '../../tools/3d-component-studio/src/state.mjs';
const enc=new TextEncoder(),dec=new TextDecoder();
const parse=(e,k)=>JSON.parse(dec.decode(e[k]));
const put=(e,k,x)=>e[k]=enc.encode(JSON.stringify(x));
async function altered(edit,rehash=true){const {bytes}=await exportDelivery(DEFAULT);const entries=readZip(bytes);await edit(entries);if(rehash){const m=parse(entries,'manifest.json');for(const f of m.files){if(entries[f.path]){f.bytes=entries[f.path].length;f.sha256=await sha256(entries[f.path]);}}put(entries,'manifest.json',m);}return writeZip(entries);}
function fixture(){let mounted=0,disposed=0;const store=new StudioState(DEFAULT,()=>({mount(){mounted++;},dispose(){disposed++;}}));return {store,counts:()=>({mounted,disposed})};}
test('export / reopen / import / reexport keeps semantic state and independent statuses',async()=>{const p=structuredClone(DEFAULT);p.design={primaryScale:8,color:'#a25b31'};const a=await exportDelivery(p);const result=await validateDelivery(a.bytes);assert.deepEqual(result.preset,p);assert.equal(result.manifest.states.design.status,'unconfirmed');assert.equal(result.manifest.states.publication.status,'unpublished');assert.equal(a.evidence.artifactHash,result.packageHash);const {store}=fixture();await store.replace(()=>validateDelivery(a.bytes).then(x=>x.preset));const b=await exportDelivery(store.snapshot());assert.deepEqual((await validateDelivery(b.bytes)).preset,p);assert.deepEqual(parse(readZip(b.bytes),'controls.json'),CONTROLS);});
const cases={
 'hash tamper':e=>{e['design.md']=enc.encode('changed');},
 'unknown version':e=>{const m=parse(e,'manifest.json');m.formatVersion=99;put(e,'manifest.json',m);},
 'out-of-range number':e=>{const p=parse(e,'preset.json');p.design.primaryScale=0;put(e,'preset.json',p);},
 'invalid color':e=>{const p=parse(e,'preset.json');p.design.color='javascript:evil';put(e,'preset.json',p);},
 'missing file':e=>{delete e['engineering.md'];},
 'incompatible dependency':e=>{const m=parse(e,'manifest.json');m.dependencies[0].version='other';put(e,'manifest.json',m);},
 'controls conflict':e=>put(e,'controls.json',[]),
 'status escalation':e=>{const m=parse(e,'manifest.json');m.states.design.status='confirmed';put(e,'manifest.json',m);},
 'unknown source':e=>{const m=parse(e,'manifest.json');m.sources=[];put(e,'manifest.json',m);},
 'extra executable':e=>e['component.js']=enc.encode('throw new Error("must not execute")'),
 'unsupported adapter':e=>{const p=parse(e,'preset.json');p.project.adapter='map';put(e,'preset.json',p);}
};
for(const [name,edit] of Object.entries(cases))test(name+' rejects without state mutation',async()=>{const {store,counts}=fixture();await store.replace(()=>DEFAULT);const before=store.snapshot(),count=counts();const b=await altered(edit,name!=='hash tamper');await assert.rejects(store.replace(()=>validateDelivery(b).then(x=>x.preset)));assert.deepEqual(store.snapshot(),before);assert.deepEqual(counts(),count);});
test('prepare failure leaves current preview and state',async()=>{let disposed=0;const s=new StudioState(DEFAULT,p=>{if(p.design.primaryScale===8)throw Error('GPU prepare failure');return {mount(){},dispose(){disposed++;}}});await s.replace(()=>DEFAULT);const p=structuredClone(DEFAULT);p.design.primaryScale=8;await assert.rejects(s.replace(()=>p));assert.deepEqual(s.snapshot(),DEFAULT);assert.equal(disposed,0);});
test('mount failure disposes candidate and retains state',async()=>{let disposed=0;const s=new StudioState(DEFAULT,()=>({mount(){throw Error('mount');},dispose(){disposed++;}}));await assert.rejects(s.replace(()=>DEFAULT));assert.deepEqual(s.snapshot(),DEFAULT);assert.equal(disposed,1);});
test('superseded asynchronous import cannot overwrite newer edit',async()=>{const {store}=fixture();let resolve;const old=store.replace(()=>new Promise(r=>resolve=r));const p=structuredClone(DEFAULT);p.design.primaryScale=8;await store.replace(()=>p);resolve(DEFAULT);assert.equal(await old,false);assert.deepEqual(store.snapshot(),p);});
test('unsafe path is rejected on read, independently of writer',async()=>{const raw=writeZip({'aa/bb.txt':enc.encode('x')});const needle=enc.encode('aa/bb.txt');for(let i=0;i<raw.length-needle.length;i++)if(needle.every((x,j)=>raw[i+j]===x))raw.set(enc.encode('../bb.txt'),i);assert.throws(()=>readZip(raw),/路径/);});
test('duplicate paths rejected by reader',()=>{const raw=writeZip({'a.txt':enc.encode('a'),'b.txt':enc.encode('b')});for(let i=0;i<raw.length-5;i++)if(dec.decode(raw.slice(i,i+5))==='b.txt')raw.set(enc.encode('a.txt'),i);assert.throws(()=>readZip(raw),/重复/);});
test('symlink, unsupported compression, oversized and corrupt headers rejected',()=>{const base=writeZip({'a.txt':enc.encode('abc')});const end=base.length-22,c=new DataView(base.buffer).getUint32(end+16,true);let b=base.slice();new DataView(b.buffer).setUint32(c+38,0xa0000000,true);assert.throws(()=>readZip(b),/链接/);b=base.slice();new DataView(b.buffer).setUint16(c+10,8,true);assert.throws(()=>readZip(b),/无压缩/);assert.throws(()=>readZip(new Uint8Array(3*1024*1024)),/大小/);b=base.slice();b[0]=0;assert.throws(()=>readZip(b));});

test('stale failed import does not report over a newer successful request',async()=>{const {store}=fixture();let reject;const old=store.replace(()=>new Promise((_,r)=>reject=r));await store.replace(()=>DEFAULT);reject(Error('old request'));assert.equal(await old,false);});
