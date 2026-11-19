import {pathToFileURL} from 'node:url';
import {writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const m=await import(pathToFileURL(process.argv[2]).href);
const checks=[];
const scan=new m.SurfaceParticleScan(()=>{},{radius:2500,maxPoints:1000.4});
assert.equal(scan.getOptions().radius,2500);assert.equal(scan.getOptions().maxPoints,1000);
scan.setOptions({radius:99999,opacity:5});assert.equal(scan.getOptions().radius,3000);assert.equal(scan.getOptions().opacity,1);
assert.ok(scan.getState().count>0&&scan.getState().count<=1000);
for(const invalid of [null,[],42,true,"bad"]){const before=scan.getOptions();assert.throws(()=>scan.setOptions(invalid),/参数必须为对象/);assert.deepEqual(scan.getOptions(),before);assert.throws(()=>new m.SurfaceParticleScan(()=>{},invalid),/未知扫光参数/);}
scan.setOptions({radius:null,opacity:NaN});assert.equal(scan.getOptions().radius,720);assert.equal(scan.getOptions().opacity,.92);scan.dispose();
checks.push('actual scan constructor/update/readback; 3000m sampling respects 1000 point budget; fallback defaults');
// Invoke actual GeographicScatter update/getConfig without requiring a canvas renderer.
globalThis.document={createElement:()=>({})};globalThis.Path2D=class {};globalThis.matchMedia=()=>({});
const g=Object.create(m.GeographicScatter.prototype);g.canvas={};g.schedule=()=>{};
g.update({data:[],options:{minClusterCount:2,pointRadius:99}});assert.equal(g.getConfig().options.minClusterCount,3);assert.equal(g.getConfig().options.pointRadius,8);
g.setOptions({minClusterCount:8.8});assert.equal(g.getConfig().options.minClusterCount,9);
assert.throws(()=>g.setData([{id:'bad',lng:200,lat:20}]));assert.deepEqual(g.getConfig().data,[]);
for(const invalid of [null,[],42,true,'bad']){const before=g.getConfig();assert.throws(()=>g.setOptions(invalid),/参数必须为对象/);assert.deepEqual(g.getConfig(),before);assert.throws(()=>g.update(invalid),/必须是对象/);assert.deepEqual(g.getConfig(),before);assert.throws(()=>new m.GeographicScatter({},invalid),/必须是对象/);}
g.setOptions({pointRadius:null,minClusterCount:NaN});assert.equal(g.getConfig().options.pointRadius,3.4);assert.equal(g.getConfig().options.minClusterCount,9);
checks.push('actual geographic update/setOptions/readback normalized; invalid coordinates rejected atomically');
console.log(JSON.stringify({passed:true,checks},null,2));
