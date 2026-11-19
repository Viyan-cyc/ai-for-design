import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
const R=resolve(new URL('../..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const work=resolve(process.argv[2]),lib=join(work,'library');
const {build}=await import(pathToFileURL(join(lib,'node_modules/esbuild/lib/main.js')));
const map=await import(pathToFileURL(join(lib,'dist/es/map.js')));
const {attemptComponent}=await import(pathToFileURL(join(lib,'dist/es/utils.js')));
let messages=[];const report=(name,error)=>messages.push({name,message:error.message});
assert.deepEqual(attemptComponent('ok',()=>7,report),{ok:true,value:7});
assert.equal(attemptComponent('bad',()=>{throw Error('bad-data');},report).ok,false);assert.equal(messages[0].message,'bad-data');
const log=console.error;let logs=0;console.error=()=>logs++;assert.equal(attemptComponent('report',()=>{throw Error('x')},()=>{throw Error('report failed')}).ok,false);console.error=log;assert.equal(logs,1);
const field=new map.HeatField(),defaults=field.getOptions();assert.equal(defaults.colorBlur,2.63);assert.deepEqual(defaults.colors,['#CCFEC2','#78EE95','#FFF05C','#FFAC4D','#FF5757']);
const good=[{lng:121.49517,lat:31.24194,value:200}],bad=[good[0],good[0]];
field.setData(good);const before=field.getSnapshot();assert.throws(()=>field.setData(bad),/同单元重复/);assert.deepEqual(field.getSnapshot(),before);
assert.throws(()=>field.setOptions({colors:['invalid']}));assert.deepEqual(field.getOptions(),defaults);assert.deepEqual(field.getSnapshot(),before);
let reject=true;const unsub=field.subscribe(()=>{if(reject)throw Error('listener');});assert.throws(()=>field.setData([]));assert.deepEqual(field.getSnapshot(),before);reject=false;unsub();
// Controlled DOM/map host, actual component implementations; not a WebGL/visual test.
let raf=0;globalThis.requestAnimationFrame=()=>++raf;globalThis.cancelAnimationFrame=()=>{};globalThis.Path2D=class{};
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
function element(){return {style:{},dataset:{},children:[],setAttribute(){},getContext(){return {}},append(e){this.children.push(e);e.parent=this;},remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);},addEventListener(){},removeEventListener(){},clientWidth:800,clientHeight:600};}
globalThis.document={createElement:element};
function host(){const container=element(),canvas=element(),listeners=new Map(),sources=new Map(),layers=new Map();return {container,listeners,sources,layers,getContainer:()=>container,getCanvas:()=>canvas,on(k,fn){const s=listeners.get(k)||new Set();s.add(fn);listeners.set(k,s);},off(k,fn){listeners.get(k)?.delete(fn)},isStyleLoaded:()=>true,getSource:k=>sources.get(k),getLayer:k=>layers.get(k),getStyle:()=>({layers:[]}),addSource(k,v){sources.set(k,{...v,setData(){}})},addLayer(v){layers.set(v.id,v)},removeLayer(k){layers.delete(k)},removeSource(k){sources.delete(k)},setLayoutProperty(){},triggerRepaint(){}};}
const failing=host();failing.addLayer=()=>{throw Error('layer failure')};assert.throws(()=>new map.GridHeat(failing,field),/layer failure/);assert.equal(failing.sources.size,0);assert.equal([...failing.listeners.values()].reduce((n,x)=>n+x.size,0),0);
const geoHost=host();geoHost.on=()=>{throw Error('event registration')};assert.throws(()=>new map.GeographicScatter(geoHost,{data:[]}),/event registration/);assert.equal(geoHost.container.children.length,0);
const tintHost=host();tintHost.__heatAdapterVersion='grid-heat-maplibre-5.24.0-v1';tintHost.on=()=>{throw Error('tint registration')};assert.throws(()=>new map.BuildingTint(tintHost,field),/tint registration/);assert.equal(tintHost.__heatTint,undefined);
const entry=join(R,'skills/generate-3d-scene/extensions/map/src/scene3d/map/map-components.ts');
await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',packages:'external',outfile:join(lib,'fault-map.mjs'),alias:{'@a3d/a3d-components/map':join(lib,'dist/es/map.js'),'@a3d/a3d-components/utils':join(lib,'dist/es/utils.js')}});
const {MapComponents,validateComponents}=await import(pathToFileURL(join(lib,'fault-map.mjs')));
const startupSource=await readFile(join(R,'skills/generate-3d-scene/extensions/map/src/scene3d/map/create-map-scene.ts'),'utf8');
const validator=startupSource.slice(startupSource.indexOf('export function validateMapConfig'),startupSource.indexOf('function presentationOverrides')).replace('export function','function');
const js=stripTypeScriptTypes('type MapConfig=any;'+validator);
const validateMapConfig=new Function('validateLayerMapping','normalizeScanOptions','validateScanBuildings','normalizeMapExperienceParameters','mapExperienceThemes','validateMapExperienceOutside','validateComponents',js+';return validateMapConfig;')(map.validateLayerMapping,map.normalizeScanOptions,map.validateScanBuildings,map.normalizeMapExperienceParameters,map.mapExperienceThemes,map.validateMapExperienceOutside,validateComponents);
const startupConfig={styleUrl:'https://example.invalid/style',origin:[121.5,31.24],heat:{data:bad}};
assert.doesNotThrow(()=>validateMapConfig(startupConfig,false));assert.throws(()=>validateMapConfig(startupConfig),/同单元重复/);assert.throws(()=>validateMapConfig({...startupConfig,origin:[200,0]},false),/经纬度/);
messages=[];const h=host(),input={heat:{data:bad},geographicScatter:{data:[{id:'a',lng:121.5,lat:31.24}]}};
const components=new MapComponents(h,h.container,input,report);assert.equal(messages.length,1);assert.match(messages[0].message,/同单元重复/);assert.ok(components.diagnostics().geographicScatter);assert.equal(components.diagnostics().grid,false);assert.deepEqual(components.serialize().heat,input.heat);
components.update({...input,heat:{data:good}});components.clearRejected();assert.equal(components.diagnostics().grid,true);const config=components.serialize();assert.throws(()=>components.update(input),/同单元重复/);assert.deepEqual(components.serialize(),config);components.dispose();components.dispose();assert.equal(h.container.children.length,0);assert.equal(h.sources.size,0);
messages=[];const ht=host(),tintInput={heat:{data:good,tint:{enabled:true}}};const noAdapter=new MapComponents(ht,ht.container,tintInput,report);assert.equal(noAdapter.diagnostics().grid,true);assert.equal(noAdapter.diagnostics().tint,undefined);assert.equal(messages[0].name,'buildingTint');assert.deepEqual(noAdapter.serialize().heat,tintInput.heat);noAdapter.dispose();
// Compile and execute the actual authored templates with the same installed Three.
for(const kind of ['native','host']){
 const source=join(R,'tools/3d-component-studio',kind+'-template/component/src/index.ts');
 await build({entryPoints:[source],bundle:true,platform:'node',format:'esm',packages:'external',outfile:join(lib,kind+'-fault.mjs'),plugins:[{name:'animation-token',setup(b){b.onLoad({filter:/parameters\.ts$/},async a=>({contents:(await readFile(a.path,'utf8')).replaceAll('__ANIMATION__','none'),loader:'ts'}));}}]});
}
const {AuthoredComponent}=await import(pathToFileURL(join(lib,'native-fault.mjs')));const object=new AuthoredComponent();const opts=object.getOptions();assert.throws(()=>object.setOptions({color:'bad'}));assert.deepEqual(object.getOptions(),opts);object.setOptions({size:1.5});assert.equal(object.getOptions().color,opts.color);object.dispose();object.dispose();
const THREE=await import(pathToFileURL(join(lib,'node_modules/three/build/three.module.js'))),{HostHighlight}=await import(pathToFileURL(join(lib,'host-fault.mjs')));
const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());root.add(mesh);let fail=false;const invalidate=()=>{if(fail)throw Error('invalidate')};
const effect=new HostHighlight({root,targets:[mesh],invalidate});const original=effect.getOptions();fail=true;assert.throws(()=>effect.setOptions({color:'#ffffff'}),/invalidate/);assert.deepEqual(effect.getOptions(),original);fail=false;effect.dispose();assert.deepEqual(root.children,[mesh]);
assert.throws(()=>new HostHighlight({root,targets:[mesh],invalidate:()=>{throw Error('init fail')}}),/init fail/);assert.deepEqual(root.children,[mesh]);mesh.geometry.dispose();mesh.material.dispose();field.dispose();
const result={passed:true,checks:['boundary success/error/report failure','actual HeatField defaults and invalid/notification rollback','GridHeat/GeographicScatter/BuildingTint constructor cleanup','bad heat with surviving independent geographic scatter','rejected input retained, corrected update and disposal','actual native and host template update/constructor failure'],limits:'controlled DOM/map; no browser WebGL or visual validation'};
await writeFile(join(work,'fault-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
