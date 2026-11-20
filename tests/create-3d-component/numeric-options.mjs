import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import assert from 'node:assert/strict';
const root=process.argv[2]??'D:/cyc/project/octo/test/3d-components';
async function load(path){return import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(readFileSync(root+'/src/3d/map/'+path,'utf8'))).toString('base64'));}
const scan=await load('surface-particle-scan/parameters.ts'),scatter=await load('restored-map-suite/logical-scatter/parameters.ts');
for(const m of [scan,scatter]){
 assert.deepEqual(m.normalize(),m.defaults);
 const controls=Array.isArray(m.controls)?m.controls.filter(c=>c.type==='range').map(c=>[c.key,c.min,c.max]):Object.entries(m.controls).map(([k,c])=>[k,c[1],c[2]]);
 for(const [key,min,max] of controls){
  for(const [value,expected] of [[min-100,min],[max+100,max],[NaN,m.defaults[key]],[Infinity,m.defaults[key]],[null,m.defaults[key]],[undefined,m.defaults[key]],['3',m.defaults[key]]])assert.equal(m.normalize({[key]:value})[key],expected,key);
 }
 assert.throws(()=>m.normalize({unknown:3}));assert.throws(()=>m.normalize([]));
}
assert.equal(scan.normalize({radius:2500}).radius,2500);
assert.equal(scan.normalize({maxPoints:1001.8}).maxPoints,1002);
assert.equal(scatter.normalize({minClusterCount:2}).minClusterCount,3);
assert.equal(scatter.normalize({minClusterCount:5.8}).minClusterCount,6);
assert.throws(()=>scan.normalize({color1:'bad'}));assert.throws(()=>scatter.normalize({markerTone:'bad'}));
console.log('PASS: all numeric boundaries, invalid fallback, integer options, defaults and strict nonnumeric validation');
