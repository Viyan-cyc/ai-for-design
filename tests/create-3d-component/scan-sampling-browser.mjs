import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
const w=resolve(process.argv[2]),url=process.argv[3];const b=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});
try{const page=await b.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);await page.waitForFunction(()=>window.__performanceScene?.scan.getState().count>0,null,{timeout:90000});
const result=await page.evaluate(async()=>{
 const {map,scan}=window.__performanceScene;scan.pause();const camera={pitch:map.getPitch(),bearing:map.getBearing(),zoom:map.getZoom()};
 await new Promise(r=>setTimeout(r,2500));let data;const queries=[];const queryOriginal=map.queryRenderedFeatures.bind(map);map.queryRenderedFeatures=(...args)=>{const t=performance.now();const value=queryOriginal(...args);queries.push(performance.now()-t);return value;};const asyncOriginal=scan.setDataAsync.bind(scan),times=[];let last=performance.now(),running=true;
 const frames=()=>{const now=performance.now();times.push(now-last);last=now;if(running)requestAnimationFrame(frames);};requestAnimationFrame(frames);
 let movedResolve;const movedDone=new Promise(r=>movedResolve=r);let calls=0;
 scan.setDataAsync=async(d,cancel)=>{data=d;calls++;const t=performance.now();const ok=await asyncOriginal(d,cancel);if(ok)movedResolve({totalMs:performance.now()-t,ok});return ok;};
 times.length=0;map.panBy([100,0],{duration:0});const moved=await Promise.race([movedDone,new Promise((_,reject)=>setTimeout(()=>reject(Error('movement sampling not completed')),15000))]);
 const movementGaps=[...times];scan.setDataAsync=asyncOriginal;await new Promise(r=>setTimeout(r,2500));
 const hash=()=>{const g=scan.children[0].geometry;let h=2166136261;for(const key of ['position','aSurfaceNormal','aKind']){const a=g.getAttribute(key).array;for(const byte of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^byte,16777619);}return h>>>0;};
 const measure=async(fn)=>{times.length=0;await new Promise(requestAnimationFrame);times.length=0;const t=performance.now();await fn();const ms=performance.now()-t;await new Promise(requestAnimationFrame);return {ms,maxFrameGap:Math.max(...times),frames:times.length,hash:hash(),state:scan.getState()};};
 const sync=await measure(()=>scan.setData(data));const sliced=await measure(()=>asyncOriginal(data));running=false;
 // A user-controlled camera change remains in force, not replaced by defaults on updates.
 map.jumpTo({pitch:51,bearing:23});await new Promise(r=>setTimeout(r,300));const userCamera={pitch:map.getPitch(),bearing:map.getBearing()};
 map.queryRenderedFeatures=queryOriginal;return {camera,userCamera,queryMaxMs:Math.max(0,...queries),moved,movementMaxFrameGap:Math.max(...movementGaps),calls,sync,sliced,surfaces:scan.userData.surfaceDiagnostics};
});await writeFile(join(w,'sampling-browser-observed.json'),JSON.stringify({result,errors},null,2));assert.equal(result.camera.pitch,45);assert.equal(result.camera.bearing,0);assert.equal(result.userCamera.pitch,51);assert.equal(result.userCamera.bearing,23);assert.equal(result.sync.hash,result.sliced.hash);assert.equal(result.sync.state.count,result.sliced.state.count);assert.ok(result.sliced.frames>1);assert.ok(result.sliced.maxFrameGap<result.sync.maxFrameGap);assert.equal(errors.length,0);
await writeFile(join(w,'sampling-browser.json'),JSON.stringify({passed:true,...result,errors,boundary:'same captured moved data and component options; frame availability, not visual or GPU acceptance'},null,2));console.log(JSON.stringify(result));
}finally{await b.close();}
