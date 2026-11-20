import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const c='D:/cyc/project/octo/test/3d-components',require=createRequire(c+'/package.json'),{build}=require('esbuild'),w=resolve(process.argv[2]);
await mkdir(w,{recursive:true});
await build({entryPoints:[c+'/src/3d/map/query-buildings.ts'],bundle:true,platform:'browser',format:'iife',globalName:'buildingQuery',outfile:join(w,'query-browser.js')});
await build({entryPoints:[c+'/src/3d/map/query-buildings.ts'],bundle:true,platform:'node',format:'esm',outfile:join(w,'query.mjs')});
const {queryBuildings}=await import(pathToFileURL(join(w,'query.mjs')));
const feature=(id,x)=>({type:'Feature',id,layer:{id:'b'},source:'s',sourceLayer:'building',properties:{height:300},geometry:{type:'Polygon',coordinates:[[[x,0],[x+2,0],[x+2,2],[x,0]],[[x+.2,.2],[x+.3,.2],[x+.2,.3],[x+.2,.2]]]}});
const a=feature(1,0),b=feature(1,2),noId=feature(undefined,4);let calls=0,zoom=16,dispose=false;const listeners=new Set();
const map={getCanvas:()=>({clientWidth:1024,clientHeight:768}),getCenter:()=>({lng:0,lat:0}),getZoom:()=>zoom,getBearing:()=>0,getPitch:()=>60,getLayer:()=>({source:'s'}),on:(_,f)=>listeners.add(f),off:(_,f)=>listeners.delete(f),queryRenderedFeatures(options){calls++;return [a,b,noId,a].filter(f=>Math.abs(Math.floor(Number(f.id)||0))%16===options.filter[2]);}};
assert.deepEqual(new Set(await queryBuildings(map,['b'])),new Set([a,b,noId]));assert.equal(calls,16);assert.equal(listeners.size,0);
const original=map.queryRenderedFeatures;
for(const mode of ['camera','source','dispose']){
 calls=0;dispose=false;map.queryRenderedFeatures=(...args)=>{const result=original(...args);if(mode==='camera')zoom++;if(mode==='dispose')dispose=true;if(mode==='source')for(const f of listeners)f({sourceId:'s',sourceDataType:'content'});return result;};
 assert.equal(await queryBuildings(map,['b'],()=>dispose),null);assert.equal(calls,1);assert.equal(listeners.size,0);
}
map.queryRenderedFeatures=()=>{throw Error('query failed');};await assert.rejects(queryBuildings(map,['b']),/query failed/);assert.equal(listeners.size,0);
await writeFile(join(w,'query-contract.json'),JSON.stringify({passed:true,partitions:16,sameIdFragmentsPreserved:true,holesPreserved:true,noIdPreserved:true,cameraSourceDisposeCancellation:true,errorCleanup:true},null,2));
console.log('query contract PASS');
