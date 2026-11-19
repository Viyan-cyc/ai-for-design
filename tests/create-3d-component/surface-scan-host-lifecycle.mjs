import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const source=process.argv[2]??'D:/cyc/project/octo/test/3d-components/src/map/surface-particle-scan/map-host.ts';
let code=(await readFile(source,'utf8')).replace(/^import .*;\r?\n/gm,'');code=stripTypeScriptTypes(code);
code=`const maplibregl={MercatorCoordinate:{fromLngLat:()=>({x:0,y:0,meterInMercatorCoordinateUnits:()=>1})}};class SurfaceParticleScan{userData={};sets=0;frames=0;disposed=0;setData(){this.sets++;}setFrame(){this.frames++;}tick(){return false;}dispose(){this.disposed++;}}\n`+code;
const {attachSurfaceParticleScan}=await import(process.argv[3]?pathToFileURL(process.argv[3]).href:'data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const delay=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
for(const outcome of ['resolve','reject']){
 const pending=[],listeners=new Map(),statuses=[],updates=[],invalidations=[];let reads=0,stops=0;
 const map={getStyle:()=>({layers:[{id:'buildings',type:'fill-extrusion'}]}),getLayoutProperty:()=> 'visible',getLayer:()=>({source:'s'}),getSource:()=>({type:'geojson',getData:()=>{reads++;return new Promise((resolve,reject)=>pending.push({resolve,reject}));}}),getCanvas:()=>({width:100,height:100,clientWidth:100}),on(k,f){const set=listeners.get(k)??new Set();set.add(f);listeners.set(k,set);},off(k,f){listeners.get(k)?.delete(f);}};
 const frames=[];
 const make=tag=>{const binding=attachSurfaceParticleScan({map,origin:[0,0],scene:{add(){}},invalidate(){invalidations.push(tag);},onFrame:f=>{frames.push(f);return ()=>{stops++;};},getMeshes:()=>[],acceptsLayer:()=>true,completeLayer:()=>true,growth:()=>1,visible:()=>true,onStatus:s=>statuses.push([tag,s]),onUpdate:()=>updates.push(tag)});
 if(process.argv[3]){const c=binding.component;c.sets=0;c.frames=0;c.disposed=0;for(const [method,key] of [['setData','sets'],['setFrame','frames'],['dispose','disposed']]){const original=c[method].bind(c);c[method]=(...args)=>{c[key]++;return original(...args);};}}
 return binding;};
 const old=make('old');await delay(220);assert.equal(reads,1);
 old.refresh();await delay(220); // busy request queues another read
 old.dispose();old.dispose();assert.equal(stops,1);assert.equal(old.component.disposed,1);
 assert.ok([...listeners.values()].every(s=>s.size===0));
 const next=make('new');await delay(220);assert.equal(reads,2);
 const invalidBefore=invalidations.length;frames[0](.016);old.refresh();
 if(outcome==='resolve')pending[0].resolve({type:'FeatureCollection',features:[]});else pending[0].reject(Error('late source failure'));
 await delay(220);assert.equal(reads,2);assert.equal(old.component.sets,0);assert.equal(old.component.frames,0);assert.equal(statuses.length,0);assert.equal(updates.length,0);assert.equal(invalidations.length,invalidBefore);
 pending[1].resolve({type:'FeatureCollection',features:[]});await delay(20);assert.equal(next.component.sets,1);assert.equal(statuses.length,1);assert.equal(statuses[0][0],'new');
 frames[1](.016);assert.deepEqual(updates,['new']);next.dispose();assert.equal(stops,2);assert.ok([...listeners.values()].every(s=>s.size===0));
 checks.push(outcome+': late old result silent, queued work canceled, old frame silent, replacement live, listeners/frame/component released once');
}
const out=new URL('../../docs/create-3d-component/native-work/rr92-fix/',import.meta.url);await mkdir(out,{recursive:true});await writeFile(new URL(process.argv[3]?'package-lifecycle.json':'lifecycle.json',out),JSON.stringify({passed:true,source,packageModule:process.argv[3]??null,checks},null,2));console.log(checks);
