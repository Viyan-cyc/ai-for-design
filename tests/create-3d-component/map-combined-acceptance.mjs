import {prepareProjectEnvironment,createBuildInput} from '../../skills/generate-3d-scene/scripts/lib/project-environment.mjs';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const project=resolve(process.argv[2]),evidence=resolve(process.argv[3]);await mkdir(evidence,{recursive:true});
const env=prepareProjectEnvironment(project),input=createBuildInput(project,env),checks=[],errors=[];
const pushCheck=checks.push.bind(checks);checks.push=(...items)=>{for(const item of items)console.log('CHECK:',item);return pushCheck(...items);};
const {createServer}=await import(pathToFileURL(join(env.modules,'vite/dist/node/index.js')).href);
let server,browser;
try{
 // Instrument only the independent test input; product/public project remains untouched.
 const file=join(input.source,'src/scene3d/map/create-map-scene.ts');let code=await readFile(file,'utf8');
 assert.ok(code.includes('new MapComponents('));code=code.replace(/(components\s*=\s*new MapComponents\([^;]+;)/,'$1\n(globalThis as any).__combo={map,components};');await writeFile(file,code);
 await writeFile(join(input.source,'combined-test.html'),'<!doctype html><html><body style="margin:0"><div id="map" style="position:relative;width:100vw;height:100vh"></div><div id="panel" style="position:fixed;right:0;top:0;width:290px;max-height:100vh;overflow:auto;background:white;z-index:10"></div><script type="module" src="/src/combined-test.ts"></script></body></html>');
 await writeFile(join(input.source,'src/combined-test.ts'),`import {createScene3D} from './scene3d';
import {Bridge} from './edit/Bridge';import {SaveService} from './edit/SaveService';import {createApp} from 'vue';import Panel from './edit/MapComponentsPanel.vue';
const handle=await createScene3D(document.querySelector('#map')!);const bridge=new Bridge(handle),save=new SaveService(handle,bridge);const app=createApp(Panel,{bridge});app.mount('#panel');
(window as any).combined={handle,bridge,save,dispose(){app.unmount();save.dispose();handle.dispose();}};`);
 server=await createServer({root:input.source,configFile:join(input.source,'vite.config.ts'),configLoader:'native',server:{host:'127.0.0.1',port:17941,strictPort:true}});await server.listen();
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(45000);const evaluate=page.evaluate.bind(page);page.evaluate=async(...args)=>{let timer;try{return await Promise.race([evaluate(...args),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Browser evaluation exceeded 60s')),60000);})]);}finally{clearTimeout(timer);}};page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/shader|VALIDATE_STATUS|WebGLProgram|compile.*error/i.test(m.text()))errors.push(m.text());});
 await page.goto('http://127.0.0.1:17941/combined-test.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.combined&&window.__combo,null,{timeout:90000});
 if(await page.getByRole('button',{name:'收起',exact:true}).count())await page.getByRole('button',{name:'收起',exact:true}).click();
 const snap=()=>page.evaluate(()=>window.combined.handle.serialize().map);
 assert.equal((await snap()).geographicScatter.data.length,JSON.parse(await readFile(join(project,'public/scene3d/scene-data.json'),'utf8')).map.geographicScatter.data.length);assert.equal(await page.locator('[data-geographic-scatter]').count(),1);assert.equal(await page.locator('[aria-label="逻辑散点（非地理图层）"]').count(),0);
 await page.waitForFunction(()=>{const c=document.querySelector('[data-geographic-scatter]');const r=c?.getBoundingClientRect();return c.width>0&&c.height>0&&r.width>0&&r.height>0;});
 const viewport=await page.evaluate(()=>{const c=document.querySelector('[data-geographic-scatter]'),map=window.__combo.map,rect=c.getBoundingClientRect(),base=map.getCanvas().getBoundingClientRect();return {width:c.width,height:c.height,aligned:Math.abs(rect.x-base.x)<1&&Math.abs(rect.y-base.y)<1&&Math.abs(rect.width-base.width)<1&&Math.abs(rect.height-base.height)<1,inside:window.__combo.components.diagnostics().geographicScatter.markers.filter(p=>p.x>=0&&p.y>=0&&p.x<rect.width&&p.y<rect.height).length};});assert.ok(viewport.aligned);assert.ok(viewport.inside>0);checks.push('nonzero canvas aligned to map viewport with visible markers: '+JSON.stringify(viewport));
 checks.push('actual combined scene: geographic overlay, no logical panel');
 // Pure semantic checks are executed from the actual generated module, without GL cycles.
 const unit=await page.evaluate(async()=>{const {validateGeographicScatter:v,projectGeographicMarkers:p}=await import('/src/scene3d/map/geographic-scatter.ts');let rejected=0;for(const bad of [{data:[{id:'x',lng:181,lat:0}]},{data:[{id:'x',lng:0,lat:0},{id:'x',lng:1,lat:1}]},{stopClusterZoom:Infinity},{visible:'yes'}])try{v(bad);}catch{rejected++;}const data=Array.from({length:9},(_,i)=>({id:String(i),lng:i,lat:0}));return {rejected,cluster:p(data,q=>({x:q.lng,y:2}),16,28,9,17),separate:p(data,q=>({x:q.lng,y:2}),17,28,9,17).length,empty:p([],q=>q,16,28,9,17).length};});
 assert.equal(unit.rejected,4);assert.equal(unit.cluster.length,1);assert.equal(unit.cluster[0].x,4);assert.equal(unit.cluster[0].ids.length,9);assert.equal(unit.separate,9);assert.equal(unit.empty,0);checks.push('invalid geographic data rejected; exact grid centroid, stop-zoom and empty semantics');
 console.log('STAGE: disable cluster for projection');
 await page.evaluate(()=>{const c=window.combined.handle.serialize().map;c.geographicScatter.stopClusterZoom=0;c.geographicScatter.heatLinked=false;window.combined.handle.update({map:c});});
 for(const view of (process.env.FOCUS_SCAN==='1'?[]:[{zoom:15.65,pitch:50,bearing:-12},{zoom:16.2,pitch:0,bearing:0},{zoom:15.8,pitch:60,bearing:70,center:[121.499,31.239]}])){
  console.log('STAGE: navigation '+JSON.stringify(view));
  await page.evaluate(v=>{const handle=window.combined.handle,c=handle.serialize().map;Object.assign(c,{...v,pitch:v.pitch===0?c.pitch:v.pitch,view:v.pitch===0?'2d':'3d'});handle.update({map:c});},view);
  await page.waitForFunction(()=>{const {map,components}=window.__combo,m=components.diagnostics().geographicScatter?.markers,p=window.combined.handle.serialize().map.geographicScatter.data;return m?.length===p.length&&m.every((v,i)=>{const q=map.project([p[i].lng,p[i].lat]);return Math.hypot(q.x-v.x,q.y-v.y)<.001;});});
 }
 await page.setViewportSize({width:1100,height:720});await page.waitForFunction(()=>{const canvas=document.querySelector('[data-geographic-scatter]');return canvas.width===Math.round(canvas.parentElement.clientWidth*Math.min(devicePixelRatio,2));});checks.push(process.env.FOCUS_SCAN==='1'?'resize verified; navigation regression not rerun in focused scan check':'exact projection across pan/zoom/pitch/bearing and resize');
 // Restore the initial view so saving tests do not redefine the accepted scene.
 const original=JSON.parse(await readFile(join(project,'public/scene3d/scene-data.json'),'utf8'));
 await page.evaluate(c=>window.combined.handle.update({map:c}),original.map);
 await page.getByRole('checkbox',{name:'地图散点显示',exact:true}).uncheck();assert.equal((await snap()).geographicScatter.visible,false);assert.equal((await snap()).heat.tint.enabled,true);
 await page.evaluate(()=>window.combined.bridge.undo());assert.equal((await snap()).geographicScatter.visible,true);
 await page.getByRole('slider',{name:'地图散点半径',exact:true}).fill('5.2');await page.getByRole('slider',{name:'地图散点半径',exact:true}).dispatchEvent('change');assert.equal((await snap()).geographicScatter.options.pointRadius,5.2);
 await page.evaluate(()=>window.combined.bridge.undo());assert.notEqual((await snap()).geographicScatter.options.pointRadius,5.2);await page.evaluate(()=>window.combined.bridge.redo());assert.equal((await snap()).geographicScatter.options.pointRadius,5.2);checks.push('real panel update, independent visibility, undo/redo');
 const invalid=await page.evaluate(()=>{const {handle,bridge,save}=window.combined,before=JSON.stringify(handle.serialize()),depth=bridge.getState().undoDepth,bad=handle.serialize();bad.map.geographicScatter.data[0].lng=999;let rejected=false;try{save.importText(JSON.stringify(bad));}catch{rejected=true;}return {rejected,same:before===JSON.stringify(handle.serialize()),history:depth===bridge.getState().undoDepth};});assert.deepEqual(invalid,{rejected:true,same:true,history:true});
 await page.evaluate(()=>{const {handle,bridge}=window.combined;bridge.commit('empty',()=>{const map=handle.serialize().map;map.geographicScatter.data=[];handle.update({map});});});await page.waitForFunction(()=>window.__combo.components.diagnostics().geographicScatter.markers.length===0);await page.evaluate(()=>window.combined.bridge.undo());checks.push('invalid imports preserve state/history; empty data and undo');
 await page.waitForFunction(()=>{let count=0;window.combined.handle.internals.sceneEngine.getObject('oriental_pearl')?.traverse(o=>{if(o.isMesh)count++;});return count>0;},null,{timeout:60000});
 const model=await page.evaluate(()=>{let meshes=0;window.combined.handle.internals.sceneEngine.getObject('oriental_pearl').traverse(o=>{if(o.isMesh)meshes++;});return {meshes};});assert.ok(model.meshes>1);checks.push('real asynchronous Pearl GLB loaded (not Box)');
 if(process.env.CHECK_FIVE_STYLE==='1'){await page.waitForFunction(()=>window.combined.handle.internals.scene.getObjectByName('surface_particle_scan')?.getState().count>0,null,{timeout:60000});const scan=await page.evaluate(()=>{const s=window.combined.handle.internals.scene.getObjectByName('surface_particle_scan');s.pause();s.seek(.5);const paused=s.getState();s.setOptions({enabled:false});const hidden=!s.visible;s.setOptions({enabled:true});s.restart();const shaders=window.combined.handle.internals.rendererEngine.renderer.info.programs.map(p=>p.diagnostics?.runnable);return {paused,hidden,options:s.getOptions(),shaders};});assert.ok(scan.paused.count>0);assert.equal(scan.paused.progress,.5);assert.equal(scan.hidden,true);assert.equal(scan.options.maxPoints,12000);assert.equal(scan.options.color1,'#1FC7F5');assert.ok(!scan.shaders.includes(false));checks.push('scan real sampled surfaces, reference defaults, pause/seek/off/restart and Three shaders runnable: '+scan.paused.count);}
 if(process.env.CHECK_HEAT_LINK==='1'){
 const linked=await page.evaluate(()=>{const {handle}=window.combined,{components}=window.__combo;const before=handle.serialize().map;const shown=components.diagnostics().geographicScatter.markers.flatMap(m=>m.ids);const changed=structuredClone(before);changed.heat.data=[];handle.update({map:changed});return {before,shown};});
 await page.waitForFunction(()=>window.__combo.components.diagnostics().geographicScatter.markers.length===0);
 assert.ok(linked.shown.length>0);assert.ok(linked.shown.every(id=>id.startsWith('hot-')));
 await page.evaluate(c=>window.combined.handle.update({map:c}),linked.before);
 checks.push('heat-linked high-value event candidates; clearing heat hides every linked point; restoration preserves source candidates');
 }
 if(process.env.CHECK_SCAN_SURFACES==='1'){
 await page.waitForFunction(()=>window.combined.handle.internals.scene.getObjectByName('surface_particle_scan')?.userData.surfaceDiagnostics?.completeFeatures>0,null,{timeout:60000});
 const surfaces=await page.evaluate(()=>{const scan=window.combined.handle.internals.scene.getObjectByName('surface_particle_scan'),g=scan.children[0].geometry,p=g.getAttribute('position'),n=g.getAttribute('aSurfaceNormal'),k=g.getAttribute('aKind');let walls=0,roofs=0,models=0;const heights=new Set();for(let i=0;i<k.count;i++){if(k.getX(i)===1){if(Math.abs(n.getY(i))<.1){walls++;heights.add(Math.round(p.getY(i)));}else roofs++;}if(k.getX(i)===2)models++;}return {...scan.userData.surfaceDiagnostics,walls,roofs,models,heightRows:heights.size};});
 assert.ok(surfaces.completeFeatures>0);assert.ok(surfaces.walls>0&&surfaces.roofs>0&&surfaces.models>0&&surfaces.heightRows>3);checks.push('full rounded footprints and multi-height wall/roof/GLB particles: '+JSON.stringify(surfaces));
 }
 await page.evaluate(()=>window.combined.save.save());assert.equal(await page.evaluate(()=>window.combined.save.status.value),'已保存到源码');const saved=JSON.parse(await readFile(join(input.source,'public/scene3d/scene-data.json'),'utf8'));assert.equal(saved.map.geographicScatter.options.pointRadius,5.2);assert.deepEqual(saved.map.geographicScatter.data,original.map.geographicScatter.data);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.combined,null,{timeout:90000});assert.equal((await snap()).geographicScatter.options.pointRadius,5.2);checks.push('SaveService writes independent source and reload preserves geographic data/options');
 await page.evaluate(()=>window.combined.dispose());assert.equal(await page.locator('[data-geographic-scatter]').count(),0);assert.equal(await page.locator('.maplibregl-canvas').count(),0);assert.deepEqual(errors,[]);checks.push('dispose removes overlay and map; no uncaught page errors');
 await writeFile(join(evidence,'browser.json'),JSON.stringify({status:'passed',checks,model,errors,screenshots:false,visual:'user-pending'},null,2));console.log(JSON.stringify({status:'passed',checks,model}));
}catch(error){await writeFile(join(evidence,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,checks,errors},null,2));throw error;}
finally{await browser?.close();await server?.close();input.dispose();}
