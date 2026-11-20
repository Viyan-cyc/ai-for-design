import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {inputDigest} from '../../skills/generate-3d-scene/scripts/lib/build-guard.mjs';
import {generateProjectHeat} from '../../skills/generate-3d-scene/scripts/lib/heat-simulation.mjs';
const modules=resolve(process.argv[2]);
const {HeatField}=createRequire(join(modules,'../package.json'))('@a3d/a3d-components/map');
const temp=mkdtempSync(join(tmpdir(),'heat-simulation-'));
const scene={meta:{name:'fixture'},map:{heat:{options:{origin:[114,22]},data:[{lng:114,lat:22,value:200}],tint:{},gridVisible:true},geographicScatter:{data:[{id:'existing',lng:114,lat:22}],visible:true}}};
function fixture(name,script){const root=join(temp,name);mkdirSync(join(root,'scripts'),{recursive:true});mkdirSync(join(root,'public/data'),{recursive:true});const file=join(root,'public/data/scene.json');writeFileSync(file,JSON.stringify(scene));if(script)writeFileSync(join(root,'scripts/heat-simulation.mjs'),script);return {root,file,original:readFileSync(file,'utf8')};}
try{
 const real=fixture('real');assert.equal(await generateProjectHeat(real.root,modules),null);assert.equal(readFileSync(real.file,'utf8'),real.original);
 const continuous=fixture('continuous',"export default {kind:'simulated',bounds:[113.999,21.999,114.001,22.001],alertCount:5,valueAt:()=>240}");
 const result=await generateProjectHeat(continuous.root,modules), out=JSON.parse(readFileSync(continuous.file));
 assert(result.records>1);assert.deepEqual(out.map.heat.options,scene.map.heat.options);assert.deepEqual(out.map.heat.tint,scene.map.heat.tint);
 const field=new HeatField(out.map.heat.options);field.setData(out.map.heat.data);const snap=field.getSnapshot();assert.equal(snap.cells.length,snap.width*snap.height);field.dispose();
 assert.equal(out.map.geographicScatter.data.length,5);for(const a of out.map.geographicScatter.data)assert(out.map.heat.data.some(r=>r.lng===a.lng&&r.lat===a.lat&&r.value===240));
 for(const [name,script] of [['bad-value',"export default {kind:'simulated',bounds:[113.999,21.999,114.001,22.001],valueAt:()=>NaN}"],['oversize',"export default {kind:'simulated',bounds:[113,21,115,23],valueAt:()=>200}"],['style',"export default {kind:'simulated',bounds:[113.999,21.999,114.001,22.001],cellSizeMeters:30,valueAt:()=>200}"]]){const f=fixture(name,script);await assert.rejects(generateProjectHeat(f.root,modules));assert.equal(readFileSync(f.file,'utf8'),f.original);}
 assert.equal(result.digest,inputDigest(continuous.root));
 for(const phase of ['load','compute']) for(const target of ['package.json','package-lock.json','scripts/other.mjs','scripts/heat-simulation.mjs','public/data/scene.json','vendor/local/package.json']) {
   const mutation = `writeFileSync(new URL('../${target}',import.meta.url),'concurrent edit');`;
   const script = `import {writeFileSync} from 'node:fs';
     ${phase==='load' ? `await new Promise(r=>setTimeout(r,20)); ${mutation}` : ''}
     export default {kind:'simulated',bounds:[113.999,21.999,114.001,22.001],valueAt(){${phase==='compute'?mutation:''}return 240;}};`;
   const f=fixture(`race-${phase}-${target.replaceAll('/','-')}`,script);
   mkdirSync(join(f.root,'vendor/local'),{recursive:true});
   const changed=join(f.root,target);
   if(!target.endsWith('heat-simulation.mjs') && target!=='public/data/scene.json')writeFileSync(changed,'original input');
   const preview=join(f.root,'offline/index.html');mkdirSync(join(f.root,'offline'));writeFileSync(preview,'previous preview');
   await assert.rejects(generateProjectHeat(f.root,modules),/BUILD_INPUT_CHANGED/);
   assert.equal(readFileSync(changed,'utf8'),'concurrent edit');
   assert.equal(readFileSync(f.file,'utf8'),target==='public/data/scene.json'?'concurrent edit':f.original);
   assert.equal(readFileSync(preview,'utf8'),'previous preview');
 }
 console.log('PASS input baseline: load/compute mutations of manifest, lock, script, local package and JSON rejected; concurrent edits and preview preserved; authorized output digest matches');
 console.log('PASS continuous cells/defaults, linked alerts, real sparse input unchanged, invalid/oversize/style failures preserve data');
}finally{rmSync(temp,{recursive:true,force:true});}
