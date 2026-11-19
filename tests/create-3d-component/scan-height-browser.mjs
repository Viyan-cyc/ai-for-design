import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('D:/cyc/project/octo/test/3d-components/package.json');
const styleSpec=require('@maplibre/maplibre-gl-style-spec');
const work=resolve(process.argv[2]),url=process.argv[3]??'http://127.0.0.1:17971/';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>window.__performanceScene?.scan.getState().count>0,null,{timeout:90000});
 const results=[];
 for(const zoom of [14.5,15.1,15.7,16.35]){
  results.push(await page.evaluate(async zoom=>{
   const {map,scan,buildingState}=window.__performanceScene;
   map.jumpTo({zoom});scan.pause();await new Promise(r=>setTimeout(r,1800));
   const u=scan.children[0].material.uniforms;
   const root=window.__scene3d.internals.scene;let model;
   root.traverse(o=>{if(o.name==='pearl_growth')model=o;});
   return {zoom:map.getZoom(),state:buildingState(),scanVisible:scan.visible,particleBuildingGrowth:u.uGrowth.value,particleModelGrowth:u.uMeshGrowth.value,modelGrowth:model?.scale.y,expression:map.getPaintProperty('sh-buildings-3d','fill-extrusion-height'),surfaces:scan.userData.surfaceDiagnostics};
  },zoom));
 }
 for(const r of results){assert.equal(r.scanVisible,r.state.visible,'effect hidden while ordinary buildings are below their visibility threshold');assert.ok(Math.abs(r.state.growth-r.particleBuildingGrowth)<1e-8);assert.ok(Math.abs(r.modelGrowth-r.particleModelGrowth)<1e-8);assert.equal(r.state.heightScale,.5);
  const parsed=styleSpec.createPropertyExpression(r.expression,styleSpec.latest['paint_fill-extrusion']['fill-extrusion-height']);assert.equal(parsed.result,'success');
  r.actualBuildingHeight=parsed.value.evaluate({zoom:r.zoom},{type:'Polygon',properties:{height:100,render_height:100}});
  r.scanWallHeight=100*r.state.heightScale*r.particleBuildingGrowth;
  assert.ok(Math.abs(r.actualBuildingHeight-r.scanWallHeight)<.001,'actual paint expression matches scan wall height');
 }
 assert.ok(results[0].particleBuildingGrowth<results.at(-1).particleBuildingGrowth);
 assert.ok(results[0].particleModelGrowth<results.at(-1).particleModelGrowth,'model state follows actual zoom rather than frozen initial value');assert.equal(errors.length,0);
 await writeFile(join(work,'height-browser.json'),JSON.stringify({passed:true,results,errors,boundary:'runtime geometry scales and actual paint expressions, no visual or pixel judgement'},null,2));console.log('height browser PASS');
}finally{await browser.close();}
