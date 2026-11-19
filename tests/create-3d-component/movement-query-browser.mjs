import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
const w=resolve(process.argv[2]),url=process.argv[3];await mkdir(w,{recursive:true});const b=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});
try{const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>window.__performanceScene?.scan.getState().count>0 && window.__performanceScene.scan.userData.surfaceDiagnostics?.completeFeatures>0,null,{timeout:90000});
 const result=await p.evaluate(async()=>{
  const {map,scan}=window.__performanceScene;scan.pause();const delay=ms=>new Promise(r=>setTimeout(r,ms));await delay(4500);
  let queries=[],gaps=[],commits=[],started=0,active=false,last=performance.now(),alive=true;
  const original=map.queryRenderedFeatures.bind(map),set=scan.setDataAsync.bind(scan);
  map.queryRenderedFeatures=(...args)=>{const t=performance.now(),out=original(...args);if(active)queries.push({ms:performance.now()-t,count:out.length,layers:args[0]?.layers??args[1]?.layers,partition:args[0]?.filter?.[2]??null});return out;};
  scan.setDataAsync=async(...args)=>{const ok=await set(...args);if(active&&ok)commits.push(performance.now()-started);return ok;};
  const frame=()=>{const t=performance.now();if(active)gaps.push(t-last);last=t;if(alive)requestAnimationFrame(frame);};requestAnimationFrame(frame);
  const moves=[];for(const dx of [100,-100,100]){await new Promise(requestAnimationFrame);queries=[];gaps=[];commits=[];const beforeRevision=scan.userData.surfaceCollectionRevision;started=performance.now();active=true;map.panBy([dx,0],{duration:0});await delay(3500);for(let wait=0;wait<45&&!((commits.length||scan.userData.surfaceCollectionRevision>beforeRevision)&&scan.userData.surfaceDiagnostics?.completeFeatures>0);wait++)await delay(100);active=false;moves.push({dx,beforeRevision,afterRevision:scan.userData.surfaceCollectionRevision,queryMaxMs:Math.max(0,...queries.map(q=>q.ms)),queryTotalMs:queries.reduce((sum,q)=>sum+q.ms,0),movementMaxFrameGap:Math.max(0,...gaps),commits,queries,surfaces:scan.userData.surfaceDiagnostics,state:scan.getState()});}
  alive=false;map.queryRenderedFeatures=original;scan.setDataAsync=set;return moves;
 });await writeFile(join(w,'movement.json'),JSON.stringify({result,errors},null,2));assert.deepEqual(errors,[]);for(const m of result){assert.ok(m.commits.length>0||m.afterRevision>m.beforeRevision,'move must complete a fresh collection; identical geometry need not rebuild particles');assert.ok(m.surfaces.completeFeatures>0,'move must restore complete building geometry');}console.log(JSON.stringify(result.map(({queries,...m})=>m)));
}finally{await b.close();}
