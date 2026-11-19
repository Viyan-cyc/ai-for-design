import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const work=resolve(process.argv[2]);const browser=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 const server=JSON.parse(await readFile(join(work,'server.json'),'utf8'));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__scene3d&&window.__performanceScene?.scan?.getState().count>0,null,{timeout:60000});
 await page.waitForTimeout(3000);
 const startup=await page.evaluate(async()=>{const s=window.__performanceScene.scan;const a=s.getState();await new Promise(r=>setTimeout(r,500));return {before:a,after:s.getState(),surfaces:s.userData.surfaceDiagnostics};});
 const results=[];
 for(const mode of ['map','grid','tint','scatter','scan','map','grid','tint','scatter','scan']){
  results.push(await page.evaluate(async mode=>{
   const {map,scan}=window.__performanceScene,h=window.__scene3d,loop=h.internals.renderLoop;
   window.__perfConfig??=h.serialize().map;const c=structuredClone(window.__perfConfig);
   c.heat.gridVisible=['grid','tint','scatter','scan'].includes(mode);c.heat.tint.enabled=['tint','scatter','scan'].includes(mode);
   if(c.geographicScatter)c.geographicScatter.visible=['scatter','scan'].includes(mode);
   h.update({map:c});scan.setOptions({enabled:mode==='scan'});scan.restart();
   // Equal demand for all variants, same viewport/data/camera. Measure delivered frame intervals, not GPU time.
   const stop=loop.onFrame(()=>{},true);await new Promise(r=>setTimeout(r,2500));
   const intervals=[];let previous=0;const off=loop.onAfterFrame(()=>{const t=performance.now();if(previous)intervals.push(t-previous);previous=t;});
   await new Promise(r=>setTimeout(r,5000));off();stop();intervals.sort((a,b)=>a-b);
   return {mode,frames:intervals.length+1,p50:intervals[Math.floor(intervals.length*.5)]??null,p95:intervals[Math.floor(intervals.length*.95)]??null,stats:loop.getStats(),scan:scan.getState()};
  },mode));
 }
 const pause=await page.evaluate(async()=>{const {scan}=window.__performanceScene;const loop=window.__scene3d.internals.renderLoop;scan.pause();await new Promise(r=>setTimeout(r,500));const a=scan.getState().progress;await new Promise(r=>setTimeout(r,500));const b=scan.getState().progress;const idle=loop.getStats();scan.play();await new Promise(r=>setTimeout(r,500));return {unchanged:a===b,idle,resumed:scan.getState().progress!==b};});
 await writeFile(join(work,'browser-performance-warm.json'),JSON.stringify({startup,results,pause,errors,limits:'Headless Edge 1440x900; delivered frame intervals under forced identical demand; not GPU timing or visual acceptance'},null,2));
 console.log(JSON.stringify({startup,results,pause,errors}));
}finally{await browser.close();}
