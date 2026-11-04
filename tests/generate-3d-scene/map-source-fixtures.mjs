import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSceneData} from '../../skills/generate-3d-scene/scripts/lib/scene-schema.mjs';
const source=readFileSync('D:/cyc/project/octo/gts/map/map-experience-v297/assets/上海地图-v2.97-基线-v2.1/上海地图-v2.97-参数锁定-v2.1.dc.html','utf8');
const target=readFileSync(process.env.SCENE3D_COMPONENT_SOURCE || 'D:/cyc/project/octo/test/3d-components/src/map/map-experience.js','utf8');
function method(code,name) {
 const start=code.indexOf('  '+name+'(');assert.ok(start>=0,name);
 const end=code.indexOf('\n  }',start)+4;
 return code.slice(start,end);
}
const names=['themeValues','buildingGrowthExpression','ordinaryBuildingGrowthScale','adjust','mix'];
const instance=code=>new Function('return new class {'+names.map(name=>method(code,name)).join('\n')+'}')();
const original=instance(source),current=instance(target);
for(const mode of ['light','dark']) {
 const expected=Object.fromEntries(Object.entries(original.themeValues(mode)).filter(([key])=>!key.startsWith('pearl')));
 assert.deepEqual(current.themeValues(mode),expected);
}
assert.deepEqual(current.buildingGrowthExpression(['get','height']),original.buildingGrowthExpression(['get','height']));
for(const zoom of [0,14,15,15.5,16,16.35,18]) assert.equal(current.ordinaryBuildingGrowthScale(zoom),original.ordinaryBuildingGrowthScale(zoom));
assert.ok(!/HALIC|mapRef|DCLogic|https:\/\//.test(target));
assert.equal(validateSceneData({map:{styleUrl:'https://example.invalid/style.json',origin:[121,31]}}).ok,true);
assert.equal(validateSceneData({map:{origin:[121,91]}}).ok,false);
const pkg=JSON.parse(readFileSync('skills/generate-3d-scene/template/package.json','utf8'));
assert.equal(pkg.dependencies.three,'0.185.1');assert.ok(!pkg.dependencies['maplibre-gl']);assert.ok(!pkg.dependencies['@turf/turf']);
console.log('PASS original light/dark parameters, height growth, no fixed city globals, map schema, optional dependencies');

// Zooming within one level band must not rebuild every layer on each event.
const ctor=method(target,'constructor');
const events=new Map();let zoom=16, materials=0, shadows=0;
const mock={on:(event,fn)=>events.set(event,fn),getZoom:()=>zoom,getBearing:()=>0,isStyleLoaded:()=>false,getLayer:()=>false};
const Subject=new Function('return class {'+ctor+'; themeValues(){return {shadow:true}}; applyBuildingMaterial(){this.materials()}; applyShadow(){this.shadows()}; scheduleTransitionShadows(){} }')();
const subject=new Subject(mock);subject.materials=()=>materials++;subject.shadows=()=>shadows++;
for(let i=0;i<100;i++) events.get('zoom')();
assert.equal(materials,0);assert.equal(shadows,0);
zoom=14;events.get('zoom')();assert.equal(materials,1);assert.equal(shadows,1);
zoom=16;events.get('zoom')();assert.equal(materials,2);assert.equal(shadows,2);
console.log('PASS 100 same-band zoom events: 0 material/shadow rebuilds; threshold crossings: exactly 2');
